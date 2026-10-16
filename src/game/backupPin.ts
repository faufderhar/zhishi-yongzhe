/* r12（策划）：备份里带家长密码哈希 + 恢复码哈希。
   导入：当前没有密码 → 一起恢复备份里的两份；当前有密码 → 先验证当前密码，导入后保留当前密码（不被备份覆盖）。
   导入不会取消正在进行的 24 小时重设：pinReset 一律沿用导入前的状态（只有输入恢复码或点〔取消〕才结束）。 */
import type { PinVault, PendingReset } from './pinVault';
type S = { pinHash?: string; pinHint?: { q: string; a: string }; pinRec?: string; pinReset?: PendingReset; pinResetDoneAt?: number; [k: string]: unknown };
const okV = (x: any): x is PinVault => !!x && typeof x.pinHash === 'string' && x.pinHash.length > 0;
/** 备份文件里的密码：优先顶层 pin，其次备份设置里的 pinHash，再次档案副本 */
export function backupVault(data: any, kv: [string, unknown][]): PinVault | null {
  if (okV(data?.pin)) return { pinHash: data.pin.pinHash, pinHint: data.pin.pinHint, recHash: typeof data.pin.recHash === 'string' ? data.pin.recHash : undefined };
  const s = kv.find(r => r[0] === 'settings')?.[1] as S | undefined;
  if (s && typeof s.pinHash === 'string' && s.pinHash) return { pinHash: s.pinHash, pinHint: s.pinHint, recHash: s.pinRec };
  const ps = kv.find(r => r[0] === 'profiles')?.[1]; const pv = Array.isArray(ps) ? ps.map((p: any) => p?.pinVault).find(okV) : undefined;
  return pv ?? null;
}
export interface CurrentPin { vault: PinVault | null; pinReset?: PendingReset; pinResetDoneAt?: number }
/** 改写待导入的 kv：settings 的密码字段 + 每个档案的副本；返回最终生效的密码（写回 localStorage / Cache 用） */
export function mergePin(kv: [string, unknown][], cur: CurrentPin, fromBackup: PinVault | null): { kv: [string, unknown][]; vault: PinVault | null } {
  const vault = cur.vault ?? fromBackup;
  const out = kv.map(([k, v]): [string, unknown] => {
    if (k === 'settings' && v && typeof v === 'object') {
      const { pinHash: _a, pinHint: _b, pinRec: _c, pinReset: _d, ...rest } = v as S;
      const s: S = { ...rest };
      if (vault) { s.pinHash = vault.pinHash; if (vault.pinHint) s.pinHint = vault.pinHint; if (vault.recHash) s.pinRec = vault.recHash; }
      if (cur.pinReset) s.pinReset = cur.pinReset;
      if (cur.vault) { if (cur.pinResetDoneAt) s.pinResetDoneAt = cur.pinResetDoneAt; else delete s.pinResetDoneAt; }
      return [k, s];
    }
    if (k === 'profiles' && Array.isArray(v)) return [k, v.map((p: any) => { if (!p || typeof p !== 'object') return p; const { pinVault: _o, ...r } = p; return vault ? { ...r, pinVault: vault } : r; })];
    return [k, v];
  });
  if (!out.some(r => r[0] === 'settings') && (vault || cur.pinReset)) out.push(['settings', { ...(vault ? { pinHash: vault.pinHash, pinHint: vault.pinHint, pinRec: vault.recHash } : {}), ...(cur.pinReset ? { pinReset: cur.pinReset } : {}) }]);
  return { kv: out, vault };
}
