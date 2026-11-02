<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import ShopCard from '../components/ShopCard.vue';
import StarRating from '../components/StarRating.vue';
import FoodTagFilter from '../components/FoodTagFilter.vue';
import DecisionSheet from '../components/DecisionSheet.vue';
import { state, ratingOf, topShops, getTarget, dishesFor, freshStats, checkin } from '../lib/store.js';
import { filterItems, facetCounts } from '../lib/foodTags.js';
import { reasonsFor, walkMinutes, recommend } from '../lib/recommend.js';

const q = ref('');
const budget = ref(false);
const activeTags = ref([]);
const sheetOpen = ref(false);

/* 首屏：分层场景的滚动视差 */
const sceneEl = ref(null);
const depth = ref(0);
let ticking = false;

const stage = computed(() => (depth.value < 0.3 ? 1 : depth.value < 0.62 ? 2 : 3));
const sceneStyle = computed(() => ({ '--p': depth.value.toFixed(3) }));

function onSceneScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const el = sceneEl.value;
    if (!el) return;
    const range = el.offsetHeight + 260;
    depth.value = Math.min(1, Math.max(0, window.scrollY / range));
  });
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.addEventListener('scroll', onSceneScroll, { passive: true });
  window.addEventListener('resize', onSceneScroll);
  onSceneScroll();
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onSceneScroll);
  window.removeEventListener('resize', onSceneScroll);
});

const spinResult = ref(null);
const spinning = ref(false);
const rollingText = ref('');

const allFoods = computed(() => [...state.canteens, ...state.campusShops, ...state.shops]);

const filtered = computed(() =>
  filterItems(allFoods.value, {
    keyword: q.value,
    tags: activeTags.value,
    costMax: budget.value ? 15 : null,
  })
);

const homeCounts = computed(() =>
  facetCounts(allFoods.value, { keyword: q.value, costMax: budget.value ? 15 : null })
);

const isSearching = computed(() => q.value.trim() !== '' || activeTags.value.length > 0 || budget.value);
const nearbyTop = computed(() => topShops(4));
const campusCount = computed(() => state.canteens.length + state.campusShops.length);

function clearFilters() {
  q.value = '';
  activeTags.value = [];
  budget.value = false;
}

const canteenDishes = computed(() => {
  const list = [];
  for (const c of state.canteens) {
    for (const d of dishesFor(c.id)) list.push({ ...d, shop: c });
  }
  return list;
});

/** 首页「现在就能吃」：默认只留营业中的店，换一批时避开上一轮 */
const nowPicks = ref([]);

function rollNow() {
  const prevKey = nowPicks.value.map((p) => p.item.id).join('|');
  let list = recommend({ scope: 'all', openOnly: true, limit: 3 });
  for (let i = 0; i < 4 && list.map((p) => p.item.id).join('|') === prevKey; i += 1) {
    list = recommend({ scope: 'all', openOnly: true, limit: 3 });
  }
  nowPicks.value = list;
}

rollNow();

const fresh = computed(() => freshStats());

const spinPool = computed(() => [
  ...canteenDishes.value.map((d) => ({
    title: d.name,
    price: d.price,
    sub: `${d.shop.name} · ${d.stall}`,
    tag: '校内 · 食堂',
    id: d.shop.id,
  })),
  ...state.campusShops.map((s) => ({
    title: s.name,
    price: s.amapCost,
    sub: `${s.category || '校内店铺'}`,
    tag: '校内',
    id: s.id,
  })),
  ...state.shops.map((s) => ({
    title: s.name,
    price: s.amapCost,
    sub: `步行 ${walkMinutes(s)} 分钟 · ${s.category}`,
    tag: '校外',
    id: s.id,
  })),
]);

