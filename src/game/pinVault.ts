/* r11 技术QA R10-2（策划确认）：家长密码的多份副本 + 恢复码 + 延时重设
   ① 密码哈希、找回问题、恢复码哈希一起存 4 处：设置（IndexedDB）、localStorage、每个孩子档案、Cache Storage；任何一份还在就自动恢复。
      只有一份都没有、而且也没有任何孩子档案（真正的新装）时，才允许不验证直接设置新密码。
   ② 设置密码时生成 8 位恢复码（只显示一次）。有恢复码 → 立即重设。没有 → 提交重设，24 小时后生效；
      生效时间按墙钟，但时钟被调过（时钟锁定）时不生效；等待期间每个页面顶部都提示，任何人都能〔取消〕（不要密码）。
      重设后家长页一直提示「密码于 X 月 X 日被重设」，点〔知道了〕才消失。 */
export interface PinVault { pinHash: string; pinHint?: { q: string; a: string }; recHash?: string; at?: number }
export const RESET_DELAY_MS = 72 * 3600e3;   // r12（策划）：24 → 72 小时
const LS = 'zy.pinBackup', CACHE = 'zy-pin', CKEY = './__zy_pin__';
const ok = (x: unknown): x is PinVault => !!x && typeof (x as PinVault).pinHash === 'string' && (x as PinVault).pinHash.length > 0;
export const vaultOf = (s: { pinHash?: string; pinHint?: { q: string; a: string }; pinRec?: string }): PinVault | null => s.pinHash ? { pinHash: s.pinHash, pinHint: s.pinHint, recHash: s.pinRec } : null;
export function writeLocal(v: PinVault | null) { try { if (v) localStorage.setItem(LS, JSON.stringify({ hash: v.pinHash, hint: v.pinHint, rec: v.recHash })); else localStorage.removeItem(LS); } catch { /* */ } }
export function readLocal(): PinVault | null { try { const x = JSON.parse(localStorage.getItem(LS) ?? 'null'); return x && typeof x.hash === 'string' ? { pinHash: x.hash, pinHint: x.hint, recHash: x.rec } : null; } catch { return null; } }
export async function writeCache(v: PinVault | null) {
  try { if (typeof caches === 'undefined') return; const c = await caches.open(CACHE);
    if (v) await c.put(CKEY, new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json' } })); else await c.delete(CKEY); } catch { /* */ }
}
export async function readCache(): Promise<PinVault | null> {
  try { if (typeof caches === 'undefined') return null; const r = await (await caches.open(CACHE)).match(CKEY); if (!r) return null; const v = await r.json(); return ok(v) ? v : null; } catch { return null; }
}
/** 从所有副本里找一份（设置 → localStorage → 孩子档案 → Cache Storage） */
export async function findVault(settings: { pinHash?: string; pinHint?: { q: string; a: string }; pinRec?: string } | undefined, profiles: { pinVault?: PinVault }[]): Promise<PinVault | null> {
  const a = settings ? vaultOf(settings) : null; if (a) return a;
  const b = readLocal(); if (b) return b;
  const c = profiles.map(p => p.pinVault).find(ok); if (c) return c;
  return readCache();
}
/** 一份都没有时怎么办 */
export const lostMode = (hasProfiles: boolean): 'fresh' | 'lost' => (hasProfiles ? 'lost' : 'fresh');
/** 8 位恢复码：去掉易混的 0/O/1/I/L */
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeRecoveryCode(rnd: () => number = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 2 ** 32; }) {
  let s = ''; for (let i = 0; i < 8; i++) s += ALPHA[Math.floor(rnd() * ALPHA.length)]; return s;
}
export const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
/** 延时重设 */
export interface PendingReset { netOffline?: boolean /* r15.1：离线提交，起点是本机时间 */; netReq?: number /* r15 R141-2：申请时的网络时间 */; netLast?: number /* 最近一次的网络时间 */; openTotal?: number /* 等待期间游戏开着的总时长 */; sessionOpen?: number /* 本次打开已开着多久 */; days?: string[]; gapUsed?: number; observed?: number; lastWall?: number; requestedAt: number; effectiveAt: number; ready?: boolean /* r12：到期——仍要找回问题答案或恢复码才能设新密码 */ }
export const newPending = (now: number): PendingReset => ({ requestedAt: now, effectiveAt: now + RESET_DELAY_MS });
export const resetDue = (p: PendingReset | undefined, now: number, clockLocked: boolean) => !!p && !clockLocked && now >= p.effectiveAt && now >= p.requestedAt;
export const fmtWhen = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日${d.getHours()}点`; };
export const fmtDay = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日`; };
/** r12：找回问题答案可能存在多份副本里（升级前后设置过、副本不一致）：任何一份对得上都算对 */
export function hintCandidates(...vs: ({ pinHint?: { q: string; a: string } } | { a?: string } | null | undefined)[]): string[] {
  const out: string[] = []; for (const v of vs) { const a = (v as any)?.pinHint?.a ?? (v as any)?.a; if (typeof a === 'string' && a && !out.includes(a)) out.push(a); } return out;
}
/** 答案的几种规范化（旧版只去空格转小写；再兼容全角 / 首尾标点 / 不转小写） */
export const answerVariants = (s: string) => { const a = s.replace(/\s+/g, ''); const b = a.normalize('NFKC'); return [...new Set([a.toLowerCase(), b.toLowerCase(), a, b, b.replace(/[。.，,！!？?]+$/u, '').toLowerCase()])]; };
/* r12 技术QA R11-3：恢复码哈希另存独立的 4 份（IndexedDB 单独 key、单独 localStorage key、每个孩子档案、Cache Storage），
   和密码副本分开：密码副本全丢了，恢复码还在 → 「家长密码数据不见了」页也能用恢复码重设 */
