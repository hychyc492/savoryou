# SavorU 云端部署手册（无需本机常开）

目标：把站点部署到一台 7×24 的服务器上，任何人随时随地（手机流量/外网）都能打开，且**不依赖你自己的电脑开机**。

> 前置说明：本机所在网络 **GitHub 不可达**。因此若你要走 PaaS，注意两种方式：
> - **可以直接本地目录/CLI 部署**：Fly.io、Railway CLI（`railway up`）——不需要 GitHub。
> - **必须连 Git 仓库**：Render Blueprint、Zeabur 的 Git 方式——可改用 **Gitee** 镜像或先解决网络。
> - **完全不依赖任何 Git**：云主机 + Docker（把代码 `scp` 上去即可）——**最推荐**。

---

## 0. 通用环境变量（三种方式都一样）

| 变量 | 说明 | 生产取值示例 |
|---|---|---|
| `DATABASE_URL` | 数据库连接串（**云端用 PostgreSQL**） | `postgresql://user:pass@host:5432/savoru?schema=public` |
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 端口（PaaS 平台通常自动注入，勿覆盖） | `3001` |
| `HOST` | 监听地址（允许外部访问） | `0.0.0.0` |
| `JWT_SECRET` / `COOKIE_SECRET` | 密钥，**务必改**（32 位以上随机串） | 随机串 |
| `COOKIE_SECURE` | 有 HTTPS 用 `true`；纯 http 演示用 `false`（否则登录刷新会掉线） | `true` |
| `CORS_ORIGINS` | 跨域白名单；**同域部署可留空** | `https://你的域名` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 管理员（首次 seed 创建，**务必改口令**） | 自定义 |

---

## 路径 A（推荐）：云主机 + Docker，一条命令起站

**适用**：有任意一台带公网 IP 的服务器（阿里云/腾讯云/华为云/搬瓦工/学生机等）。

```bash
# 1) 服务器上安装 Docker（示例 Ubuntu）
curl -fsSL https://get.docker.com | sh

# 2) 上传代码（本机执行；不需要 GitHub）
scp -r D:\yummy\SavorU root@<服务器IP>:/opt/savoru
#    或先 git 推送到 Gitee/自建 Git，再在服务器 git clone

# 3) 配置密钥（服务器上）
cd /opt/savoru
cp .env.example .env       # 然后编辑 .env：改 POSTGRES_PASSWORD / JWT_SECRET / COOKIE_SECRET / ADMIN_PASSWORD
                           # 若已配 HTTPS，保持 COOKIE_SECURE=true；先跑 http 可临时改 false

# 4) 构建并启动（会自动迁移 + 建表 + 写入 666 家店铺等种子）
docker compose up -d --build

# 5) 验证
curl -s http://127.0.0.1:3001/api/health        # 期望 {"ok":true,"db":"up"}
```

**放行端口**：云主机「安全组」放行 `3001`（或后面用 80/443 反代）。
访问：`http://<服务器IP>:3001`。

### 加域名 + HTTPS（推荐，顺带解决 Cookie/PWA）

用 Caddy 一键自动证书（在服务器上）：

```bash
# Caddyfile
cat > /opt/savoru/Caddyfile <<'EOF'
你的域名.com {
    encode gzip
    reverse_proxy 127.0.0.1:3001
}
EOF
docker run -d --name caddy --restart unless-stopped --network host \
  -v /opt/savoru/Caddyfile:/etc/caddy/Caddyfile -v caddy_data:/data caddy
```

然后：`.env` 里 `COOKIE_SECURE=true`、`CORS_ORIGINS=https://你的域名.com`，`docker compose up -d app` 重启应用。
> 国内主机绑域名需 **ICP 备案**；不想备案就用境外主机，或用路径 B/C 的免费域名。

### 运维

- **更新**：`git pull`（或重新 scp）→ `docker compose up -d --build`
- **备份**：`docker compose exec db pg_dump -U savoru savoru > backup-$(date +%F).sql`
- **自启**：compose 已设 `restart: unless-stopped`，服务器重启后自动拉起（无需你本机）。