function spin() {
  if (spinning.value) return;
  const pool = spinPool.value;
  if (!pool.length) return;

  const prevId = spinResult.value?.id;
  if (prevId) spinResult.value = null;
  spinning.value = true;

  // 先抽出最终结果，再倒推滚动过程，避免中途就露出答案
  let target = pool[Math.floor(Math.random() * pool.length)];
  let guard = 0;
  while (prevId && target.id === prevId && guard++ < 8) {
    target = pool[Math.floor(Math.random() * pool.length)];
  }

  const total = 14;
  let i = 0;
  const step = () => {
    i += 1;
    if (i >= total) {
      rollingText.value = target.title;
      spinResult.value = { ...target, reasons: reasonsFor(getTarget(target.id)) };
      spinning.value = false;
      return;
    }
    rollingText.value = pool[Math.floor(Math.random() * pool.length)].title;
    const t = i / total;
    // 先快后慢，越接近结果跳得越慢
    setTimeout(step, 38 + 150 * t * t);
  };
  step();
}
</script>

<template>
  <section ref="sceneEl" class="scene" :style="sceneStyle">
    <div class="layer far" aria-hidden="true">
      <div class="sun"></div>
      <svg class="skyline" viewBox="0 0 900 260" preserveAspectRatio="none">
        <defs>
          <linearGradient id="skylineFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#c9a374" stop-opacity="0.5" />
            <stop offset="100%" stop-color="#e8d3ab" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path
          fill="url(#skylineFade)"
          d="M0 236h46v-44h28v44h58v-78l20-14 20 14v78h34v-30h34v30h44v-58h30v58h52v-96h28v96h50v-36h38v36h62v-64h24v64h46v-24h30v24h40v-70h26v70h52v-40h34v40h48v-30h26v30h40v-56h24v56h36V260H0z"
        />
      </svg>
      <div class="sky-glow"></div>
    </div>

    <div class="layer mid" aria-hidden="true">
      <span class="bokeh b1"></span>
      <span class="bokeh b2"></span>
      <span class="bokeh b3"></span>
      <span class="pin pin-a"><i></i>菁园餐厅</span>
      <span class="pin pin-b"><i></i>乾园食堂</span>
      <span class="pin pin-c"><i></i>龙祥街 · 645 家</span>
    </div>

    <div class="layer near" aria-hidden="true">
      <div class="dish d1">
        <span class="rim"></span>
        <span class="food"></span>
        <span class="steam">
          <svg viewBox="0 0 96 78">
            <path d="M26 74c-9-11 6-18-1-29s3-22 3-22" />
            <path d="M48 74c-9-13 7-21-1-33s3-25 3-25" />
            <path d="M70 74c-9-11 6-18-1-29s3-22 3-22" />
          </svg>
        </span>
      </div>
      <div class="dish d2"></div>
      <span class="tag-float t1">麻辣香锅 · ¥13</span>
      <span class="tag-float t2">黄焖鸡米饭 · ¥12</span>
      <span class="tag-float t3">4.4 分 · 步行 3 分钟</span>
    </div>

    <div class="grain" aria-hidden="true"></div>

    <div class="hero-inner">
      <p class="eyebrow">开元校区 · 校内 {{ campusCount }} 家 · 校外 {{ state.shops.length }} 家</p>
      <h1>今天吃什么？</h1>
      <p class="sub">别纠结了，从下面开始，三十秒内做决定。</p>
      <input v-model="q" class="hero-search" type="search" placeholder="搜校内、校外、菜名" />
      <div class="hero-actions">
        <button class="btn-primary hero-cta" @click="sheetOpen = true">帮我决定吃哪家</button>
        <p class="hero-hint">回答 4 个小问题 · 直接给 1 个主推 + 2 个备选</p>
      </div>
    </div>

    <div class="depth-rail" aria-hidden="true">
      <span class="st" :class="{ on: stage >= 1 }"><b>01</b>校园</span>
      <i class="link"></i>
      <span class="st" :class="{ on: stage >= 2 }"><b>02</b>窗口</span>
      <i class="link"></i>
      <span class="st" :class="{ on: stage >= 3 }"><b>03</b>这一份</span>
    </div>

    <p class="scroll-cue" aria-hidden="true"><span>向下滑 · 逐层挑</span><i></i></p>
  </section>

  <div class="budget-row chip-row">
    <button class="chip" :class="{ active: budget }" @click="budget = !budget">人均 ≤ 15</button>
    <span class="filter-hint">口味标签可多选</span>
  </div>
  <FoodTagFilter v-model="activeTags" :counts="homeCounts" class="filters" />

  <template v-if="isSearching">
    <div class="section-head">
      <h2 class="section-title">找到 {{ filtered.length }} 个</h2>
      <button class="section-more" @click="clearFilters">清空</button>
    </div>
    <div class="grid" v-if="filtered.length">
      <ShopCard v-for="item in filtered.slice(0, 24)" :key="item.id" :item="item" />
    </div>
    <p v-else class="empty">没有符合条件的结果，换个筛选试试。</p>
  </template>

  <template v-else>
    <section class="now">
      <div class="section-head">
        <h2 class="section-title">现在就能吃</h2>
        <button class="section-more" @click="rollNow">换一批</button>
      </div>
      <div class="now-row">
        <router-link v-for="p in nowPicks" :key="p.item.id" :to="`/shop/${p.item.id}`" class="now-card">
          <div class="now-thumb">
            <img v-if="p.item.photo" :src="p.item.photo" :alt="p.item.name" loading="lazy" />
            <div v-else class="now-empty">SavorU</div>
          </div>
          <div class="now-body">
            <h3>{{ p.item.name }}</h3>
            <p class="now-meta">
              <span class="now-score">{{ ratingOf(p.item).score ?? '—' }}</span>
              <span v-if="p.walk != null">步行 {{ p.walk }} 分钟</span>
              <span v-if="p.item.amapCost">人均 ¥{{ p.item.amapCost }}</span>
            </p>
            <p class="now-why">{{ p.reasons.slice(0, 2).join(' · ') }}</p>
          </div>
        </router-link>
      </div>
      <p v-if="!nowPicks.length" class="now-none">这个点附近暂时没有营业中的店，往下看看全部。</p>
    </section>

    <p class="fresh-strip">
      <span>
        <template v-if="fresh.reviews || fresh.dishes">
          近 7 天新增 {{ fresh.reviews }} 条评价<template v-if="fresh.dishes"> · {{ fresh.dishes }} 道新菜</template>
        </template>
        <template v-else>菜品和评价还在积累，欢迎你来补第一条。</template>
        <template v-if="checkin.todayTotal"> · 今天 {{ checkin.todayTotal }} 人打卡</template>
      </span>
      <router-link to="/submit-dish" class="fresh-link">补充菜品 →</router-link>
    </p>

    <section class="directions">
      <router-link to="/canteens" class="dir-card campus">
        <span class="dir-tag">校内</span>
        <h2>食堂与校内店铺</h2>
        <p>{{ state.canteens.length }} 个食堂 · {{ state.campusShops.length }} 家校内店</p>
        <span class="dir-more">看看校内 →</span>
      </router-link>
      <router-link to="/nearby" class="dir-card nearby">
        <span class="dir-tag">校外</span>
        <h2>2 公里内校外美食</h2>
        <p>{{ state.shops.length }} 家店 · 按距离与评分挑</p>
        <span class="dir-more">看看校外 →</span>
      </router-link>
    </section>

    <router-link to="/ranking" class="rank-strip">
      <span class="rank-icon" aria-hidden="true">★</span>
      <span class="rank-copy">
        <strong>全校好评榜</strong>
        <span>校内 / 校外 · 口味 / 性价比 / 人气</span>
      </span>
      <span class="rank-more">去看看 →</span>
    </router-link>

    <section class="spin-card">
      <div class="spin-copy">
        <h2>懒得回答？直接转一个</h2>
        <p>交给运气，也交给校内校外的真实评分。</p>
      </div>
      <div class="spin-body">
        <button class="btn-primary spin-btn" :disabled="spinning" @click="spin">
          {{ spinning ? '转着呢…' : spinResult ? '再转一次' : '帮我选一个' }}
        </button>
        <transition name="pop" mode="out-in">
          <div v-if="spinning" key="rolling" class="spin-result rolling">
            <span class="spin-title">{{ rollingText }}</span>
            <span class="spin-sub">正在挑，马上就好…</span>
          </div>
          <router-link v-else-if="spinResult" key="landed" :to="`/shop/${spinResult.id}`" class="spin-result landed">
            <span class="spin-tag">{{ spinResult.tag }}</span>
            <span class="spin-title">{{ spinResult.title }}</span>
            <span class="spin-sub">{{ spinResult.sub }}<template v-if="spinResult.price"> · 约 ¥{{ spinResult.price }}</template></span>
            <span v-if="spinResult.reasons?.length" class="spin-reasons">{{ spinResult.reasons.join(' · ') }}</span>
          </router-link>
        </transition>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">校园食堂</h2>
        <router-link to="/canteens" class="section-more">全部食堂 →</router-link>
      </div>
      <div class="canteens">
        <router-link v-for="c in state.canteens" :key="c.id" :to="`/shop/${c.id}`" class="canteen">
          <div class="canteen-thumb">
            <img v-if="c.photo" :src="c.photo" :alt="c.name" loading="lazy" />
            <span class="canteen-tag">食堂</span>
          </div>
          <div class="canteen-body">
            <h3>{{ c.shortName }}</h3>
            <div class="canteen-rate">
              <StarRating :value="ratingOf(c).score || 0" readonly size="sm" />
              <span>{{ ratingOf(c).score ?? '—' }}</span>
            </div>
            <p>{{ dishesFor(c.id).length }} 个菜品</p>
          </div>
        </router-link>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">附近好评</h2>
        <router-link to="/nearby" class="section-more">看地图 →</router-link>
      </div>
      <div class="grid">
        <ShopCard v-for="item in nearbyTop" :key="item.id" :item="item" />
      </div>
    </section>
  </template>

  <DecisionSheet :open="sheetOpen" @close="sheetOpen = false" />