const RLS = 'zy.recBackup', RCKEY = './__zy_rec__';
export const REC_KV = 'zy.recHash';
export async function writeRec(h: string | null | undefined, setKV?: (k: string, v: unknown) => unknown) {
  try { if (h) localStorage.setItem(RLS, h); else localStorage.removeItem(RLS); } catch { /* */ }
  try { await setKV?.(REC_KV, h || undefined); } catch { /* */ }
  try { if (typeof caches === 'undefined') return; const c = await caches.open(CACHE); if (h) await c.put(RCKEY, new Response(h)); else await c.delete(RCKEY); } catch { /* */ }
}
export async function findRec(settings: { pinRec?: string } | undefined, profiles: { recHash?: string; pinVault?: PinVault }[], getKV?: (k: string) => Promise<unknown>): Promise<string | null> {
  if (settings?.pinRec) return settings.pinRec;
  try { const a = localStorage.getItem(RLS); if (a) return a; } catch { /* */ }
  try { const b = await getKV?.(REC_KV); if (typeof b === 'string' && b) return b; } catch { /* */ }
  const c = profiles.map(p => p.recHash ?? p.pinVault?.recHash).find(x => typeof x === 'string' && x); if (c) return c;
  try { if (typeof caches !== 'undefined') { const r = await (await caches.open(CACHE)).match(RCKEY); if (r) { const t = await r.text(); if (t) return t; } } } catch { /* */ }
  return null;
}
/* r12 技术QA R11-1：延时重设只按「App 运行时实际观察到的单调时间」+「两次运行之间有上限的间隔」累计，
   不相信墙钟前跳；等待期间检测到大的时钟跳变 → 直接取消申请并提示 */
export const GAP_CAP_MS = 8 * 3600e3;          // 两次打开之间最多认 8 小时
export const JUMP_MS = 10 * 60e3;              // 运行中墙钟与单调时钟相差 > 10 分钟 = 时钟跳变
/** 每个延时重设申请，关闭期间累计最多计入的时间 */
export const GAP_TOTAL_MS = 24 * 3600e3;
/* r14.1 策划定稿（找回问题 72 小时延时重设）：
   - 关闭期间按真实时间计，但每段关闭最多 12 小时（调快时钟最多多算 12 小时）
   - 生效要同时满足：累计 ≥ 72 小时，且至少在 3 个不同的日子打开过游戏
   - 时钟往回调（比上次看到的早 5 分钟以上）→ 取消申请；运行中墙钟与单调时钟相差 > 10 分钟也取消
   24 小时锁定（pin.ts 的 resumeLong）不共用这段代码，仍然只算游戏开着的时间。 */
