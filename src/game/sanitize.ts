/* r15.3 技术QA R152-4：覆盖恢复 / 撤销恢复写库前清洗数字——1e308、负数、"NaN"、null 等不再原样存进去。
   读的时候各处也会夹，但库里不该留脏值（导出再导入、旧版本读取都会出问题） */
import { XP_MAX, MASTERED_MAX } from './limits';
import { clampLock, LK_PIN, LK_HINT, LK_REC, LK_CANCEL, LK_IMPORT } from './pin';
import { RESET_DELAY_MS } from './pinVault';
import { cleanElectives } from './electives';
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
  if (!isObj(x)) return undefined; const out: Record<string, { used: number; bonus: number; wrap?: number; wrapTail?: number; spent?: number; capAt?: number }> = {};
  for (const [d, v] of Object.entries(x)) { if (!isObj(v)) continue; const used = num(v.used, 0, DAY_SEC, true); if (used === undefined) continue; const wrap = num(v.wrap, 0, DAY_SEC, true); const wrapTail = num(v.wrapTail, 0, 180, true); const spent = num(v.spent, 0, DAY_SEC, true); const capAt = num(v.capAt, 0, DAY_SEC, true); out[d] = { used, bonus: num(v.bonus, 0, DAY_SEC, true) ?? 0, ...(wrap !== undefined ? { wrap } : {}), ...(wrapTail ? { wrapTail } : {}), ...(spent ? { spent } : {}), ...(capAt !== undefined && spent ? { capAt } : {}) }; }   /* r16：capAt（取消加时时的今天上限）也保留 */
  return out;
}
export function cleanSkills(x: unknown) {
  if (!isObj(x)) return undefined; const out: R = {};
  for (const [s, v] of Object.entries(x)) { if (!isObj(v)) continue; const level = num(v.level, 1, 5, true); if (level === undefined) continue; out[s] = { level, right: num(v.right, 0, 1000, true) ?? 0, wrong: num(v.wrong, 0, 1000, true) ?? 0, ...(v.locked === true ? { locked: true } : {}) }; }
  return out;
}
/* r15.4.1 技术QA P4：时间戳最多到「现在」（以前夹到 2100-01-01，1e308 → 仍是未来时间） */
const tsMax = () => Date.now();
export function cleanFlags(x: unknown) { if (!isObj(x)) return undefined; const out: Record<string, number> = {}; for (const [k, v] of Object.entries(x)) { const n = num(v, 0, tsMax()); if (n !== undefined) out[k] = n; } return out; }
/** kv 一行：按键名清洗；返回 undefined 表示这一行丢掉 */
export function cleanKv(k: string, v: unknown): unknown {
  if (k.startsWith('progress:')) return cleanProgress(v);
  if (k.startsWith('usage:')) return cleanUsage(v);
  if (k.startsWith('skills:')) return cleanSkills(v);
  if (k === 'flags') return cleanFlags(v);
  if (k === 'profiles') return cleanProfiles(v);
  /* r15.4.2 技术QA P2-1 / P3-3：备份里其余带数字 / 时间的键也全部清洗（清单见 BACKUP_NUMERIC_FIELDS） */
  if (LOCK_KEYS.includes(k)) return clampLock(v, k) ?? undefined;
  if (k === 'backupSnoozeUntil') return num(v, 0, Date.now() + SNOOZE_MAX_MS, true);
  if (k === 'lastBackupAt') return num(v, 0, tsMax(), true);
  if (k === 'settings') return cleanSettings(v);
  if (k === 'clock') return cleanClock(v);
  if (k.startsWith('rollup:')) return cleanRollup(v);
  if (k === PIN_MARK_K) return v === 1 || v === true || v === '1' ? 1 : undefined;
  if (k === 'snapshot:last' || k.startsWith('corrupt:')) return undefined;   // 设备本地的撤销快照 / 损坏备份：不从备份带进来（恢复完会重写快照）
  return v;
}
const LOCK_KEYS = [LK_PIN, LK_HINT, LK_REC, LK_CANCEL, LK_IMPORT]; const PIN_MARK_K = 'zy.pinEverSet';
export const SNOOZE_MAX_MS = 30 * 864e5;   // 「该备份啦」稍后提醒：最多推迟 30 天（家长页点「稍后」是 7 天）
const NET_SKEW_MS = 864e5;
export function cleanSettings(x: unknown) {
  if (!isObj(x)) return x; const o: R = { ...x }; const now = Date.now();
  if ('volume' in o) { const v = num(o.volume, 0, 1); if (v === undefined) delete o.volume; else o.volume = v; }
  if ('pinResetDoneAt' in o) { const v = num(o.pinResetDoneAt, 0, now, true); if (v === undefined) delete o.pinResetDoneAt; else o.pinResetDoneAt = v; }
  if ('pinReset' in o) { const r = cleanPendingReset(o.pinReset); if (r === undefined) delete o.pinReset; else o.pinReset = r; }
  return o;
}
/** 等待中的密码重设：requestedAt ≤ now；effectiveAt ∈ [requestedAt, now + 72 小时]（显示用；真正到期按 openTotal 等计时）；其余计时字段夹到合理范围 */
export function cleanPendingReset(x: unknown) {
  if (!isObj(x)) return undefined; const now = Date.now();
  const requestedAt = num(x.requestedAt, 0, now, true); if (requestedAt === undefined) return undefined;
  const o: R = { ...x, requestedAt, effectiveAt: num(x.effectiveAt, requestedAt, now + RESET_DELAY_MS, true) ?? requestedAt + RESET_DELAY_MS };
  for (const [k, hi] of [['netReq', now + NET_SKEW_MS], ['netLast', now + NET_SKEW_MS], ['lastWall', now], ['observed', RESET_DELAY_MS * 10], ['openTotal', RESET_DELAY_MS * 10], ['sessionOpen', RESET_DELAY_MS * 10], ['gapUsed', RESET_DELAY_MS * 10]] as [string, number][])
    if (k in o) { const v = num(o[k], 0, hi, true); if (v === undefined) delete o[k]; else o[k] = v; }
  if ('days' in o && !(Array.isArray(o.days) && o.days.every(d => typeof d === 'string'))) delete o.days;
  return o;
}
/** 时钟守卫：maxSeen / lockedAt / staleReset ≤ now（覆盖恢复保留本机 clock；合并也保留本机，这里兜底） */
export function cleanClock(x: unknown) {
  if (!isObj(x)) return undefined; const now = Date.now(); const maxSeen = num(x.maxSeen, 0, now, true); if (maxSeen === undefined) return undefined;
  const o: R = { maxSeen, locked: x.locked === true };
  for (const k of ['lockedAt', 'staleReset']) { const v = num(x[k], 0, now, true); if (v !== undefined) o[k] = v; }
  return o;
}
/** 答题月汇总：每格 n / ok 是 0–1e6 的整数，ok ≤ n */
export function cleanRollup(x: unknown) {
  if (!isObj(x)) return undefined; const out: Record<string, Record<string, { n: number; ok: number }>> = {};
  for (const [m, subs] of Object.entries(x)) { if (!/^\d{4}-\d{2}$/.test(m) || !isObj(subs)) continue; const o: Record<string, { n: number; ok: number }> = {};
    for (const [sub, c] of Object.entries(subs)) { if (!isObj(c)) continue; const n = num(c.n, 0, 1e6, true); if (n === undefined) continue; o[sub] = { n, ok: Math.min(n, num(c.ok, 0, 1e6, true) ?? 0) }; }
    out[m] = o; }
  return out;
}
/** r15.4.2：备份里所有数字 / 时间字段和清洗规则（报告与测试用这张表） */
export const BACKUP_NUMERIC_FIELDS: [string, string][] = [
  ['progress:<档案>.stars.*', '0–3 整数'], ['progress:<档案>.plays.*.count', '0–999 整数'], ['progress:<档案>.xp', `0–${XP_MAX}`], ['progress:<档案>.masteredStars', `0–${MASTERED_MAX}`],
  ['usage:<档案>.<日期>.used / bonus / wrap', '0–86400 秒整数'], ['usage:<档案>.<日期>.wrapTail', '0–180 秒'], ['usage:<档案>.<日期>.spent', '0–86400 秒整数'], ['skills:<档案>.*.level', '1–5'], ['skills:<档案>.*.right / wrong', '0–1000'],
  ['flags.*（时间戳）', '0–现在'], ['profiles[].limit.weekday / weekend', '5–240 分钟（0 = 旧版不限）'],
  ['zy.pinLock', 'remain 0–15 分钟（长锁 24 小时）；until 现在–现在+最长；seenAt ≤ 现在；fails 0–4；level 0–99'],
  ['zy.hintLock / zy.recLock / zy.cancelLock / zy.importLock', 'remain 0–24 小时；until 现在–现在+24 小时；其余同上'],
  ['backupSnoozeUntil', '0–现在+30 天'], ['lastBackupAt', '0–现在'],
  ['settings.volume', '0–1'], ['settings.pinResetDoneAt', '0–现在'],
  ['settings.pinReset.requestedAt', '0–现在'], ['settings.pinReset.effectiveAt', 'requestedAt–现在+72 小时'], ['settings.pinReset.netReq / netLast', '0–现在+1 天'], ['settings.pinReset.lastWall', '0–现在'], ['settings.pinReset.observed / openTotal / sessionOpen / gapUsed', '0–720 小时'],
  ['clock.maxSeen / lockedAt / staleReset', '0–现在'], ['rollup:<档案>.<月>.<科目>.n / ok', '0–1e6 整数，ok ≤ n'],
  ['answers[].at', '0–现在'], ['wrong[].box', '1–3'], ['wrong[].wrongCount', '0–1e4'], ['wrong[].addedAt / updatedAt', '0–现在'],
  ['snapshot:last / corrupt:*', '不从备份带入'], ['zy.pinEverSet', '只能是 1'],
];
/* r15.4 技术QA P2-2：档案每日时长 limit 按家长页能设的范围夹（5–240 分钟；0 是旧版「不限」写法，留给 repairProfile 迁移）；
   不是有限数的删掉，读的时候 repairProfile 补年级默认值 */
