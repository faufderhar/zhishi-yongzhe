/* 家长密码（策划 D9 / X-13）：SHA-256 + 随机盐（无 crypto.subtle 时 FNV 兜底）；逐级锁定；提示问题找回 */
import { hashPin } from './playtime';
import { getKV, setKV } from '../db';
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
export const HINT_QUESTIONS = ['孩子的小名是？', '家里宠物/玩偶的名字是？', '孩子的生日（如 0612）是？'];
export const normAnswer = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** 锁定：连续错 5 次 → 60 秒；再 5 次 → 5 分钟；之后每 5 次 → 15 分钟；对一次清零。localStorage + IndexedDB 双份 */
export interface LockState { fails: number; level: number; until: number }
const LK = 'zy.pinLock';
export const LOCK_STEPS = [60e3, 5 * 60e3, 15 * 60e3];
export function nextLock(s: LockState, ok: boolean, now: number): LockState {
  if (ok) return { fails: 0, level: 0, until: 0 };
  const fails = s.fails + 1;
  if (fails < 5) return { ...s, fails };
  return { fails: 0, level: s.level + 1, until: now + LOCK_STEPS[Math.min(s.level, LOCK_STEPS.length - 1)] };
}
const parse = (x: unknown): LockState | null => x && typeof x === 'object' && Number.isFinite((x as LockState).until) ? x as LockState : null;
export async function loadLock(): Promise<LockState> {
  let a: LockState | null = null; try { a = parse(JSON.parse(localStorage.getItem(LK) ?? 'null')); } catch { /* */ }
  const b = parse(await getKV(LK));
  const all = [a, b].filter((x): x is LockState => !!x);
  if (!all.length) return { fails: 0, level: 0, until: 0 };
  return all.reduce((m, x) => (x.until > m.until || (x.until === m.until && x.fails + x.level * 5 > m.fails + m.level * 5) ? x : m));
}
export async function saveLock(s: LockState) { try { localStorage.setItem(LK, JSON.stringify(s)); } catch { /* */ } await setKV(LK, s); }
/** 曾经设置过密码的标记（密码数据丢失时不当成「首次使用」，技术QA P2-1） */
export const PIN_MARK = 'zy.pinEverSet';
export const markPinSet = () => { try { localStorage.setItem(PIN_MARK, '1'); } catch { /* */ } void setKV(PIN_MARK, 1); };
export async function pinWasSet() { try { if (localStorage.getItem(PIN_MARK)) return true; } catch { /* */ } return !!(await getKV(PIN_MARK)); }
