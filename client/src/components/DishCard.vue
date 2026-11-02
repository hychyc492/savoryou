<script setup>
const props = defineProps({
  dish: { type: Object, required: true },
  stallFallback: { type: String, default: '' },
});

const slots = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', night: '夜宵' };
const slotText = (dish) => (dish.mealSlots || []).map((s) => slots[s] || s).join(' / ');
</script>

<template>
  <div class="dish">
    <div class="left">
      <h4 class="name">{{ dish.name }}</h4>
      <div class="tags">
        <span class="tag neutral">{{ dish.stall || stallFallback }}</span>
        <span v-for="t in dish.tags || []" :key="t" class="tag">{{ t }}</span>
        <span v-if="dish.spicy >= 3" class="tag green">特辣</span>
      </div>
    </div>
    <div class="right">
      <span class="price">¥{{ dish.price }}</span>
      <span class="slot">{{ slotText(dish) }}</span>
    </div>
  </div>
</template>

<style scoped>
.dish {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px dashed var(--line);
}
.dish:last-child {
  border-bottom: none;
}
.left {
  flex: 1;
  min-width: 0;
}
.name {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.right {
  flex: none;
  text-align: right;
}
.price {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: var(--primary-deep);
}
.slot {
  font-size: 11px;
  color: var(--ink-mute);
}
</style>
