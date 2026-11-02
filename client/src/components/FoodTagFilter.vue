<script setup>
import { FOOD_TAGS } from '../lib/foodTags.js';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  counts: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['update:modelValue']);

function toggle(tag) {
  if (props.modelValue.includes(tag)) {
    emit(
      'update:modelValue',
      props.modelValue.filter((t) => t !== tag)
    );
  } else {
    emit('update:modelValue', [...props.modelValue, tag]);
  }
}
</script>

<template>
  <div class="tag-filter chip-row">
    <button class="chip" :class="{ active: !modelValue.length }" @click="emit('update:modelValue', [])">
      全部
    </button>
    <button
      v-for="tag in FOOD_TAGS"
      :key="tag"
      class="chip"
      :class="{ active: modelValue.includes(tag) }"
      :disabled="!counts[tag] && !modelValue.includes(tag)"
      @click="toggle(tag)"
    >
      {{ tag }}
      <span class="num">{{ counts[tag] ?? 0 }}</span>
    </button>
  </div>
</template>

<style scoped>
.tag-filter {
  align-items: center;
}
.chip:disabled {
  opacity: 0.42;
  cursor: default;
}
.num {
  font-size: 11px;
  opacity: 0.7;
}
.chip.active .num {
  opacity: 0.85;
}
</style>
