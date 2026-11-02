/**
 * PostgreSQL 迁移后核对脚本（在已切到 PG 并启动服务后执行）：
 *   node --env-file=.env scripts/pg-smoke.mjs
 * 检查：DATABASE_URL 类型、健康检查、目录规模、评分/榜单可用性。
 */
const PORT = Number(process.env.PORT) || 3001;
const base = `http://127.0.0.1:${PORT}`;

const url = String(process.env.DATABASE_URL || '');
console.log('DATABASE_URL provider ::', url.startsWith('postgres') ? 'postgresql ✓' : url.startsWith('file:') ? 'sqlite（仍在本地模式）' : '未知');

const check = async (path, pick) => {
  try {
    const res = await fetch(base + path);
    const body = await res.json();
    console.log(path, '->', res.status, pick ? pick(body) : '');
    return body;
  } catch (e) {
    console.log(path, '-> ERR', e.message);
    return null;
  }
};

await check('/api/health', (b) => JSON.stringify(b.data));
const stats = await check('/api/v1/stats/overview', (b) => JSON.stringify(b.data));
if (stats?.data) {
  const ok = stats.data.nearbyShops === 645 && stats.data.canteens === 3 && stats.data.dishes === 42;
  console.log(ok ? '目录规模核对 ✓（645 / 3 / 42）' : '目录规模与预期不一致，请确认已执行 db:seed');
}
await check('/api/v1/ratings?ids=c-jinyuan', (b) => JSON.stringify(b.data));
await check('/api/v1/rankings?scope=nearby&by=rating&limit=3', (b) => '返回 ' + b.data.length + ' 条');