<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import StarRating from '../components/StarRating.vue';
import DishCard from '../components/DishCard.vue';
import ShareCard from '../components/ShareCard.vue';
import {
  getTarget,
  ratingOf,
  reviewsFor,
  myReviewFor,
  submitReview,
  isFavorite,
  toggleFavorite,
  dishesFor,
  checkin,
  checkedToday,
  checkInAt,
  fetchCheckinStats,
} from '../lib/store.js';
import { isLoggedIn } from '../lib/auth.js';
import { tagsOf, REVIEW_TAGS } from '../lib/foodTags.js';

const route = useRoute();
const router = useRouter();
const loggedIn = isLoggedIn;
const item = computed(() => getTarget(route.params.id));
const isCanteen = computed(() => item.value?.kind === 'canteen' || !!item.value?.id.startsWith('c-'));
const isCampusShop = computed(() => item.value?.kind === 'campusShop');
const kindText = computed(() => (isCanteen.value ? '校内食堂' : isCampusShop.value ? '校内店铺' : '校外店铺'));
const tags = computed(() => tagsOf(item.value).filter((t) => t !== '其他'));
const r = computed(() => ratingOf(item.value));
const reviews = computed(() => (item.value ? reviewsFor(item.value.id) : []));
const dishes = computed(() => (item.value ? dishesFor(item.value.id) : []));
const fav = computed(() => (item.value ? isFavorite(item.value.id) : false));

const myRating = ref(0);
const myTags = ref([]);
const content = ref('');
const bump = ref(false);
const toast = ref('');

const checkStats = ref({ todayCount: 0, total: 0 });
const checked = computed(() => (item.value ? checkedToday(item.value.id) : false));
const shareOpen = ref(false);

async function loadCheckinStats() {
  if (!item.value) return;
  try {
    const data = await fetchCheckinStats(item.value.id);
    checkStats.value = { todayCount: data.todayCount || 0, total: data.total || 0 };
  } catch {
    /* 统计失败不影响详情页 */
  }
}

async function onCheckin() {
  if (!item.value) return;
  if (!loggedIn.value) {
    flash('登录后才能打卡');
    router.push(`/login?redirect=${encodeURIComponent(route.fullPath)}`);
    return;
  }
  if (checked.value) {
    shareOpen.value = true;
    return;
  }
  try {
    const data = await checkInAt(item.value.id);
    checkStats.value = { todayCount: data.todayCount, total: data.total };
    const streak = data.mine?.streak || 0;
    flash(data.already ? '今天已经打过卡了' : streak > 1 ? `打卡成功，已连续 ${streak} 天` : '打卡成功，今天的第一顿');
    shareOpen.value = true;
  } catch (e) {
    flash(e.message);
  }
}

watch(
  item,
  (v) => {
    if (!v) return;
    const mine = myReviewFor(v.id);
    myRating.value = mine?.rating || 0;
    myTags.value = Array.isArray(mine?.tags) ? [...mine.tags] : [];
    content.value = mine?.content || '';
    loadCheckinStats();
  },
  { immediate: true }
);

const sourceText = computed(() => {
  const { n, base } = r.value;
  if (n > 0 && base != null) return `站内 ${n} 人 · 高德基准 ${base}`;
  if (n > 0) return `站内 ${n} 人评分`;
  if (base != null) return '高德评分';
  return '暂无评分';
});

function flash(message) {
  toast.value = message;
  setTimeout(() => (toast.value = ''), 2400);
}

function toggleTag(tag) {
  const i = myTags.value.indexOf(tag);
  if (i >= 0) myTags.value.splice(i, 1);
  else if (myTags.value.length < 3) myTags.value.push(tag);
  else flash('最多选 3 个标签');
}

async function submit() {
  if (!myRating.value || !item.value || loggedIn.value === false) {
    if (loggedIn.value === false) {
      flash('登录后才能打分');
      router.push(`/login?redirect=${encodeURIComponent(route.fullPath)}`);
    }
    return;
  }
  try {
    await submitReview(item.value.id, myRating.value, content.value, myTags.value);
    bump.value = true;
    flash('评分已更新，即刻生效');
    setTimeout(() => (bump.value = false), 520);
  } catch (e) {
    flash(e.message);
  }
}

async function onFav() {
  if (!item.value) return;
  try {
    await toggleFavorite(item.value.id);
    if (!loggedIn.value) flash('已存到本机，登录后会自动同步');
  } catch (e) {
    flash(e.message);
  }
}

