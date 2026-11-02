/**
 * 全部 API 路由（统一挂载在 /api/v1）。
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from './db.js';
import { ok, wrap, badRequest, notFound, pageParams } from './http.js';
import {
  hashPassword, verifyPassword, issueSession, rotateRefresh, revokeFromRequest,
  requireAuth, softAuth, requireAdmin, publicUser,
} from './auth.js';
import { queryShops, shopDetail, mapShops, statsOverview, FOOD_TAGS } from './shops.js';
import { todayKey, streakOf } from './lib/time.js';
import { reviewAgg, ratingOf } from './rating.js';

const NAME_RE = /^[\w\u4e00-\u9fa5]{2,16}$/;
const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'night'];
const REVIEW_TAGS = ['好吃', '份量足', '性价比高', '上菜快', '环境干净', '有点辣', '要排队', '有点咸'];

function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest(r.error.issues[0]?.message || '参数不合法');
  return r.data;
}

const splitCsv = (v) => (Array.isArray(v) ? v : String(v || '').split(',').map((s) => s.trim()).filter(Boolean));
const splitList = (v) => (v ? String(v).split(',').filter(Boolean) : []);

async function audit(actorId, action, targetId, detail) {
  try {
    await prisma.auditLog.create({ data: { actorId: actorId ?? null, action, targetId: String(targetId || ''), detail: String(detail || '') } });
  } catch { /* 审计失败不影响主流程 */ }
}

function reviewView(row, viewerId) {
  return {
    id: `s-${row.id}`,
    targetId: row.targetId,
    user: row.user.username,
    rating: row.rating,
    content: row.content,
    tags: splitList(row.tags),
    date: row.createdAt.toISOString().slice(0, 10),
    mine: viewerId != null && row.userId === viewerId,
  };
}

function dishView(row) {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    name: row.name,
    price: row.price,
    stall: row.stall,
    spicy: row.spicy,
    mealSlots: splitList(row.mealSlots),
    tags: splitList(row.tags),
    status: row.status,
    note: row.note,
    date: row.createdAt.toISOString().slice(0, 10),
    submittedBy: row.creator?.username || null,
  };
}

function readDishInput(body) {
  const restaurantId = String(body.restaurantId ?? '').trim();
  const name = String(body.name ?? '').trim();
  const stall = String(body.stall ?? '').trim();
  const rawPrice = body.price;
  const price = rawPrice === '' || rawPrice == null ? null : Number(rawPrice);
  const spicy = Number(body.spicy ?? 0);
  const slots = Array.isArray(body.mealSlots) ? body.mealSlots.filter((s) => MEAL_SLOTS.includes(s)) : [];
  const tags = (Array.isArray(body.tags) ? body.tags : String(body.tags ?? '').split(','))
    .map((t) => String(t).trim()).filter(Boolean);

  if (!restaurantId || restaurantId.length > 40) return { error: '缺少店铺 id' };
  if (!name || name.length > 20) return { error: '菜名需 1–20 个字' };
  if (stall.length > 20) return { error: '窗口名最多 20 个字' };
  if (price !== null && (!Number.isInteger(price) || price < 1 || price > 999)) return { error: '价格需为 1–999 的整数，或留空' };
  if (!Number.isInteger(spicy) || spicy < 0 || spicy > 3) return { error: '辣度需为 0–3' };
  if (tags.length > 6 || tags.some((t) => t.length > 8)) return { error: '最多 6 个标签，每个不超过 8 字' };
  return { data: { restaurantId, name, stall, price, spicy, mealSlots: slots.join(','), tags: tags.join(',') } };
}

