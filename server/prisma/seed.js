import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { toSegments } from '../src/lib/time.js';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 数据文件位置：本地开发在 client/public，容器里可能只有 client/dist（构建产物）
const CANDIDATES = [
  process.env.SEED_DATA,
  path.resolve(__dirname, '../../client/public/data/shops.json'),
  path.resolve(__dirname, '../../client/dist/data/shops.json'),
].filter(Boolean);
const dataPath = CANDIDATES.find((p) => fs.existsSync(p));
if (!dataPath) {
  console.error('找不到 shops.json，已尝试：\n  ' + CANDIDATES.join('\n  '));
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const str = (v) => (Array.isArray(v) ? v.filter(Boolean).join(' ') : v == null ? '' : String(v));

/** 校外街区归属，与前端 areas.js 保持一致 */
function areaOf(address) {
  const a = String(address || '');
  if (/美食街/.test(a)) return '科大美食街';
  if (/地下通道|过街通道|地下过街/.test(a)) return '地下通道';
  if (/龙祥商业街|龙祥街|龙翔街/.test(a)) return /商业街/.test(a) ? '龙祥商业街' : '龙祥街';
  if (/开元大道/.test(a)) return '开元大道';
  return '其他';
}

const AREAS = ['科大美食街', '地下通道', '龙祥商业街', '龙祥街', '开元大道'];

/** 精选规则：评分≥3.8、同街区同品类≤3、1 公里内约 60%、每街区保底 6 家、总数≤150 */
function featuredIds(shops) {
  const sorted = [...shops].sort(
    (a, b) => (b.amapRating ?? 0) - (a.amapRating ?? 0) || (a.distance ?? 1e9) - (b.distance ?? 1e9)
  );
  const picked = new Set();
  const catCount = new Map();
  const areaCount = new Map();
  const MAX = 150;
  const NEAR_CAP = 90;
  const PER_CAT = 3;

  const take = (s) => {
    if (picked.has(s.id)) return false;
    const area = areaOf(s.address);
    const key = `${area}|${s.category || ''}`;
    if ((catCount.get(key) || 0) >= PER_CAT) return false;
    picked.add(s.id);
    catCount.set(key, (catCount.get(key) || 0) + 1);
    areaCount.set(area, (areaCount.get(area) || 0) + 1);
    return true;
  };

  const good = sorted.filter((s) => (s.amapRating ?? 0) >= 3.8);
  for (const s of good) {
    if (picked.size >= NEAR_CAP) break;
    if ((s.distance ?? 1e9) <= 1000) take(s);
  }
  for (const s of good) {
    if (picked.size >= MAX) break;
    if ((s.distance ?? 1e9) > 1000) take(s);
  }
  for (const area of AREAS) {
    for (const s of sorted) {
      if ((areaCount.get(area) || 0) >= 6 || picked.size >= MAX) break;
      if (areaOf(s.address) !== area) continue;
      if ((s.amapRating ?? 0) < 3.3) break;
      take(s);
    }
  }
  return picked;
}

function shopRow(raw, kind, group, featured) {
  const address = str(raw.address);
  const openHours = str(raw.openHours) || str(raw.openTime);
  return {
    id: String(raw.id),
    name: str(raw.name),
    shortName: str(raw.shortName),
    kind,
    group,
    category: str(raw.category),
    address,
    area: group === 'nearby' ? areaOf(address) : '',
    lng: Number(raw.lng),
    lat: Number(raw.lat),
    distance: Number.isFinite(Number(raw.distance)) ? Number(raw.distance) : null,
    amapRating: Number.isFinite(Number(raw.amapRating)) ? Number(raw.amapRating) : null,
    amapCost: Number.isFinite(Number(raw.amapCost)) ? Number(raw.amapCost) : null,
    openHours,
    openSegments: toSegments(openHours),
    tel: str(raw.tel),
    photo: str(raw.photo),
    photos: JSON.stringify(Array.isArray(raw.photos) ? raw.photos : []),
    isFeatured: featured.has(raw.id),
    isOnCampus: kind === 'canteen' || kind === 'campusShop' || raw.isOnCampus === true,
  };
}

async function seedShops() {
  const nearby = data.shops || [];
  const featured = featuredIds(nearby);
  const rows = [
    ...(data.canteens || []).map((c) => shopRow(c, 'canteen', 'campus', featured)),
    ...(data.campusShops || []).map((c) => shopRow(c, 'campusShop', 'campus', featured)),
    ...nearby.map((c) => shopRow(c, 'shop', 'nearby', featured)),
  ].filter((r) => r.id && Number.isFinite(r.lng) && Number.isFinite(r.lat));

  for (const row of rows) {
    await prisma.shop.upsert({ where: { id: row.id }, update: row, create: row });
  }
  console.log(`已入库店铺：${rows.length} 家（精选 ${featured.size} 家）`);
}

const list = (v, max) =>
  (Array.isArray(v) ? v : String(v ?? '').split(','))
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, max)
    .join(',');

