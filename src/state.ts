/* 应用级数据：设置、档案、进度（KV 存 IndexedDB） */
import { getKV, setKV } from './db';
import type { GradeKey } from './game/questions';
import { bandConfig } from './game/grades';
import type { TimeLimit, Usage } from './game/playtime';
import type { Skills } from './game/adaptive';
export interface Settings { pinHash?: string; includePending: boolean; g1NoLimit: boolean; hsWager?: boolean;
  pinHint?: { q: string; a: string };            // 找回问题（答案存哈希）
  sfx?: boolean; tts?: boolean; volume?: number;  // 技术QA P3-4
  kinderDemoReward?: boolean;                     // D1：演示后仍给⭐（默认是）
  tutorialReplay?: Record<string, boolean> }
export interface Profile { id: string; name: string; avatar: string; grade: GradeKey; volumes: string[] | null; limit: TimeLimit; charId?: string; tutorialDone?: boolean; tutorialV036?: boolean }
export interface Progress { stars: Record<string, number>; plays: Record<string, { day: string; count: number }>; masteredStars: number; xp: number }
export const DEFAULT_SETTINGS: Settings = { includePending: false, g1NoLimit: false };
export const AVATARS = ['🧒', '👧', '👦', '🧑‍🎓', '🧑‍🔬', '🐱', '🐶', '🐰', '🦊', '🐼', '🦁', '🐯'];
export const newProfile = (name: string, grade: GradeKey, avatar = '🧒'): Profile =>
  ({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, avatar, grade, volumes: null, limit: { ...bandConfig(grade).dailyMinutes } });
export const DEFAULT_PROFILES = (): Profile[] => [
  { ...newProfile('小班宝贝', 'K1', '🐰'), id: 'kid-k' },
  { ...newProfile('初一同学', '7', '🧑‍🎓'), id: 'kid-7' },
  { ...newProfile('高一同学', '10', '🧑‍🔬'), id: 'kid-10' },
];
export const emptyProgress = (): Progress => ({ stars: {}, plays: {}, masteredStars: 0, xp: 0 });

/* ---- 读取时逐项校验：任何一项损坏都不会白屏（技术QA P0-1）。坏值备份到 kv/corrupt:<key>:<时间> 后回落默认 ---- */
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export const corruptLog: string[] = [];
async function quarantine(key: string, raw: unknown) {
  corruptLog.push(key);
  try { await setKV(`corrupt:${key}:${Date.now()}`, raw); } catch { /* */ }
}
async function guarded<T>(key: string, check: (x: unknown) => T | null, fallback: () => T, writeBack = false): Promise<T> {
  const raw = await getKV<unknown>(key);
  if (raw === undefined) return fallback();
  let v: T | null = null; try { v = check(raw); } catch { v = null; }
  if (v === null) { await quarantine(key, raw); const f = fallback(); if (writeBack) await setKV(key, f); return f; }
  return v;
}
const GRADES = new Set(['K1', 'K2', 'K3', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
/** 单个档案修复：缺字段补默认，年级非法则丢弃 */
export function repairProfile(x: unknown): Profile | null {
  if (!isObj(x) || typeof x.id !== 'string' || !x.id) return null;
  const grade = String(x.grade ?? ''); if (!GRADES.has(grade)) return null;
  const def = bandConfig(grade as GradeKey).dailyMinutes;
  const lim = isObj(x.limit) ? x.limit : {};
  return { id: x.id, name: typeof x.name === 'string' && x.name ? x.name.slice(0, 16) : '小勇者', avatar: typeof x.avatar === 'string' && x.avatar ? x.avatar : '🧒', grade: grade as GradeKey,
    volumes: Array.isArray(x.volumes) ? x.volumes.filter(v => typeof v === 'string') : null,
    limit: { weekday: Number.isFinite(lim.weekday) ? Number(lim.weekday) : def.weekday, weekend: Number.isFinite(lim.weekend) ? Number(lim.weekend) : def.weekend },
    charId: typeof x.charId === 'string' ? x.charId : undefined, ...(x.tutorialDone === true ? { tutorialDone: true } : {}), ...(x.tutorialV036 === true ? { tutorialV036: true } : {}) };
}
export const loadSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await guarded<Partial<Settings>>('settings', x => isObj(x) ? x as Partial<Settings> : null, () => ({}))) });
export const saveSettings = (s: Settings) => setKV('settings', s);
export async function loadProfiles(): Promise<Profile[]> {
  const raw = await getKV<unknown>('profiles');
  if (raw === undefined) { const d = DEFAULT_PROFILES(); await setKV('profiles', d); return d; }
  if (!Array.isArray(raw)) { await quarantine('profiles', raw); const d = DEFAULT_PROFILES(); await setKV('profiles', d); return d; }
  const ok = raw.map(repairProfile).filter((p): p is Profile => !!p);
  const ids = new Set<string>(); const uniq = ok.filter(p => !ids.has(p.id) && !!ids.add(p.id));
  if (uniq.length !== raw.length || JSON.stringify(uniq) !== JSON.stringify(raw)) { await quarantine('profiles', raw); await setKV('profiles', uniq.length ? uniq : DEFAULT_PROFILES()); }
  return uniq.length ? uniq : DEFAULT_PROFILES();
}
export const saveProfiles = (p: Profile[]) => setKV('profiles', p);
const numRec = (x: unknown) => isObj(x) ? Object.fromEntries(Object.entries(x).filter(([, v]) => Number.isFinite(v))) as Record<string, number> : {};
export const loadProgress = (pid: string) => guarded<Progress>('progress:' + pid, x => isObj(x) ? {
  stars: numRec(x.stars), plays: isObj(x.plays) ? x.plays as Progress['plays'] : {},
  masteredStars: Number.isFinite(x.masteredStars) ? Number(x.masteredStars) : 0, xp: Number.isFinite(x.xp) ? Number(x.xp) : 0 } : null, emptyProgress);
