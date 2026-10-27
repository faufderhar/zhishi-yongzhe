/* 家长密码（策划 D9 / X-13）：SHA-256 + 随机盐（无 crypto.subtle 时 FNV 兜底）；逐级锁定；提示问题找回 */
import { hashPin } from './playtime';
import { getKV, setKV } from '../db';
import { isRestoring } from '../runtimeFlags';
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const subtle = () => (typeof crypto !== 'undefined' && crypto.subtle) || null;
async function sha(pin: string, salt: string) { return hex(await subtle()!.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin))); }
export async function makePinHash(pin: string, salt = Math.random().toString(36).slice(2, 10)): Promise<string> {
  return subtle() ? `s2:${salt}:${await sha(pin, salt)}` : `f1:${salt}:${hashPin(pin, salt)}`;
}
export async function verifyPin(pin: string, stored?: string): Promise<boolean> {
  if (!stored) return false;
  const [k, salt, h] = stored.split(':');
  if (k === 's2' && h) return subtle() ? (await sha(pin, salt)) === h : false;
  if (k === 'f1' && h) return hashPin(pin, salt) === h;
  return hashPin(pin) === stored;   // 旧格式
}
// r13 策划：只给孩子不太可能知道答案的问题；不预选；另可「自己写问题」
export const HINT_QUESTIONS = ['你初中班主任姓什么？', '你第一台手机的牌子？', '你小学最好的朋友叫什么？', '你第一份工作的公司名？', '你小时候住的街道名？'];
/** r17.4 学霸 L3：找回问题统一用全角「？」（预设 5 个本来就是全角）。家长自己写的问题结尾的半角 ? / ？? 之类收成一个全角「？」；保存和显示都过一遍（旧档案里存的半角也显示成全角，不影响答案指纹） */
export const hintQText = (q: string) => q.trim().replace(/[?？]+$/, '？');
/** r13 策划：答案不分大小写、空格、全角半角（NFKC）；旧答案由 answerVariants 兼容 */
export const normAnswer = (s: string) => s.normalize('NFKC').replace(/\s+/g, '').toLowerCase();

/** 锁定：连续错 5 次 → 60 秒；再 5 次 → 5 分钟；之后每 5 次 → 15 分钟；对一次清零。localStorage + IndexedDB 双份。
    倒计时只按 performance.now()（单调时钟）的实际流逝扣减 remain，调系统时间无效（技术QA R4-4）；
    关掉 / 刷新期间不扣（无法可信地知道过了多久），重新打开后从剩余时间继续；seenAt 记录最后一次看到的墙钟，用于防回拨（D8）。 */
