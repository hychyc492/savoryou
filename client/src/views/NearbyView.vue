<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import ShopCard from '../components/ShopCard.vue';
import FoodTagFilter from '../components/FoodTagFilter.vue';
import { state, ratingOf, getTarget } from '../lib/store.js';
import { filterItems, facetCounts, tagsOf } from '../lib/foodTags.js';
import { areaOf, areaCounts, AREAS, featuredIdSet } from '../lib/areas.js';
import { walkMinutes } from '../lib/recommend.js';
import { loadAmap } from '../lib/amap.js';

const route = useRoute();
const view = ref('map');
const scope = ref('featured');
const area = ref('');
const range = ref(2000);
const sort = ref('rating');
const tags = ref([]);
const visible = ref(36);
const mapEl = ref(null);
const mapError = ref('');
const selected = ref(null);

let map = null;
let markers = [];
let mapPromise = null;

const inRange = computed(() => state.shops.filter((s) => s.distance <= range.value));
const featured = computed(() => featuredIdSet());
const scopeBase = computed(() =>
  scope.value === 'featured' ? inRange.value.filter((s) => featured.value.has(s.id)) : inRange.value
);
const scoped = computed(() =>
  area.value ? scopeBase.value.filter((s) => areaOf(s) === area.value) : scopeBase.value
);
const counts = computed(() => facetCounts(scoped.value));
const areaStats = computed(() => areaCounts(scopeBase.value));
const areaList = computed(() => AREAS.filter((a) => a !== '其他' && (areaStats.value.get(a) || 0) > 0));

const list = computed(() => {
  const arr = filterItems(scoped.value, { tags: tags.value });
  if (sort.value === 'rating') {
    arr.sort((a, b) => (ratingOf(b).score ?? 0) - (ratingOf(a).score ?? 0));
  } else {
    arr.sort((a, b) => a.distance - b.distance);
  }
  return arr;
});

const shown = computed(() => list.value.slice(0, visible.value));

const pickedSub = computed(() => {
  const s = selected.value;
  if (!s) return '';
  const tagText = tagsOf(s)
    .filter((t) => t !== '其他')
    .slice(0, 2)
    .join(' · ');
  if (s.kind === 'canteen') return `食堂 · ${s.openHours}`;
  if (s.kind === 'campusShop') return `校内店铺${tagText ? ` · ${tagText}` : ''}`;
  return `步行 ${walkMinutes(s)} 分钟${tagText ? ` · ${tagText}` : ''}`;
});

/** 从详情页跳转过来、但不在当前地图标记里的店铺（校内店铺或超出分页的校外店铺） */
const focusExtra = computed(() => {
  const s = selected.value;
  if (!s || s.kind === 'canteen') return null;
  return shown.value.some((x) => x.id === s.id) ? null : s;
});

function pinEl(item, text, color, active) {
  const el = document.createElement('div');
  const shadow = active
    ? '0 0 0 3px rgba(217,170,65,.42), 0 6px 16px rgba(58,27,18,.26)'
    : '0 4px 10px rgba(58,27,18,.2)';
  const bg = active ? '#d9aa41' : color;
  const fg = active || color === '#d9aa41' ? '#2b1710' : '#fffaf0';
  el.style.cssText = `background:${bg};color:${fg};font-size:${active ? 12 : 11}px;line-height:1;padding:${active ? 7 : 6}px 9px;border-radius:8px;white-space:nowrap;text-align:center;box-shadow:${shadow};font-family:Manrope,-apple-system,sans-serif;cursor:pointer;user-select:none;${active ? 'font-weight:700;' : ''}`;
  el.textContent = text;
  el.dataset.pinId = item.id;
  return el;
}

function onDocClick(e) {
  const target = e.target instanceof Element ? e.target : null;
  if (!target) return;
  const pin = target.closest('[data-pin-id]') || target.closest('.amap-marker')?.querySelector('[data-pin-id]');
  if (!pin) return;
  const id = pin.dataset.pinId;
  const item =
    state.canteens.find((c) => c.id === id) ||
    shown.value.find((s) => s.id === id) ||
    (focusExtra.value?.id === id ? focusExtra.value : null);
  if (!item) return;
  e.preventDefault();
  e.stopPropagation();
  select(item);
}

function select(item) {
  selected.value = item;
  if (map) map.setZoomAndCenter(17, [item.lng, item.lat]);
  drawMarkers();
}

function clearSelection() {
  selected.value = null;
  drawMarkers();
}