</template>

<style scoped>
/* ---------- 首屏：三层视差场景 ---------- */
.scene {
  --p: 0;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 560px;
  padding: 48px 44px 42px;
  border-radius: 28px;
  border: 1px solid rgba(105, 47, 32, 0.14);
  box-shadow: var(--shadow-lg);
  background:
    radial-gradient(720px 380px at 78% -12%, rgba(217, 170, 65, 0.45), transparent 62%),
    radial-gradient(520px 320px at 2% 112%, rgba(140, 67, 44, 0.18), transparent 72%),
    linear-gradient(158deg, #fdf8ec 0%, #f7ecd6 48%, #eedcbc 100%);
}
.scene::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.4),
    inset 0 -110px 90px -70px rgba(58, 27, 18, 0.16);
}
.layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  will-change: transform;
}
.layer.far {
  transform: translate3d(0, calc(var(--p) * 46px), 0) scale(1.05);
}
.layer.mid {
  transform: translate3d(0, calc(var(--p) * -22px), 0);
}
.layer.near {
  transform: translate3d(0, calc(var(--p) * -64px), 0);
}

/* 远景：天光、校园剪影 */
.sun {
  position: absolute;
  right: 4%;
  top: -140px;
  width: 430px;
  height: 430px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 251, 236, 0.95) 0 16%, rgba(240, 205, 130, 0.55) 44%, transparent 70%);
  filter: blur(6px);
}
.skyline {
  position: absolute;
  left: -4%;
  bottom: -6px;
  width: 108%;
  height: 232px;
  opacity: 0.9;
  filter: blur(1.1px);
}
.sky-glow {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 170px;
  background: linear-gradient(180deg, transparent, rgba(253, 248, 236, 0.92));
}

