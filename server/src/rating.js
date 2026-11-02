/**
 * 评分口径：贝叶斯收缩融合（W = 10）
 * display = (W × 高德基准分 + Σ 站内评分) / (W + n)
 * 服务端实时计算、不落库；前端在线时以服务端为准（离线可本地兜底同一公式）。
 */
import { prisma } from './db.js';

export const RATING_W = 10;

export function ratingLabel(score) {
  if (score == null) return '暂无评分';
  if (score >= 4.2) return '强烈推荐';
  if (score >= 3.8) return '推荐';
  if (score >= 3.3) return '还不错';
  return '一般';
}

export function fuse(base, sum, n) {
  if (n > 0 && base != null) return (RATING_W * base + sum) / (RATING_W + n);
  if (n > 0) return sum / n;
  if (base != null) return base;
  return null;
}

/** 批量站内评分聚合：{ [targetId]: { sum, n } } */
export async function reviewAgg(targetIds) {
  if (!targetIds.length) return {};
  const rows = await prisma.review.groupBy({
    by: ['targetId'],
    where: { targetId: { in: targetIds } },
    _sum: { rating: true },
    _count: { _all: true },
  });
  const map = {};
  for (const r of rows) map[r.targetId] = { sum: r._sum.rating || 0, n: r._count._all || 0 };
  return map;
}

export function ratingOf(shop, agg) {
  const a = agg[shop.id] || { sum: 0, n: 0 };
  const score = fuse(shop.amapRating ?? null, a.sum, a.n);
  const rounded = score == null ? null : Math.round(score * 10) / 10;
  return { score: rounded, n: a.n, base: shop.amapRating ?? null, label: ratingLabel(rounded) };
}