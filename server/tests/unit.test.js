import test from 'node:test';
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { toSegments, isOpenNow, todayKey, shiftDay, streakOf } from '../src/lib/time.js';
import { fuse, ratingLabel, RATING_W } from '../src/rating.js';
import { tagsOf, matchKeyword } from '../src/shops.js';
import { prisma } from '../src/db.js';

after(() => prisma.$disconnect());

/* ---------------- 时间 / 营业时段 ---------------- */
test('toSegments 解析单段与多段营业时间', () => {
  assert.equal(toSegments('06:30 - 20:30'), '390-1230');
  assert.equal(toSegments('10:30-13:20 15:30-20:00'), '630-800,930-1200');
  assert.equal(toSegments('08:40-20:00'), '520-1200');
  assert.equal(toSegments(''), '');
  assert.equal(toSegments('全天'), '');
});

test('toSegments 跨天自动 +1440', () => {
  assert.equal(toSegments('22:00-02:00'), '1320-1560');
});

test('isOpenNow 判断营业 / 打烊 / 未知', () => {
  assert.equal(isOpenNow('390-1230', new Date(2026, 9, 31, 7, 0)), true);
  assert.equal(isOpenNow('390-1230', new Date(2026, 9, 31, 22, 0)), false);
  assert.equal(isOpenNow('', new Date(2026, 9, 31, 12, 0)), null);
});

test('todayKey 按北京时间计算（凌晨不串天）', () => {
  assert.equal(todayKey(new Date('2026-10-31T20:00:00Z')), '2026-11-01');
  assert.equal(todayKey(new Date('2026-10-31T02:00:00Z')), '2026-10-31');
});

test('shiftDay / streakOf 连续天数', () => {
  assert.equal(shiftDay('2026-10-31', -1), '2026-10-30');
  assert.equal(streakOf(['2026-10-30', '2026-10-29', '2026-10-28'], '2026-10-31'), 3); // 今天没打也不清零
  assert.equal(streakOf(['2026-10-31', '2026-10-30'], '2026-10-31'), 2);
  assert.equal(streakOf([], '2026-10-31'), 0);
});

/* ---------------- 评分融合 ---------------- */
test('fuse 贝叶斯收缩（W=10）', () => {
  assert.equal(RATING_W, 10);
  assert.equal(fuse(4.5, 0, 0), 4.5);
  assert.ok(Math.abs(fuse(4.5, 5, 1) - 50 / 11) < 1e-9);
  assert.equal(fuse(null, 8, 2), 4);
  assert.equal(fuse(null, 0, 0), null);
});

test('ratingLabel 文案分档', () => {
  assert.equal(ratingLabel(4.2), '强烈推荐');
  assert.equal(ratingLabel(3.8), '推荐');
  assert.equal(ratingLabel(3.3), '还不错');
  assert.equal(ratingLabel(3.0), '一般');
  assert.equal(ratingLabel(null), '暂无评分');
});

/* ---------------- 标签与关键词 ---------------- */
test('tagsOf 归类与「其他」兜底', () => {
  assert.deepEqual(tagsOf({ name: '蜜雪冰城', category: '冷饮店', dishes: [] }), ['饮品']);
  assert.deepEqual(tagsOf({ name: '无名小馆', category: '', dishes: [] }), ['其他']);
});

test('matchKeyword 命中菜品名与别名', () => {
  const shop = { name: '菁园餐厅', category: '', dishes: [{ name: '黄焖鸡米饭', stall: '1F' }] };
  assert.equal(matchKeyword(shop, '黄焖鸡'), true);
  const drink = { name: '蜜雪冰城', category: '冷饮店', dishes: [] };
  assert.equal(matchKeyword(drink, '奶茶'), true); // 别名 → 饮品
  assert.equal(matchKeyword(drink, '不存在的词'), false);
});