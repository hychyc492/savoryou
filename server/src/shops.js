/**
 * 店铺查询服务：标签归类、关键词匹配、列表 / 详情 / 地图 / 榜单 / 统计。
 * 标签规则与关键词别名与前端 foodTags.js 保持一致，避免口径分裂。
 */
import { prisma } from './db.js';
import { reviewAgg, ratingOf } from './rating.js';
import { isOpenNow, todayKey } from './lib/time.js';

const FOOD_RULES = [
  ['米饭', /米饭|盖饭|盖浇饭|炒饭|煲仔饭|便当|黄焖鸡|排骨饭|卤肉饭|鸡腿饭|石锅拌饭|盒饭/],
  ['面食', /拉面|牛肉面|刀削面|烩面|担担面|炸酱面|热干面|拌面|汤面|炒面|焖面|凉面|意面|面馆|面食|馄饨|水饺|饺子|锅贴|包子|馒头|肉夹馍/],
  ['粉', /米线|米粉|粉丝|螺蛳粉|酸辣粉|河粉|炒粉|宽粉/],
  ['火锅', /火锅|麻辣烫|串串|冒菜|干锅|麻辣香锅/],
  ['烧烤', /烧烤|烤肉|烤串|烤鱼|铁板烧|撸串/],
  ['炸鸡汉堡', /炸鸡|鸡排|汉堡|肯德基|KFC|塔斯汀|必胜客|披萨|pizza|德克士|华莱士|麦当劳/],
  ['咖啡', /咖啡|瑞幸|库迪|幸运咖/],
  ['饮品', /饮品|冷饮|奶茶|茶饮|果茶|鲜茶|果汁|蜜雪冰城|甜啦啦|茶艺馆/],
  ['甜品', /甜品|蛋糕|烘焙|糕饼|面包|甜点|冰淇淋|冰激凌|泡芙|布丁/],
  ['小吃', /小吃|炸串|炸|煎|烤肠|卤味|鸭脖|粥|锅盔|饼|凉皮|臭豆腐/],
  ['炒菜', /中餐厅|正餐|川菜|湘菜|粤菜|东北菜|鲁菜|西北菜|家常菜|炒菜|饭店|酒楼|食府|私房菜|大排档/],
  ['清真', /清真/],
];

export const FOOD_TAGS = [...FOOD_RULES.map(([n]) => n), '其他'];

const KEYWORD_ALIASES = {
  米饭: ['米饭', '盖饭', '盒饭', '炒饭', '便当', '饭'],
  面食: ['面条', '面', '拉面', '刀削面', '饺子', '馄饨', '包子'],
  粉: ['粉', '米线', '米粉', '粉丝', '螺蛳粉'],
  火锅: ['火锅', '麻辣烫', '串串', '冒菜', '干锅'],
  烧烤: ['烧烤', '烤肉', '烤串', '烤鱼', '撸串'],
  炸鸡汉堡: ['炸鸡', '汉堡', '鸡排', '披萨', '快餐'],
  咖啡: ['咖啡'],
  饮品: ['饮品', '奶茶', '果茶', '茶饮', '冷饮', '饮料'],
  甜品: ['甜品', '甜点', '蛋糕', '面包', '烘焙', '冰淇淋'],
  小吃: ['小吃', '夜宵', '炸串', '煎饼', '粥'],
  炒菜: ['炒菜', '家常菜', '川菜', '湘菜', '正餐'],
  清真: ['清真'],
};

export function tagsOf(shop) {
  const dishes = (shop.dishes || []).map((d) => `${d.name || ''} ${d.stall || ''}`).join(' ');
  const hay = `${shop.name || ''} ${shop.category || ''} ${dishes}`;
  const tags = FOOD_RULES.filter(([, re]) => re.test(hay)).map(([name]) => name);
  return tags.length ? tags : ['其他'];
}

function aliasTag(term) {
  for (const [tag, words] of Object.entries(KEYWORD_ALIASES)) {
    if (words.some((w) => w === term || w.includes(term) || term.includes(w))) return tag;
  }
  return null;
}

