import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

process.env.NODE_ENV = 'test';
const app = createApp();
const PREFIX = 'apitest_';
const username = PREFIX + Math.floor(Math.random() * 999999);
let access = '';
let refreshCookie = '';

after(async () => {
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

test('健康检查含数据库状态', async () => {
  const res = await request(app).get('/api/health').expect(200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.db, 'up');
});

test('店铺列表：校内 21 家，含服务端融合分与标签', async () => {
  const res = await request(app).get('/api/v1/shops?scope=campus&limit=5').expect(200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.meta.total, 21);
  const first = res.body.data[0];
  assert.ok(first.rating && typeof first.rating.score !== 'undefined');
  assert.ok(Array.isArray(first.tags));
});

test('关键词筛选（含菜品名）', async () => {
  const res = await request(app).get('/api/v1/shops?q=黄焖鸡&limit=10').expect(200);
  assert.ok(res.body.data.length >= 1);
});

test('批量评分、榜单、统计、标签、地图', async () => {
  const ratings = await request(app).get('/api/v1/ratings?ids=c-jinyuan,c-qianyuan').expect(200);
  assert.ok(ratings.body.data['c-jinyuan'].score > 0);

  const ranking = await request(app).get('/api/v1/rankings?scope=nearby&by=rating&limit=5').expect(200);
  assert.equal(ranking.body.data.length, 5);
  assert.equal(ranking.body.data[0].rank, 1);

  const stats = await request(app).get('/api/v1/stats/overview').expect(200);
  assert.equal(stats.body.data.nearbyShops, 645);
  assert.equal(stats.body.data.canteens, 3);

  const tags = await request(app).get('/api/v1/tags').expect(200);
  assert.ok(tags.body.data.tags.includes('火锅'));
  assert.ok(tags.body.data.tags.includes('其他'));

  const map = await request(app).get('/api/v1/shops/map?bbox=112.40,34.59,112.44,34.61').expect(200);
  assert.ok(map.body.meta.total > 0);
});

test('未登录写评价 → 401', async () => {
  await request(app).put('/api/v1/reviews/c-jinyuan').send({ rating: 5 }).expect(401);
});

test('弱口令注册 → 400 校验错误', async () => {
  const res = await request(app).post('/api/v1/auth/register').send({ username: 'ab', password: '123' }).expect(400);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'VALIDATION');
});

test('注册 → 返回 access 与 httpOnly refresh Cookie', async () => {
  const res = await request(app).post('/api/v1/auth/register').send({ username, password: 'secret123' }).expect(200);
  assert.equal(res.body.ok, true);
  access = res.body.data.accessToken;
  assert.ok(access);
  const setCookie = res.headers['set-cookie'] || [];
  assert.ok(setCookie.some((c) => c.includes('savoru_rt=') && c.toLowerCase().includes('httponly')));
  refreshCookie = String(setCookie).split(';')[0];
});

test('携带 access 访问 /auth/me', async () => {
  const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${access}`).expect(200);
  assert.equal(res.body.data.user.username, username);
});

test('refresh 轮换：旧 Cookie 复用应 401', async () => {
  const ok = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie).expect(200);
  assert.ok(ok.body.data.accessToken);
  await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie).expect(401);
  const fresh = ok.headers['set-cookie'];
  refreshCookie = String(fresh).split(';')[0];
});

test('登录后可写评价（一店一人一条，重复即更新）', async () => {
  const a = await request(app).put('/api/v1/reviews/c-jinyuan').set('Authorization', `Bearer ${access}`).send({ rating: 5, content: '接口测试', tags: ['好吃'] }).expect(200);
  assert.equal(a.body.data.rating, 5);
  assert.equal(a.body.data.mine, true);

  const b = await request(app).put('/api/v1/reviews/c-jinyuan').set('Authorization', `Bearer ${access}`).send({ rating: 4, content: '更新', tags: [] }).expect(200);
  assert.equal(b.body.data.rating, 4);

  const mine = await request(app).get('/api/v1/reviews?targetId=c-jinyuan').set('Authorization', `Bearer ${access}`).expect(200);
  const own = mine.body.data.filter((r) => r.mine);
  assert.equal(own.length, 1);

  await request(app).delete('/api/v1/reviews/c-jinyuan').set('Authorization', `Bearer ${access}`).expect(200);
});

test('收藏与打卡需要登录，且写入后可见', async () => {
  await request(app).put('/api/v1/favorites/c-jinyuan').expect(401);
  const fav = await request(app).put('/api/v1/favorites/c-jinyuan').set('Authorization', `Bearer ${access}`).expect(200);
  assert.ok(fav.body.data.favorites.includes('c-jinyuan'));

  const checkin = await request(app).post('/api/v1/checkins').set('Authorization', `Bearer ${access}`).send({ targetId: 'c-jinyuan' }).expect(200);
  assert.ok(checkin.body.data.todayCount >= 1);

  const stats = await request(app).get('/api/v1/checkins/stats?targetId=c-jinyuan').expect(200);
  assert.ok(stats.body.data.todayCount >= 1);
});

test('普通用户访问管理员接口 → 403', async () => {
  await request(app).get('/api/v1/admin/submissions').set('Authorization', `Bearer ${access}`).expect(403);
});

test('退出后撤销 refresh', async () => {
  await request(app).post('/api/v1/auth/logout').set('Cookie', refreshCookie).expect(200);
  await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie).expect(401);
});