/* ---------------- 校验 schema ---------------- */
const credentials = z.object({
  username: z.string().regex(NAME_RE, '用户名需 2–16 位，可用中文、字母、数字、下划线'),
  password: z.string().min(6, '密码需 6–64 位').max(64, '密码需 6–64 位'),
});
const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().max(200).optional().default(''),
  tags: z.array(z.enum(REVIEW_TAGS)).max(3).optional().default([]),
});
const shopsQuery = z.object({
  q: z.string().max(60).optional().default(''),
  scope: z.enum(['', 'campus', 'nearby']).optional().default(''),
  kind: z.enum(['', 'canteen', 'campusShop', 'shop']).optional().default(''),
  area: z.string().max(20).optional().default(''),
  tags: z.string().max(120).optional().default(''),
  costMax: z.coerce.number().int().min(0).max(999).optional(),
  featured: z.coerce.boolean().optional().default(false),
  open: z.coerce.boolean().optional().default(false),
  sort: z.enum(['', 'rating', 'popular', 'value', 'distance']).optional().default(''),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const api = Router();

/* ---------------- 认证 ---------------- */
api.post('/auth/register', wrap(async (req, res) => {
  const { username, password } = parse(credentials, req.body);
  if (await prisma.user.findUnique({ where: { username } })) throw badRequest('这个用户名已经被用了');
  const user = await prisma.user.create({ data: { username, passwordHash: await hashPassword(password) } });
  const accessToken = await issueSession(req, res, user);
  await audit(user.id, 'register', username, '');
  return ok(res, { accessToken, user: publicUser(user) });
}));

api.post('/auth/login', wrap(async (req, res) => {
  const { username, password } = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw badRequest('用户名或密码不对');
  const accessToken = await issueSession(req, res, user);
  await audit(user.id, 'login', username, '');
  return ok(res, { accessToken, user: publicUser(user) });
}));

api.post('/auth/refresh', wrap(async (req, res) => {
  const { accessToken, user } = await rotateRefresh(req, res);
  return ok(res, { accessToken, user: publicUser(user) });
}));

api.post('/auth/logout', wrap(async (req, res) => {
  await revokeFromRequest(req, res);
  return ok(res, { ok: true });
}));

api.get('/auth/me', requireAuth, wrap(async (req, res) => ok(res, { user: publicUser(req.user) })));

/* ---------------- 店铺目录 ---------------- */
api.get('/shops', wrap(async (req, res) => {
  const p = parse(shopsQuery, req.query);
  const { items, total } = await queryShops({
    q: p.q, scope: p.scope, kind: p.kind, area: p.area,
    tags: splitCsv(p.tags), costMax: p.costMax ?? null, featured: p.featured, open: p.open,
    sort: p.sort, limit: p.limit, offset: p.offset,
  });
  return ok(res, items, { total, limit: p.limit, offset: p.offset });
}));

api.get('/shops/map', wrap(async (req, res) => {
  const items = await mapShops(String(req.query.bbox || ''));
  return ok(res, items, { total: items.length });
}));

api.get('/shops/:id', softAuth, wrap(async (req, res) => {
  const detail = await shopDetail(String(req.params.id), req.user?.id);
  if (!detail) throw notFound('店铺不存在');
  return ok(res, detail);
}));

/* ---------------- 批量评分 ---------------- */
api.get('/ratings', wrap(async (req, res) => {
  const ids = splitCsv(req.query.ids).slice(0, 200);
  if (!ids.length) return ok(res, {});
  const shops = await prisma.shop.findMany({ where: { id: { in: ids } }, select: { id: true, amapRating: true } });
  const agg = await reviewAgg(shops.map((s) => s.id));
  const out = {};
  for (const s of shops) out[s.id] = ratingOf(s, agg);
  return ok(res, out);
}));

/* ---------------- 榜单 ---------------- */
api.get('/rankings', wrap(async (req, res) => {
  const scope = ['campus', 'nearby'].includes(String(req.query.scope)) ? String(req.query.scope) : 'campus';
  const by = ['rating', 'popular', 'value'].includes(String(req.query.by)) ? String(req.query.by) : 'rating';
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const { items } = await queryShops({ scope, sort: by, limit, offset: 0 });
  return ok(res, items.map((s, i) => ({ rank: i + 1, ...s })), { scope, by });
}));

/* ---------------- 统计 / 标签 ---------------- */
api.get('/stats/overview', wrap(async (_req, res) => ok(res, await statsOverview())));
api.get('/tags', wrap(async (_req, res) => ok(res, { tags: FOOD_TAGS })));

/* ---------------- 评价 ---------------- */
api.get('/reviews', softAuth, wrap(async (req, res) => {
  const targetId = req.query.targetId ? String(req.query.targetId) : '';
  const rows = await prisma.review.findMany({
    where: targetId ? { targetId } : {},
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: targetId ? 200 : 1000,
  });
  return ok(res, rows.map((r) => reviewView(r, req.user?.id)));
}));

api.put('/reviews/:targetId', requireAuth, wrap(async (req, res) => {
  const targetId = String(req.params.targetId || '').slice(0, 40);
  if (!targetId) throw badRequest('缺少店铺 id');
  const body = parse(reviewSchema, req.body);
  const row = await prisma.review.upsert({
    where: { userId_targetId: { userId: req.user.id, targetId } },
    update: { rating: body.rating, content: body.content.trim(), tags: body.tags.join(',') },
    create: { userId: req.user.id, targetId, rating: body.rating, content: body.content.trim(), tags: body.tags.join(',') },
    include: { user: true },
  });
  return ok(res, reviewView(row, req.user.id));
}));

api.delete('/reviews/:targetId', requireAuth, wrap(async (req, res) => {
  await prisma.review.deleteMany({ where: { userId: req.user.id, targetId: String(req.params.targetId) } });
  return ok(res, { ok: true });
}));

/* ---------------- 收藏 ---------------- */
async function favoriteIds(userId) {
  const rows = await prisma.favorite.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  return rows.map((r) => r.targetId);
}
api.get('/favorites', requireAuth, wrap(async (req, res) => ok(res, { favorites: await favoriteIds(req.user.id) })));
api.put('/favorites/:targetId', requireAuth, wrap(async (req, res) => {
  const targetId = String(req.params.targetId || '').slice(0, 40);
  if (!targetId) throw badRequest('缺少店铺 id');
  await prisma.favorite.upsert({ where: { userId_targetId: { userId: req.user.id, targetId } }, update: {}, create: { userId: req.user.id, targetId } });
  return ok(res, { favorites: await favoriteIds(req.user.id) });
}));
api.delete('/favorites/:targetId', requireAuth, wrap(async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user.id, targetId: String(req.params.targetId) } });
  return ok(res, { favorites: await favoriteIds(req.user.id) });
}));

