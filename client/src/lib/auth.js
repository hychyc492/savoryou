import { reactive, computed } from 'vue';

/**
 * 认证：access token 只存内存（不落 localStorage，降低 XSS 面）；
 * refresh 由服务端下发 httpOnly Cookie（savoru_rt），前端不可读、只用于 /auth/refresh。
 */
export const auth = reactive({ user: null, token: '', ready: false });

export const isLoggedIn = computed(() => !!auth.user);

function setAccess(token, user) {
  auth.token = token || '';
  auth.user = user || null;
}

/** 解包统一响应 { ok, data, meta } → data */
async function handle(res) {
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!res.ok) {
    throw new Error(payload?.error?.message || `请求失败（${res.status}）`);
  }
  return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}

/** 用 httpOnly refresh Cookie 换新的 access */
export async function tryRefresh() {
  try {
    const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) return false;
    const payload = await res.json();
    if (payload?.ok && payload.data?.accessToken) {
      setAccess(payload.data.accessToken, payload.data.user);
      return true;
    }
  } catch {
    /* 忽略 */
  }
  return false;
}

/**
 * 统一请求入口：自动带 access；401 时用 refresh 换新 access 并重试一次。
 */
export async function api(path, { method = 'GET', body, auth: withAuth = true, retry = true } = {}) {
  const makeHeaders = () => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (withAuth && auth.token) headers.Authorization = `Bearer ${auth.token}`;
    return headers;
  };
  const send = () =>
    fetch(`/api/v1${path}`, {
      method,
      headers: makeHeaders(),
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res;
  try {
    res = await send();
  } catch {
    throw new Error('连不上服务器，请确认后端已启动');
  }

  if (res.status === 401 && withAuth && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      try {
        return await handle(await send());
      } catch (e) {
        throw e;
      }
    }
    setAccess('', null);
  }
  return handle(res);
}

async function applyAuth(path, username, password) {
  const data = await api(path, { method: 'POST', body: { username, password }, auth: false });
  setAccess(data.accessToken, data.user);
  auth.ready = true;
  return data.user;
}

export const login = (username, password) => applyAuth('/auth/login', username, password);
export const register = (username, password) => applyAuth('/auth/register', username, password);

/** 会话恢复：优先用 refresh Cookie 换 access */
export async function restoreSession() {
  const ok = await tryRefresh();
  auth.ready = true;
  return ok ? auth.user : null;
}

export async function logout() {
  try {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    /* 忽略 */
  }
  setAccess('', null);
}