/* 中景：光斑与地点气泡 */
.bokeh {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 252, 240, 0.92), rgba(255, 252, 240, 0) 68%);
  filter: blur(4px);
  animation: drift 20s ease-in-out infinite alternate;
}
.b1 { width: 128px; height: 128px; right: 31%; top: 9%; opacity: 0.8; }
.b2 { width: 74px; height: 74px; right: 11%; top: 38%; opacity: 0.55; animation-duration: 25s; }
.b3 { width: 168px; height: 168px; left: 36%; top: 54%; opacity: 0.32; animation-duration: 29s; }
@keyframes drift {
  from { transform: translate3d(0, -8px, 0); }
  to { transform: translate3d(10px, 8px, 0); }
}
.pin {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px 7px 10px;
  border-radius: 999px;
  background: rgba(255, 250, 240, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 26px -14px rgba(58, 27, 18, 0.5);
  color: var(--ink-soft);
  font-size: 11.5px;
  white-space: nowrap;
}
.pin i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary-deep);
  box-shadow: 0 0 0 3px rgba(217, 170, 65, 0.3);
}
.pin-a { right: 26%; top: 10%; }
.pin-b {
  right: 8%; top: 17%;
  opacity: clamp(0, calc((var(--p) - 0.08) * 3.6), 1);
  transform: translateY(calc((1 - var(--p)) * 14px));
}
.pin-c {
  right: 40%; top: 33%;
  opacity: clamp(0, calc((var(--p) - 0.2) * 3.4), 1);
  transform: translateY(calc((1 - var(--p)) * 20px));
}

