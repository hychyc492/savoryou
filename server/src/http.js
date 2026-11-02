/**
 * HTTP 基础层：统一响应、错误码、异步包装、分页与错误处理。
 * 约定成功：{ ok:true, data, meta? }；失败：{ ok:false, error:{ code, message } }
 */

export const CODES = {
  VALIDATION: 400,
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class ApiError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.status = CODES[code] || 500;
  }
}

export const badRequest = (m) => new ApiError('VALIDATION', m);
export const unauthorized = (m) => new ApiError('AUTH_REQUIRED', m || '请先登录');
export const forbidden = (m) => new ApiError('FORBIDDEN', m || '没有权限');
export const notFound = (m) => new ApiError('NOT_FOUND', m || '资源不存在');
export const conflict = (m) => new ApiError('CONFLICT', m);

export function ok(res, data, meta) {
  const body = { ok: true, data };
  if (meta) body.meta = meta;
  return res.json(body);
}

/** 包装 async 路由，异常交给全局错误处理 */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** 解析分页参数：limit(1..100, 默认 20)、offset(>=0) */
export function pageParams(query, { defLimit = 20, maxLimit = 100 } = {}) {
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defLimit));
  const offset = Math.max(0, Number(query.offset) || 0);
  return { limit, offset };
}

export function notFoundHandler(_req, _res, next) {
  next(notFound('接口不存在'));
}

/* eslint-disable no-unused-vars */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message } });
  }
  // Prisma 唯一约束
  if (err && err.code === 'P2002') {
    return res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: '数据已存在' } });
  }
  // Prisma 外键约束（例如 targetId 不在目录内）
  if (err && err.code === 'P2003') {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION', message: '关联对象不存在' } });
  }
  if (err && err.code === 'P2025') {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '资源不存在' } });
  }
  console.error(err);
  return res.status(500).json({ ok: false, error: { code: 'INTERNAL', message: '服务器开小差了，稍后再试' } });
}