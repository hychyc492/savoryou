/**
 * 一键公网分享（SSH 反向隧道，零安装）：
 *   node scripts/tunnel.mjs                 # 随机公网地址
 *   node scripts/tunnel.mjs --subdomain savoru   # 固定子域（若未被占用）
 *   node scripts/tunnel.mjs --host localhost.run # 备用隧道服务
 *   node scripts/tunnel.mjs --port 3001
 *
 * 原理：借助系统自带 ssh，把公网入口反向映射到本机 127.0.0.1:3001。
 * 关闭本脚本或本机休眠/关机，公网地址即失效；每次重启地址可能变化（除非用固定子域）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const getArg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const port = getArg('port', process.env.PORT || '3001');
const host = getArg('host', 'serveo.net');
const subdomain = getArg('subdomain', '');
const logFile = getArg('log', '');
const remote = subdomain ? `${subdomain}:80:127.0.0.1:${port}` : `80:127.0.0.1:${port}`;

const sshArgs = [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'UserKnownHostsFile=NUL',
  '-o', 'ServerAliveInterval=30',
  '-o', 'ExitOnForwardFailure=yes',
  '-R', remote,
  host,
].concat(host === 'serveo.net' ? [] : ['nokey@' + host]);

console.log(`建立公网隧道：${host} → 127.0.0.1:${port}${subdomain ? `（子域 ${subdomain}）` : ''}`);
console.log('（保持此窗口开启；按 Ctrl+C 断开）\n');

const child = spawn('ssh', sshArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
let printed = false;

const onData = (buf) => {
  const text = buf.toString();
  const m = text.match(/https:\/\/[A-Za-z0-9._-]+(?:serveousercontent\.com|lhr\.life|serveo\.net|trycloudflare\.com)/);
  if (m && !printed) {
    printed = true;
    if (logFile) {
      try { fs.writeFileSync(logFile, m[0] + '\n'); } catch { /* 忽略 */ }
    }
    console.log('==============================================');
    console.log('  公网地址：' + m[0]);
    console.log('  可直接发给任何人（含手机流量/外网）');
    console.log('==============================================');
    console.log('提示：高德地图 Key 若设了域名白名单，需把该域名加入，否则地图不显示。\n');
  }
};

setTimeout(() => {
  if (!printed) {
    console.log('（12 秒内未拿到公网地址：若使用了 --subdomain，可能是该子域已被占用，请去掉该参数改用随机地址）');
  }
}, 12000);

child.stdout.on('data', onData);
child.stderr.on('data', onData);
child.on('exit', (code) => {
  console.log(`隧道已退出（code=${code}）。可重新运行本脚本获取新地址。`);
});