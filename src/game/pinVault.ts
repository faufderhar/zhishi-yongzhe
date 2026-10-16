/* r11 技术QA R10-2（策划确认）：家长密码的多份副本 + 恢复码 + 延时重设
   ① 密码哈希、找回问题、恢复码哈希一起存 4 处：设置（IndexedDB）、localStorage、每个孩子档案、Cache Storage；任何一份还在就自动恢复。
      只有一份都没有、而且也没有任何孩子档案（真正的新装）时，才允许不验证直接设置新密码。
   ② 设置密码时生成 8 位恢复码（只显示一次）。有恢复码 → 立即重设。没有 → 提交重设，24 小时后生效；
      生效时间按墙钟，但时钟被调过（时钟锁定）时不生效；等待期间每个页面顶部都提示，任何人都能〔取消〕（不要密码）。
      重设后家长页一直提示「密码于 X 月 X 日被重设」，点〔知道了〕才消失。 */
export interface PinVault { pinHash: string; pinHint?: { q: string; a: string }; recHash?: string; at?: number }
export const RESET_DELAY_MS = 24 * 3600e3;
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
export interface PendingReset { requestedAt: number; effectiveAt: number }
export const newPending = (now: number): PendingReset => ({ requestedAt: now, effectiveAt: now + RESET_DELAY_MS });
export const resetDue = (p: PendingReset | undefined, now: number, clockLocked: boolean) => !!p && !clockLocked && now >= p.effectiveAt && now >= p.requestedAt;
export const fmtWhen = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日${d.getHours()}点`; };
export const fmtDay = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日`; };
