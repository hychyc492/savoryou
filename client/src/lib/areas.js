import { state } from './store.js';

/** 校外街区归属，顺序即匹配优先级 */
export const AREAS = ['科大美食街', '地下通道', '龙祥商业街', '龙祥街', '开元大道', '其他'];

export function areaOf(shop) {
  const address = shop?.address || '';
  if (/美食街/.test(address)) return '科大美食街';
  if (/地下通道|过街通道|地下过街/.test(address)) return '地下通道';
  if (/龙祥商业街|龙祥街|龙翔街/.test(address)) {
    return /商业街/.test(address) ? '龙祥商业街' : '龙祥街';
  }
  if (/开元大道/.test(address)) return '开元大道';
  return '其他';
}

export function areaCounts(shops) {
  const map = new Map();
  for (const s of shops) {
    const a = areaOf(s);
    map.set(a, (map.get(a) || 0) + 1);
  }
  return map;
}

/**
 * 精选规则（不改数据文件，运行时生成）：
 * 评分 ≥ 3.8、同街区同品类最多 3 家、1 公里内约占 60%、每街区保底 6 家，总数 ≤ 150
 */
function buildFeatured(shops) {
  const sorted = [...shops].sort(
    (a, b) => (b.amapRating ?? 0) - (a.amapRating ?? 0) || a.distance - b.distance
  );
  const picked = [];
  const ids = new Set();
  const catCount = new Map();
  const areaCount = new Map();
  const MAX = 150;
  const NEAR_CAP = 90;
  const PER_CAT = 3;

  const take = (s) => {
    if (ids.has(s.id)) return false;
    const area = areaOf(s);
    const catKey = `${area}|${s.category || ''}`;
    if ((catCount.get(catKey) || 0) >= PER_CAT) return false;
    ids.add(s.id);
    picked.push(s);
    catCount.set(catKey, (catCount.get(catKey) || 0) + 1);
    areaCount.set(area, (areaCount.get(area) || 0) + 1);
    return true;
  };

  const good = sorted.filter((s) => (s.amapRating ?? 0) >= 3.8);
  for (const s of good) {
    if (picked.length >= NEAR_CAP) break;
    if (s.distance <= 1000) take(s);
  }
  for (const s of good) {
    if (picked.length >= MAX) break;
    if (s.distance > 1000) take(s);
  }

  // 每个街区保底 6 家，最低放宽到 3.3 分
  for (const area of AREAS) {
    if (area === '其他') continue;
    for (const s of sorted) {
      if ((areaCount.get(area) || 0) >= 6 || picked.length >= MAX) break;
      if (areaOf(s) !== area) continue;
      if ((s.amapRating ?? 0) < 3.3) break;
      take(s);
    }
  }

  return picked;
}

let cache = { source: null, list: [] };

export function featuredShops() {
  if (cache.source === state.shops && cache.list.length) return cache.list;
  const list = buildFeatured(state.shops);
  cache = { source: state.shops, list };
  return list;
}

export function featuredIdSet() {
  return new Set(featuredShops().map((s) => s.id));
}
