import { reactive, computed } from 'vue';
import { auth, api, restoreSession, logout } from './auth.js';

const W = 10;
const FAV_KEY = 'savoru.favorites';
const USER_REVIEW_KEY = 'savoru.reviews';

export const state = reactive({
  canteens: [],
  campusShops: [],
  shops: [],
  dishes: [],
  demoReviews: [],
  reviews: [],
  favorites: [],
  loaded: false,
  /** 'server' | 'static'：数据来源，便于界面提示与离线兜底 */
  source: '',
});

/** 打卡：今日各店人数、我的今日打卡与连续天数 */
export const checkin = reactive({
  todayTotal: 0,
  total: 0,
  byTarget: {},
  mineToday: [],
  streak: 0,
  myTotal: 0,
  ready: false,
});

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }
};

/* ---------------- 目录数据 ---------------- */

/** 从服务端按需拉取目录（不再一次性加载 519KB 静态 JSON） */
async function loadCatalogFromServer() {
  const [campus, nearby, dishes] = await Promise.all([
    api('/shops?scope=campus&limit=100', { auth: false }),
    api('/shops?scope=nearby&limit=700', { auth: false }),
    api('/dishes', { auth: false }),
  ]);
  state.canteens = campus.filter((s) => s.kind === 'canteen');
  state.campusShops = campus.filter((s) => s.kind !== 'canteen');
  state.shops = nearby;
  state.dishes = dishes;
  state.source = 'server';
}

/** 离线/服务端不可用时的静态兜底 */
async function loadCatalogFromStatic() {
  const res = await fetch('/data/shops.json');
  const data = await res.json();
  state.canteens = data.canteens || [];
  state.campusShops = data.campusShops || [];
  state.shops = data.shops || [];
  state.dishes = state.canteens.flatMap((c) =>
    (c.dishes || []).map((d) => ({ ...d, restaurantId: c.id, status: 'published' }))
  );
  state.demoReviews = data.reviews || [];
  state.source = 'static';
}

/* ---------------- 评价 / 收藏 ---------------- */

function applyGuestReviews() {
  const own = readJson(USER_REVIEW_KEY, []);
  state.reviews = [...state.demoReviews, ...own.map((r) => ({ ...r, mine: true }))];
}

async function loadReviews() {
  try {
    const list = await api('/reviews');
    state.reviews = [...state.demoReviews, ...list];
  } catch {
    applyGuestReviews();
  }
}

async function loadFavorites() {
  try {
    const data = await api('/favorites');
    state.favorites = data.favorites || [];
  } catch {
    /* 服务端不可用时保留本机收藏 */
  }
}

export async function loadDishes() {
  try {
    state.dishes = await api('/dishes');
  } catch {
    /* 服务端不可用时用静态兜底 */
  }
}

/** 把上一阶段存在 localStorage 的评价与收藏并入当前账号 */
async function migrateLocalData() {
  const own = readJson(USER_REVIEW_KEY, []);
  const favs = readJson(FAV_KEY, []);
  if (!own.length && !favs.length) return { reviewsAdded: 0, favoritesAdded: 0 };
  try {
    const res = await api('/migrate', {
      method: 'POST',
      body: {
        reviews: own.map((r) => ({ targetId: r.targetId, rating: r.rating, content: r.content })),
        favorites: favs,
      },
    });
    writeJson(USER_REVIEW_KEY, []);
    writeJson(FAV_KEY, []);
    return res;
  } catch {
    return { reviewsAdded: 0, favoritesAdded: 0 };
  }
}

/** 登录 / 注册完成后：迁移本机旧数据并同步服务端评价与收藏 */
export async function syncAfterAuth() {
  const migrated = await migrateLocalData();
  await Promise.all([loadReviews(), loadFavorites(), loadMyCheckins()]);
  return migrated;
}

export async function logoutUser() {
  await logout();
  applyGuestReviews();
  state.favorites = readJson(FAV_KEY, []);
  checkin.mineToday = [];
  checkin.streak = 0;
  checkin.myTotal = 0;
}

/* ---------------- 打卡 ---------------- */

export async function loadCheckinStats() {
  try {
    const data = await api('/checkins/stats', { auth: false });
    checkin.todayTotal = data.todayTotal || 0;
    checkin.total = data.total || 0;
    checkin.byTarget = Object.fromEntries((data.targets || []).map((t) => [t.targetId, t.count]));
    checkin.ready = true;
  } catch {
    /* 服务端不可用时保持 0，不影响浏览 */
  }
}

export async function loadMyCheckins() {
  if (!auth.user) {
    checkin.mineToday = [];
    checkin.streak = 0;
    checkin.myTotal = 0;
    return;
  }
  try {
    const data = await api('/checkins/mine');
    checkin.mineToday = data.todayIds || [];
    checkin.streak = data.streak || 0;
    checkin.myTotal = data.total || 0;
  } catch {
    /* 忽略偶发失败 */
  }
}

export function checkedToday(targetId) {
  return checkin.mineToday.includes(targetId);
}

export async function checkInAt(targetId) {
  const data = await api('/checkins', { method: 'POST', body: { targetId } });
  if (!checkin.mineToday.includes(targetId)) checkin.mineToday.push(targetId);
  checkin.byTarget[targetId] = data.todayCount;
  checkin.streak = data.mine?.streak ?? checkin.streak;
  checkin.myTotal = data.mine?.total ?? checkin.myTotal;
  if (!data.already) checkin.todayTotal += 1;
  return data;
}

