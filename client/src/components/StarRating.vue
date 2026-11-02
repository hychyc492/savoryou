<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  value: { type: Number, default: 0 },
  readonly: { type: Boolean, default: false },
  size: { type: String, default: 'md' },
});
const emit = defineEmits(['update:value']);

const hover = ref(0);
const current = computed(() => (props.readonly ? props.value : hover.value || props.value));
const pct = computed(() => (Math.max(0, Math.min(5, current.value)) / 5) * 100);
</script>

<template>
  <div class="stars" :class="[size, { interactive: !readonly }]" @mouseleave="hover = 0">
    <template v-if="readonly">
      <span class="layer base">★★★★★</span>
      <span class="layer fill" :style="{ width: pct + '%' }">★★★★★</span>
    </template>
    <template v-else>
      <button
        v-for="i in 5"
        :key="i"
        type="button"
        class="hit"
        :aria-label="`${i} 星`"
        @mouseenter="hover = i"
        @click="emit('update:value', i)"
      >
        <span :class="{ on: i <= Math.round(current) }">★</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.stars {
  position: relative;
  display: inline-block;
  line-height: 1;
  letter-spacing: 2px;
  font-size: 15px;
  white-space: nowrap;
  vertical-align: middle;
}
.stars.lg {
  font-size: 22px;
  letter-spacing: 3px;
}
.stars.sm {
  font-size: 12px;
  letter-spacing: 1px;
}
.layer {
  display: inline-block;
  color: rgba(105, 47, 32, 0.18);
}
.layer.fill {
  position: absolute;
  inset: 0 auto 0 0;
  overflow: hidden;
  color: var(--gold);
}
.hit {
  padding: 0 1px;
  font-size: inherit;
  line-height: 1;
  color: rgba(105, 47, 32, 0.18);
  transition: color 0.12s ease, transform 0.12s ease;
}
.hit span.on {
  color: var(--gold);
}
.hit:hover {
  transform: scale(1.12);
}
</style>
