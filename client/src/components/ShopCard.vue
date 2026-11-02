<script setup>
import { computed } from 'vue';
import StarRating from './StarRating.vue';
import { ratingOf } from '../lib/store.js';
import { tagsOf } from '../lib/foodTags.js';
import { walkMinutes } from '../lib/recommend.js';

const props = defineProps({
  item: { type: Object, required: true },
});

const r = computed(() => ratingOf(props.item));
const isCanteen = computed(() => props.item.kind === 'canteen' || props.item.id.startsWith('c-'));
const isCampusShop = computed(() => props.item.kind === 'campusShop');
const badge = computed(() => (isCanteen.value ? '食堂' : isCampusShop.value ? '校内' : '校外'));
const tags = computed(() => tagsOf(props.item).filter((t) => t !== '其他').slice(0, 2));
const metaLine = computed(() => {
  const parts = [];
  if (isCanteen.value) {
    parts.push(props.item.openHours);
  } else if (isCampusShop.value) {
    parts.push(props.item.category);
    if (props.item.amapCost) parts.push(`人均 ¥${props.item.amapCost}`);
  } else {
    parts.push(`步行 ${walkMinutes(props.item)} 分钟`);
    if (props.item.amapCost) parts.push(`人均 ¥${props.item.amapCost}`);
  }
  return parts.filter(Boolean).join(' · ');
});
</script>

<template>
  <router-link :to="`/shop/${item.id}`" class="shop-card">
    <div class="thumb">
      <img v-if="item.photo" :src="item.photo" :alt="item.name" loading="lazy" />
      <div v-else class="thumb-empty"><span>SavorU</span></div>
      <span v-if="r.score" class="score">{{ r.score.toFixed(1) }}</span>
      <span v-if="badge" class="kind">{{ badge }}</span>
    </div>
    <div class="body">
      <h3 class="name">{{ item.name }}</h3>
      <div v-if="tags.length" class="tags">
        <span v-for="t in tags" :key="t" class="tag neutral">{{ t }}</span>
      </div>
      <div class="meta">
        <StarRating :value="r.score || 0" readonly size="sm" />
        <span class="label">{{ r.label }}</span>
      </div>
      <div class="meta-line">{{ metaLine }}</div>
    </div>
  </router-link>
</template>

<style scoped>
.shop-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid rgba(105, 47, 32, 0.12);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.shop-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}
.thumb {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--surface-2);
  overflow: hidden;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}
.shop-card:hover .thumb img {
  transform: scale(1.04);
}
.thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(135deg, #f8efdc 0 12px, #f2e5cb 12px 24px);
  color: #b09a7a;
  font-family: var(--font-display);
  font-size: 15px;
  letter-spacing: 0.16em;
}
.score {
  position: absolute;
  right: 8px;
  top: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--primary);
  color: var(--ink);
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(58, 27, 18, 0.18);
}
.kind {
  position: absolute;
  left: 8px;
  top: 8px;
  padding: 1px 8px;
  border-radius: 6px;
  background: rgba(58, 27, 18, 0.88);
  color: #fffaf0;
  font-size: 11px;
}
.body {
  padding: 10px 12px 12px;
}
.name {
  margin: 0 0 4px;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0 0 4px;
}
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
}
.label {
  font-size: 11px;
  color: var(--primary-deep);
  background: var(--primary-soft);
  padding: 0 6px;
  border-radius: 4px;
}
.meta-line {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ink-mute);
}
</style>
