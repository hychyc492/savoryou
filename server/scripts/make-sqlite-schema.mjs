import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 从生产 schema（postgresql）自动派生一份 sqlite 镜像 schema，供本地开发/演示使用。
// 用法：node scripts/make-sqlite-schema.mjs
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.resolve(__dirname, '../prisma/schema.prisma');
const outPath = path.resolve(__dirname, '../prisma/schema.sqlite.prisma');

let text = fs.readFileSync(srcPath, 'utf8');

if (!text.includes('provider = "postgresql"')) {
  console.error('未在主 schema 中找到 provider = "postgresql"');
  process.exit(1);
}
text = text.replace('provider = "postgresql"', 'provider = "sqlite"');
text = '// 自动生成：由 schema.prisma 派生（provider=sqlite），请勿手工编辑。\n// 重新生成：npm run schema:sqlite\n' + text;

fs.writeFileSync(outPath, text);
console.log('已生成 ' + path.relative(process.cwd(), outPath));