/* ---------------- 打卡 ---------------- */

api.get('/checkins/stats', wrap(async (req, res) => {
  const targetId = req.query.targetId ? String(req.query.targetId).slice(0, 40) : '';
  const today = todayKey();
  if (targetId) {
    const [dayCount, total] = await Promise.all([
      prisma.checkin.count({ where: { targetId, date: today } }),
      prisma.checkin.count({ where: { targetId } }),
    ]);
    return ok(res, { targetId, today, todayCount: dayCount, total });
  }
  const [todayTotal, total, todayRows] = await Promise.all([
    prisma.checkin.count({ where: { date: today } }),
    prisma.checkin.count(),
    prisma.checkin.groupBy({ by: ['targetId'], where: { date: today }, _count: { _all: true } }),
  ]);
  return ok(res, { today, todayTotal, total, targets: todayRows.map((r) => ({ targetId: r.targetId, count: r._count._all })) });
}));

api.get('/checkins/mine', requireAuth, wrap(async (req, res) => {
  const today = todayKey();
  const rows = await prisma.checkin.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 120 });
  return ok(res, {
    today,
    todayIds: rows.filter((r) => r.date === today).map((r) => r.targetId),
    total: rows.length,
    streak: streakOf(rows.map((r) => r.date), today),
    items: rows.map((r) => ({ targetId: r.targetId, date: r.date, createdAt: r.createdAt })),
  });
}));

api.post('/checkins', requireAuth, wrap(async (req, res) => {
  const targetId = String(req.body.targetId ?? '').trim().slice(0, 40);
  if (!targetId) throw badRequest('缺少店铺 id');
  const today = todayKey();
  const existing = await prisma.checkin.findUnique({ where: { userId_targetId_date: { userId: req.user.id, targetId, date: today } } });
  if (!existing) await prisma.checkin.create({ data: { userId: req.user.id, targetId, date: today } });
  const [todayCount, total, allDays] = await Promise.all([
    prisma.checkin.count({ where: { targetId, date: today } }),
    prisma.checkin.count({ where: { targetId } }),
    prisma.checkin.findMany({ where: { userId: req.user.id }, select: { date: true } }),
  ]);
  return ok(res, {
    targetId, date: today, already: !!existing, todayCount, total,
    mine: { streak: streakOf(allDays.map((r) => r.date), today), total: allDays.length },
  });
}));

api.delete('/checkins/:targetId', requireAuth, wrap(async (req, res) => {
  const r = await prisma.checkin.deleteMany({ where: { userId: req.user.id, targetId: String(req.params.targetId), date: todayKey() } });
  return ok(res, { ok: true, removed: r.count });
}));

/* ---------------- 菜品（公开） ---------------- */
api.get('/dishes', wrap(async (req, res) => {
  const restaurantId = req.query.restaurantId ? String(req.query.restaurantId).slice(0, 40) : '';
  const rows = await prisma.dish.findMany({
    where: restaurantId ? { restaurantId, status: 'published' } : { status: 'published' },
    orderBy: [{ restaurantId: 'asc' }, { id: 'asc' }],
    take: 500,
  });
  return ok(res, rows.map(dishView));
}));