/* 近景：餐盘、热气、菜品标签 */
.dish {
  position: absolute;
  border-radius: 50%;
}
.d1 {
  right: 7%;
  top: 33%;
  width: 210px;
  height: 210px;
  background: radial-gradient(circle at 38% 30%, #fffdf7 0%, #f8ecd4 42%, #ecd7b2 72%, #dfc59a 100%);
  box-shadow:
    0 34px 56px -26px rgba(58, 27, 18, 0.5),
    0 10px 22px -12px rgba(58, 27, 18, 0.28),
    inset 0 -10px 22px rgba(140, 67, 44, 0.18),
    inset 0 8px 16px rgba(255, 255, 255, 0.75);
}
.d1 .rim {
  position: absolute;
  inset: 7%;
  border-radius: 50%;
  border: 1px solid rgba(140, 67, 44, 0.14);
  box-shadow: inset 0 0 0 6px rgba(255, 255, 255, 0.35);
}
.d1 .food {
  position: absolute;
  inset: 21%;
  border-radius: 46% 54% 50% 50%;
  background: radial-gradient(circle at 36% 30%, #eec27a, #d08a43 55%, #9a4d26 100%);
  box-shadow:
    inset -10px -12px 22px rgba(58, 27, 18, 0.4),
    inset 6px 8px 14px rgba(255, 224, 170, 0.5),
    0 8px 14px rgba(58, 27, 18, 0.25);
}
.d1 .food::before {
  content: '';
  position: absolute;
  inset: 16% 22% 42% 16%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 240, 200, 0.75), transparent 70%);
}
.d1 .food::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 24% 58%, #8bb058 0 6%, transparent 7%),
    radial-gradient(circle at 35% 42%, #7da24c 0 4%, transparent 5%),
    radial-gradient(circle at 42% 23%, #f4e9c8 0 5%, transparent 6%),
    radial-gradient(circle at 57% 35%, #ca4a2e 0 4%, transparent 5%),
    radial-gradient(circle at 66% 59%, #8bb058 0 5%, transparent 6%),
    radial-gradient(circle at 50% 73%, #f4e9c8 0 4%, transparent 5%),
    radial-gradient(circle at 72% 33%, #f7edd2 0 3%, transparent 4%);
  opacity: 0.9;
}
.d2 {
  right: 32%;
  top: 16%;
  width: 104px;
  height: 104px;
  background: radial-gradient(circle at 40% 34%, #fffdf8, #f3e2c4 60%, #e3cba4);
  box-shadow: 0 20px 34px -18px rgba(58, 27, 18, 0.4), inset 0 -6px 14px rgba(140, 67, 44, 0.16);
  opacity: 0.9;
  filter: blur(0.4px);
}
.steam {
  position: absolute;
  left: 50%;
  top: -64px;
  width: 96px;
  height: 78px;
  transform: translateX(-50%);
  filter: blur(1.5px);
}
.steam svg {
  width: 100%;
  height: 100%;
}
.steam path {
  fill: none;
  stroke: rgba(255, 252, 243, 0.9);
  stroke-width: 4;
  stroke-linecap: round;
  animation: rise 7s ease-in-out infinite;
}
.steam path:nth-child(2) { animation-delay: 1.2s; }
.steam path:nth-child(3) { animation-delay: 2.1s; }
@keyframes rise {
  0%, 100% { transform: translateY(6px) scaleY(0.9); opacity: 0.15; }
  50% { transform: translateY(-8px) scaleY(1.05); opacity: 0.7; }
}
.tag-float {
  position: absolute;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 250, 240, 0.94);
  border: 1px solid rgba(105, 47, 32, 0.1);
  box-shadow: 0 16px 28px -16px rgba(58, 27, 18, 0.55);
  color: var(--ink-soft);
  font-size: 11.5px;
  white-space: nowrap;
}
.t1 {
  right: 40%;
  top: 47%;
  opacity: clamp(0, calc((var(--p) - 0.12) * 3.6), 1);
  transform: translateY(calc((1 - var(--p)) * 22px));
}
.t2 {
  right: 33%;
  top: 66%;
  opacity: clamp(0, calc((var(--p) - 0.34) * 3.6), 1);
  transform: translateY(calc((1 - var(--p)) * 22px));
}
.t3 {
  right: 9%;
  top: 78%;
  opacity: clamp(0, calc((var(--p) - 0.52) * 3.6), 1);
  transform: translateY(calc((1 - var(--p)) * 22px));
}
.grain {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.15;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");
}

/* 内容层与进度 */
.hero-inner {
  position: relative;
  z-index: 3;
  max-width: 470px;
}
.hero-inner .eyebrow::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 7px;
  border-radius: 50%;
  background: var(--gold);
  vertical-align: 1px;
}
.depth-rail {
  position: absolute;
  left: 44px;
  bottom: 26px;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--ink-mute);
}
.depth-rail .st {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0.42;
  transition: opacity 0.45s ease, color 0.45s ease;
}
.depth-rail .st b {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
}
.depth-rail .st.on {
  opacity: 1;
  color: var(--primary-deep);
}
.depth-rail .link {
  width: 24px;
  height: 1px;
  background: rgba(105, 47, 32, 0.22);
}
.scroll-cue {
  position: absolute;
  left: 50%;
  bottom: 22px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin: 0;
  transform: translateX(-50%);
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--ink-mute);
}
.scroll-cue i {
  width: 1px;
  height: 24px;
  background: linear-gradient(180deg, rgba(140, 67, 44, 0.42), transparent);
  animation: cue 2.6s ease-in-out infinite;
}
@keyframes cue {
  0%, 100% { transform: scaleY(0.5); opacity: 0.4; }
  50% { transform: scaleY(1); opacity: 0.9; }
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  margin: 0 0 10px;
  padding: 5px 13px 5px 11px;
  border-radius: 999px;
  border: 1px solid rgba(105, 47, 32, 0.12);
  background: rgba(255, 250, 240, 0.62);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--primary-deep);
}
h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(36px, 4.4vw, 52px);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: 0.01em;
  color: var(--ink);
  text-shadow: 0 2px 18px rgba(255, 250, 240, 0.72);
}
.sub {
  margin: 10px 0 18px;
  max-width: 22em;
  font-size: 14px;
  line-height: 1.8;
  color: var(--ink-soft);
}
.hero-search {
  width: 100%;
  height: 48px;
  padding: 0 18px;
  border: 1px solid rgba(105, 47, 32, 0.14);
  border-radius: 999px;
  background: rgba(255, 250, 240, 0.78);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 26px -14px rgba(58, 27, 18, 0.4);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.hero-search:focus {
  outline: none;
  border-color: rgba(217, 170, 65, 0.7);
  box-shadow: 0 12px 28px -14px rgba(58, 27, 18, 0.45), 0 0 0 3px rgba(217, 170, 65, 0.18);
}
.filters {
  margin-top: 8px;
}
.budget-row {
  margin-top: 16px;
  align-items: center;
}
.filter-hint {
  flex: none;
  font-size: 12px;
  color: var(--ink-mute);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 720px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
}
@media (min-width: 1000px) {
  .grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  margin-top: 16px;
}
.hero-cta {
  flex: none;
  height: 46px;
  padding: 0 26px;
  font-size: 15px;
  box-shadow: 0 12px 26px -12px rgba(184, 135, 43, 0.6);
}
.hero-hint {
  margin: 0;
  max-width: 15em;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ink-mute);
}
.now {
  margin-top: 20px;
}
.now-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.now-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 14px;
  background: var(--surface);
  box-shadow: var(--shadow);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.now-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
