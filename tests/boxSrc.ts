// 测试用：只在开发机（box）上才有的源文件根目录（题库源 / 美术源 / 策划文档）。CI 上没有这些目录，相关比对要跳过。
// ZY_BOX_ROOT 可以改根目录（例如指到不存在的目录，模拟 CI）。
import { existsSync } from 'node:fs';
export const BOX = (process.env.ZY_BOX_ROOT ?? '/workspace').replace(/\/$/, '');
export const boxPath = (p: string) => `${BOX}/${p.replace(/^\//, '')}`;
/** 缺哪些文件（空数组 = 都在） */
export const missing = (...ps: string[]) => ps.filter(p => !existsSync(p));