export const PEND_GAP_CAP_MS = 12 * 3600e3, PEND_DAYS = 3;
const dayOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const withDay = (p: PendingReset, t: number): PendingReset => { const ds = new Set(p.days ?? [dayOf(p.requestedAt)]); ds.add(dayOf(t)); return { ...p, days: [...ds].sort().slice(-10) }; };
export const NET_SKEW_MS = 10 * 60e3, MIN_SESSION_MS = 5 * 60e3, MIN_OPEN_MS = 30 * 60e3;
export function tickPending(p: PendingReset, dtPerf: number, dtWall: number, wallNow: number): PendingReset | 'cancel' {
  if (dtWall < dtPerf - JUMP_MS) return 'cancel';   // r14.1：只有墙钟往回走才取消（休眠时单调时钟停住、墙钟前进不是调钟）
  // 墙钟比单调时钟多走很多（休眠 / 调快）：和「关闭期间」同一规则，这一段最多算 12 小时
  const open = Math.max(0, Math.min(dtPerf, 60e3));
  const add = dtWall > dtPerf + JUMP_MS ? Math.min(dtWall, PEND_GAP_CAP_MS) : open;
  return withDay({ ...p, observed: (p.observed ?? 0) + add, openTotal: (p.openTotal ?? 0) + open, sessionOpen: (p.sessionOpen ?? 0) + open, lastWall: wallNow }, wallNow);
}
/* r15 策划 R141-2（离线规则）：关闭的这段只有在「关之前那次打开累计 ≥ 5 分钟」时才算（每段最多 12 小时）；往回调取消 */
export function resumePending(p: PendingReset, wallNow: number): PendingReset | 'cancel' {
  const last = p.lastWall ?? p.requestedAt;
  if (wallNow < last - 5 * 60e3) return 'cancel';   // 时钟往回调
  const gap = (p.sessionOpen ?? 0) >= MIN_SESSION_MS ? Math.min(Math.max(0, wallNow - last), PEND_GAP_CAP_MS) : 0; void GAP_CAP_MS; void GAP_TOTAL_MS;
  return withDay({ ...p, observed: (p.observed ?? 0) + gap, gapUsed: (p.gapUsed ?? 0) + gap, sessionOpen: 0, lastWall: Math.max(wallNow, last) }, wallNow);
}
/* r15 策划 R141-2（联网规则）：网络时间说了算。网络时间和本机时钟差 > 10 分钟 → 取消；申请时和现在都有网络时间 → 用两者之差算 72 小时 */
export function netCheck(p: PendingReset, net: number, wallNow: number): PendingReset | 'cancel' {
  if (Math.abs(net - wallNow) > NET_SKEW_MS) return 'cancel';
  const atReq = Math.abs(net - p.requestedAt) < NET_SKEW_MS + 60e3;
  if (p.netReq === undefined && !atReq) {
    /* r15.1 技术QA R15-1：离线提交的申请——第一次联网校验：以申请时的本机时间为起点，
       本机记录的已等时长不能比网络时间算出的还长（关着时把时钟调快），申请时间也不能在网络时间之后 */
    if (net < p.requestedAt - NET_SKEW_MS) return 'cancel';
    if ((p.observed ?? 0) > net - p.requestedAt + NET_SKEW_MS) return 'cancel';
    return { ...p, netReq: p.requestedAt, netOffline: true, netLast: Math.max(p.netLast ?? 0, net) };
  }
  if (p.netOffline && (p.observed ?? 0) > net - (p.netReq ?? p.requestedAt) + NET_SKEW_MS) return 'cancel';
  return { ...p, netReq: p.netReq ?? (atReq ? net - (wallNow - p.requestedAt) : undefined), netLast: Math.max(p.netLast ?? 0, net) };
}
/* 离线申请：已等 = min(本机记录, 网络时间差)；联网申请：网络时间差；还没联网校验过：本机记录（但不能到期） */
export const pendingWaitedMs = (p: PendingReset) => p.netReq && p.netLast ? (p.netOffline ? Math.min(p.observed ?? 0, Math.max(0, p.netLast - p.netReq)) : Math.max(0, p.netLast - p.netReq)) : (p.observed ?? 0);
export const pendingDays = (p: PendingReset) => new Set(p.days ?? [dayOf(p.requestedAt)]).size;
export const pendingDue = (p: PendingReset | undefined) => !!p && !!p.netLast /* r15.1：至少一次联网校验 */ && pendingWaitedMs(p) >= RESET_DELAY_MS && pendingDays(p) >= PEND_DAYS && (p.openTotal ?? 0) >= MIN_OPEN_MS;
export const pendingLeftMs = (p: PendingReset) => Math.max(0, RESET_DELAY_MS - pendingWaitedMs(p));