.now-thumb {
  position: relative;
  aspect-ratio: 3 / 2;
  background: var(--surface-2);
}
.now-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.now-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(135deg, #f8efdc 0 10px, #f2e5cb 10px 20px);
  color: #b09a7a;
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 0.12em;
}
.now-body {
  padding: 8px 9px 10px;
}
.now-body h3 {
  margin: 0 0 3px;
  font-size: 13px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.now-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  font-size: 11px;
  color: var(--ink-mute);
}
.now-score {
  font-weight: 700;
  color: var(--primary-deep);
}
.now-why {
  margin: 3px 0 0;
  font-size: 11px;
  color: var(--accent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.now-none {
  margin: 0;
  padding: 10px 0;
  font-size: 12px;
  color: var(--ink-mute);
}
.fresh-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  margin: 14px 0 0;
  padding: 9px 14px;
  border-radius: 12px;
  background: var(--primary-soft);
  font-size: 12px;
  color: var(--primary-deep);
}
.fresh-link {
  flex: none;
  font-weight: 600;
  color: var(--primary-deep);
}
.directions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}
.dir-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 15px 16px 14px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.dir-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}
.dir-tag {
  align-self: flex-start;
  padding: 1px 8px;
  border-radius: 6px;
  background: var(--primary-soft);
  color: var(--primary-deep);
  font-size: 11px;
}
.dir-card.nearby .dir-tag {
  background: var(--primary-soft);
  color: var(--primary-deep);
}
.dir-card h2 {
  margin: 3px 0 0;
  font-family: var(--font-display);
  font-size: 17px;
}
.dir-card p {
  margin: 0;
  font-size: 12px;
  color: var(--ink-mute);
}
.dir-more {
  margin-top: 7px;
  font-size: 12px;
  color: var(--primary-deep);
}
.rank-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--line);
}
.rank-icon {
  flex: none;
  color: var(--gold);
  font-size: 18px;
  line-height: 1;
}
.rank-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.rank-copy strong {
  font-size: 14px;
}
.rank-copy span {
  font-size: 11px;
  color: var(--ink-mute);
}
.rank-more {
  margin-left: auto;
  flex: none;
  font-size: 12px;
  color: var(--primary-deep);
}
.spin-tag {
  align-self: flex-start;
  margin-bottom: 2px;
  padding: 0 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 10px;
}
.spin-card {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: var(--radius);
  background: var(--accent);
  color: #fffaf0;
  box-shadow: var(--shadow);
}
.spin-copy {
  flex: 1 1 200px;
}
.spin-copy h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
}
.spin-copy p {
  margin: 4px 0 0;
  font-size: 13px;
  opacity: 0.78;
}
.spin-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.spin-card .btn-primary {
  background: var(--cream);
  color: var(--accent);
  box-shadow: none;
}
.spin-result {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 8px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
  min-width: 210px;
  min-height: 56px;
  overflow: hidden;
}
.spin-result.rolling {
  opacity: 0.7;
}
.spin-result.rolling .spin-title {
  animation: slot 0.12s linear infinite alternate;
  filter: blur(0.2px);
}
.spin-result.landed {
  background: rgba(255, 255, 255, 0.2);
  animation: land 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.spin-btn {
  min-width: 132px;
  transition: transform 0.12s ease, box-shadow 0.15s ease;
}
.spin-btn:active:not(:disabled) {
  transform: scale(0.96);
}
.spin-title {
  font-weight: 700;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 210px;
}
.spin-sub {
  font-size: 12px;
  opacity: 0.78;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 210px;
}
.spin-reasons {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.5;
  opacity: 0.82;
}
@keyframes slot {
  from {
    transform: translateY(-1px);
  }
  to {
    transform: translateY(1px);
  }
}
@keyframes land {
  0% {
    transform: scale(0.9);
    opacity: 0.5;
  }
  70% {
    transform: scale(1.04);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.canteens {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.canteen {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.canteen-thumb {
  position: relative;
  aspect-ratio: 3 / 2;
  background: var(--surface-2);
}
.canteen-tag {
  position: absolute;
  left: 8px;
  top: 8px;
  padding: 1px 8px;
  border-radius: 6px;
  background: rgba(58, 27, 18, 0.88);
  color: #fffaf0;
  font-size: 11px;
}
.canteen-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.canteen-body {
  padding: 8px 10px 12px;
}
.canteen-body h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 16px;
}
.canteen-rate {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ink-soft);
}
.canteen-body p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--ink-mute);
}
.empty {
  padding: 32px 0;
  text-align: center;
  color: var(--ink-mute);
  font-size: 14px;
}
.pop-enter-active {
  transition: all 0.25s ease;
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.92);
}