function drawMarkers() {
  if (!map || !window.AMap) return;
  markers.forEach((m) => m.setMap(null));
  markers = [];
  const activeId = selected.value?.id;
  for (const c of state.canteens) {
    const active = activeId === c.id;
    const m = new window.AMap.Marker({
      position: [c.lng, c.lat],
      content: pinEl(c, c.shortName, '#3a1b12', active),
      anchor: 'bottom-center',
      title: c.name,
      zIndex: active ? 300 : 120,
    });
    m.setMap(map);
    markers.push(m);
  }
  for (const s of shown.value) {
    const active = activeId === s.id;
    const m = new window.AMap.Marker({
      position: [s.lng, s.lat],
      content: pinEl(s, s.name, '#8c432c', active),
      anchor: 'bottom-center',
      title: s.name,
      zIndex: active ? 300 : 100,
    });
    m.setMap(map);
    markers.push(m);
  }
  const extra = focusExtra.value;
  if (extra) {
    const m = new window.AMap.Marker({
      position: [extra.lng, extra.lat],
      content: pinEl(extra, extra.name, '#d9aa41', true),
      anchor: 'bottom-center',
      title: extra.name,
      zIndex: 300,
    });
    m.setMap(map);
    markers.push(m);
  }
}

async function ensureMap() {
  if (map) {
    drawMarkers();
    return true;
  }
  if (!mapPromise) {
    mapPromise = (async () => {
      try {
        const AMap = await loadAmap();
        map = new AMap.Map(mapEl.value, {
          zoom: 14,
          center: [112.421454, 34.602253],
          viewMode: '2D',
          mapStyle: 'amap://styles/whitesmoke',
        });
        drawMarkers();
        return true;
      } catch (e) {
        mapError.value = e.message || '地图加载失败';
        return false;
      } finally {
        mapPromise = null;
      }
    })();
  }
  return mapPromise;
}

watch(view, (v) => {
  if (v === 'map') nextTick(ensureMap);
});
watch([range, sort, tags], () => {
  visible.value = 36;
});
watch([scope, area], () => {
  visible.value = 36;
});
watch(scope, (v) => {
  sort.value = v === 'featured' ? 'rating' : 'distance';
});
watch(shown, () => {
  if (view.value === 'map') drawMarkers();
});
watch(list, (arr) => {
  if (selected.value?.kind === 'shop' && !arr.some((s) => s.id === selected.value.id)) {
    selected.value = null;
  }
});

onMounted(async () => {
  document.addEventListener('click', onDocClick, true);
  // 默认即展示地图：挂载后立刻初始化，保证一进页面就显眼可见
  await nextTick();
  ensureMap();
  const focusId = route.query.focus;
  if (!focusId) return;
  const item = getTarget(String(focusId));
  if (!item) return;
  view.value = 'map';
  await nextTick();
  if (await ensureMap()) select(item);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true);
  if (map) map.destroy();
  map = null;
});
</script>