export const saveProgress = (pid: string, p: Progress) => setKV('progress:' + pid, p);
export const loadSkills = (pid: string) => guarded<Skills>('skills:' + pid, x => isObj(x) ? Object.fromEntries(Object.entries(x).filter(([, v]) => isObj(v) && Number.isFinite((v as { level?: number }).level))) as Skills : null, () => ({}));
export const saveSkills = (pid: string, s: Skills) => setKV('skills:' + pid, s);
export const loadUsage = (pid: string) => guarded<Usage>('usage:' + pid, x => isObj(x) ? Object.fromEntries(Object.entries(x).filter(([, v]) => isObj(v) && Number.isFinite((v as { used?: number }).used)).map(([d, v]) => [d, { used: Number((v as { used: number }).used), bonus: Number((v as { bonus?: number }).bonus) || 0 }])) as Usage : null, () => ({}));
export const saveUsage = (pid: string, u: Usage) => setKV('usage:' + pid, u);
export const loadFlags = () => guarded<Record<string, number>>('flags', x => isObj(x) ? numRec(x) : null, () => ({}));
export const saveFlags = (f: Record<string, number>) => setKV('flags', f);
/** 设备级时钟守卫（GDD §8.2）：记录见过的最大时间戳；发现倒退 > 10 分钟 → 锁定今日（家长密码解除） */
export interface ClockState { maxSeen: number; locked: boolean; lockedAt?: number }
export const loadClock = () => guarded<ClockState>('clock', x => isObj(x) && Number.isFinite(x.maxSeen) ? { maxSeen: Number(x.maxSeen), locked: !!x.locked, lockedAt: Number(x.lockedAt) || undefined } : null, () => ({ maxSeen: 0, locked: false }));
export const saveClock = (c: ClockState) => setKV('clock', c);
export function checkClock(c: ClockState, now: number): ClockState {
  if (c.maxSeen && now < c.maxSeen - 5 * 60e3) return { ...c, locked: true, lockedAt: now };
  return { ...c, maxSeen: Math.max(c.maxSeen, now) };
}
/** 删档案时一并清理的 KV 键 */
export const profileKeys = (pid: string) => ['progress:' + pid, 'skills:' + pid, 'usage:' + pid];
