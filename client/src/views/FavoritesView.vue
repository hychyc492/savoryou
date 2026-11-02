<script setup>
import { computed } from 'vue';
import ShopCard from '../components/ShopCard.vue';
import { state, getTarget } from '../lib/store.js';
import { auth, isLoggedIn } from '../lib/auth.js';

const items = computed(() => state.favorites.map((id) => getTarget(id)).filter(Boolean));
const campusItems = computed(() => items.value.filter((item) => item.group === 'campus'));
const nearbyItems = computed(() => items.value.filter((item) => item.group === 'nearby'));
</script>

<template>
  <section class="head">
    <h1>我的收藏</h1>
    <p>想吃的先存着，纠结时再从里面挑。</p>
    <p v-if="!isLoggedIn" class="guest">
      未登录，收藏只保存在本机。
      <router-link to="/login?redirect=/favorites" class="guest-link">登录后同步 →</router-link>
    </p>
    <p v-else class="guest">已登录 {{ auth.user.username }}，收藏已同步到账号。</p>
  </section>

  <template v-if="items.length">
    <div class="section-head">
      <h2 class="section-title">校内</h2>
      <span class="section-more">{{ campusItems.length }} 个</span>
    </div>
    <div v-if="campusItems.length" class="grid">
      <ShopCard v-for="item in campusItems" :key="item.id" :item="item" />
    </div>
    <p v-else class="none">还没有收藏校内的食堂或店铺。</p>

    <div class="section-head nearby-head">
      <h2 class="section-title">校外</h2>
      <span class="section-more">{{ nearbyItems.length }} 家</span>
    </div>
    <div v-if="nearbyItems.length" class="grid">
      <ShopCard v-for="item in nearbyItems" :key="item.id" :item="item" />
    </div>
    <p v-else class="none">还没有收藏校外的店铺。</p>
  </template>

  <div v-else class="empty">
    <svg viewBox="0 0 120 90" width="132" height="100" aria-hidden="true">
      <path d="M18 40h84a42 42 0 0 1-84 0z" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M14 40h92" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" />
      <path d="M44 26c0 5-5 5-5 9M60 22c0 5-5 5-5 9M76 26c0 5-5 5-5 9" fill="none" stroke="var(--ink-mute)" stroke-width="2" stroke-linecap="round" />
      <path d="M34 54h52" stroke="var(--line)" stroke-width="3" stroke-linecap="round" />
    </svg>
    <p>还没有收藏</p>
    <p class="muted">去校内或校外逛逛，点店铺里的收藏就能存下来。</p>
    <router-link to="/app" class="btn-primary">去逛逛</router-link>
  </div>
</template>

<style scoped>
.head {
  padding: 6px 2px 18px;
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
.head .guest {
  margin-top: 10px;
  font-size: 12px;
  color: var(--ink-mute);
}
.guest-link {
  color: var(--primary-deep);
  font-weight: 600;
}
.nearby-head {
  margin-top: 26px;
}
.none {
  margin: 0 0 6px;
  font-size: 13px;
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
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  text-align: center;
}
.empty p {
  margin: 10px 0 0;
  font-size: 15px;
  font-weight: 600;
}
.empty p.muted {
  margin-top: 4px;
  font-size: 13px;
  font-weight: 400;
}
.empty .btn-primary {
  margin-top: 18px;
}
</style>
