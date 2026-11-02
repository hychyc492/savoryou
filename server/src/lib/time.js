/**
 * 纯函数工具（无依赖，便于单元测试）：
 * 营业时段解析、营业状态判断、北京时间「今天」、连续打卡天数。
 */

/** 营业时间文本 → 结构化分钟段："06:30 - 20:30" → "390-1230"；跨天自动 +1440 */
export function toSegments(text) {
  const matches = String(text || '').match(/\d{1,2}:\d{2}\s*[-~至]\s*\d{1,2}:\d{2}/g);
  if (!matches) return '';
  return matches
    .map((seg) => {
      const [a, b] = seg.split(/\s*[-~至]\s*/);
      const toMin = (s) => {
        const [h, m] = String(s).split(':').map(Number);
        return h * 60 + m;
      };
      const start = toMin(a);
      let end = toMin(b);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return '';
      if (end <= start) end += 1440;
      return `${start}-${end}`;
    })
    .filter(Boolean)
    .join(',');
}

/** 营业状态：true 营业 / false 打烊 / null 无法判断 */
export function isOpenNow(segments, now = new Date()) {
  const text = String(segments || '');
  if (!text) return null;
  const cur = now.getHours() * 60 + now.getMinutes();
  for (const seg of text.split(',')) {
    const [a, b] = seg.split('-').map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (cur >= a && cur <= b) return true;
    if (cur + 1440 >= a && cur + 1440 <= b) return true;
  }
  return false;
}

/** 固定按北京时间算「今天」（YYYY-MM-DD），避免服务器时区把凌晨记到前一天 */
export function todayKey(now = new Date()) {
  const shifted = new Date(now.getTime() + 8 * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function shiftDay(day, delta) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * 864e5).toISOString().slice(0, 10);
}

/** 连续打卡天数：今天没打也不立刻清零，从昨天开始往回数 */
export function streakOf(days, today) {
  const set = new Set(days);
  let cursor = set.has(today) ? today : shiftDay(today, -1);
  if (!set.has(cursor)) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}