export interface LockState { gapUsed?: number; fails: number; level: number; until: number; remain?: number; seenAt?: number; long?: boolean }
const LK = 'zy.pinLock';
export const LK_PIN = LK;
/** r9：找回问题单独计错、单独锁定（以前和密码共用一个倒计时） */
export const LK_HINT = 'zy.hintLock';
export const LK_REC = 'zy.recLock';
export const LK_CANCEL = 'zy.cancelLock';   // r15.4.1 技术QA P3-1：「取消重设申请」框单独计错（以前和恢复码共用 LK_REC，孩子在提醒框乱输 5 次会把恢复码锁住）
export const LK_IMPORT = 'zy.importLock';   // r13：导入备份时「备份密码 / 恢复码」共用的锁
/** r15.4.3 技术QA P3-1：全部防误入锁的键；覆盖恢复后都写成「没锁、没错过」 */
export const LOCK_KEYS_ALL = [LK, LK_HINT, LK_REC, LK_CANCEL, LK_IMPORT];
export const freshLocks = (now = Date.now()): Record<string, LockState> => Object.fromEntries(LOCK_KEYS_ALL.map(k => [k, { fails: 0, level: 0, until: 0, remain: 0, seenAt: now }]));
/** r12（策划）：找回问题、恢复码各自连错 5 次 → 锁 24 小时。按单调时钟扣（关掉期间：墙钟往前走的部分才算，往回调不算），刷新不清零 */
export const LONG_LOCK_MS = 24 * 3600e3;
export function nextLock24(s: LockState, ok: boolean, now: number): LockState {
  if (ok) return { fails: 0, level: 0, until: 0, remain: 0, seenAt: now };
  const fails = s.fails + 1;
  if (fails < 5) return { ...s, fails };
  return { fails: 0, level: s.level + 1, until: now + LONG_LOCK_MS, remain: LONG_LOCK_MS, seenAt: now, long: true };
}
/** 重新打开时：长锁按「上次看到之后墙钟前进的时间」扣（回拨不扣，前跳最多扣到 until） */
export const LOCK_GAP_CAP_MS = 8 * 3600e3, LOCK_GAP_TOTAL_MS = 12 * 3600e3;
export function resumeLong(s: LockState, now: number): LockState {
  if (!s.long || !s.remain || !s.seenAt) return s;
  // r13 技术QA R12-2：关闭期间最多算 8 小时（和延时重设同一规则），关掉 → 调快 24 小时 → 再打开 不能直接解锁
  // r14 技术QA R13-1：每次长锁关闭期间累计最多算 LOCK_GAP_TOTAL_MS（反复「关掉 → 调快 → 打开」不能凑满）
  const used = s.gapUsed ?? 0;
  const gone = 0;   // r14 策划定稿：长锁也只按 App 开着时的单调时钟扣（tickLock），关闭期间不计
  return { ...s, remain: Math.max(0, s.remain - gone), gapUsed: used + gone, seenAt: Math.max(now, s.seenAt) };
}
export const LOCK_STEPS = [60e3, 5 * 60e3, 15 * 60e3];
export function nextLock(s: LockState, ok: boolean, now: number): LockState {
  if (ok) return { fails: 0, level: 0, until: 0, remain: 0, seenAt: now };
  const fails = s.fails + 1;
  if (fails < 5) return { ...s, fails };
  const step = LOCK_STEPS[Math.min(s.level, LOCK_STEPS.length - 1)];
  return { fails: 0, level: s.level + 1, until: now + step, remain: step, seenAt: now };
}
/** 剩余锁定毫秒：新格式只看 remain（与系统时间无关）；旧存档（只有 until）按 until - now 迁移 */
export const lockLeft = (s: LockState, now = Date.now()) => s.remain != null ? Math.max(0, s.remain) : Math.max(0, s.until - now);
/** 单调时钟流逝 dt 毫秒后的锁定状态（dt 只取 0–2000，防止休眠/卡顿时一次扣太多） */
export function tickLock(s: LockState, dt: number, now: number): LockState {
  const r = lockLeft(s, now); if (!r) return s.remain === 0 ? s : { ...s, remain: 0, seenAt: now };
  return { ...s, remain: Math.max(0, r - Math.min(2000, Math.max(0, dt))), seenAt: Math.max(s.seenAt ?? 0, now) };
}
/* r15.4.2 技术QA P2-1：锁定值一律夹到合法范围——备份恢复 / 手改存储带进来的 1e308 不再把键盘锁死、提示「2.77e+301 小时」，刷新也照样夹。
   remain ≤ 这种锁最长的时长（家长密码 15 分钟；找回问题 / 恢复码 / 取消框 / 导入 24 小时；长锁 24 小时）；until ∈ [now, now + 最长]（没锁时 0）；
   seenAt ≤ now；fails 0–4、level 0–99、gapUsed 0–LOCK_GAP_TOTAL_MS */
