<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { tabs } from '../router.js';
import { state, dishesFor } from '../lib/store.js';
import { matchKeyword, tagsOf } from '../lib/foodTags.js';
import { auth, isLoggedIn } from '../lib/auth.js';

const route = useRoute();
const router = useRouter();
const searchOpen = ref(false);
const q = ref('');

const immersive = computed(() => !!route.meta.immersive);
const title = computed(() => route.meta.title || 'SavorU');

const results = computed(() => {
  const kw = q.value.trim();
  const campus = [];
  const nearby = [];
  if (!kw) return { campus, nearby };
  for (const c of state.canteens) {
    const tags = tagsOf(c).filter((t) => t !== '其他').slice(0, 2).join(' / ');
    if (c.name.includes(kw)) campus.push({ kind: '食堂', name: c.name, sub: tags || '校内', id: c.id });
    for (const d of dishesFor(c.id)) {
      if (d.name.includes(kw)) campus.push({ kind: '菜品', name: d.name, sub: `${c.shortName} · ${d.stall}`, id: c.id });
    }
    if (!c.name.includes(kw) && matchKeyword(c, kw)) {
      campus.push({ kind: '食堂', name: c.name, sub: tags || '校内', id: c.id });
    }
  }
  for (const s of state.campusShops) {
    if (matchKeyword(s, kw)) {
      const tags = tagsOf(s).filter((t) => t !== '其他').slice(0, 2).join(' / ');
      campus.push({ kind: '校内店', name: s.name, sub: tags || s.category, id: s.id });
    }
  }
  for (const s of state.shops) {
    if (matchKeyword(s, kw)) {
      const tags = tagsOf(s).filter((t) => t !== '其他').slice(0, 2).join(' / ');
      nearby.push({ kind: '校外店', name: s.name, sub: `${s.distance}m · ${tags || s.category}`, id: s.id });
    }
  }
  return { campus: campus.slice(0, 6), nearby: nearby.slice(0, 6) };
});

const hasResults = computed(() => results.value.campus.length > 0 || results.value.nearby.length > 0);

function go(id) {
  searchOpen.value = false;
  q.value = '';
  router.push(`/shop/${id}`);
}
</script>

<template>
  <header class="app-header">
    <div class="bar">
      <button v-if="immersive" class="icon-btn" aria-label="返回" @click="router.back()">
        <svg viewBox="0 0 24 24" width="20" height="20"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <router-link v-else to="/app" class="brand">
        <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
          <path d="M4 15h24a12 12 0 0 1-24 0z" fill="var(--primary)" />
          <path d="M10 8c0 2 2 2 2 4M16 6c0 2 2 2 2 4M22 8c0 2 2 2 2 4" fill="none" stroke="var(--primary)" stroke-width="1.8" stroke-linecap="round" opacity=".7" />
        </svg>
        <span>SavorU</span>
      </router-link>

      <div class="page-title">{{ title }}</div>

      <div class="actions">
        <button class="icon-btn" aria-label="搜索" @click="searchOpen = !searchOpen">
          <svg viewBox="0 0 24 24" width="19" height="19"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2" /><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
        <button class="icon-btn account" :class="{ on: isLoggedIn }" aria-label="个人中心" @click="router.push('/login')">
          <span v-if="isLoggedIn" class="me">{{ auth.user.username.slice(0, 1) }}</span>
          <svg v-else viewBox="0 0 24 24" width="19" height="19"><circle cx="12" cy="8.5" r="3.5" fill="none" stroke="currentColor" stroke-width="2" /><path d="M4.5 19c1.6-3.4 4.2-5 7.5-5s5.9 1.6 7.5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      </div>

      <nav v-if="!immersive" class="tabs">
        <router-link v-for="t in tabs" :key="t.to" :to="t.to" class="tab">{{ t.label }}</router-link>
      </nav>
    </div>

    <div v-if="searchOpen" class="search-panel">
      <input v-model="q" type="search" placeholder="搜菜名、店名、窗口" autofocus />
      <div v-if="hasResults" class="search-results">
        <section v-if="results.campus.length" class="search-group">
          <p class="group-label">校内</p>
          <ul>
            <li v-for="(r, i) in results.campus" :key="`c-${i}`" @click="go(r.id)">
              <span class="kind">{{ r.kind }}</span>
              <span class="name">{{ r.name }}</span>
              <span class="sub">{{ r.sub }}</span>
            </li>
          </ul>
        </section>
        <section v-if="results.nearby.length" class="search-group">
          <p class="group-label">校外</p>
          <ul>
            <li v-for="(r, i) in results.nearby" :key="`n-${i}`" @click="go(r.id)">
              <span class="kind">{{ r.kind }}</span>
              <span class="name">{{ r.name }}</span>
              <span class="sub">{{ r.sub }}</span>
            </li>
          </ul>
        </section>
      </div>
      <p v-else class="search-empty">{{ q ? '没找到，试试别的关键词' : '输入关键词开始搜索' }}</p>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(244, 234, 216, 0.86);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(105, 47, 32, 0.14);
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  max-width: 1120px;
  margin: 0 auto;
  padding: 8px 16px 0;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ink);
  order: 1;
}
.page-title {
  flex: 1;
  text-align: center;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-soft);
  order: 2;
}
.actions {
  order: 3;
  margin-left: auto;
  display: flex;
  gap: 2px;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--ink-soft);
  transition: background 0.16s ease, color 0.16s ease;
}
.icon-btn:hover {
  background: var(--primary-soft);
  color: var(--primary-deep);
}
.me {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--ink);
  font-size: 12px;
  font-weight: 700;
}
.account.on {
  background: var(--primary-soft);
}
.tabs {
  order: 4;
  width: 100%;
  display: none;
  gap: 20px;
  overflow-x: auto;
  padding: 8px 0 10px;
  scrollbar-width: none;
}
.tabs::-webkit-scrollbar {
  display: none;
}
.tab {
  position: relative;
  padding: 2px 0;
  font-size: 14px;
  color: var(--ink-soft);
  white-space: nowrap;
  transition: color 0.16s ease;
}
.tab.router-link-active {
  color: var(--ink);
  font-weight: 700;
}
.tab.router-link-active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 18px;
  height: 3px;
  border-radius: 2px;
  background: var(--primary);
  transform: translateX(-50%);
}
.search-panel {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 16px 12px;
}
.search-panel input {
  width: 100%;
  height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
}
.search-results {
  margin-top: 8px;
  background: var(--surface);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.search-group + .search-group {
  border-top: 1px solid var(--line);
}
.group-label {
  margin: 0;
  padding: 8px 14px 2px;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ink-mute);
}
.search-group ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.search-results li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  font-size: 14px;
}
.search-results li:last-child {
  border-bottom: none;
}
.search-results li:hover {
  background: var(--surface-2);
}
.kind {
  flex: none;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--primary-soft);
  color: var(--primary-deep);
}
.name {
  font-weight: 600;
}
.sub {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink-mute);
}
.search-empty {
  margin: 10px 2px 0;
  font-size: 13px;
  color: var(--ink-mute);
}
@media (min-width: 900px) {
  .bar {
    padding: 12px 32px;
    flex-wrap: nowrap;
  }
  .page-title {
    display: none;
  }
  .tabs {
    order: 2;
    width: auto;
    display: flex;
    margin-left: 28px;
    padding: 0;
    gap: 26px;
  }
  .actions {
    order: 3;
  }
  .tab.router-link-active::after {
    bottom: -18px;
  }
  .search-panel {
    padding: 0 32px 14px;
  }
}
</style>
