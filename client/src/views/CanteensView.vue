<script setup>
import { computed, ref } from 'vue';
import StarRating from '../components/StarRating.vue';
import DishCard from '../components/DishCard.vue';
import ShopCard from '../components/ShopCard.vue';
import FoodTagFilter from '../components/FoodTagFilter.vue';
import { state, ratingOf, dishesFor } from '../lib/store.js';
import { filterItems, facetCounts } from '../lib/foodTags.js';

const tags = ref([]);
const counts = computed(() => facetCounts(state.campusShops));
const campusShopList = computed(() =>
  filterItems(state.campusShops, { tags: tags.value }).sort(
    (a, b) => (ratingOf(b).score ?? 0) - (ratingOf(a).score ?? 0)
  )
);
</script>

<template>
  <section class="intro">
    <h1>校内：{{ state.canteens.length }} 个食堂，{{ state.campusShops.length }} 家店</h1>
    <p>食堂窗口由同学补充，菜品价格为示例；校内店铺来自高德，不显示距离。</p>
  </section>

  <div class="section-head">
    <h2 class="section-title">食堂</h2>
    <span class="section-more">{{ state.canteens.length }} 个</span>
  </div>

  <section v-for="c in state.canteens" :key="c.id" class="canteen card">
    <router-link :to="`/shop/${c.id}`" class="head">
      <img v-if="c.photo" :src="c.photo" :alt="c.name" loading="lazy" class="cover" />
      <div class="head-info">
        <div class="name-row">
          <h2>{{ c.name }}</h2>
          <span class="tag green">食堂</span>
        </div>
        <div class="rate">
          <StarRating :value="ratingOf(c).score || 0" readonly />
          <span class="score">{{ ratingOf(c).score?.toFixed(1) ?? '—' }}</span>
          <span class="label">{{ ratingOf(c).label }}</span>
        </div>
        <p class="muted">{{ c.openHours }} · {{ dishesFor(c.id).length }} 个热门菜品</p>
      </div>
    </router-link>

    <div v-if="dishesFor(c.id).length" class="dishes">
      <DishCard v-for="d in dishesFor(c.id)" :key="d.id" :dish="d" />
    </div>
    <p v-else class="no-dish">还没有菜品信息，欢迎补充。</p>

    <router-link :to="`/shop/${c.id}`" class="more">查看食堂详情与评价 →</router-link>
  </section>

  <div class="section-head shops-head">
    <h2 class="section-title">校内店铺</h2>
    <span class="section-more">{{ campusShopList.length }} / {{ state.campusShops.length }} 家</span>
  </div>

  <FoodTagFilter v-model="tags" :counts="counts" class="tag-bar" />

  <div v-if="campusShopList.length" class="grid">
    <ShopCard v-for="s in campusShopList" :key="s.id" :item="s" />
  </div>
  <p v-else class="empty">没有符合这些标签的店，换个标签试试。</p>
</template>

<style scoped>
.intro {
  padding: 6px 2px 18px;
}
.intro h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
}
.intro p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--ink-soft);
}
.canteen {
  padding: 12px 16px 16px;
  margin-bottom: 16px;
}
.head {
  display: flex;
  gap: 14px;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--line);
}
.cover {
  width: 84px;
  height: 84px;
  border-radius: 14px;
  object-fit: cover;
  flex: none;
}
.head-info h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 19px;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.rate {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.score {
  font-size: 15px;
  font-weight: 700;
  color: var(--primary-deep);
}
.label {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--primary-soft);
  color: var(--primary-deep);
}
.head-info p {
  margin: 2px 0 0;
  font-size: 12px;
}
.dishes {
  padding-top: 4px;
}
.no-dish {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--ink-mute);
}
.more {
  display: block;
  margin-top: 10px;
  text-align: right;
  font-size: 13px;
  color: var(--primary-deep);
}
.shops-head {
  margin-top: 26px;
}
.tag-bar {
  margin-bottom: 12px;
}
.empty {
  padding: 28px 0;
  text-align: center;
  font-size: 14px;
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
  }
}
@media (min-width: 1000px) {
  .grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
