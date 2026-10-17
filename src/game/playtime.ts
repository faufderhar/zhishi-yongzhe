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
  // r14.1：加时就是「加」：今天已加 += sec（r14 的「先补齐超出部分」会让 10 分钟变成 114 分钟，撤回）
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
/** r15.3 较真家长：今天的用时上限 = 上限（含加时）+ 3 分钟收尾。
 *  base = 上限秒数（含加时；Infinity = 不限）。超过 base 的部分只在「收尾进行中（战斗 / 复习里）」才计，且总数永远不超过 base + 收尾。
 *  以前时间到之后，结算页 / 地图 / 错题本还在照常计时（r15 起所有登录界面都计时），所以会超出 8:00 */
export const GRACE_SEC = GRACE_MS / 1000;
export function clampUsageAdd(used: number, add: number, base: number, inGrace: boolean): number {
  if (!(add > 0)) return 0;
  if (!Number.isFinite(base)) return add;
  const cap = inGrace ? base + GRACE_SEC : base;
  return Math.max(0, Math.min(add, cap - used));
}
/** 家长页拆分：已用（不超过上限） + 收尾（超过上限的部分，最多 3 分钟） */
export function splitUsed(used: number, base: number): { play: number; wrap: number } {
  if (!Number.isFinite(base)) return { play: used, wrap: 0 };
  return { play: Math.min(used, base), wrap: Math.max(0, used - base) };
}
/** 收尾还能走多少毫秒：3 分钟，但已经计进去的超时部分要扣掉（用时每 5 秒结算一次，进入收尾时可能已多计了几秒） */
export function graceBudgetMs(used: number, base: number, G = GRACE_MS): number {
  if (!Number.isFinite(base)) return G;
  return Math.max(0, Math.min(G, (base + GRACE_SEC - used) * 1000));
}
export const fmtMS = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* r15.4 小萌新：收尾 / 时间用完的朗读与提示文字（小班不识字时朗读） */
export const GRACE_VOICE = '时间到啦，打完这关就休息哦';
export const SLEEPY_TEXT = '今天玩够啦，明天再来';
export const SLEEPY_RESET = '明天 0:00 重新计时';
export const SLEEPY_VOICE = '今天玩够啦，明天再来哦。明天零点重新计时';