const metaRows = computed(() => {
  if (!item.value) return [];
  const rows = [{ label: '地址', value: item.value.address }];
  if (isCanteen.value) rows.push({ label: '营业', value: item.value.openHours });
  else if (isCampusShop.value) {
    if (item.value.category) rows.push({ label: '分类', value: item.value.category });
    if (item.value.openTime) rows.push({ label: '营业', value: item.value.openTime });
    if (item.value.amapCost) rows.push({ label: '人均', value: `¥${item.value.amapCost}` });
    if (item.value.tel) rows.push({ label: '电话', value: item.value.tel });
  } else {
    rows.push({ label: '距离', value: `${item.value.distance} 米` });
    if (item.value.openTime) rows.push({ label: '营业', value: item.value.openTime });
    if (item.value.amapCost) rows.push({ label: '人均', value: `¥${item.value.amapCost}` });
    if (item.value.tel) rows.push({ label: '电话', value: item.value.tel });
  }
  return rows;
});
</script>

<template>
  <div v-if="!item" class="notfound">
    <p>找不到这家店</p>
    <router-link to="/app" class="btn-primary">回首页</router-link>
  </div>

  <template v-else>
    <div class="hero">
      <img v-if="item.photo" :src="item.photo" :alt="item.name" />
      <div v-else class="hero-empty"></div>
      <div class="hero-mask"></div>
      <span class="hero-kind">{{ kindText }}</span>
    </div>

    <section class="summary card">
      <div class="summary-main">
        <h1>{{ item.name }}</h1>
        <div v-if="tags.length" class="tags">
          <span v-for="t in tags" :key="t" class="tag neutral">{{ t }}</span>
        </div>
        <div class="score-row">
          <span class="big" :class="{ bump }">{{ r.score != null ? r.score.toFixed(1) : '—' }}</span>
          <div class="score-side">
            <StarRating :value="r.score || 0" readonly />
            <span class="label">{{ r.label }}</span>
            <span class="source">{{ sourceText }}</span>
          </div>
        </div>
      </div>
      <button class="fav" :class="{ on: fav }" @click="onFav">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path
            d="M12 20s-7-4.4-7-9.3C5 7.9 7 6 9.4 6c1.4 0 2.6.7 2.6 1.9C12 6.7 13.2 6 14.6 6 17 6 19 7.9 19 10.7 19 15.6 12 20 12 20z"
            :fill="fav ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
        </svg>
        <span>{{ fav ? '已收藏' : '收藏' }}</span>
      </button>
    </section>

    <section class="info card">
      <div v-for="row in metaRows" :key="row.label" class="info-row">
        <span class="k">{{ row.label }}</span>
        <span class="v">{{ row.value }}</span>
      </div>
    </section>

    <section class="checkin card">
      <div class="checkin-copy">
        <h2 class="checkin-title">今天吃了这家？</h2>
        <p class="checkin-count">
          <template v-if="checkStats.todayCount">
            今日 {{ checkStats.todayCount }} 人打卡 · 累计 {{ checkStats.total }} 次
          </template>
          <template v-else>来当今天第一个打卡的人</template>
        </p>
        <p v-if="!loggedIn" class="checkin-sub">登录后打卡，记录你的食堂足迹与连续天数。</p>
        <p v-else-if="checkin.streak > 1" class="checkin-sub">已连续打卡 {{ checkin.streak }} 天，保持住。</p>
      </div>
      <div class="checkin-actions">
        <button class="btn-primary checkin-btn" :class="{ done: checked }" @click="onCheckin">
          {{ checked ? '已打卡 · 去分享' : '我吃了这家' }}
        </button>
        <button class="ghost" @click="shareOpen = true">分享卡片</button>
      </div>
    </section>

    <router-link :to="`/nearby?focus=${item.id}`" class="map-jump">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
        <circle cx="12" cy="11" r="2.2" fill="currentColor" />
      </svg>
      <span>在地图中查看位置</span>
    </router-link>

    <router-link
      v-if="isCanteen || isCampusShop"
      :to="`/submit-dish?shop=${item.id}`"
      class="dish-jump"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span>补充菜品 / 窗口信息</span>
    </router-link>

    <section class="rate-box card">
      <h2 class="box-title">给它打个分</h2>
      <p class="hint">
        <template v-if="!loggedIn">
          登录后打分，评分会记到你的账号上。
          <router-link :to="`/login?redirect=${encodeURIComponent(route.fullPath)}`" class="login-link">去登录 →</router-link>
        </template>
        <template v-else>{{ myRating ? '你已打过分，可随时修改' : '打分即时生效，会影响这家店的星级' }}</template>
      </p>
      <div class="input-row">
        <StarRating v-model:value="myRating" size="lg" />
        <span class="my-score">{{ myRating ? `${myRating}.0` : '未选' }}</span>
      </div>
      <div class="tag-row">
        <button
          v-for="t in REVIEW_TAGS"
          :key="t"
          class="chip"
          :class="{ active: myTags.includes(t) }"
          @click="toggleTag(t)"
        >
          {{ t }}
        </button>
      </div>
      <p class="tag-hint">点标签就能评价，最多 3 个 · 文字可留空</p>
      <textarea
        v-model="content"
        rows="3"
        maxlength="200"
        placeholder="说点什么，比如哪道菜值得点、几点去不用排队（可留空）"
      ></textarea>
      <div class="submit-row">
        <span class="count">{{ content.length }}/200</span>
        <button class="btn-primary" :disabled="!myRating" @click="submit">提交评分</button>
      </div>
    </section>

    <section v-if="isCanteen && dishes.length" class="section">
      <div class="section-head">
        <h2 class="section-title">热门菜品</h2>
        <span class="section-more">{{ dishes.length }} 个 · 同学补充</span>
      </div>
      <div class="card dishes">
        <DishCard v-for="d in dishes" :key="d.id" :dish="d" />
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">评价 {{ reviews.length ? `(${reviews.length})` : '' }}</h2>
        <span class="section-more">先发后管</span>
      </div>
      <div v-if="reviews.length" class="card reviews">
        <article v-for="rev in reviews" :key="rev.id" class="review">
          <div class="review-head">
            <span class="avatar">{{ rev.user.slice(0, 1) }}</span>
            <span class="user">{{ rev.user }}</span>
            <span v-if="rev.mine" class="tag mine">我的</span>
            <span v-if="rev.demo" class="demo-badge">演示数据</span>
            <span class="date">{{ rev.date }}</span>
          </div>
          <div class="review-rate"><StarRating :value="rev.rating" readonly size="sm" /></div>
          <div v-if="rev.tags?.length" class="review-tags">
            <span v-for="t in rev.tags" :key="t">{{ t }}</span>
          </div>
          <p v-if="rev.content" class="review-text">{{ rev.content }}</p>
        </article>
      </div>
      <p v-else class="no-review">还没有评价，来当第一个点评的人。</p>
    </section>

    <transition name="fade">
      <p v-if="toast" class="page-toast">{{ toast }}</p>
    </transition>

    <ShareCard
      :open="shareOpen"
      :item="item"
      :score="r.score"
      :today-count="checkStats.todayCount"
      :checked="checked"
      :streak="checkin.streak"
      @close="shareOpen = false"
    />
  </template>