export function matchKeyword(shop, keyword) {
  const terms = String(keyword || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const tags = tagsOf(shop);
  const hay = [
    shop.name,
    shop.category,
    tags.join(' '),
    ...(shop.dishes || []).map((d) => `${d.name || ''} ${d.stall || ''}`),
  ].join(' ').toLowerCase();
  return terms.every((term) => {
    if (hay.includes(term)) return true;
    const alias = aliasTag(term);
    return alias != null && tags.includes(alias);
  });
}

const parsePhotos = (s) => {
  try {
    const v = JSON.parse(s || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

function toShopView(shop, agg) {
  const { dishes, ...rest } = shop;
  return {
    ...rest,
    photos: parsePhotos(shop.photos),
    dishes: dishes || undefined,
    tags: tagsOf(shop),
    rating: ratingOf(shop, agg),
  };
}

const valueScore = (v) => (v.rating.score != null && v.amapCost ? v.rating.score / v.amapCost : -1);

/** 列表查询：支持 q / scope / kind / area / tags / costMax / featured / sort / 分页 */
export async function queryShops(params) {
  const {
    q = '', scope = '', kind = '', area = '', tags = [],
    costMax = null, featured = false, sort = '', limit = 20, offset = 0, open = false,
  } = params;

  const where = {};
  if (scope === 'campus' || scope === 'nearby') where.group = scope;
  if (kind) where.kind = kind;
  if (area) where.area = area;
  if (featured) where.isFeatured = true;
  if (costMax != null) where.amapCost = { gte: 0, lte: costMax };

  const rows = await prisma.shop.findMany({
    where,
    include: { dishes: { where: { status: 'published' }, select: { name: true, stall: true, price: true, mealSlots: true, spicy: true, tags: true } } },
    take: 1500,
  });

  let list = rows;
  if (q) list = list.filter((s) => matchKeyword(s, q));
  if (tags.length) list = list.filter((s) => tags.some((t) => tagsOf(s).includes(t)));
  if (open) list = list.filter((s) => isOpenNow(s.openSegments));

  const agg = await reviewAgg(list.map((s) => s.id));
  let items = list.map((s) => toShopView(s, agg));

  if (sort === 'rating') items.sort((a, b) => (b.rating.score ?? 0) - (a.rating.score ?? 0) || b.rating.n - a.rating.n);
  else if (sort === 'popular') items.sort((a, b) => b.rating.n - a.rating.n);
  else if (sort === 'value') items.sort((a, b) => valueScore(b) - valueScore(a));
  else if (sort === 'distance') items.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

  const total = items.length;
  return { items: items.slice(offset, offset + limit), total };
}

/** 营业状态与「今天」的实现见 lib/time.js，这里复用（供路由直接引入） */
export { isOpenNow, todayKey };

export async function shopDetail(id, viewerId) {
  const shop = await prisma.shop.findUnique({
    where: { id },
    include: {
      dishes: {
        where: { status: 'published' },
        orderBy: [{ id: 'asc' }],
        select: { id: true, name: true, price: true, stall: true, spicy: true, mealSlots: true, tags: true },
      },
    },
  });
  if (!shop) return null;
  const [agg, reviews] = await Promise.all([
    reviewAgg([id]),
    prisma.review.findMany({
      where: { targetId: id },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);
  return {
    ...toShopView(shop, agg),
    reviews: reviews.map((r) => ({
      id: `s-${r.id}`,
      targetId: r.targetId,
      user: r.user.username,
      rating: r.rating,
      content: r.content,
      tags: r.tags ? r.tags.split(',').filter(Boolean) : [],
      date: r.createdAt.toISOString().slice(0, 10),
      mine: viewerId != null && r.userId === viewerId,
    })),
  };
}

/** 地图视口查询：bbox=minLng,minLat,maxLng,maxLat */
export async function mapShops(bboxStr, limit = 600) {
  const parts = String(bboxStr || '').split(',').map(Number);
  const where = { group: 'nearby' };
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    where.lng = { gte: parts[0], lte: parts[2] };
    where.lat = { gte: parts[1], lte: parts[3] };
  }
  const rows = await prisma.shop.findMany({
    where,
    select: { id: true, name: true, lng: true, lat: true, kind: true, area: true, amapRating: true, amapCost: true, isFeatured: true },
    take: limit,
  });
  const agg = await reviewAgg(rows.map((r) => r.id));
  return rows.map((r) => ({
    ...r,
    score: ratingOf(r, agg).score,
    n: (agg[r.id] || {}).n || 0,
  }));
}

/** 站点规模与新鲜度 */
export async function statsOverview() {
  const since = new Date(Date.now() - 6 * 864e5);
  const [
    canteens, campusShops, nearbyShops, dishes, reviews, users,
    checkinsToday, checkinsTotal, freshReviews, freshDishes,
  ] = await Promise.all([
    prisma.shop.count({ where: { kind: 'canteen' } }),
    prisma.shop.count({ where: { kind: 'campusShop' } }),
    prisma.shop.count({ where: { kind: 'shop' } }),
    prisma.dish.count({ where: { status: 'published' } }),
    prisma.review.count(),
    prisma.user.count(),
    prisma.checkin.count({ where: { date: todayKey() } }),
    prisma.checkin.count(),
    prisma.review.count({ where: { createdAt: { gte: since } } }),
    prisma.dish.count({ where: { status: 'published', createdAt: { gte: since } } }),
  ]);
  return {
    canteens, campusShops, nearbyShops, dishes, reviews, users,
    checkinsToday, checkinsTotal, fresh7d: { reviews: freshReviews, dishes: freshDishes },
  };
}