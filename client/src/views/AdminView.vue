<script setup>
import { ref, computed, onMounted } from 'vue';
import { auth, isLoggedIn, api } from '../lib/auth.js';
import { state, loadDishes } from '../lib/store.js';

const SLOTS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'night', label: '夜宵' },
];
const FILTERS = [
  { key: '', label: '全部' },
  { key: 'published', label: '已发布' },
  { key: 'pending', label: '待审核' },
  { key: 'rejected', label: '已驳回' },
];

const tab = ref('pending');
const pending = ref([]);
const dishes = ref([]);
const statusFilter = ref('');
const loading = ref(false);
const message = ref('');
const error = ref('');
const notes = ref({});
const delId = ref(null);
const showCreate = ref(false);
const form = ref({ restaurantId: '', name: '', price: '', stall: '', spicy: 0, mealSlots: ['lunch', 'dinner'], tagText: '' });

const isAdmin = computed(() => auth.user?.role === 'admin');
const shops = computed(() => [
  ...state.canteens.map((s) => ({ id: s.id, label: `食堂 · ${s.name}` })),
  ...state.campusShops.map((s) => ({ id: s.id, label: `校内店 · ${s.name}` })),
]);
const shopName = (id) => {
  const t = [...state.canteens, ...state.campusShops].find((s) => s.id === id);
  return t ? t.name : id;
};