export const lockMaxMs = (key: string, long?: boolean) => key === LK && !long ? LOCK_STEPS[LOCK_STEPS.length - 1] : LONG_LOCK_MS;
const fin = (v: unknown, lo: number, hi: number, d: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
export function clampLock(x: unknown, key = LK, now = Date.now()): LockState | null {
  if (!x || typeof x !== 'object') return null; const s = x as Record<string, unknown>;
  if (typeof s.until !== 'number' && typeof s.remain !== 'number') return null;
  const long = s.long === true; const max = lockMaxMs(key, long);
  const remain = s.remain === undefined ? undefined : fin(s.remain, 0, max, 0);
  const until0 = fin(s.until, 0, now + max, 0); const until = until0 > 0 ? Math.max(now, until0) : 0;
  const left = remain ?? Math.max(0, until - now);
  return { fails: Math.round(fin(s.fails, 0, 4, 0)), level: Math.round(fin(s.level, 0, 99, 0)), until: left > 0 ? Math.min(until || now + left, now + max) : 0, remain: left, seenAt: fin(s.seenAt, 0, now, now), ...(long ? { long: true } : {}), ...(s.gapUsed !== undefined ? { gapUsed: fin(s.gapUsed, 0, LOCK_GAP_TOTAL_MS, 0) } : {}) };
}
const parse = (x: unknown, key = LK): LockState | null => clampLock(x, key);
export async function loadLock(key = LK): Promise<LockState> {
  let a: LockState | null = null; try { a = parse(JSON.parse(localStorage.getItem(key) ?? 'null'), key); } catch { /* */ }
  const b = parse(await getKV(key), key);
  const all = [a, b].filter((x): x is LockState => !!x);
  if (!all.length) return { fails: 0, level: 0, until: 0, remain: 0 };
  const now = Date.now();
  const m = all.reduce((m, x) => (lockLeft(x, now) > lockLeft(m, now) || (lockLeft(x, now) === lockLeft(m, now) && x.fails + x.level * 5 > m.fails + m.level * 5) ? x : m));
  // r15 技术QA R141-6：两份里缺了一份（或不一致）→ 用更严的那份补齐（localStorage 被清掉也锁得住）
  if (all.length < 2 || JSON.stringify(a) !== JSON.stringify(b)) { try { localStorage.setItem(key, JSON.stringify(m)); } catch { /* */ } void setKV(key, m); }
  return resumeLong({ ...m, remain: lockLeft(m, now) }, now);   // 统一迁移到 remain；长锁补上关闭期间的墙钟流逝
}
/* r15.4.4 技术QA P3：覆盖恢复把锁清零后、页面重载前，密码页 / 忘记密码页的 1 秒计时器还握着旧锁，会把 freshLocks 盖回去。
   恢复写库时设了 runtimeFlags.beginRestoring（约 15 秒；r16.2 前是 window.__zyRestoring）；这段时间 saveLock 不写。另外：存储里若已是「更新且更松」的锁（seenAt 更新、remain/fails/level 都更低），说明别处刚清过，丢掉手里的旧值。 */
export async function saveLock(s: LockState, key = LK) {
  if (isRestoring()) return;
  try { const raw = localStorage.getItem(key); if (raw) { const cur = parse(JSON.parse(raw), key); const now = Date.now();
    /* r16 技术QA P3：删掉「清零后 30 秒内一律丢掉更严的写入」——它把正确 PIN / 新设 PIN / 恢复之后正常的输错计数也丢了（输错 5 次刷新不锁）。
       现在只丢两种：恢复写库期间（上面的 isRestoring）；手里的状态是在清零之前看到的（seenAt 早于存储里那次清零 / 更新，下面这条）。
       输错由 nextLock({ ...s, fails }) 算出，seenAt 沿用清零那一刻，所以不会被当成旧值 */
    if (cur && (cur.seenAt ?? 0) > (s.seenAt ?? 0) && lockLeft(cur, now) <= lockLeft(s, now) && cur.fails <= s.fails && cur.level <= s.level) return; } } catch { /* */ }
  try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* */ } await setKV(key, s);
}
/** 曾经设置过密码的标记（密码数据丢失时不当成「首次使用」，技术QA P2-1） */
export const PIN_MARK = 'zy.pinEverSet';
export const markPinSet = () => { try { localStorage.setItem(PIN_MARK, '1'); } catch { /* */ } void setKV(PIN_MARK, 1); };
export async function pinWasSet() { try { if (localStorage.getItem(PIN_MARK)) return true; } catch { /* */ } return !!(await getKV(PIN_MARK)); }
/** r10：密码哈希在 localStorage 另存一份（IndexedDB 被清掉时能自动找回，不误报「丢失」） */
export const PIN_BACKUP = 'zy.pinBackup';
export const backupPin = (hash?: string, hint?: unknown) => { try { if (hash) localStorage.setItem(PIN_BACKUP, JSON.stringify({ hash, hint })); else localStorage.removeItem(PIN_BACKUP); } catch { /* */ } };
export const readPinBackup = (): { hash: string; hint?: { q: string; a: string } } | null => { try { const x = JSON.parse(localStorage.getItem(PIN_BACKUP) ?? 'null'); return x && typeof x.hash === 'string' ? x : null; } catch { return null; } };
