<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { FOOD_TAGS } from '../lib/foodTags.js';
import { ratingOf } from '../lib/store.js';
import { recommend, isOpenNow } from '../lib/recommend.js';

const props = defineProps({ open: { type: Boolean, default: false } });
const emit = defineEmits(['close']);

const SAVE_KEY = 'savoru.decision';

const people = ref(1);
const budget = ref(null);
const scope = ref('all');
const tags = ref([]);
const openOnly = ref(true);
const restored = ref(false);

const mode = ref('input');
const results = ref([]);

const PEOPLE = [
  { value: 1, label: '1 人' },
  { value: 2, label: '2 人' },
  { value: 4, label: '4 人以上' },
];
const BUDGETS = [
  { value: null, label: '不限' },
  { value: 10, label: '≤ ¥10' },
  { value: 15, label: '≤ ¥15' },
  { value: 25, label: '≤ ¥25' },
];
const SCOPES = [
  { value: 'all', label: '都行' },
  { value: 'campus', label: '校内' },
  { value: 'nearby', label: '校外' },
];
const tagOptions = FOOD_TAGS.filter((t) => t !== '其他');

const main = computed(() => results.value[0] || null);
const rest = computed(() => results.value.slice(1));
const summary = computed(() => {
  const parts = [PEOPLE.find((p) => p.value === people.value)?.label];
  parts.push(budget.value ? `人均 ≤ ¥${budget.value}` : '预算不限');
  parts.push(SCOPES.find((s) => s.value === scope.value)?.label);
  if (tags.value.length) parts.push(tags.value.join(' / '));
  if (openOnly.value) parts.push('只看营业中');
  return parts.join(' · ');
});

function openText(item) {
  const state = isOpenNow(item);
  if (state === true) return '现在营业';
  if (state === false) return '现在打烊';
  return '';
}

function badgeOf(item) {
  if (item.kind === 'canteen') return '食堂';
  if (item.kind === 'campusShop') return '校内';
  return '校外';
}

function scoreText(item) {
  const s = ratingOf(item).score;
  return s != null ? s.toFixed(1) : '—';
}

function toggleTag(tag) {
  const i = tags.value.indexOf(tag);
  if (i >= 0) tags.value.splice(i, 1);
  else tags.value.push(tag);
}

function reset() {
  people.value = 1;
  budget.value = null;
  scope.value = 'all';
  tags.value = [];
  openOnly.value = true;
  restored.value = false;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* 隐私模式忽略 */
  }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (PEOPLE.some((p) => p.value === saved.people)) people.value = saved.people;
    if (BUDGETS.some((b) => b.value === saved.budget)) budget.value = saved.budget;
    if (SCOPES.some((s) => s.value === saved.scope)) scope.value = saved.scope;
    if (Array.isArray(saved.tags)) {
      tags.value = saved.tags.filter((t) => tagOptions.includes(t));
    }
    openOnly.value = saved.openOnly !== false;
    restored.value = true;
  } catch {
    /* 坏数据直接忽略 */
  }
}

function saveConditions() {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        people: people.value,
        budget: budget.value,
        scope: scope.value,
        tags: [...tags.value],
        openOnly: openOnly.value,
      })
    );
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }
}

function query() {
  return {
    budget: budget.value,
    tags: [...tags.value],
    scope: scope.value,
    people: people.value,
    limit: 3,
    openOnly: openOnly.value,
  };
}

function run() {
  results.value = recommend(query());
  mode.value = 'result';
  saveConditions();
}

function reroll() {
  const prev = main.value?.item.id;
  let list = recommend(query());
  for (let i = 0; i < 4 && list[0]?.item.id === prev; i += 1) list = recommend(query());
  results.value = list;
}

function loosen() {
  budget.value = null;
  tags.value = [];
  run();
}

function close() {
  emit('close');
}

function onKey(e) {
  if (e.key === 'Escape') close();
}

watch(
  () => props.open,
  (v) => {
    document.body.style.overflow = v ? 'hidden' : '';
    if (v) {
      mode.value = 'input';
      loadSaved();
      window.addEventListener('keydown', onKey);
    } else {
      window.removeEventListener('keydown', onKey);
    }
  }
);

onBeforeUnmount(() => {
  document.body.style.overflow = '';
  window.removeEventListener('keydown', onKey);
});
</script>