export const LIMIT_MIN = 5, LIMIT_MAX = 240;
export function cleanLimitMin(v: unknown): number | undefined { if (typeof v !== 'number' || !Number.isFinite(v)) return undefined; if (v === 0) return 0; return Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, Math.round(v))); }
export function cleanProfiles(x: unknown) {
  if (!Array.isArray(x)) return x;
  return x.map(p => { if (!isObj(p) || !isObj(p.limit)) return p; const lim: R = {};
    for (const k of ['weekday', 'weekend']) { const n = cleanLimitMin(p.limit[k]); if (n !== undefined) lim[k] = n; }
    const { electives: el, ...rest } = p; const e = cleanElectives(el);   // r16.1：选科
    return { ...rest, limit: lim, ...(e ? { electives: e } : {}) }; });
}
export function cleanAnswer(v: unknown) { if (!isObj(v)) return undefined; const at = num(v.at, 0, tsMax(), true); return at === undefined ? undefined : { ...v, at, correct: v.correct === true }; }
export function cleanWrong(v: unknown) {
  if (!isObj(v)) return undefined; const box = num(v.box, 1, 3, true) ?? 1;
  return { ...v, box, wrongCount: num(v.wrongCount, 0, 1e4, true) ?? 1, addedAt: num(v.addedAt, 0, tsMax(), true) ?? 0, updatedAt: num(v.updatedAt, 0, tsMax(), true) ?? 0, due: typeof v.due === 'string' ? v.due : '' };
}
/** r15.4 技术QA P2-1：覆盖恢复、撤销恢复、合并共用这一个清洗（以前合并没走，错题本出现「第 NaN 盒」） */
export function sanitizeData<T extends { kv?: unknown; answers?: unknown; wrong?: unknown }>(c: T): T {
  const kv = Array.isArray(c.kv) ? (c.kv as [string, unknown][]).map(([k, v]): [string, unknown] => [k, cleanKv(k, v)]).filter(([, v]) => v !== undefined) : [];
  const answers = Array.isArray(c.answers) ? (c.answers as [unknown, unknown][]).map(([k, v]): [unknown, unknown] => [k, cleanAnswer(v)]).filter(([, v]) => v !== undefined) : [];
  const wrong = Array.isArray(c.wrong) ? (c.wrong as unknown[]).map(cleanWrong).filter(v => v !== undefined) : [];
  return { ...c, kv, answers, wrong };
}