---

## 路径 B：Render（免费，Git 驱动）

1. 把代码托管到 Git 仓库（**GitHub 若不通，用 Gitee 并在 Render 里选 Gitee 仓库**，或直接用路径 A/C）。
2. Render 控制台 → **New → Blueprint** → 选仓库（会读取仓库根目录的 `render.yaml`）。
3. 按提示填 `ADMIN_PASSWORD`（其余自动生成/注入），确认创建：会自动建 **Web( Docker)** + **PostgreSQL**。
4. 部署完成后访问 `https://<服务名>.onrender.com`；首次启动脚本已自动 `migrate deploy + seed`。
5. 自定义域名：Render → Settings → Custom Domain，按提示加 CNAME；`COOKIE_SECURE` 保持 `true`。
6. 免费实例会**休眠**，首次访问约几十秒冷启动（要 7×24 秒开可升付费，或用路径 A）。

## 路径 C：Railway / Zeabur / Koyeb（Dockerfile 自动识别）

- **Railway**：`npm i -g @railway/cli` → `railway login` → 在项目根 `railway init` → `railway up`（**本地目录直接上传，不需要 GitHub**）→ 控制台 Add PostgreSQL（自动注入 `DATABASE_URL`）→ 设置 `JWT_SECRET/COOKIE_SECRET/ADMIN_PASSWORD/COOKIE_SECURE=true`。
- **Zeabur**：新建项目 → 连仓库（或“部署 Docker 镜像”）→ 添加 PostgreSQL 服务 → 设环境变量。
- **Koyeb**：Deploy from Dockerfile → 附加 Postgres 实例 → 设环境变量。

> 这些平台大多需要一个 **Start Command**，填：
> `sh -c "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"`

## 路径 D：Fly.io（本地目录直传，无需 GitHub）

```bash
# 安装 flyctl 后（本机若因网络装不了，可在能联网的机器上做）
fly launch --no-deploy --dockerfile Dockerfile
fly postgres create --name savoru-db
fly postgres attach --app savoru savoru-db        # 注入 DATABASE_URL
fly secrets set JWT_SECRET=... COOKIE_SECRET=... ADMIN_PASSWORD=... COOKIE_SECURE=true NODE_ENV=production
fly deploy
```

---

## 常见问题排查

| 现象 | 原因 / 处理 |
|---|---|
| 部署后 502 / 打不开 | 容器未起或健康检查失败：看日志 `docker compose logs -f app`；确认 `migrate deploy` 成功、`DATABASE_URL` 正确 |
| 能打开但登录后“掉线” | HTTPS 下 `COOKIE_SECURE` 必须为 `true`；纯 http 反而要设 `false` |
| 校外地图不显示 | 高德 Key 域名白名单需加入你的域名（或放开域名限制） |
| `migrate deploy` 报找不到 prisma | 已把 `prisma` 移入运行时依赖，重新 `build` 镜像即可 |
| 种子重复执行 | 无害：`seed.js` 是幂等的（店铺 upsert、菜品按名去重、演示评价 upsert） |
| PaaS 强制端口 | 别设 `PORT`，让平台注入；本地 Docker 用 3001 |
| 数据库数据丢失 | 用托管 PG 或 compose 的 `pgdata` 卷；定期 `pg_dump` 备份 |

---

## 部署后自检清单

```bash
curl -s https://你的地址/api/health              # ok:true, db:up
curl -s https://你的地址/api/v1/stats/overview   # nearbyShops=645, canteens=3, dishes=42
open  https://你的地址/                          # SPA 可打开、能登录
open  https://你的地址/landing.html              # 落地页 + 3D 汉堡
open  https://你的地址/api/docs                  # 接口文档
```
可用仓库里的脚本核对：
```bash
node --env-file=.env server/scripts/pg-smoke.mjs     # 或 npm run smoke:pg
node server/scripts/verify-migration.mjs             # 迁移 SQL 与 schema 一致性
```