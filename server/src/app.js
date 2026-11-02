import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { api } from './routes.js';
import { openapiSpec } from './openapi.js';
import { notFoundHandler, errorHandler, ok, wrap } from './http.js';
import { prisma } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false })); // Swagger UI 需要内联资源
  app.use(compression());
  if (process.env.NODE_ENV !== 'test') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  const origins = String(process.env.CORS_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : true, credentials: true }));

  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser(process.env.COOKIE_SECRET || 'savoru-cookie'));

  // 限流：全局 / 认证 / 写操作
  const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 900, standardHeaders: true, legacyHeaders: false });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: { code: 'RATE_LIMITED', message: '尝试过于频繁，请稍后再试' } } });
  const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, skip: (req) => req.method === 'GET', message: { ok: false, error: { code: 'RATE_LIMITED', message: '操作过于频繁，请稍后再试' } } });
  app.use('/api/v1', globalLimiter);
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/register', authLimiter);

  // 健康检查（含 DB ping）
  app.get('/api/health', wrap(async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return ok(res, { ok: true, db: 'up', time: new Date().toISOString() });
    } catch {
      return res.status(503).json({ ok: false, error: { code: 'INTERNAL', message: '数据库不可用' } });
    }
  }));

  // 文档
  app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: 'SavorU API' }));

  // 写操作限流（须在业务路由之前挂载）
  app.use('/api/v1/reviews', writeLimiter);
  app.use('/api/v1/checkins', writeLimiter);
  app.use('/api/v1/submissions', writeLimiter);

  // 业务接口
  app.use('/api/v1', api);

  // 生产环境托管前端构建产物（SPA fallback）
  const distDir = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir, { maxAge: '1h', index: false }));
    // 根路径直接展示落地页（作品首页）；应用本体在 /app
    app.get('/', (_req, res) => {
      const landing = path.join(distDir, 'landing.html');
      res.sendFile(fs.existsSync(landing) ? landing : path.join(distDir, 'index.html'));
    });
    app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}