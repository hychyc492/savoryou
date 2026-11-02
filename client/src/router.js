import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import CanteensView from './views/CanteensView.vue';
import NearbyView from './views/NearbyView.vue';
import RankingView from './views/RankingView.vue';
import FavoritesView from './views/FavoritesView.vue';
import LoginView from './views/LoginView.vue';
import SubmitDishView from './views/SubmitDishView.vue';
import AdminView from './views/AdminView.vue';
import ShopDetailView from './views/ShopDetailView.vue';

export const tabs = [
  { to: '/app', label: '首页', title: '今天吃什么' },
  { to: '/canteens', label: '校内', title: '校内美食' },
  { to: '/nearby', label: '校外', title: '校外美食' },
  { to: '/ranking', label: '排行榜', title: '排行榜' },
  { to: '/favorites', label: '收藏', title: '我的收藏' },
];

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/app' },
    { path: '/app', component: HomeView, meta: { title: '今天吃什么' } },
    { path: '/canteens', component: CanteensView, meta: { title: '校内美食' } },
    { path: '/nearby', component: NearbyView, meta: { title: '校外美食' } },
    { path: '/ranking', component: RankingView, meta: { title: '排行榜' } },
    { path: '/favorites', component: FavoritesView, meta: { title: '我的收藏' } },
    { path: '/login', component: LoginView, meta: { title: '账号' } },
    { path: '/submit-dish', component: SubmitDishView, meta: { title: '补充菜品', immersive: true } },
    { path: '/admin', component: AdminView, meta: { title: '管理员后台' } },
    { path: '/shop/:id', component: ShopDetailView, meta: { title: '店铺详情', immersive: true } },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

router.afterEach((to) => {
  document.title = `${to.meta.title || 'SavorU'} · SavorU`;
});

export default router;
