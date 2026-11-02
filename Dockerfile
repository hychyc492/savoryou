# ---- 前端构建 ----
FROM node:22-alpine AS client
WORKDIR /c
COPY client/package*.json ./
RUN npm ci || npm install
COPY client ./
RUN npm run build

# ---- 后端运行 ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY server/prisma ./prisma
RUN npx prisma generate
COPY server/src ./src
COPY server/scripts ./scripts
# 前端产物放到 ../client/dist（app.js 相对 src 解析）
COPY --from=client /c/dist /client/dist
# 种子数据（seed.js 需要 client/public/data/shops.json）
COPY --from=client /c/public/data /client/public/data
EXPOSE 3001
# 环境变量由编排注入（不使用 --env-file）
CMD ["node", "src/index.js"]