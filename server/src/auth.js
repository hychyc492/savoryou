import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from './db.js';
import { unauthorized, forbidden } from './http.js';

const SECRET = process.env.JWT_SECRET || 'savoru-dev-secret';
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '2h';
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;
export const REFRESH_COOKIE = 'savoru_rt';

// Cookie 的 Secure 开关：显式 COOKIE_SECURE 优先；否则生产默认 true
const isSecure = process.env.COOKIE_SECURE != null
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production';
const cookieBase = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isSecure,
  path: '/api/v1/auth',
};

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function signAccess(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, ver: user.tokenVersion ?? 0 },
    SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

/** 签发会话：access 返回给客户端，refresh 以 httpOnly Cookie 下发 */
export async function issueSession(req, res, user) {
  const raw = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 864e5),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
      ip: String(req.ip || ''),
    },
  });
  res.cookie(REFRESH_COOKIE, raw, { ...cookieBase, maxAge: REFRESH_DAYS * 864e5 });
  return signAccess(user);
}

/** 刷新：校验 Cookie 中的 refresh → 撤销旧记录 → 轮换新 refresh + 新 access */
export async function rotateRefresh(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) throw unauthorized('登录已过期，请重新登录');
  const row = await prisma.refreshToken.findFirst({
    where: { tokenHash: sha256(raw), revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!row) throw unauthorized('登录已过期，请重新登录');
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  const accessToken = await issueSession(req, res, row.user);
  return { accessToken, user: row.user };
}

/** 退出：撤销当前 refresh 并清 Cookie */
export async function revokeFromRequest(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.clearCookie(REFRESH_COOKIE, cookieBase);
}

function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

/** 解析 access token，并核对 tokenVersion（改密/全端登出后旧 token 立即失效） */
async function loadUser(req) {
  const token = readToken(req);
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, username: true, role: true, tokenVersion: true },
  });
  if (!user || (payload.ver ?? 0) !== user.tokenVersion) return null;
  return user;
}

export const softAuth = async (req, _res, next) => {
  try {
    req.user = await loadUser(req);
  } catch {
    req.user = null;
  }
  next();
};

export const requireAuth = async (req, _res, next) => {
  try {
    const user = await loadUser(req);
    if (!user) return next(unauthorized());
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
};

/** 需先经过 requireAuth；每次查库确认角色，避免 token 里的旧角色 */
export const requireAdmin = async (req, _res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.role !== 'admin') return next(forbidden('需要管理员权限'));
    req.user.role = user.role;
    next();
  } catch (e) {
    next(e);
  }
};

export const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role });