import { state, ratingOf } from './store.js';
import { tagsOf } from './foodTags.js';

const CAMPUS_CENTER = [112.421454, 34.602253];
const WALK_SPEED = 75; // 米 / 分钟
const WALK_DETOUR = 1.3; // 绕路系数
const WALK_MAX = 40;

const GROUP_CATEGORIES = /火锅|烧烤|中餐|川菜|湘菜|粤菜|东北菜|鲁菜|西北菜|清真|海鲜|正餐|地方风味/;
const SOLO_CATEGORIES = /快餐|小吃|面|粉|冷饮|咖啡|茶艺|糕饼|甜品|汉堡|炸鸡/;

function haversine(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** 步行分钟数：校外用真实距离，校内按校区中心估算 */
export function walkMinutes(item) {
  if (!item) return null;
  const meters = item.distance != null ? item.distance : haversine(CAMPUS_CENTER, [item.lng, item.lat]);
  if (!Number.isFinite(meters)) return null;
  return Math.max(1, Math.round((meters * WALK_DETOUR) / WALK_SPEED));
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** 营业状态：true 营业 / false 打烊 / null 无法判断 */
export function isOpenNow(item, now = new Date()) {
  const text = item?.openHours || item?.openTime || '';
  const matches = text.match(/\d{1,2}:\d{2}\s*[-~至]\s*\d{1,2}:\d{2}/g);
  if (!matches) return null;
  const cur = now.getHours() * 60 + now.getMinutes();
  for (const seg of matches) {
    const [a, b] = seg.split(/\s*[-~至]\s*/);
    const start = toMinutes(a);
    let end = toMinutes(b);
    if (end <= start) end += 1440;
    if (cur >= start && cur <= end) return true;
    if (cur + 1440 >= start && cur + 1440 <= end) return true;
  }
  return false;
}

function poolFor(scope) {
  if (scope === 'campus') return [...state.canteens, ...state.campusShops];
  if (scope === 'nearby') return state.shops;
  return [...state.canteens, ...state.campusShops, ...state.shops];
}

function scoreOf(item, { tags, people }) {
  const r = ratingOf(item);
  const ratingNorm = r.score != null ? Math.min(1, r.score / 5) : 0.5;
  const walk = walkMinutes(item) ?? WALK_MAX;
  const walkNorm = 1 - Math.min(walk, WALK_MAX) / WALK_MAX;
  const itemTags = tagsOf(item);
  const hit = tags.length ? tags.filter((t) => itemTags.includes(t)).length / tags.length : 0.5;
  const popNorm = Math.min(1, Math.log1p(r.n) / Math.log1p(10));
  const category = item.category || '';
  let crowd = 0;
  if (people >= 4 && GROUP_CATEGORIES.test(category)) crowd = 0.05;
  if (people === 1 && SOLO_CATEGORIES.test(category)) crowd = 0.05;
  return 0.4 * ratingNorm + 0.3 * walkNorm + 0.2 * hit + 0.1 * popNorm + crowd + (Math.random() - 0.5) * 0.06;
}

/** 推荐理由：步行 / 命中口味 / 评分，最多 3 条 */
export function reasonsFor(item, tags = []) {
  if (!item) return [];
  const out = [];
  const walk = walkMinutes(item);
  if (walk != null && walk <= 25) out.push(`步行 ${walk} 分钟`);
  const itemTags = tagsOf(item);
  const matched = tags.filter((t) => itemTags.includes(t));
  if (matched.length) out.push(...matched.slice(0, 2));
  const r = ratingOf(item);
  if (r.score != null) out.push(`评分 ${r.score.toFixed(1)}`);
  if (r.n >= 2) out.push(`站内 ${r.n} 人评价`);
  if (!out.length) out.push(item.kind === 'canteen' ? '校内食堂' : '2 公里内');
  return out.slice(0, 3);
}

/**
 * 帮我决定：硬过滤（预算 / 口味 / 营业状态）后打分排序
 * score = 0.4 评分 + 0.3 步行 + 0.2 标签命中 + 0.1 人气 + 人数修正
 * openOnly 默认只留现在营业的店；显式关闭时不过滤营业状态
 */
export function recommend({ budget = null, tags = [], scope = 'all', people = 1, limit = 3, openOnly = true } = {}) {
  const base = poolFor(scope).filter((item) => {
    // 定了预算就不再推荐价格未知的店，避免点进去超出预期
    if (budget && item.amapCost == null) return false;
    if (budget && item.amapCost > budget) return false;
    if (tags.length) {
      const own = tagsOf(item);
      if (!tags.some((t) => own.includes(t))) return false;
    }
    return true;
  });

  const pool = openOnly ? base.filter((item) => isOpenNow(item) !== false) : base;

  const seen = new Set();
  return pool
    .map((item) => ({ item, score: scoreOf(item, { tags, people }) }))
    .sort((a, b) => b.score - a.score)
    .filter(({ item }) => {
      // 同名连锁只留一家，避免三个结果都是同一品牌
      const key = item.name.replace(/[（(].*?[)）]/g, '').replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ item, score }) => ({
      item,
      score,
      walk: walkMinutes(item),
      reasons: reasonsFor(item, tags),
    }));
}
