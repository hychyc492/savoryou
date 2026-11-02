<script setup>
import AppHeader from './components/AppHeader.vue';
import BottomNav from './components/BottomNav.vue';
</script>

<template>
  <AppHeader />
  <main class="app-main">
    <router-view v-slot="{ Component }">
      <div class="view fade-in">
        <component :is="Component" />
      </div>
    </router-view>
  </main>
  <footer class="foot">
    <p>SavorU · 河科大美食地图</p>
    <p class="muted">
      店铺评分与图片来自高德地图，菜品信息为原型示例数据
    </p>
  </footer>
  <BottomNav />
</template>

<style scoped>
.foot {
  padding: 28px 16px 40px;
  text-align: center;
  font-size: 12px;
  background: var(--accent);
  color: rgba(255, 250, 231, 0.68);
}
.foot p {
  margin: 2px 0;
}
.foot p:first-child {
  color: #fffaf0;
  font-family: var(--font-display);
  font-size: 15px;
  letter-spacing: 0.04em;
}
.foot .muted {
  color: rgba(255, 250, 231, 0.5);
}
@media (max-width: 899px) {
  .foot {
    padding-bottom: calc(84px + env(safe-area-inset-bottom));
  }
}
</style>
