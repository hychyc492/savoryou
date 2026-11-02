<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { isLoggedIn } from '../lib/auth.js';
import { state } from '../lib/store.js';

const route = useRoute();

const tabs = [
  {
    to: '/app',
    label: '首页',
    match: (p) => p === '/app',
    path: 'M4 11.5 12 4l8 7.5M6 10v9h4.5v-5h3v5H18v-9',
  },
  {
    to: '/canteens',
    label: '校内',
    match: (p) => p === '/canteens',
    path: 'M4 10h16a8 8 0 0 1-16 0zM8 6.5c0 1.6 1.6 1.6 1.6 3.2M12 5c0 1.6 1.6 1.6 1.6 3.2M16 6.5c0 1.6 1.6 1.6 1.6 3.2',
  },
  {
    to: '/nearby',
    label: '校外',
    match: (p) => p === '/nearby',
    path: 'M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10zM12 9.6a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z',
  },
  {
    to: '/favorites',
    label: '收藏',
    match: (p) => p === '/favorites',
    path: 'M12 20s-7-4.4-7-9.3C5 7.9 7 6 9.4 6c1.4 0 2.6.7 2.6 1.9C12 6.7 13.2 6 14.6 6 17 6 19 7.9 19 10.7 19 15.6 12 20 12 20z',
  },
  {
    to: '/login',
    label: '我的',
    match: (p) => p === '/login',
    path: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM4.5 19c1.6-3.4 4.2-5 7.5-5s5.9 1.6 7.5 5',
  },
];

const favCount = computed(() => state.favorites.length);
const current = computed(() => route.path);
</script>

<template>
  <nav class="bottom-nav" aria-label="主导航">
    <router-link
      v-for="t in tabs"
      :key="t.to"
      :to="t.to"
      class="nav-item"
      :class="{ on: t.match(current) }"
    >
      <span class="icon-wrap">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            :d="t.path"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span v-if="t.to === '/favorites' && favCount" class="badge">{{ favCount > 99 ? '99+' : favCount }}</span>
        <span v-if="t.to === '/login' && isLoggedIn" class="dot"></span>
      </span>
      <span class="label">{{ t.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  padding: 4px 6px calc(4px + env(safe-area-inset-bottom));
  background: rgba(244, 234, 216, 0.94);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(105, 47, 32, 0.16);
}
.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 5px 0 3px;
  border-radius: 12px;
  color: var(--ink-mute);
  transition: color 0.16s ease, transform 0.16s ease;
}
.nav-item:active {
  transform: scale(0.92);
}
.nav-item.on {
  color: var(--primary-deep);
}
.nav-item.on .label {
  color: var(--primary-deep);
  font-weight: 700;
}
.icon-wrap {
  position: relative;
  display: inline-flex;
}
.badge {
  position: absolute;
  top: -4px;
  right: -10px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--accent);
  color: #fffaf0;
  font-size: 10px;
  line-height: 15px;
  text-align: center;
}
.dot {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
}
.label {
  font-size: 11px;
  line-height: 1.3;
}
@media (min-width: 900px) {
  .bottom-nav {
    display: none;
  }
}
</style>