/* 中等宽度：收紧餐盘与浮标签，避免压到文案 */
@media (max-width: 1100px) {
  .scene {
    min-height: 600px;
    padding: 40px 34px 34px;
  }
  .hero-inner {
    max-width: 440px;
  }
  .sun {
    width: 360px;
    height: 360px;
    top: -120px;
  }
  .skyline {
    height: 200px;
  }
  .d1 {
    right: 6%;
    top: 44%;
    width: 176px;
    height: 176px;
  }
  .d2 {
    right: 27%;
    top: 28%;
    width: 86px;
    height: 86px;
  }
  .pin-c {
    display: none;
  }
  .t1 {
    right: 31%;
    top: 64%;
  }
  .t2 {
    right: 7%;
    top: 69%;
  }
  .t3 {
    display: none;
  }
}

/* 手机与窄屏：场景改为上下两段，底部留出餐盘带 */
@media (max-width: 899px) {
  .scene {
    min-height: 0;
    padding: 26px 22px 200px;
    border-radius: 22px;
  }
  .hero-inner {
    max-width: none;
  }
  .eyebrow {
    padding: 4px 11px;
    font-size: 10.5px;
  }
  h1 {
    font-size: clamp(30px, 7.4vw, 38px);
    letter-spacing: 0.015em;
  }
  .sub {
    margin: 8px 0 14px;
    font-size: 13px;
  }
  .hero-search {
    height: 44px;
    background: rgba(255, 250, 240, 0.86);
  }
  .hero-actions {
    margin-top: 12px;
  }
  .hero-cta {
    height: 44px;
    padding: 0 22px;
    font-size: 14px;
  }
  .hero-hint {
    max-width: 100%;
  }
  .sun {
    right: -8%;
    top: -110px;
    width: 300px;
    height: 300px;
  }
  .skyline {
    height: 150px;
    opacity: 0.75;
  }
  .sky-glow {
    height: 120px;
  }
  .bokeh {
    filter: blur(3px);
  }
  .b1 {
    right: 4%;
    top: 4%;
    width: 96px;
    height: 96px;
  }
  .b2 {
    right: 46%;
    top: 30%;
    width: 60px;
    height: 60px;
  }
  .b3,
  .pin,
  .scroll-cue {
    display: none;
  }
  .d1 {
    right: 17%;
    top: auto;
    bottom: 28px;
    width: 146px;
    height: 146px;
  }
  .steam {
    top: -46px;
    width: 70px;
    height: 56px;
  }
  .d2 {
    display: none;
  }
  .tag-float {
    font-size: 10.5px;
    padding: 5px 10px;
  }
  .t1 {
    left: 22px;
    right: auto;
    top: auto;
    bottom: 118px;
    opacity: 1;
  }
  .t2 {
    left: 22px;
    right: auto;
    top: auto;
    bottom: 74px;
  }
  .t3 {
    display: none;
  }
  .depth-rail {
    position: static;
    margin-top: 20px;
    font-size: 10.5px;
  }
}

/* 减少动态：保留层次但不位移、不隐藏 */
@media (prefers-reduced-motion: reduce) {
  .layer.far,
  .layer.mid,
  .layer.near {
    transform: none;
  }
  .pin-b,
  .pin-c,
  .t1,
  .t2,
  .t3 {
    opacity: 1;
    transform: none;
  }
  .bokeh,
  .steam path,
  .scroll-cue i {
    animation: none;
  }
}
</style>
