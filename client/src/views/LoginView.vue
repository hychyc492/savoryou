<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { auth, isLoggedIn, login, register } from '../lib/auth.js';
import { state, syncAfterAuth, logoutUser, checkin } from '../lib/store.js';

const route = useRoute();
const router = useRouter();

const mode = ref('login');
const username = ref('');
const password = ref('');
const confirm = ref('');
const error = ref('');
const notice = ref('');
const busy = ref(false);

const myReviewCount = computed(() => state.reviews.filter((r) => r.mine).length);

function redirectTarget() {
  const raw = route.query.redirect ? String(route.query.redirect) : '/';
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

watch(mode, () => {
  error.value = '';
  notice.value = '';
});

async function submit() {
  if (busy.value) return;
  error.value = '';
  notice.value = '';
  const name = username.value.trim();
  if (name.length < 2 || name.length > 16) {
    error.value = '用户名需 2–16 位';
    return;
  }
  if (password.value.length < 6) {
    error.value = '密码至少 6 位';
    return;
  }
  if (mode.value === 'register' && password.value !== confirm.value) {
    error.value = '两次输入的密码不一致';
    return;
  }

  busy.value = true;
  try {
    if (mode.value === 'login') await login(name, password.value);
    else await register(name, password.value);

    const migrated = await syncAfterAuth();
    const added = (migrated?.reviewsAdded || 0) + (migrated?.favoritesAdded || 0);
    if (added) {
      notice.value = `已同步本机 ${migrated.reviewsAdded} 条评价、${migrated.favoritesAdded} 个收藏`;
      await new Promise((r) => setTimeout(r, 1200));
    }
    password.value = '';
    confirm.value = '';
    router.replace(redirectTarget());
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

function doLogout() {
  logoutUser();
  mode.value = 'login';
  notice.value = '已退出登录，本机收藏仍会保留';
  password.value = '';
}
</script>

<template>
  <section v-if="isLoggedIn" class="panel card">
    <div class="me-avatar">{{ auth.user.username.slice(0, 1) }}</div>
    <h1>{{ auth.user.username }}</h1>
    <p class="stat">收藏 {{ state.favorites.length }} 家 · 我的评价 {{ myReviewCount }} 条 · 打卡 {{ checkin.myTotal }} 次</p>
    <p v-if="checkin.streak > 1" class="streak">已连续打卡 {{ checkin.streak }} 天，今天也别断。</p>
    <p class="sync">评价与收藏已同步到服务器，换设备登录也能看到。</p>
    <div class="actions">
      <router-link to="/favorites" class="btn-primary">看我的收藏</router-link>
      <router-link v-if="auth.user.role === 'admin'" to="/admin" class="ghost">管理员后台</router-link>
      <button class="ghost" @click="doLogout">退出登录</button>
    </div>
    <transition name="fade">
      <p v-if="notice" class="notice">{{ notice }}</p>
    </transition>
  </section>

  <section v-else class="panel card">
    <p class="eyebrow">SavorU 账号</p>
    <h1>{{ mode === 'login' ? '登录，同步你的口味' : '注册一个账号' }}</h1>
    <p class="sub">收藏和评分会跟着账号走，换设备也不丢。</p>

    <div class="seg">
      <button :class="{ on: mode === 'login' }" @click="mode = 'login'">登录</button>
      <button :class="{ on: mode === 'register' }" @click="mode = 'register'">注册</button>
    </div>

    <form @submit.prevent="submit">
      <label class="field">
        <span>用户名</span>
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          maxlength="16"
          placeholder="2–16 位，可用中文"
        />
      </label>
      <label class="field">
        <span>密码</span>
        <input
          v-model="password"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          maxlength="64"
          placeholder="至少 6 位"
        />
      </label>
      <label v-if="mode === 'register'" class="field">
        <span>确认密码</span>
        <input v-model="confirm" type="password" autocomplete="new-password" maxlength="64" placeholder="再输一次" />
      </label>

      <button class="btn-primary submit" :disabled="busy" type="submit">
        {{ busy ? '处理中…' : mode === 'login' ? '登录' : '注册并登录' }}
      </button>
    </form>

    <transition name="fade">
      <p v-if="error" class="error">{{ error }}</p>
    </transition>
    <transition name="fade">
      <p v-if="notice" class="notice">{{ notice }}</p>
    </transition>

    <p class="hint">未登录也能浏览和收藏，收藏仅保存在本机；登录后会自动同步。</p>
  </section>
</template>

<style scoped>
.panel {
  max-width: 460px;
  margin: 20px auto 0;
  padding: 26px 22px 22px;
}
.eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--primary-deep);
}
h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1.35;
}
.sub {
  margin: 6px 0 18px;
  font-size: 13px;
  color: var(--ink-soft);
}
.seg {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  margin-bottom: 18px;
  border-radius: 14px;
  background: #ecdfc7;
}
.seg button {
  padding: 6px 18px;
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
.field {
  display: block;
  margin-bottom: 14px;
}
.field span {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-soft);
}
.field input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-2);
}
.field input:focus {
  border-color: var(--primary);
  background: var(--surface);
}
.submit {
  width: 100%;
  margin-top: 4px;
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
.hint {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--ink-mute);
}
.me-avatar {
  width: 54px;
  height: 54px;
  margin-bottom: 12px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stat {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--ink-soft);
}
.streak {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--accent);
}
.sync {
  margin: 4px 0 18px;
  font-size: 12px;
  color: var(--ink-mute);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.ghost {
  height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 14px;
}
@media (min-width: 720px) {
  .panel {
    margin-top: 36px;
    padding: 32px 28px 28px;
  }
}
</style>