/* ---------------- 用户提交菜品 ---------------- */
api.get('/submissions/mine', requireAuth, wrap(async (req, res) => {
  const rows = await prisma.dish.findMany({ where: { createdBy: req.user.id }, orderBy: { createdAt: 'desc' }, take: 30 });
  return ok(res, rows.map(dishView));
}));

api.post('/submissions', requireAuth, wrap(async (req, res) => {
  const { data, error } = readDishInput(req.body);
  if (error) throw badRequest(error);
  const dup = await prisma.dish.findFirst({ where: { restaurantId: data.restaurantId, name: data.name, status: 'pending' } });
  if (dup) throw badRequest('已有同名菜品在等审核，不用重复提交');
  const row = await prisma.dish.create({ data: { ...data, status: 'pending', createdBy: req.user.id } });
  await audit(req.user.id, 'submit-dish', row.id, data.name);
  return ok(res, dishView(row));
}));

/* ---------------- 管理员 ---------------- */
api.get('/admin/submissions', requireAuth, requireAdmin, wrap(async (_req, res) => {
  const rows = await prisma.dish.findMany({ where: { status: 'pending' }, include: { creator: true }, orderBy: { createdAt: 'asc' }, take: 100 });
  return ok(res, rows.map(dishView));
}));

api.patch('/admin/submissions/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const action = String(req.body.action || '');
  if (!Number.isInteger(id)) throw badRequest('参数不对');
  if (action !== 'approve' && action !== 'reject') throw badRequest('action 只能是 approve 或 reject');
  const row = await prisma.dish.findUnique({ where: { id } });
  if (!row) throw notFound('找不到这条提交');
  if (row.status !== 'pending') throw badRequest('这条提交已经处理过了');
  const note = String(req.body.note ?? '').trim().slice(0, 60);
  const updated = await prisma.dish.update({
    where: { id },
    data: action === 'approve' ? { status: 'published', note: '' } : { status: 'rejected', note },
    include: { creator: true },
  });
  await audit(req.user.id, action === 'approve' ? 'approve-dish' : 'reject-dish', id, note);
  return ok(res, dishView(updated));
}));

api.get('/admin/dishes', requireAuth, requireAdmin, wrap(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.restaurantId) where.restaurantId = String(req.query.restaurantId).slice(0, 40);
  const rows = await prisma.dish.findMany({ where, include: { creator: true }, orderBy: { createdAt: 'desc' }, take: 300 });
  return ok(res, rows.map(dishView));
}));

api.post('/admin/dishes', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { data, error } = readDishInput(req.body);
  if (error) throw badRequest(error);
  const row = await prisma.dish.create({ data: { ...data, status: 'published', createdBy: req.user.id }, include: { creator: true } });
  await audit(req.user.id, 'create-dish', row.id, data.name);
  return ok(res, dishView(row));
}));

api.delete('/admin/dishes/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw badRequest('参数不对');
  await prisma.dish.deleteMany({ where: { id } });
  await audit(req.user.id, 'delete-dish', id, '');
  return ok(res, { ok: true });
}));

/* ---------------- 旧本地数据迁移 ---------------- */
api.post('/migrate', requireAuth, wrap(async (req, res) => {
  const reviews = Array.isArray(req.body.reviews) ? req.body.reviews.slice(0, 50) : [];
  const favorites = Array.isArray(req.body.favorites) ? req.body.favorites.slice(0, 300) : [];
  let reviewsAdded = 0;
  let favoritesAdded = 0;
  for (const item of reviews) {
    const rating = Number(item?.rating);
    const targetId = String(item?.targetId ?? '').slice(0, 40);
    if (!targetId || !Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    if (!(await prisma.shop.findUnique({ where: { id: targetId }, select: { id: true } }))) continue;
    const exists = await prisma.review.findUnique({ where: { userId_targetId: { userId: req.user.id, targetId } } });
    if (exists) continue;
    await prisma.review.create({ data: { userId: req.user.id, targetId, rating, content: String(item?.content ?? '').slice(0, 200) } });
    reviewsAdded += 1;
  }
  for (const raw of favorites) {
    const targetId = String(raw ?? '').slice(0, 40);
    if (!targetId) continue;
    if (!(await prisma.shop.findUnique({ where: { id: targetId }, select: { id: true } }))) continue;
    try { await prisma.favorite.create({ data: { userId: req.user.id, targetId } }); favoritesAdded += 1; } catch { /* 已收藏 */ }
  }
  return ok(res, { reviewsAdded, favoritesAdded });
}));