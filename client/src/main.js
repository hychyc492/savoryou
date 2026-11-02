import { createApp } from 'vue';
import App from './App.vue';
import router from './router.js';
import { initStore } from './lib/store.js';
import './styles/global.css';

initStore()
  .then(() => createApp(App).use(router).mount('#app'))
  .catch((err) => {
    console.error('数据加载失败', err);
    document.getElementById('app').innerHTML =
      '<p style="padding:40px;font-family:sans-serif">数据加载失败，请确认 public/data/shops.json 存在。</p>';
  });

// 生产构建才注册 Service Worker，避免开发时缓存干扰热更新
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker 注册失败', err);
    });
  });
}