<template>
  <section class="head">
    <h1>
      {{ scope === 'featured' ? '校外精选' : range === 2000 ? '校外 2 公里' : '校外 1 公里' }}，{{
        list.length
      }}
      家
    </h1>
    <p v-if="scope === 'featured'">
      按评分、品类与街区均衡挑出的 {{ featured.size }} 家；切到「全部」可看 2 公里内
      {{ state.shops.length }} 家。
    </p>
    <p v-else>
      共收录 2 公里内 {{ state.shops.length }} 家；点口味标签可快速筛店，评分是店铺维度，点开可看评价并打分。
    </p>
  </section>

  <div class="toolbar">
    <div class="seg">
      <button :class="{ on: view === 'map' }" @click="view = 'map'">地图</button>
      <button :class="{ on: view === 'list' }" @click="view = 'list'">列表</button>
    </div>
    <div class="chip-row">
      <button class="chip" :class="{ active: range === 2000 }" @click="range = 2000">2 公里内</button>
      <button class="chip" :class="{ active: range === 1000 }" @click="range = 1000">1 公里内</button>
      <button class="chip" :class="{ active: sort === 'distance' }" @click="sort = 'distance'">按距离</button>
      <button class="chip" :class="{ active: sort === 'rating' }" @click="sort = 'rating'">按评分</button>
    </div>
  </div>

  <div class="chip-row filter-row">
    <button class="chip" :class="{ active: scope === 'featured' }" @click="scope = 'featured'">
      精选 {{ featured.size }}
    </button>
    <button class="chip" :class="{ active: scope === 'all' }" @click="scope = 'all'">
      全部 {{ state.shops.length }}
    </button>
  </div>

  <div class="chip-row filter-row">
    <button class="chip" :class="{ active: !area }" @click="area = ''">全部街区</button>
    <button
      v-for="a in areaList"
      :key="a"
      class="chip"
      :class="{ active: area === a }"
      @click="area = a"
    >
      {{ a }} {{ areaStats.get(a) }}
    </button>
  </div>

  <FoodTagFilter v-model="tags" :counts="counts" class="tag-bar" />

  <div class="layout" :class="{ mapmode: view === 'map' }">
    <div v-show="view === 'map'" class="map-wrap card">
      <div ref="mapEl" class="map"></div>
      <div v-if="selected" class="map-picked">
        <div class="picked-info">
          <span class="picked-name">{{ selected.name }}</span>
          <span class="picked-sub">{{ pickedSub }}</span>
        </div>
        <router-link :to="`/shop/${selected.id}`" class="picked-link">查看详情 →</router-link>
        <button class="picked-close" aria-label="取消高亮" @click="clearSelection">×</button>
      </div>
      <p v-if="mapError" class="map-error">{{ mapError }}（列表仍可正常使用）</p>
      <div class="legend">
        <span><i class="dot canteen"></i>校内食堂地标</span>
        <span><i class="dot shop"></i>校外店铺</span>
      </div>
    </div>

    <div class="list" :class="{ compact: view === 'map' }">
      <p v-if="!list.length" class="empty">
        {{ scope === 'featured' ? '这个街区暂无符合条件精选，切到「全部」看看。' : '没有符合这些标签的店，换个标签试试。' }}
      </p>
      <div class="grid">
        <ShopCard v-for="s in shown" :key="s.id" :item="s" />
      </div>
      <div v-if="shown.length < list.length" class="load-more">
        <button class="btn-primary" @click="visible += 36">
          加载更多（还有 {{ list.length - shown.length }} 家）
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head {
  padding: 6px 2px 14px;
}
.head h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
}
.head p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--ink-soft);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.tag-bar {
  margin-bottom: 14px;
}
.filter-row {
  margin: -2px 0 8px;
}
.seg {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: #ecdfc7;
}
.seg button {
  padding: 5px 16px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--ink-soft);
}
.seg button.on {
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 2px 6px rgba(58, 27, 18, 0.1);
}
.map-wrap {
  position: relative;
  margin-bottom: 14px;
  padding: 6px;
  border: 1px solid rgba(217, 170, 65, 0.42);
  border-radius: calc(var(--radius) + 4px);
  background: rgba(255, 250, 240, 0.9);
  box-shadow: 0 18px 44px rgba(58, 27, 18, 0.16);
}
.map {
  width: 100%;
  height: 52vh;
  min-height: 320px;
  border-radius: var(--radius);
}
.map-picked {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 10px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 8px 12px;
  border-radius: 12px;
  background: rgba(255, 250, 240, 0.97);
  box-shadow: 0 6px 18px rgba(58, 27, 18, 0.16);
}
.picked-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.picked-name {
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.picked-sub {
  font-size: 11px;
  color: var(--ink-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.picked-link {
  flex: none;
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--primary);
  color: var(--ink);
  font-size: 12px;
}
.picked-close {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: var(--ink-mute);
  font-size: 16px;
  line-height: 1;
}
.map-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-soft);
  background: rgba(244, 234, 216, 0.94);
}
.legend {
  position: absolute;
  left: 10px;
  bottom: 10px;
  display: flex;
  gap: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 250, 240, 0.94);
  font-size: 11px;
  color: var(--ink-soft);
  pointer-events: none;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}
.dot.canteen {
  background: #3a1b12;
}
.dot.shop {
  background: #8c432c;
}
.load-more {
  display: flex;
  justify-content: center;
  padding: 20px 0 4px;
}
.empty {
  margin: 8px 0 0;
  padding: 28px 0;
  text-align: center;
  font-size: 14px;
  color: var(--ink-mute);
}
.load-more .btn-primary {
  height: 40px;
  font-size: 13px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 720px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .map {
    height: 56vh;
    min-height: 420px;
  }
}
@media (min-width: 1000px) {
  .layout.mapmode {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 18px;
    align-items: start;
  }
  .layout.mapmode .map-wrap {
    position: sticky;
    top: 96px;
    margin-bottom: 0;
  }
  .layout.mapmode .map {
    height: calc(100vh - 200px);
    min-height: 520px;
  }
  .layout.mapmode .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .layout.mapmode .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