<template>
  <Teleport to="body">
    <transition name="sheet">
      <div v-if="open" class="sheet-mask" @click.self="close">
        <section class="sheet" role="dialog" aria-modal="true" aria-label="帮我决定吃什么">
          <div class="sheet-head">
            <div>
              <p class="eyebrow">30 秒决定</p>
              <h2>{{ mode === 'input' ? '回答几个小问题，马上出结果' : '给你挑了这几家' }}</h2>
            </div>
            <button class="sheet-close" aria-label="关闭" @click="close">×</button>
          </div>

          <div class="sheet-body">
            <template v-if="mode === 'input'">
              <p v-if="restored" class="restored-tip">已按上次的条件填好，想换就直接改。</p>

              <div class="field">
                <span class="field-label">几个人吃</span>
                <div class="seg">
                  <button
                    v-for="p in PEOPLE"
                    :key="p.value"
                    :class="{ on: people === p.value }"
                    @click="people = p.value"
                  >
                    {{ p.label }}
                  </button>
                </div>
              </div>

              <div class="field">
                <span class="field-label">人均预算</span>
                <div class="seg">
                  <button
                    v-for="b in BUDGETS"
                    :key="String(b.value)"
                    :class="{ on: budget === b.value }"
                    @click="budget = b.value"
                  >
                    {{ b.label }}
                  </button>
                </div>
              </div>

              <div class="field">
                <span class="field-label">想吃哪边</span>
                <div class="seg">
                  <button
                    v-for="s in SCOPES"
                    :key="s.value"
                    :class="{ on: scope === s.value }"
                    @click="scope = s.value"
                  >
                    {{ s.label }}
                  </button>
                </div>
              </div>

              <div class="field">
                <span class="field-label">营业状态<em>打烊的店先不推荐</em></span>
                <div class="seg">
                  <button :class="{ on: openOnly }" @click="openOnly = true">现在营业</button>
                  <button :class="{ on: !openOnly }" @click="openOnly = false">不限时段</button>
                </div>
              </div>

              <div class="field">
                <span class="field-label">想吃的口味<em>可多选，不选就是都行</em></span>
                <div class="tag-grid">
                  <button
                    v-for="t in tagOptions"
                    :key="t"
                    class="chip"
                    :class="{ active: tags.includes(t) }"
                    @click="toggleTag(t)"
                  >
                    {{ t }}
                  </button>
                </div>
              </div>
            </template>

            <template v-else>
              <p class="picked-summary">{{ summary }}</p>

              <template v-if="main">
                <router-link :to="`/shop/${main.item.id}`" class="pick-main" @click="close">
                  <div class="pick-thumb">
                    <img v-if="main.item.photo" :src="main.item.photo" :alt="main.item.name" />
                    <div v-else class="pick-empty">SavorU</div>
                    <span class="pick-badge">{{ badgeOf(main.item) }}</span>
                  </div>
                  <div class="pick-body">
                    <h3>{{ main.item.name }}</h3>
                    <p class="pick-meta">
                      <span class="pick-score">{{ scoreText(main.item) }}</span>
                      <span v-if="main.walk != null">步行 {{ main.walk }} 分钟</span>
                      <span v-if="main.item.amapCost">人均 ¥{{ main.item.amapCost }}</span>
                      <span
                        v-if="openText(main.item)"
                        class="pick-open"
                        :class="{ off: openText(main.item) === '现在打烊' }"
                      >
                        {{ openText(main.item) }}
                      </span>
                    </p>
                    <div class="reasons">
                      <span v-for="r in main.reasons" :key="r">{{ r }}</span>
                    </div>
                  </div>
                  <span class="pick-go">去这家 →</span>
                </router-link>

                <div class="pick-alts">
                  <router-link
                    v-for="alt in rest"
                    :key="alt.item.id"
                    :to="`/shop/${alt.item.id}`"
                    class="pick-alt"
                    @click="close"
                  >
                    <div>
                      <span class="alt-name">{{ alt.item.name }}</span>
                      <span class="alt-meta">
                        {{ scoreText(alt.item) }} 分<template v-if="alt.walk != null"> · 步行 {{ alt.walk }} 分钟</template>
                        <template v-if="alt.item.amapCost"> · 人均 ¥{{ alt.item.amapCost }}</template>
                      </span>
                      <span class="alt-reasons">{{ alt.reasons.join(' · ') }}</span>
                    </div>
                    <span class="pick-go">→</span>
                  </router-link>
                </div>
              </template>

              <div v-else class="pick-empty-state">
                <p>这个条件下没有合适的店，放宽一下试试。</p>
                <div class="pick-actions">
                  <button class="btn-primary" @click="loosen">放宽预算与口味</button>
                  <button v-if="openOnly" class="ghost" @click="openOnly = false; run()">也看看打烊的</button>
                </div>
              </div>
            </template>
          </div>

          <div class="sheet-foot">
            <template v-if="mode === 'input'">
              <button class="ghost" @click="reset">重置</button>
              <button class="btn-primary grow" @click="run">开始推荐</button>
            </template>
            <template v-else>
              <button class="ghost" @click="reroll">换一批</button>
              <button class="ghost" @click="mode = 'input'">改条件</button>
              <router-link
                :to="scope === 'campus' ? '/canteens' : '/nearby'"
                class="btn-primary grow"
                @click="close"
              >
                看完整列表
              </router-link>
            </template>
          </div>
        </section>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(58, 27, 18, 0.44);
}
.sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  max-height: 88vh;
  border-radius: 24px 24px 0 0;
  background: var(--bg);
  box-shadow: 0 -12px 40px rgba(58, 27, 18, 0.22);
}
.sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 20px 10px;
}
.eyebrow {
  margin: 0 0 2px;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--primary-deep);
}
.sheet-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
}
.sheet-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #ecdfc7;
  color: var(--ink-soft);
  font-size: 18px;
  line-height: 1;
}
.sheet-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 20px 8px;
}
.field {
  margin-bottom: 16px;
}
.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
}
.field-label em {
  margin-left: 6px;
  font-style: normal;
  font-weight: 400;
  font-size: 11px;
  color: var(--ink-mute);
}
.seg {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  border-radius: 14px;
  background: #ecdfc7;
}
.seg button {
  padding: 6px 14px;
  border-radius: 11px;
  font-size: 13px;
  color: var(--ink-soft);
}
.seg button.on {
  background: var(--surface);
  color: var(--ink);
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(58, 27, 18, 0.1);
}
.restored-tip {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--primary-soft);
  color: var(--primary-deep);
  font-size: 12px;
}
.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.picked-summary {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--ink-mute);
}
.pick-main {
  display: flex;
  gap: 12px;
  padding: 10px;
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.pick-thumb {
  position: relative;
  flex: none;
  width: 92px;
  height: 92px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface-2);
}
.pick-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pick-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #b09a7a;
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: 0.12em;
  background: repeating-linear-gradient(135deg, #f8efdc 0 10px, #f2e5cb 10px 20px);
}
.pick-badge {
  position: absolute;
  left: 6px;
  top: 6px;
  padding: 0 6px;
  border-radius: 5px;
  background: rgba(58, 27, 18, 0.88);
  color: #fffaf0;
  font-size: 10px;
}
.pick-body {
  flex: 1;
  min-width: 0;
}
.pick-body h3 {
  margin: 2px 0 4px;
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.pick-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--ink-mute);
}
.pick-score {
  font-weight: 700;
  color: var(--primary-deep);
}
.pick-open {
  padding: 0 6px;
  border-radius: 5px;
  background: rgba(217, 170, 65, 0.22);
  color: var(--primary-deep);
  font-weight: 600;
}
.pick-open.off {
  background: #efe2c9;
  color: var(--ink-mute);
}
.reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.reasons span {
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--primary-soft);
  color: var(--primary-deep);
  font-size: 11px;
}
.pick-go {
  align-self: center;
  flex: none;
  white-space: nowrap;
  color: var(--primary-deep);
  font-size: 12px;
  font-weight: 600;
}
.pick-alts {
  margin-top: 10px;
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.pick-alt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--line);
}
.pick-alt:last-child {
  border-bottom: none;
}
.pick-alt > div {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.alt-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.alt-meta {
  font-size: 11px;
  color: var(--ink-mute);
}
.alt-reasons {
  font-size: 11px;
  color: var(--accent);
}
.pick-empty-state {
  padding: 24px 0 8px;
  text-align: center;
}
.pick-empty-state p {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--ink-soft);
}
.pick-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}
.pick-actions .btn-primary {
  height: 42px;
  padding: 0 18px;
  font-size: 13px;
}
.pick-actions .ghost {
  height: 42px;
  font-size: 13px;
}
.sheet-foot {
  display: flex;
  gap: 10px;
  padding: 12px 20px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--line);
  background: var(--bg);
}
.ghost {
  flex: none;
  height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 13px;
}
.grow {
  flex: 1;
}
.sheet-foot .btn-primary {
  height: 44px;
  font-size: 14px;
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.28s cubic-bezier(0.34, 1.2, 0.64, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}
@media (min-width: 720px) {
  .sheet-mask {
    align-items: center;
  }
  .sheet {
    border-radius: 24px;
    max-height: 82vh;
  }
  .sheet-enter-from .sheet,
  .sheet-leave-to .sheet {
    transform: translateY(16px) scale(0.98);
  }
}
</style>
