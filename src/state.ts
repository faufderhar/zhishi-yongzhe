import type { PinVault, PendingReset } from './game/pinVault';
import { migrateVolumes } from './game/volumeMigrate';
/* 应用级数据：设置、档案、进度（KV 存 IndexedDB） */
import { getKV, setKV } from './db';
import type { GradeKey } from './game/questions';
import { bandConfig } from './game/grades';
import type { TimeLimit, Usage } from './game/playtime';
import type { Skills } from './game/adaptive';
export interface Settings { pinHash?: string; includePending: boolean; g1NoLimit: boolean; hsWager?: boolean; lenientTime?: boolean /* 时限宽松 ×1.5（r7） */;
  pinHint?: { q: string; a: string };            // 找回问题（答案存哈希）
  sfx?: boolean; tts?: boolean; volume?: number;  // 技术QA P3-4
  kinderDemoReward?: boolean;                     // D1：演示后仍给⭐（默认是）
  tutorialReplay?: Record<string, boolean>;
  recPrompted?: boolean                            // r12：升级前设的密码：已提示过生成恢复码
  restoredFromAt?: string                          // r13：用备份密码 / 恢复码恢复后，家长页提示「已从X月X日的备份恢复」
  switchNoPin?: boolean                            // r12：切换档案不用密码（默认关）
  pinRec?: string                                  // r11：恢复码哈希
  pinReset?: PendingReset                          // r11：等待生效的密码重设（24 小时）
  pinResetDoneAt?: number                          // r11：密码被重设的时间（家长页一直提示，点〔知道了〕清掉）
}
export interface Profile { id: string; name: string; avatar: string; grade: GradeKey; volumes: string[] | null; limit: TimeLimit; charId?: string; tutorialDone?: boolean; tutorialV036?: boolean; lastGrade?: GradeKey /* r8b：上次在入口选的年级 */; charIds?: Record<string, string> /* r8b：按学段记角色（幼儿园/小学/初中用小狗，高中用研究员） */; tips?: Record<string, boolean> /* D14 首次提示 */; kinderGuide?: boolean /* r9 小班首次引导看过 */; unlimited?: { weekday?: boolean; weekend?: boolean } /* r9：「不限」是单独开关，时长最少 5 分钟 */; pinVault?: PinVault /* r11：家长密码副本 */; recHash?: string /* r12：恢复码哈希独立副本 */ }
/** 实际生效的每日时长（0 = 不限）：r9 起 limit 最少 5 分钟，不限由 unlimited 开关决定 */
export const effLimit = (p: Pick<Profile, 'limit' | 'unlimited'>): TimeLimit => ({ weekday: p.unlimited?.weekday ? 0 : Math.max(MIN_LIMIT, p.limit.weekday), weekend: p.unlimited?.weekend ? 0 : Math.max(MIN_LIMIT, p.limit.weekend) });
export const MIN_LIMIT = 5;
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
    volumes: Array.isArray(x.volumes) ? migrateVolumes(grade as GradeKey, x.volumes.filter((v): v is string => typeof v === 'string')) : null,   // r10：v19 册别新写法
    ...(() => {   // r9 迁移：旧档案里的 0（不限）→ unlimited 开关 = 开，时长恢复默认值（最少 5 分钟）
      const un = isObj(x.unlimited) ? x.unlimited : {};
      const one = (k: 'weekday' | 'weekend') => { const v = Number.isFinite(lim[k]) && Number(lim[k]) >= 0 ? Number(lim[k]) : def[k]; return v === 0 && lim[k] === 0 ? { v: Math.max(MIN_LIMIT, def[k] || MIN_LIMIT), off: true } : { v: Math.max(MIN_LIMIT, v), off: un[k] === true }; };
      const a = one('weekday'), b = one('weekend');
      return { limit: { weekday: a.v, weekend: b.v }, ...(a.off || b.off ? { unlimited: { weekday: a.off, weekend: b.off } } : {}) };
    })(),
    charId: typeof x.charId === 'string' ? x.charId : undefined, ...(x.tutorialDone === true ? { tutorialDone: true } : {}), ...(x.tutorialV036 === true ? { tutorialV036: true } : {}),
    // r9：修复时保留 r8b/D14 的新字段（以前被丢掉，导致「记住上次选择」、各学段角色丢失）
    ...(typeof x.lastGrade === 'string' && GRADES.has(x.lastGrade) ? { lastGrade: x.lastGrade as GradeKey } : {}),
    ...(isObj(x.charIds) ? { charIds: Object.fromEntries(Object.entries(x.charIds).filter(([, v]) => typeof v === 'string')) as Record<string, string> } : {}),
    ...(isObj(x.tips) ? { tips: Object.fromEntries(Object.entries(x.tips).filter(([, v]) => v === true)) as Record<string, boolean> } : {}),
    ...(isObj(x.kinderGuide) || x.kinderGuide === true ? { kinderGuide: true } : {}),
    ...(isObj(x.pinVault) && typeof x.pinVault.pinHash === 'string' && x.pinVault.pinHash ? { pinVault: x.pinVault as unknown as PinVault } : {}), ...(typeof x.recHash === 'string' && x.recHash ? { recHash: x.recHash } : {}) };   // r11：家长密码副本
}
export const loadSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await guarded<Partial<Settings>>('settings', x => isObj(x) ? x as Partial<Settings> : null, () => ({}))) });
export const saveSettings = (s: Settings) => setKV('settings', s);
export async function loadProfiles(): Promise<Profile[]> {
  const raw = await getKV<unknown>('profiles');
  if (raw === undefined) { const d = DEFAULT_PROFILES(); await setKV('profiles', d); return d; }
  if (!Array.isArray(raw)) { await quarantine('profiles', raw); const d = DEFAULT_PROFILES(); await setKV('profiles', d); return d; }
  const ok = raw.map(repairProfile).filter((p): p is Profile => !!p);
  const ids = new Set<string>(); const uniq = ok.filter(p => !ids.has(p.id) && !!ids.add(p.id));
  // r14：只有真的丢了档案（损坏 / 重复）才隔离；只是补字段、字段顺序不同就静默写回（以前每次启动都记一条 corrupt:profiles）
  if (uniq.length !== raw.length) { await quarantine('profiles', raw); await setKV('profiles', uniq.length ? uniq : DEFAULT_PROFILES()); }
  else if (JSON.stringify(uniq) !== JSON.stringify(raw)) await setKV('profiles', uniq);
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
export interface ClockState { maxSeen: number; locked: boolean; lockedAt?: number; staleReset?: number }
export const loadClock = () => guarded<ClockState>('clock', x => isObj(x) && Number.isFinite(x.maxSeen) ? { maxSeen: Number(x.maxSeen), locked: !!x.locked, lockedAt: Number(x.lockedAt) || undefined } : null, () => ({ maxSeen: 0, locked: false }));
export const saveClock = (c: ClockState) => setKV('clock', c);
/** r14.1：记下的「见过的最晚时间」比现在还晚 1 天以上——多半是别人把系统时钟调快过（共用设备 / 测试），基准作废、不上锁 */
export const STALE_AHEAD_MS = 24 * 3600e3;
export function checkClock(c: ClockState, now: number): ClockState {
  if (c.maxSeen && c.maxSeen - now > STALE_AHEAD_MS) { console.warn('[zy] 时钟基准在未来，作废', new Date(c.maxSeen).toISOString()); return { maxSeen: now, locked: false, staleReset: c.maxSeen }; }
  if (c.maxSeen && now < c.maxSeen - 5 * 60e3) return { ...c, locked: true, lockedAt: now };
  return { ...c, maxSeen: Math.max(c.maxSeen, now) };
}
/** 删档案时一并清理的 KV 键 */
export const profileKeys = (pid: string) => ['progress:' + pid, 'skills:' + pid, 'usage:' + pid, 'rollup:' + pid];