onMounted(() => {
  if (isAdmin.value) load();
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const query = statusFilter.value ? `?status=${statusFilter.value}` : '';
    const [queue, list] = await Promise.all([api('/admin/submissions'), api(`/admin/dishes${query}`)]);
    pending.value = queue;
    dishes.value = list;
    if (!form.value.restaurantId) form.value.restaurantId = state.canteens[0]?.id || '';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function review(dish, action) {
  message.value = '';
  error.value = '';
  try {
    await api(`/admin/submissions/${dish.id}`, {
      method: 'PATCH',
      body: { action, note: notes.value[dish.id] || '' },
    });
    message.value = action === 'approve' ? `已通过「${dish.name}」` : `已驳回「${dish.name}」`;
    await Promise.all([load(), loadDishes()]);
  } catch (e) {
    error.value = e.message;
  }
}

async function removeDish(dish) {
  if (delId.value !== dish.id) {
    delId.value = dish.id;
    return;
  }
  error.value = '';
  try {
    await api(`/admin/dishes/${dish.id}`, { method: 'DELETE' });
    delId.value = null;
    message.value = `已删除「${dish.name}」`;
    await Promise.all([load(), loadDishes()]);
  } catch (e) {
    error.value = e.message;
  }
}

function toggleSlot(key) {
  const idx = form.value.mealSlots.indexOf(key);
  if (idx >= 0) form.value.mealSlots.splice(idx, 1);
  else form.value.mealSlots.push(key);
}

async function createDish() {
  error.value = '';
  message.value = '';
  const f = form.value;
  if (!f.name.trim()) {
    error.value = '先写菜名';
    return;
  }
  const yuan = f.price === '' ? null : Number(f.price);
  if (yuan !== null && (!Number.isInteger(yuan) || yuan < 1 || yuan > 999)) {
    error.value = '价格填 1–999 的整数，或留空';
    return;
  }
  try {
    await api('/admin/dishes', {
      method: 'POST',
      body: {
        restaurantId: f.restaurantId,
        name: f.name.trim(),
        price: yuan,
        stall: f.stall.trim(),
        spicy: f.spicy,
        mealSlots: f.mealSlots,
        tags: f.tagText.split(/[,，、\s]+/).filter(Boolean).slice(0, 6),
      },
    });
    message.value = `已新增「${f.name.trim()}」并直接发布`;
    f.name = '';
    f.price = '';
    f.stall = '';
    f.tagText = '';
    await Promise.all([load(), loadDishes()]);
  } catch (e) {
    error.value = e.message;
  }
}

async function changeFilter(key) {
  statusFilter.value = key;
  await load();
}
</script>

<template>
  <section class="intro">
    <h1>管理员后台</h1>
    <p>审核同学提交的菜品，或直接维护食堂菜品。通过后立即出现在校内页面。</p>
  </section>

  <section v-if="!isLoggedIn" class="panel card">
    <p class="eyebrow">需要登录</p>
    <h2>请先用管理员账号登录</h2>
    <router-link to="/login?redirect=/admin" class="btn-primary">去登录 →</router-link>
  </section>

  <section v-else-if="!isAdmin" class="panel card">
    <p class="eyebrow">权限不足</p>
    <h2>只有管理员能进入这里</h2>
    <p class="sub">当前账号：{{ auth.user.username }}。如果需要管理权限，请用管理员账号登录。</p>
    <router-link to="/app" class="btn-primary">回首页</router-link>
  </section>

  <template v-else>
    <div class="seg tabs">
      <button :class="{ on: tab === 'pending' }" @click="tab = 'pending'">
        待审核<span v-if="pending.length" class="badge">{{ pending.length }}</span>
      </button>
      <button :class="{ on: tab === 'dishes' }" @click="tab = 'dishes'">菜品管理</button>
    </div>

    <p v-if="message" class="notice">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section v-if="tab === 'pending'" class="section">
      <div class="section-head">
        <h2 class="section-title">待审核</h2>
        <span class="section-more">{{ pending.length }} 条</span>
      </div>
      <div v-if="pending.length" class="queue">
        <article v-for="d in pending" :key="d.id" class="queue-item card">
          <div class="item-head">
            <span class="dish-name">{{ d.name }}</span>
            <span class="shop">{{ shopName(d.restaurantId) }}</span>
            <span class="date">{{ d.date }}</span>
          </div>
          <p class="meta">
            {{ d.price ? `¥${d.price}` : '价格未填' }}
            <template v-if="d.stall"> · {{ d.stall }}</template>
            <template v-if="d.spicy"> · {{ ['', '微辣', '中辣', '特辣'][d.spicy] }}</template>
            <template v-if="d.tags.length"> · {{ d.tags.join(' / ') }}</template>
          </p>
          <p class="submitter">提交人：{{ d.submittedBy || '未知' }}</p>
          <div class="review-row">
            <input v-model="notes[d.id]" type="text" maxlength="60" placeholder="驳回原因（可选）" />
            <button class="ghost" @click="review(d, 'reject')">驳回</button>
            <button class="btn-primary small" @click="review(d, 'approve')">通过</button>
          </div>
        </article>
      </div>
      <p v-else class="empty">没有待审核的提交。</p>
    </section>

    <section v-else class="section">
      <div class="section-head">
        <h2 class="section-title">菜品管理</h2>
        <button class="ghost small" @click="showCreate = !showCreate">
          {{ showCreate ? '收起新增' : '＋ 新增菜品' }}
        </button>
      </div>

      <div v-if="showCreate" class="create card">
        <div class="row">
          <label class="field half">
            <span>所属店</span>
            <select v-model="form.restaurantId">
              <option v-for="s in shops" :key="s.id" :value="s.id">{{ s.label }}</option>
            </select>
          </label>
          <label class="field half">
            <span>菜名</span>
            <input v-model="form.name" type="text" maxlength="20" placeholder="比如 黄焖鸡米饭" />
          </label>
        </div>
        <div class="row">
          <label class="field half">
            <span>价格（元，可留空）</span>
            <input v-model="form.price" type="number" min="1" max="999" placeholder="14" />
          </label>
          <label class="field half">
            <span>窗口 / 楼层</span>
            <input v-model="form.stall" type="text" maxlength="20" placeholder="1F 黄焖鸡" />
          </label>
        </div>
        <div class="field">
          <span>辣度</span>
          <div class="seg small">
            <button v-for="n in [0, 1, 2, 3]" :key="n" :class="{ on: form.spicy === n }" @click="form.spicy = n">
              {{ ['不辣', '微辣', '中辣', '特辣'][n] }}
            </button>
          </div>
        </div>
        <div class="field">
          <span>供应时段</span>
          <div class="seg small">
            <button
              v-for="s in SLOTS"
              :key="s.key"
              :class="{ on: form.mealSlots.includes(s.key) }"
              @click="toggleSlot(s.key)"
            >
              {{ s.label }}
            </button>
          </div>
        </div>
        <label class="field">
          <span>标签（逗号分隔，最多 6 个）</span>
          <input v-model="form.tagText" type="text" maxlength="60" placeholder="经典, 配米饭" />
        </label>
        <button class="btn-primary submit" @click="createDish">新增并发布</button>
      </div>

      <div class="seg small filters">
        <button v-for="f in FILTERS" :key="f.key" :class="{ on: statusFilter === f.key }" @click="changeFilter(f.key)">
          {{ f.label }}
        </button>
      </div>

      <div v-if="dishes.length" class="card manage">
        <div v-for="d in dishes" :key="d.id" class="manage-item">
          <div class="item-head">
            <span class="dish-name">{{ d.name }}</span>
            <span class="tag" :class="d.status === 'published' ? 'green' : d.status === 'rejected' ? 'neutral' : ''">
              {{ d.status === 'published' ? '已发布' : d.status === 'rejected' ? '已驳回' : '待审核' }}
            </span>
          </div>
          <p class="meta">
            {{ shopName(d.restaurantId) }}
            <template v-if="d.price"> · ¥{{ d.price }}</template>
            <template v-if="d.stall"> · {{ d.stall }}</template>
            <template v-if="d.submittedBy"> · 提交人 {{ d.submittedBy }}</template>
          </p>
          <div class="ops">
            <button v-if="delId === d.id" class="ghost danger" @click="removeDish(d)">确认删除</button>
            <button v-else class="ghost" @click="removeDish(d)">删除</button>
            <button v-if="delId === d.id" class="ghost" @click="delId = null">取消</button>
          </div>
        </div>
      </div>
      <p v-else class="empty">{{ loading ? '加载中…' : '这个筛选下没有菜品。' }}</p>
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
}
.panel {
  padding: 20px 18px;
}
.panel h2 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 20px;
}
.eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--primary-deep);
}
.sub {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--ink-soft);
}
.tabs {
  margin-bottom: 8px;
}
.seg {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.seg button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
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
.badge {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgba(43, 23, 16, 0.16);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
.notice,
.error {
  margin: 10px 0 0;
  font-size: 13px;
}
.notice {
  color: var(--accent);
}
.error {
  color: var(--primary-deep);
}
.queue {
  display: grid;
  gap: 12px;
}
.queue-item {
  padding: 14px 16px;
}
.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.dish-name {
  font-size: 15px;
  font-weight: 600;
}
.shop {
  font-size: 12px;
  color: var(--ink-soft);
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
.submitter {
  margin: 2px 0 10px;
  font-size: 12px;
  color: var(--ink-mute);
}
.review-row {
  display: flex;
  gap: 8px;
}
.review-row input {
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
  font-size: 13px;
}
.ghost {
  height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 13px;
  white-space: nowrap;
}
.ghost.small {
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
}
.ghost.danger {
  border-color: var(--primary);
  color: var(--primary-deep);
}
.btn-primary.small {
  height: 38px;
  padding: 0 18px;
  font-size: 13px;
}
.empty {
  padding: 28px 0;
  text-align: center;
  font-size: 14px;
  color: var(--ink-mute);
}
.create {
  padding: 16px;
  margin-bottom: 12px;
}
.field {
  display: block;
  margin-bottom: 10px;
}
.field > span {
  display: block;
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-soft);
}
.field input,
.field select {
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
  font-family: inherit;
  font-size: 13px;
  color: var(--ink);
}
.row {
  display: flex;
  gap: 10px;
}
.half {
  flex: 1;
  min-width: 0;
}
.seg.small button {
  padding: 4px 12px;
  font-size: 12px;
}
.filters {
  margin: 12px 0;
}
.manage {
  padding: 4px 16px;
}
.manage-item {
  padding: 12px 0;
  border-bottom: 1px dashed var(--line);
}
.manage-item:last-child {
  border-bottom: none;
}
.ops {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
