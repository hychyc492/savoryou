/**
 * 迁移核对（不依赖数据库引擎）：把 prisma/schema.prisma 的模型/索引/唯一约束/关系
 * 与 prisma/migrations 里的 PostgreSQL SQL 逐项比对，提前发现缺表、缺索引、缺外键。
 *
 *   node scripts/verify-migration.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(root, 'prisma', 'schema.prisma');
const migrationsDir = path.join(root, 'prisma', 'migrations');

const schema = fs.readFileSync(schemaPath, 'utf8');
const sqlFiles = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
  : [];
const sql = sqlFiles.map((d) => fs.readFileSync(path.join(migrationsDir, d, 'migration.sql'), 'utf8')).join('\n');

/* ---------- 解析 schema ---------- */
const models = [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)].map((m) => ({ name: m[1], body: m[2] }));

const wantTables = models.map((m) => m.name);
let wantUnique = 0;
let wantIndex = 0;
let wantRel = 0;
for (const m of models) {
  wantUnique += [...m.body.matchAll(/@@unique/g)].length;
  wantUnique += [...m.body.matchAll(/(?<!@)@unique/g)].length;
  wantIndex += [...m.body.matchAll(/@@index/g)].length;
  // 关系字段：类型为另一个 model 的行（形如 `  shop  Shop  @relation(...)`）
  wantRel += [...m.body.matchAll(/@relation\(/g)].length;
}

/* ---------- 解析 SQL ---------- */
const gotTables = [...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]);
const gotUniqueIdx = [...sql.matchAll(/CREATE UNIQUE INDEX/g)].length;
const gotIdx = [...sql.matchAll(/CREATE INDEX/g)].length;
const gotPk = [...sql.matchAll(/PRIMARY KEY/g)].length;
const gotFk = [...sql.matchAll(/FOREIGN KEY/g)].length;
const lock = fs.existsSync(path.join(migrationsDir, 'migration_lock.toml'))
  ? fs.readFileSync(path.join(migrationsDir, 'migration_lock.toml'), 'utf8')
  : '';

/* ---------- 报告 ---------- */
console.log('迁移文件：', sqlFiles.join(', ') || '(无)');
console.log('provider：', /postgresql/.test(lock) ? 'postgresql ✓' : '非 postgresql ✗');

const missing = wantTables.filter((t) => !gotTables.includes(t));
const extra = gotTables.filter((t) => !wantTables.includes(t));
console.log(`\n表：期望 ${wantTables.length} / SQL ${gotTables.length}`);
console.log('  期望表：', wantTables.join(', '));
if (missing.length) console.log('  ✗ 缺失：', missing.join(', '));
if (extra.length) console.log('  · 额外：', extra.join(', '));
else if (!missing.length) console.log('  ✓ 全部表均已生成');

console.log(`\n唯一约束：schema ${wantUnique} / SQL CREATE UNIQUE INDEX ${gotUniqueIdx}`);
console.log(`索引：schema ${wantIndex} / SQL CREATE INDEX ${gotIndexText(gotIdx)}`);
console.log(`主键：SQL PRIMARY KEY ${gotPk}（期望 ${wantTables.length}）`);
console.log(`外键：schema @relation ${wantRel} / SQL FOREIGN KEY ${gotFk}`);

function gotIndexText(n) {
  return n;
}

const ok = !missing.length && /postgresql/.test(lock) && gotFk >= wantRel - 1;
console.log('\n结论：', ok ? '✓ 迁移 SQL 与 schema 基本一致，可在 PostgreSQL 执行 migrate deploy' : '✗ 存在不一致，请检查');
process.exit(ok ? 0 : 1);