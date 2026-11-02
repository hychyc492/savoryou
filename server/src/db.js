import { PrismaClient } from '@prisma/client';

/// 全局唯一 PrismaClient（生产环境建议挂到 globalThis 防热重载重复实例）
export const prisma = globalThis.__savoru_prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__savoru_prisma = prisma;

export default prisma;