<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { state, submitDish, mySubmissions } from '../lib/store.js';
import { auth, isLoggedIn } from '../lib/auth.js';

const route = useRoute();

const SLOTS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'night', label: '夜宵' },
];
const STATUS = { pending: '待审核', published: '已通过', rejected: '已驳回' };

const shops = computed(() => [
  ...state.canteens.map((s) => ({ id: s.id, label: `食堂 · ${s.name}` })),
  ...state.campusShops.map((s) => ({ id: s.id, label: `校内店 · ${s.name}` })),
]);

const restaurantId = ref('');
const name = ref('');
const price = ref('');
const stall = ref('');
const spicy = ref(0);
const slots = ref(['lunch', 'dinner']);
const tagText = ref('');
const error = ref('');
const notice = ref('');
const busy = ref(false);
const mine = ref([]);

const loginPath = computed(() => `/login?redirect=${encodeURIComponent(route.fullPath)}`);

onMounted(() => {
  const q = String(route.query.shop || '');
  restaurantId.value = shops.value.some((s) => s.id === q) ? q : state.canteens[0]?.id || '';
  if (isLoggedIn.value) loadMine();
});

watch(isLoggedIn, (v) => {
  if (v) loadMine();
});

async function loadMine() {
  try {
    mine.value = await mySubmissions();
  } catch {
    mine.value = [];
  }
}

function toggleSlot(key) {
  const idx = slots.value.indexOf(key);
  if (idx >= 0) slots.value.splice(idx, 1);
  else slots.value.push(key);
}

async function submit() {
  if (busy.value) return;
  error.value = '';
  notice.value = '';
  if (!name.value.trim()) {
    error.value = '先写菜名';
    return;
  }
  const yuan = price.value === '' ? null : Number(price.value);
  if (yuan !== null && (!Number.isInteger(yuan) || yuan < 1 || yuan > 999)) {
    error.value = '价格填 1–999 的整数，或留空';
    return;
  }
  const tags = tagText.value
    .split(/[,，、\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6);

  busy.value = true;
  try {
    await submitDish({
      restaurantId: restaurantId.value,
      name: name.value.trim(),
      price: yuan,
      stall: stall.value.trim(),
      spicy: spicy.value,
      mealSlots: slots.value,
      tags,
    });
    notice.value = '已提交，管理员审核通过后会出现在学校食堂页面';
    name.value = '';
    price.value = '';
    stall.value = '';
    tagText.value = '';
    await loadMine();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="intro">
    <h1>补充菜品 / 窗口</h1>
    <p>你填的信息会先进入审核队列，管理员通过后公开显示。菜名、窗口尽量写全，价格填不准可以留空。</p>
  </section>

  <section v-if="!isLoggedIn" class="panel card">
    <p class="eyebrow">需要登录</p>
    <h2>登录后才能提交</h2>
    <p class="sub">提交会记在你的账号下，方便查看审核结果。</p>
    <router-link :to="loginPath" class="btn-primary">去登录 →</router-link>
  </section>

  <template v-else>
    <section class="panel card">
      <div class="me-row">
        <span class="avatar">{{ auth.user.username.slice(0, 1) }}</span>
        <span class="muted">以 {{ auth.user.username }} 的身份提交</span>
      </div>

      <label class="field">
        <span>提交到哪家</span>
        <select v-model="restaurantId">
          <option v-for="s in shops" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
      </label>

      <label class="field">
        <span>菜名</span>
        <input v-model="name" type="text" maxlength="20" placeholder="比如 麻辣香锅（自选）" />
      </label>

      <div class="row">
        <label class="field half">
          <span>价格（元，可留空）</span>
          <input v-model="price" type="number" min="1" max="999" placeholder="18" />
        </label>
        <label class="field half">
          <span>窗口 / 楼层</span>
          <input v-model="stall" type="text" maxlength="20" placeholder="2F 川湘窗口" />
        </label>
      </div>

      <div class="field">
        <span>辣度</span>
        <div class="seg">
          <button v-for="n in [0, 1, 2, 3]" :key="n" :class="{ on: spicy === n }" @click="spicy = n">
            {{ ['不辣', '微辣', '中辣', '特辣'][n] }}
          </button>
        </div>
      </div>

      <div class="field">
        <span>供应时段</span>
        <div class="seg">
          <button
            v-for="s in SLOTS"
            :key="s.key"
            :class="{ on: slots.includes(s.key) }"
            @click="toggleSlot(s.key)"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <label class="field">
        <span>标签（最多 6 个，用逗号分隔）</span>
        <input v-model="tagText" type="text" maxlength="60" placeholder="下饭, 量大" />
      </label>

      <button class="btn-primary submit" :disabled="busy" @click="submit">
        {{ busy ? '提交中…' : '提交待审核' }}
      </button>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="notice" class="notice">{{ notice }}</p>
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">我的提交</h2>
        <span class="section-more">{{ mine.length }} 条</span>
      </div>
      <div v-if="mine.length" class="card mine-list">
        <article v-for="d in mine" :key="d.id" class="mine-item">
          <div class="mine-head">
            <span class="dish-name">{{ d.name }}</span>
            <span class="tag" :class="d.status === 'published' ? 'green' : d.status === 'rejected' ? 'neutral' : ''">
              {{ STATUS[d.status] || d.status }}
            </span>
            <span class="date">{{ d.date }}</span>
          </div>
          <p class="meta">
            {{ d.price ? `¥${d.price}` : '价格未填' }}<template v-if="d.stall"> · {{ d.stall }}</template>
            · {{ shops.find((s) => s.id === d.restaurantId)?.label.replace('食堂 · ', '').replace('校内店 · ', '') || d.restaurantId }}
          </p>
          <p v-if="d.status === 'rejected' && d.note" class="reason">驳回原因：{{ d.note }}</p>
        </article>
      </div>
      <p v-else class="empty">还没提交过，先填一条吧。</p>
    </section>
  </template>
</template>

<style scoped>
.intro {
  padding: 6px 2px 16px;
}
.intro h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
}
.intro p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--ink-soft);
  line-height: 1.7;
}
.panel {
  padding: 18px 18px 20px;
  margin-bottom: 16px;
}
.eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--primary-deep);
}
.panel h2 {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 20px;
}
.sub {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--ink-soft);
}
.me-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 12px;
}
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--ink);
  font-size: 12px;
}
.field {
  display: block;
  margin-bottom: 14px;
}
.field > span {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-soft);
}
.field input,
.field select {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-2);
  font-family: inherit;
  font-size: 14px;
  color: var(--ink);
}
.field input:focus,
.field select:focus {
  border-color: var(--primary);
  background: var(--surface);
}
.row {
  display: flex;
  gap: 10px;
}
.half {
  flex: 1;
  min-width: 0;
}
.seg {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.seg button {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 13px;
}
.seg button.on {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--ink);
  font-weight: 700;
}
.submit {
  width: 100%;
  margin-top: 2px;
}
.error,
.notice {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.6;
}
.error {
  color: var(--primary-deep);
}
.notice {
  color: var(--accent);
}
.mine-list {
  padding: 4px 16px;
}
.mine-item {
  padding: 12px 0;
  border-bottom: 1px dashed var(--line);
}
.mine-item:last-child {
  border-bottom: none;
}
.mine-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dish-name {
  font-size: 15px;
  font-weight: 600;
}
.date {
  margin-left: auto;
  font-size: 11px;
  color: var(--ink-mute);
}
.meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ink-soft);
}
.reason {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--primary-deep);
}
.empty {
  padding: 26px 0;
  text-align: center;
  font-size: 14px;
  color: var(--ink-mute);
}
</style>
