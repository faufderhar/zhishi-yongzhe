/* r15.3 技术QA R152-4：覆盖恢复 / 撤销恢复写库前清洗数字——1e308、负数、"NaN"、null 等不再原样存进去。
   读的时候各处也会夹，但库里不该留脏值（导出再导入、旧版本读取都会出问题） */
import { XP_MAX, MASTERED_MAX } from './limits';
type R = Record<string, unknown>;
const isObj = (x: unknown): x is R => !!x && typeof x === 'object' && !Array.isArray(x);
/** 有限数且在 [lo, hi] 内；可选取整。不合格返回 undefined（调用方丢掉该项） */
export function num(v: unknown, lo: number, hi: number, int = false): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const c = Math.min(hi, Math.max(lo, v)); return int ? Math.round(c) : c;
}
const DAY_SEC = 86400;
export function cleanProgress(x: unknown) {
  if (!isObj(x)) return undefined;
  const stars: Record<string, number> = {}; if (isObj(x.stars)) for (const [k, v] of Object.entries(x.stars)) { const n = num(v, 0, 3, true); if (n !== undefined) stars[k] = n; }
  const plays: Record<string, { day: string; count: number }> = {}; if (isObj(x.plays)) for (const [k, v] of Object.entries(x.plays)) { if (!isObj(v) || typeof v.day !== 'string') continue; const c = num(v.count, 0, 999, true); if (c !== undefined) plays[k] = { day: v.day, count: c }; }
  return { ...x, stars, plays, xp: num(x.xp, 0, XP_MAX, true) ?? 0, masteredStars: num(x.masteredStars, 0, MASTERED_MAX, true) ?? 0 };
}
export function cleanUsage(x: unknown) {
  if (!isObj(x)) return undefined; const out: Record<string, { used: number; bonus: number }> = {};
  for (const [d, v] of Object.entries(x)) { if (!isObj(v)) continue; const used = num(v.used, 0, DAY_SEC, true); if (used === undefined) continue; out[d] = { used, bonus: num(v.bonus, 0, DAY_SEC, true) ?? 0 }; }
  return out;
}
export function cleanSkills(x: unknown) {
  if (!isObj(x)) return undefined; const out: R = {};
  for (const [s, v] of Object.entries(x)) { if (!isObj(v)) continue; const level = num(v.level, 1, 5, true); if (level === undefined) continue; out[s] = { level, right: num(v.right, 0, 1000, true) ?? 0, wrong: num(v.wrong, 0, 1000, true) ?? 0, ...(v.locked === true ? { locked: true } : {}) }; }
  return out;
}
const TS_MAX = 4102444800000;   // 2100-01-01
export function cleanFlags(x: unknown) { if (!isObj(x)) return undefined; const out: Record<string, number> = {}; for (const [k, v] of Object.entries(x)) { const n = num(v, 0, TS_MAX); if (n !== undefined) out[k] = n; } return out; }
/** kv 一行：按键名清洗；返回 undefined 表示这一行丢掉 */
export function cleanKv(k: string, v: unknown): unknown {
  if (k.startsWith('progress:')) return cleanProgress(v);
  if (k.startsWith('usage:')) return cleanUsage(v);
  if (k.startsWith('skills:')) return cleanSkills(v);
  if (k === 'flags') return cleanFlags(v);
  return v;
}
export function cleanAnswer(v: unknown) { if (!isObj(v)) return undefined; const at = num(v.at, 0, TS_MAX, true); return at === undefined ? undefined : { ...v, at, correct: v.correct === true }; }
export function cleanWrong(v: unknown) {
  if (!isObj(v)) return undefined; const box = num(v.box, 1, 3, true) ?? 1;
  return { ...v, box, wrongCount: num(v.wrongCount, 0, 1e4, true) ?? 1, addedAt: num(v.addedAt, 0, TS_MAX, true) ?? 0, updatedAt: num(v.updatedAt, 0, TS_MAX, true) ?? 0, due: typeof v.due === 'string' ? v.due : '' };
}