</template>

<style scoped>
.notfound {
  padding: 60px 20px;
  text-align: center;
}
.checkin {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding: 16px 18px;
  background:
    radial-gradient(320px 160px at 92% -20%, rgba(217, 170, 65, 0.3), transparent 72%),
    linear-gradient(135deg, #fdf6e6, #f3e4c2);
}
.checkin-copy {
  flex: 1 1 180px;
}
.checkin-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}
.checkin-count {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--primary-deep);
}
.checkin-sub {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--ink-soft);
}
.checkin-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.checkin-btn {
  height: 40px;
  padding: 0 18px;
  font-size: 14px;
}
.checkin-btn.done {
  background: var(--accent);
  color: #fffaf0;
  box-shadow: 0 6px 16px rgba(58, 27, 18, 0.24);
}
.ghost {
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(105, 47, 32, 0.26);
  background: transparent;
  color: var(--ink-soft);
  font-size: 13px;
}
.notfound p {
  font-size: 16px;
  margin-bottom: 16px;
}
.hero {
  position: relative;
  margin: -16px -16px 0;
  height: 220px;
  overflow: hidden;
  background: var(--surface-2);
}
.hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero-empty {
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(135deg, #f8efdc 0 16px, #f2e5cb 16px 32px);
}
.hero-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(58, 27, 18, 0.2) 0%, rgba(58, 27, 18, 0) 40%, rgba(244, 234, 216, 0.92) 100%);
}
.hero-kind {
  position: absolute;
  left: 16px;
  top: 14px;
  padding: 2px 10px;
  border-radius: 6px;
  background: rgba(58, 27, 18, 0.88);
  color: #fffaf0;
  font-size: 11px;
}
.summary {
  position: relative;
  z-index: 2;
  margin-top: -46px;
  padding: 16px 18px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.summary-main {
  flex: 1;
  min-width: 0;
}
h1 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 1.3;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: -2px 0 8px;
}
.score-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.big {
  font-family: var(--font-display);
  font-size: 38px;
  font-weight: 700;
  color: var(--primary-deep);
  line-height: 1;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.3s ease;
}
.big.bump {
  transform: scale(1.22);
  color: var(--gold);
}
.score-side {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.label {
  font-size: 12px;
  color: var(--primary-deep);
  background: var(--primary-soft);
  padding: 0 8px;
  border-radius: 4px;
  align-self: flex-start;
}
.source {
  font-size: 11px;
  color: var(--ink-mute);
}
.fav {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 12px;
  color: var(--ink-soft);
  font-size: 11px;
  transition: all 0.16s ease;
}
.fav.on {
  color: var(--primary);
  background: var(--primary-soft);
}
.info {
  margin-top: 12px;
  padding: 6px 18px;
}
.info-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px dashed var(--line);
}
.info-row:last-child {
  border-bottom: none;
}
.k {
  flex: none;
  width: 40px;
  color: var(--ink-mute);
}
.v {
  flex: 1;
  color: var(--ink);
}
.map-jump {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 44px;
  margin-top: 12px;
  border-radius: 999px;
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  transition: background 0.16s ease;
}
.map-jump:hover {
  background: #f6e9c9;
  border-color: var(--primary-deep);
}
.dish-jump {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  margin-top: 8px;
  border-radius: 999px;
  border: 1px dashed var(--line);
  color: var(--ink-soft);
  font-size: 13px;
}
.dish-jump:hover {
  border-color: var(--primary);
  color: var(--primary-deep);
}
.rate-box {
  margin-top: 12px;
  padding: 16px 18px;
}
.box-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}
.hint {
  margin: 2px 0 12px;
  font-size: 12px;
  color: var(--ink-mute);
}
.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.my-score {
  font-size: 14px;
  font-weight: 700;
  color: var(--primary-deep);
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 4px;
}
.tag-row .chip {
  font-size: 12px;
  padding: 5px 12px;
}
.tag-hint {
  margin: 4px 0 10px;
  font-size: 11px;
  color: var(--ink-mute);
}
.review-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 5px 0 0;
}
.review-tags span {
  padding: 1px 8px;
  border-radius: 6px;
  background: var(--primary-soft);
  color: var(--primary-deep);
  font-size: 11px;
}
textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-2);
  resize: vertical;
  line-height: 1.6;
}
.submit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}
.count {
  font-size: 11px;
  color: var(--ink-mute);
}
.btn-primary {
  height: 40px;
  padding: 0 20px;
  font-size: 14px;
}
.login-link {
  margin-left: 4px;
  color: var(--primary-deep);
  font-weight: 600;
}
.tag.mine {
  background: var(--primary-soft);
  color: var(--primary-deep);
}
.page-toast {
  position: fixed;
  left: 50%;
  bottom: 86px;
  z-index: 70;
  transform: translateX(-50%);
  max-width: calc(100vw - 32px);
  margin: 0;
  padding: 9px 18px;
  border-radius: 999px;
  background: rgba(58, 27, 18, 0.92);
  color: #fffaf0;
  font-size: 13px;
  line-height: 1.5;
  box-shadow: 0 8px 24px rgba(58, 27, 18, 0.24);
}
.dishes {
  padding: 4px 16px;
}
.reviews {
  padding: 4px 16px;
}
.review {
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}
.review:last-child {
  border-bottom: none;
}
.review-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent);
  color: #fffaf0;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.user {
  font-weight: 600;
}
.date {
  margin-left: auto;
  font-size: 11px;
  color: var(--ink-mute);
}
.review-rate {
  margin: 4px 0 4px 32px;
}
.review-text {
  margin: 0 0 0 32px;
  font-size: 13px;
  color: var(--ink-soft);
  line-height: 1.7;
}
.no-review {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--ink-mute);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@media (min-width: 900px) {
  .hero {
    margin: -24px -32px 0;
    height: 340px;
    border-radius: 0;
  }
  .summary {
    margin-top: -56px;
    padding: 20px 24px;
  }
  .info,
  .rate-box {
    margin-top: 14px;
  }
}
</style>
