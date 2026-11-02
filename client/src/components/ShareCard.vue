<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  item: { type: Object, default: null },
  score: { type: Number, default: null },
  todayCount: { type: Number, default: 0 },
  checked: { type: Boolean, default: false },
  streak: { type: Number, default: 0 },
});
const emit = defineEmits(['close']);

const canvas = ref(null);
const message = ref('');
const busy = ref(false);

const shareUrl = () => (props.item ? `${location.origin}/shop/${props.item.id}` : location.origin);

const kindText = () => {
  const it = props.item;
  if (!it) return '校园美食';
  if (it.kind === 'canteen' || String(it.id).startsWith('c-')) return '校内食堂';
  if (it.kind === 'campusShop') return '校内店铺';
  return '校外店铺';
};

function wrapLines(ctx, text, maxWidth, maxLines = 2) {
  const lines = [];
  let line = '';
  for (const ch of [...text]) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth) {
      if (lines.length === maxLines - 1) {
        lines.push(`${line}…`);
        return lines;
      }
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function draw() {
  const c = canvas.value;
  const it = props.item;
  if (!c || !it) return;
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const D = '"Playfair Display", "Songti SC", "STSong", "SimSun", serif';
  const B = '"Manrope", "PingFang SC", "Microsoft YaHei", sans-serif';

  g.clearRect(0, 0, W, H);
  g.fillStyle = '#f4ead8';
  g.fillRect(0, 0, W, H);

  // 背景装饰
  g.strokeStyle = 'rgba(105, 47, 32, 0.14)';
  g.lineWidth = 2;
  for (const [x, y, r] of [[618, 150, 92], [660, 742, 130]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(x, y, r * 0.52, 0, Math.PI * 2);
    g.stroke();
  }

  // 顶部色带
  g.fillStyle = '#d9aa41';
  g.fillRect(0, 0, W, 14);

  // 品牌
  g.fillStyle = '#2b1710';
  g.font = `700 42px ${D}`;
  g.fillText('SavorU', 56, 92);
  g.fillStyle = '#9a7a63';
  g.font = `500 22px ${B}`;
  g.fillText('河科大美食地图', 56, 126);

  g.strokeStyle = '#dccbae';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(56, 160);
  g.lineTo(W - 56, 160);
  g.stroke();

  // 店名
  g.fillStyle = '#2b1710';
  g.font = `700 62px ${D}`;
  const nameLines = wrapLines(g, it.name, W - 112, 2);
  nameLines.forEach((line, i) => g.fillText(line, 56, 246 + i * 76));
  const afterName = 246 + nameLines.length * 76;

  // 评分
  const score = props.score;
  g.fillStyle = '#8c432c';
  g.font = `700 96px ${D}`;
  g.fillText(score != null ? score.toFixed(1) : '—', 56, afterName + 66);
  const scoreW = g.measureText(score != null ? score.toFixed(1) : '—').width;
  g.fillStyle = '#9a7a63';
  g.font = `500 26px ${B}`;
  g.fillText('分', 56 + scoreW + 10, afterName + 66);

  const stars = score == null ? 0 : Math.round(score);
  g.fillStyle = '#d9aa41';
  g.font = `400 34px ${B}`;
  g.fillText('★★★★★'.slice(0, stars) + '☆☆☆☆☆'.slice(0, 5 - stars), 56, afterName + 110);

  // 打卡信息
  if (props.checked) {
    const badge = props.streak > 1 ? `我已打卡 · 连续 ${props.streak} 天` : '我今天吃了这家';
    g.fillStyle = '#3a1b12';
    g.font = `600 24px ${B}`;
    const bw = g.measureText(badge).width + 34;
    roundRect(g, 56, afterName + 134, bw, 46, 23);
    g.fill();
    g.fillStyle = '#fffaf0';
    g.fillText(badge, 73, afterName + 165);
  }
  if (props.todayCount > 0) {
    g.fillStyle = '#9a7a63';
    g.font = `500 22px ${B}`;
    g.fillText(`今天 ${props.todayCount} 人在这里打卡`, 56, afterName + 222);
  }

  // 店铺信息
  const meta = [kindText()];
  if (it.amapCost) meta.push(`人均 ¥${it.amapCost}`);
  if (it.distance) meta.push(`${it.distance} 米`);
  g.fillStyle = '#692f20';
  g.font = `500 25px ${B}`;
  g.fillText(meta.join(' · '), 56, afterName + 266);

  // 标语卡片
  const cardY = afterName + 300;
  g.save();
  g.shadowColor = 'rgba(58, 27, 18, 0.12)';
  g.shadowBlur = 24;
  g.shadowOffsetY = 8;
  g.fillStyle = '#fffaf0';
  roundRect(g, 40, cardY, W - 80, 150, 28);
  g.fill();
  g.restore();
  g.fillStyle = '#2b1710';
  g.font = `700 36px ${D}`;
  g.fillText('别纠结了，今天就去这家', 72, cardY + 66);
  g.fillStyle = '#9a7a63';
  g.font = `500 24px ${B}`;
  g.fillText('大学四年，值得吃好的每一顿。', 72, cardY + 112);

  // 链接
  g.fillStyle = '#f2e2bd';
  roundRect(g, 56, 930, W - 112, 56, 16);
  g.fill();
  g.fillStyle = '#8c432c';
  g.font = `600 24px ${B}`;
  const linkText = `savoru · /shop/${it.id}`;
  g.fillText(linkText, 78, 966);

  g.fillStyle = '#9a7a63';
  g.font = `500 20px ${B}`;
  g.fillText('打开 SavorU，看评分、打卡、找今天的饭', 56, 1012);
}

function redraw() {
  nextTick(draw);
}

watch(
  () => [props.open, props.item, props.score, props.checked, props.todayCount],
  ([open]) => {
    if (!open) return;
    redraw();
  }
);

function flash(text) {
  message.value = text;
  setTimeout(() => (message.value = ''), 2200);
}

function toBlob() {
  return new Promise((resolve) => {
    const c = canvas.value;
    if (!c) return resolve(null);
    c.toBlob((b) => resolve(b), 'image/png', 0.95);
  });
}

async function doShare() {
  if (busy.value) return;
  busy.value = true;
  try {
    const blob = await toBlob();
    const file = blob ? new File([blob], `savoru-${props.item.id}.png`, { type: 'image/png' }) : null;
    const text = `我在 SavorU 发现了「${props.item.name}」，今天就来这家`;
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: props.item.name, text, url: shareUrl() });
    } else if (navigator.share) {
      await navigator.share({ title: props.item.name, text, url: shareUrl() });
    } else {
      await copyLink('当前浏览器不支持直接分享，已复制链接');
    }
  } catch (e) {
    if (e?.name !== 'AbortError') flash('分享没成功，可以保存图片再发');
  } finally {
    busy.value = false;
  }
}

