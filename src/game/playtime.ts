/* 每日时长（GDD §8，本地）。用量按 档案×日期 记秒；limit=0 表示不限 */
export interface TimeLimit { weekday: number; weekend: number }   // 分钟
/** wrap（r15.4.1）：其中记在收尾时间里的秒数（超过当时上限、收尾进行中）。旧记录没有这个字段 */
/** wrapTail（r15.4.2）：最近一段收尾的秒数——收尾之后又正常玩了（用上了加时）就清零。只有这段「刚走完、后面还没玩」的收尾不算加时已用 */
/** spent（r15.4.3）：取消加时时留下的「已用掉的加时」秒数——之后改每日上限也不再重算成「没用的、可以取消」 */
export interface Usage { [day: string]: { used: number; bonus: number; wrap?: number; wrapTail?: number; spent?: number } }  // 秒
export const isWeekend = (d = new Date()) => d.getDay() === 0 || d.getDay() === 6;
export function limitMinutes(l: TimeLimit, d = new Date()) { return isWeekend(d) ? l.weekend : l.weekday; }
/** 剩余秒数；Infinity = 不限 */
export function remainingSec(l: TimeLimit, u: Usage, day: string, d = new Date()): number {
  const m = limitMinutes(l, d);
  if (!m) return Infinity;
  const r = u[day] ?? { used: 0, bonus: 0 };
  return Math.max(0, m * 60 + r.bonus - r.used);
}
export function addUsage(u: Usage, day: string, sec: number, base = Infinity): Usage {
  const r = u[day] ?? { used: 0, bonus: 0 };
  /* r15.4.1 较真家长：超过当时上限（含加时）的那部分按收尾记下来，家长页按记录显示收尾，不再用「已用 − 上限」倒推（上限改了 / 加时取消了就会算出 23 分钟收尾） */
  const wInc = Number.isFinite(base) ? Math.max(0, Math.max(0, r.used + sec - base) - Math.max(0, r.used - base)) : 0;
  // 只保留最近 30 天
  const keep = Object.keys(u).sort().slice(-30);
  const out: Usage = {}; for (const k of keep) out[k] = u[k];
  const tail = wInc > 0 ? Math.min(GRACE_SEC, (r.wrapTail ?? 0) + wInc) : sec > 0 ? 0 : (r.wrapTail ?? 0);
  const { wrapTail: _t, ...r0 } = r; void _t;
  out[day] = { ...r0, used: r.used + sec, ...(wInc > 0 ? { wrap: (r.wrap ?? 0) + wInc } : {}), ...(tail > 0 ? { wrapTail: tail } : {}) };
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

/** r15.4.1 较真家长：今天的加时里已经用掉的部分（秒）。limitSec = 今天的每日上限秒数（不含加时；0 / Infinity = 不限） */
export function bonusUsedSec(r: { used: number; bonus: number; wrap?: number; wrapTail?: number; spent?: number } | undefined, limitSec: number): number {
  if (!r || !(r.bonus > 0)) return 0;
  /* r15.4.3 较真家长 P2-4：取消时已经认定用掉的那部分加时固定下来（上限改大后不再变回「没用的 4:14，可以取消」） */
  const sp = Math.min(r.bonus, Math.max(0, r.spent ?? 0)); if (!(limitSec > 0) || !Number.isFinite(limitSec)) return sp;
  /* r15.4.2 技术QA P3-6：刚走完、之后还没继续玩的那段收尾（wrapTail）不算「加时已用」——收尾走完后 +10 再立刻取消，
     以前会把「收尾 3:00」改记成「加时已用 3:00」。收尾之后孩子又用加时玩了，那段收尾已经按「加的时间先抵掉超出的部分」用掉了加时，照旧算 */
  const ex = Math.max(0, r.used - (limitSec + r.bonus)); const curWrap = Math.max(Math.min(GRACE_SEC, ex, r.wrap ?? ex), Math.min(GRACE_SEC, r.wrapTail ?? 0));
  return Math.max(sp, Math.min(r.bonus, Math.max(0, r.used - curWrap - limitSec)));
}
/** r11：取消今天的临时加时。r15.4.1 较真家长：只取消还没用的部分，已经用掉的加时留下（以前整笔清零，已玩的加时时间全被算成「收尾」，家长页出现「收尾 23:00」）。
 *  limitSec = 取消时家长看到的每日上限秒数（不含加时）；不传 / 不限 = 整笔取消 */
/** r15.4.2 较真家长：取消确认框用——这次会取消多少、取消后今天还能玩多久（秒；Infinity = 不限） */
export function cancelPreview(r: { used: number; bonus: number; wrap?: number; wrapTail?: number; spent?: number } | undefined, limitSec: number): { cancel: number; leftAfter: number } {
  if (!r) return { cancel: 0, leftAfter: limitSec > 0 ? limitSec : Infinity }; const bu = bonusUsedSec(r, limitSec);
  return { cancel: Math.max(0, r.bonus - bu), leftAfter: limitSec > 0 && Number.isFinite(limitSec) ? Math.max(0, limitSec + bu - r.used) : Infinity };
}
export function cancelBonus(u: Usage, day: string, limitSec = 0): Usage { const r = u[day]; if (!r) return u; const bu = bonusUsedSec(r, limitSec); const { spent: _s, ...r0 } = r; void _s; return { ...u, [day]: { ...r0, bonus: bu, ...(bu > 0 ? { spent: bu } : {}) } }; }
/** r15.4.3 较真家长 P2-4：今天的加时是不是全是「取消后留下的已用部分」（显示「加时已取消」而不是「今天已加」） */
export const bonusAllSpent = (r: { bonus: number; spent?: number } | undefined) => !!r && r.bonus > 0 && (r.spent ?? 0) >= r.bonus;
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
/** 家长页拆分：已用 + 收尾（超过上限的部分里、真的记在收尾时间里的，永远 ≤ 3:00）。
 *  r15.4.1：wrapRec = 记下的收尾秒数（旧记录没有时按超出部分算，同样封顶 3:00）；超出上限但不是收尾的（上限后来改小了）算在 play 里，over 给出超出多少 */
export function splitUsed(used: number, base: number, wrapRec?: number): { play: number; wrap: number; over: number } {
  if (!Number.isFinite(base)) return { play: used, wrap: 0, over: 0 };
  const ex = Math.max(0, used - base); const wrap = Math.min(GRACE_SEC, ex, wrapRec ?? ex);
  return { play: used - wrap, wrap, over: ex - wrap };
}
/** 收尾还能走多少毫秒：3 分钟，但已经计进去的超时部分要扣掉（用时每 5 秒结算一次，进入收尾时可能已多计了几秒） */
export function graceBudgetMs(used: number, base: number, G = GRACE_MS): number {
  if (!Number.isFinite(base)) return G;
  return Math.max(0, Math.min(G, (base + GRACE_SEC - used) * 1000));
}
export const fmtMS = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* r15.4 小萌新：收尾 / 时间用完的朗读与提示文字（小班不识字时朗读） */
export const GRACE_VOICE = '时间到啦，打完这关就休息哦';
/** r15.4.2 技术QA P1-1：手机竖屏时小班的提示录音 */
export const ROTATE_K_TEXT = '请把手机横过来，就能接着玩啦';
export const SLEEPY_TEXT = '今天玩够啦，明天再来';
export const SLEEPY_RESET = '明天 0:00 重新计时';
export const SLEEPY_VOICE = '今天玩够啦，明天再来哦。明天零点重新计时';
/* r15.4.1 较真家长：小班时间到的结算页（自动朗读；不显示星星比较） */
export const TIMEUP_K_TEXT = '今天玩够啦，明天见';
/** r15.4.3 小萌新：小班这次没加星时结算页唯一的一句（录音 p:res_k_done） */
export const K_NOSTAR_TEXT = '今天玩得真棒，明天再来吧';
/** r15.4.4：小班同一关今天第 2 次玩完（还能加星，可以接着玩）——不说「明天再来」（录音 p:res_k_again） */
export const K_AGAIN_TEXT = '真棒！再玩一关吧';