export async function undoCheckin(targetId) {
  await api(`/checkins/${encodeURIComponent(targetId)}`, { method: 'DELETE' });
  checkin.mineToday = checkin.mineToday.filter((id) => id !== targetId);
}

export async function fetchCheckinStats(targetId) {
  return api(`/checkins/stats?targetId=${encodeURIComponent(targetId)}`, { auth: false });
}

/* ---------------- 初始化 ---------------- */

export async function initStore() {
  if (state.loaded) return;
  try {
    await loadCatalogFromServer();
  } catch {
    await loadCatalogFromStatic();
  }
  await loadReviews().catch(() => applyGuestReviews());
  state.favorites = readJson(FAV_KEY, []);
  state.loaded = true;

  const user = await restoreSession();
  if (user) await syncAfterAuth();
  else applyGuestReviews();
  await loadCheckinStats();
}

/** 校内：食堂 + 校内店铺；校外：周边店铺 */
export const campusTargets = computed(() => [...state.canteens, ...state.campusShops]);
export const allTargets = computed(() => [...campusTargets.value, ...state.shops]);

export function getTarget(id) {
  return allTargets.value.find((t) => t.id === id);
}

export function reviewsFor(id) {
  return state.reviews
    .filter((r) => r.targetId === id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * 融合星级：服务端已给出 target.rating（在线时以服务端为准）；
 * 离线/静态兜底时本地按同一公式计算：display = (W×基准分 + Σ站内) / (W + n)
 */
export function ratingOf(target) {
  if (!target) return { score: null, n: 0, base: null, label: '暂无评分' };
  if (target.rating) return target.rating;
  const list = reviewsFor(target.id);
  const n = list.length;
  const sum = list.reduce((acc, r) => acc + r.rating, 0);
  const base = target.amapRating ?? null;
  let score = null;
  if (n > 0 && base != null) score = (W * base + sum) / (W + n);
  else if (n > 0) score = sum / n;
  else if (base != null) score = base;
  if (score == null) return { score: null, n, base, label: '暂无评分' };
  const rounded = Math.round(score * 10) / 10;
  return { score: rounded, n, base, label: ratingLabel(rounded) };
}

export function ratingLabel(score) {
  if (score == null) return '暂无评分';
  if (score >= 4.2) return '强烈推荐';
  if (score >= 3.8) return '推荐';
  if (score >= 3.3) return '还不错';
  return '一般';
}

export function isFavorite(id) {
  return state.favorites.includes(id);
}

export async function toggleFavorite(id) {
  if (auth.user) {
    const on = isFavorite(id);
    state.favorites = on ? state.favorites.filter((x) => x !== id) : [id, ...state.favorites];
    try {
      const data = await api(`/favorites/${encodeURIComponent(id)}`, { method: on ? 'DELETE' : 'PUT' });
      state.favorites = data.favorites || [];
      return isFavorite(id);
    } catch (e) {
      state.favorites = on ? [id, ...state.favorites] : state.favorites.filter((x) => x !== id);
      throw e;
    }
  }
  const idx = state.favorites.indexOf(id);
  if (idx >= 0) state.favorites.splice(idx, 1);
  else state.favorites.push(id);
  writeJson(FAV_KEY, [...state.favorites]);
  return isFavorite(id);
}

/** 评分必须登录；服务端一店一人一条，重复提交即更新；提交后刷新该店融合分 */
export async function submitReview(targetId, rating, content, tags = []) {
  const row = await api(`/reviews/${encodeURIComponent(targetId)}`, {
    method: 'PUT',
    body: { rating, content: String(content ?? '').trim(), tags },
  });
  const idx = state.reviews.findIndex((r) => r.targetId === targetId && r.mine);
  if (idx >= 0) state.reviews.splice(idx, 1, row);
  else state.reviews.unshift(row);
  refreshRating(targetId).catch(() => {});
  return row;
}

/** 从服务端刷新单个店铺的融合分，写回目录对象 */
export async function refreshRating(targetId) {
  const data = await api(`/ratings?ids=${encodeURIComponent(targetId)}`, { auth: false });
  const next = data[targetId];
  const target = getTarget(targetId);
  if (next && target) target.rating = next;
  return next;
}

export function myReviewFor(targetId) {
  return state.reviews.find((r) => r.targetId === targetId && r.mine) || null;
}

/** 某家店的已发布菜品 */
export function dishesFor(restaurantId) {
  return state.dishes.filter((d) => d.restaurantId === restaurantId);
}

export async function submitDish(input) {
  return api('/submissions', { method: 'POST', body: input });
}

export async function mySubmissions() {
  return api('/submissions/mine');
}

export function topShops(limit = 4) {
  return [...state.shops]
    .map((s) => ({ ...s, rating: ratingOf(s) }))
    .sort((a, b) => (b.rating.score ?? 0) - (a.rating.score ?? 0) || b.rating.n - a.rating.n)
    .slice(0, limit);
}

/** 近 7 天新增：站内评价数 + 同学补充并通过的菜品数 */
export function freshStats() {
  const since = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const reviews = state.reviews.filter((r) => r.date && r.date >= since).length;
  const dishes = state.dishes.filter((d) => d.submittedBy && d.date && d.date >= since).length;
  return { reviews, dishes };
}