function download() {
  const c = canvas.value;
  if (!c) return;
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `savoru-${props.item.id}.png`;
  a.click();
  flash('图片已保存');
}

async function copyLink(tip = '链接已复制，去群里喊人吃饭') {
  const url = shareUrl();
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const input = document.createElement('textarea');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
  flash(tip);
}

function close() {
  emit('close');
}
</script>

<template>
  <transition name="sheet">
    <div v-if="open" class="share-mask" @click.self="close">
      <div class="share-sheet" role="dialog" aria-label="分享卡片">
        <div class="sheet-head">
          <h2>分享这家店</h2>
          <button class="close-btn" aria-label="关闭" @click="close">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <canvas ref="canvas" width="720" height="1040" class="share-canvas"></canvas>
        <div class="sheet-actions">
          <button class="btn-primary" :disabled="busy" @click="doShare">
            {{ busy ? '生成中…' : '分享给好友' }}
          </button>
          <button class="ghost" @click="download">保存图片</button>
          <button class="ghost" @click="copyLink()">复制链接</button>
        </div>
        <p v-if="message" class="sheet-tip">{{ message }}</p>
        <p v-else class="sheet-hint">发到班级群、宿舍群，帮同学少纠结一次</p>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.share-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(58, 27, 18, 0.48);
  backdrop-filter: blur(4px);
  padding: 0;
}
.share-sheet {
  width: 100%;
  max-width: 460px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 16px 16px calc(18px + env(safe-area-inset-bottom));
  border-radius: 22px 22px 0 0;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.sheet-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}
.close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--ink-soft);
  background: var(--surface-2);
}
.share-canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 14px;
  border: 1px solid var(--line);
}
.sheet-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.sheet-actions .btn-primary {
  flex: 1;
  height: 42px;
  padding: 0 14px;
}
.ghost {
  height: 42px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 13px;
}
.sheet-tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--accent);
  text-align: center;
}
.sheet-hint {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--ink-mute);
  text-align: center;
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.22s ease;
}
.sheet-enter-active .share-sheet,
.sheet-leave-active .share-sheet {
  transition: transform 0.26s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .share-sheet,
.sheet-leave-to .share-sheet {
  transform: translateY(28px);
}
@media (min-width: 720px) {
  .share-mask {
    align-items: center;
  }
  .share-sheet {
    border-radius: 22px;
    padding-bottom: 18px;
  }
}
</style>