async function seedDishes() {
  const sources = [...(data.canteens || []), ...(data.campusShops || [])];
  let added = 0;
  for (const shop of sources) {
    const source = shop.dishes || [];
    if (!source.length) continue;
    const existing = await prisma.dish.findMany({
      where: { restaurantId: shop.id },
      select: { name: true },
    });
    const known = new Set(existing.map((d) => d.name));
    const rows = [];
    for (const d of source) {
      const name = String(d.name || '').slice(0, 20);
      if (!name || known.has(name)) continue;
      known.add(name);
      rows.push({
        restaurantId: shop.id,
        name,
        price: Number.isFinite(Number(d.price)) ? Number(d.price) : null,
        stall: String(d.stall || '').slice(0, 20),
        spicy: Math.min(3, Math.max(0, Number(d.spicy) || 0)),
        mealSlots: list(d.mealSlots, 4),
        tags: list(d.tags, 6),
        status: 'published',
      });
    }
    if (rows.length) {
      await prisma.dish.createMany({ data: rows });
      added += rows.length;
    }
  }
  console.log(`已导入菜品：${added} 条`);
}

/** 演示评价：为每条评价建一个演示用户（随机密码、不可登录使用），保留展示昵称 */
async function seedDemoReviews() {
  const rows = data.reviews || [];
  if (!rows.length) {
    console.log('演示评价：0 条');
    return;
  }
  const userIds = new Map();
  let added = 0;
  for (const r of rows) {
    const targetId = String(r.targetId || '');
    const nickname = String(r.user || '同学').slice(0, 16);
    if (!targetId) continue;

    const shop = await prisma.shop.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!shop) continue;

    if (!userIds.has(nickname)) {
      let user = await prisma.user.findUnique({ where: { username: nickname } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            username: nickname,
            passwordHash: await bcrypt.hash('demo-' + crypto.randomUUID(), 10),
          },
        });
      }
      userIds.set(nickname, user.id);
    }

    const rating = Number(r.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    const date = String(r.date || '').match(/^\d{4}-\d{2}-\d{2}$/) ? r.date : '2026-10-01';
    await prisma.review.upsert({
      where: { userId_targetId: { userId: userIds.get(nickname), targetId } },
      update: { rating, content: String(r.content || '').slice(0, 200) },
      create: {
        userId: userIds.get(nickname),
        targetId,
        rating,
        content: String(r.content || '').slice(0, 200),
        createdAt: new Date(`${date}T12:00:00Z`),
      },
    });
    added += 1;
  }
  console.log(`已导入演示评价：${added} 条（昵称 ${userIds.size} 个）`);
}

async function seedAdmin() {
  const username = String(process.env.ADMIN_USERNAME || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!username || password.length < 6) {
    console.warn('跳过管理员种子：请在 .env 配置 ADMIN_USERNAME 与至少 6 位的 ADMIN_PASSWORD');
    return;
  }
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    if (exists.role !== 'admin') {
      await prisma.user.update({ where: { id: exists.id }, data: { role: 'admin' } });
    }
    console.log(`管理员已存在：${username}（role=admin）`);
    return;
  }
  await prisma.user.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10), role: 'admin' },
  });
  console.log(`已创建管理员：${username}`);
}

try {
  await seedAdmin();
  await seedShops();
  await seedDishes();
  await seedDemoReviews();
  const counts = await Promise.all([
    prisma.shop.count(),
    prisma.dish.count(),
    prisma.review.count(),
    prisma.user.count(),
  ]);
  console.log(`统计：店铺 ${counts[0]} / 菜品 ${counts[1]} / 评价 ${counts[2]} / 用户 ${counts[3]}`);
} finally {
  await prisma.$disconnect();
}