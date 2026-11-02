import os from 'node:os';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // 0.0.0.0 = 允许同局域网访问；127.0.0.1 = 仅本机
const app = createApp();

/** 收集本机非回环的 IPv4 地址，方便把网址发给同一内网的同学 */
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

app.listen(PORT, HOST, () => {
  console.log(`SavorU API 已启动（监听 ${HOST}:${PORT}）`);
  console.log(`  本机：    http://127.0.0.1:${PORT}`);
  const lan = lanAddresses();
  if (lan.length) {
    lan.forEach((ip) => console.log(`  局域网：  http://${ip}:${PORT}   （同一 WiFi/内网的其他电脑可直接打开）`));
  } else {
    console.log('  局域网：  （未检测到局域网地址）');
  }
  console.log(`  接口文档：http://127.0.0.1:${PORT}/api/docs`);
});