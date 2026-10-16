/* 每日时长（GDD §8，本地）。用量按 档案×日期 记秒；limit=0 表示不限 */
export interface TimeLimit { weekday: number; weekend: number }   // 分钟
export interface Usage { [day: string]: { used: number; bonus: number } }  // 秒
export const isWeekend = (d = new Date()) => d.getDay() === 0 || d.getDay() === 6;
export function limitMinutes(l: TimeLimit, d = new Date()) { return isWeekend(d) ? l.weekend : l.weekday; }
/** 剩余秒数；Infinity = 不限 */
export function remainingSec(l: TimeLimit, u: Usage, day: string, d = new Date()): number {
  const m = limitMinutes(l, d);
  if (!m) return Infinity;
  const r = u[day] ?? { used: 0, bonus: 0 };
  return Math.max(0, m * 60 + r.bonus - r.used);
}
export function addUsage(u: Usage, day: string, sec: number): Usage {
  const r = u[day] ?? { used: 0, bonus: 0 };
  // 只保留最近 30 天
  const keep = Object.keys(u).sort().slice(-30);
  const out: Usage = {}; for (const k of keep) out[k] = u[k];
  out[day] = { ...r, used: r.used + sec };
  return out;
}
export function addBonus(u: Usage, day: string, sec: number): Usage {
  const r = u[day] ?? { used: 0, bonus: 0 };
  return { ...u, [day]: { ...r, bonus: r.bonus + sec } };
}
/** 家长密码：仅用于防孩子误入，不是安全措施（局域网 http 下没有 crypto.subtle，用 FNV-1a） */
export function hashPin(pin: string, salt = 'zsyz') {
  let h = 0x811c9dc5;
  for (const ch of salt + pin) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}
export const validPin = (p: string) => /^\d{4,6}$/.test(p);

/** r11：取消今天的临时加时 */
export function cancelBonus(u: Usage, day: string): Usage { const r = u[day]; return r ? { ...u, [day]: { ...r, bonus: 0 } } : u; }
/** r11：今天的临时加时（秒） */
export const bonusToday = (u: Usage | undefined, day: string) => u?.[day]?.bonus ?? 0;

/** r11 技术QA R10-1：时间到后的收尾（3 分钟）。每秒由游戏时钟调用一次：暂停 / 后台不走；单次最多走 2 秒（防卡顿跳秒、调时钟） */
export const GRACE_MS = 3 * 60e3;
export function tickGrace(left: number, dp: number, paused: boolean): { left: number; fire: boolean } {
  if (paused) return { left, fire: false };
  const n = Math.max(0, left - Math.min(Math.max(dp, 0), 2000)); return { left: n, fire: n <= 0 };
}
