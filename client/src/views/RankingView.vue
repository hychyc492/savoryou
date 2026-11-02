<script setup>
import { ref, computed } from 'vue';
import StarRating from '../components/StarRating.vue';
import { state, ratingOf, reviewsFor } from '../lib/store.js';

const group = ref('campus');
const groups = [
  { key: 'campus', label: '校内' },
  { key: 'nearby', label: '校外店铺' },
];

const tab = ref('taste');
const tabs = [
  { key: 'taste', label: '口味榜' },
  { key: 'value', label: '性价比' },
  { key: 'hot', label: '人气榜' },
];

const source = computed(() =>
  group.value === 'campus' ? [...state.canteens, ...state.campusShops] : state.shops
);

const rows = computed(() => {
  const items = source.value.map((item) => {
    const r = ratingOf(item);
    return { item, r, reviewCount: reviewsFor(item.id).length };
  });

  if (tab.value === 'taste') {
    return items
      .filter((x) => x.r.score != null)
      .sort((a, b) => b.r.score - a.r.score || b.reviewCount - a.reviewCount)
      .slice(0, 20);
  }
  if (tab.value === 'hot') {
    return items
      .filter((x) => x.reviewCount > 0)
      .sort((a, b) => b.reviewCount - a.reviewCount || (b.r.score ?? 0) - (a.r.score ?? 0))
      .slice(0, 20);
  }
  return items
    .filter((x) => x.r.score != null && x.item.amapCost > 0)
    .map((x) => ({ ...x, value: (x.r.score * 10) / x.item.amapCost }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 20);
});

function subline(item) {
  if (item.kind === 'canteen' || item.id.startsWith('c-')) return `${item.openHours} · 校内食堂`;
  if (item.kind === 'campusShop') {
    const cost = item.amapCost ? ` · 人均 ¥${item.amapCost}` : '';
    return `${item.category}${cost} · 校内店铺`;
  }
  const cost = item.amapCost ? ` · 人均 ¥${item.amapCost}` : '';
  return `${item.distance}m${cost} · ${item.category}`;
}
</script>

<template>
  <section class="head">
    <h1>排行榜</h1>
    <p>口味看融合星级，人气看评价人数，性价比看分数除以人均。</p>
  </section>

  <div class="chip-row groups">
    <button
      v-for="g in groups"
      :key="g.key"
      class="chip"
      :class="{ active: group === g.key }"
      @click="group = g.key"
    >
      {{ g.label }}
    </button>
  </div>

  <div class="chip-row">
    <button v-for="t in tabs" :key="t.key" class="chip" :class="{ active: tab === t.key }" @click="tab = t.key">
      {{ t.label }}
    </button>
  </div>

  <ol class="board card">
    <li v-for="(row, i) in rows" :key="row.item.id">
      <router-link :to="`/shop/${row.item.id}`" class="row">
        <span class="rank" :class="`r${i + 1}`">{{ i + 1 }}</span>
        <span class="info">
          <span class="name">{{ row.item.name }}</span>
          <span class="sub">{{ subline(row.item) }}</span>
        </span>
        <span class="right">
          <StarRating :value="row.r.score ?? 0" readonly size="sm" />
          <span class="score">{{ row.r.score?.toFixed(1) }}</span>
          <span class="count">{{ row.reviewCount }} 人评</span>
        </span>
      </router-link>
    </li>
  </ol>

  <p v-if="!rows.length" class="empty">这个榜单还没有数据。</p>

  <p class="note">
    评分 =（10 × 高德基准分 + 站内评分之和）/（10 + 评价人数），站内评价少时会贴近高德分。
  </p>
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
.chip-row {
  margin-bottom: 14px;
}
.chip-row.groups {
  margin-bottom: 10px;
}
.board {
  list-style: none;
  margin: 0;
  padding: 4px 14px;
}
.board li + li {
  border-top: 1px solid var(--line);
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}
.rank {
  flex: none;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #efe2c9;
  color: var(--ink-soft);
  font-size: 13px;
  font-weight: 700;
}
.rank.r1 {
  background: var(--primary);
  color: var(--ink);
}
.rank.r2 {
  background: #c9995e;
  color: #fffaf0;
}
.rank.r3 {
  background: #e3cfa8;
  color: var(--primary-deep);
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.name {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  font-size: 12px;
  color: var(--ink-mute);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.right {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.score {
  font-size: 14px;
  font-weight: 700;
  color: var(--primary-deep);
}
.count {
  font-size: 11px;
  color: var(--ink-mute);
}
.empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--ink-mute);
}
.note {
  margin: 12px 4px 0;
  font-size: 12px;
  color: var(--ink-mute);
  line-height: 1.7;
}
</style>
