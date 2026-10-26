import { MASTERED_MAX, XP_MAX } from './game/limits';
import type { PinVault, PendingReset } from './game/pinVault';
import { migrateVolumes } from './game/volumeMigrate';
/* 应用级数据：设置、档案、进度（KV 存 IndexedDB） */
import { getKV, setKV as rawSetKV } from './db';
import { cleanUsage } from './game/sanitize';
/** r16 较真家长 2：覆盖恢复 / 合并写库期间（db.importAll 竖 runtimeFlags.beginRestoring，约 15 秒，之后 reload）state.ts 的保存一律不写，
    免得内存里的旧状态盖回刚恢复的数据。不加在 db.setKV 上——importAll 自己还要用它写 snapshot:last / writeRec */
export const restoring = isRestoring;
const saveKV = (k: string, v: unknown) => restoring() ? Promise.resolve() : rawSetKV(k, v);
const setKV = rawSetKV;
import type { GradeKey } from './game/questions';
import { bandConfig } from './game/grades';
import { cleanElectives, needsElectives, ALL_SUBJECTS, type Electives } from './game/electives';
import type { TimeLimit, Usage } from './game/playtime';
import type { Skills } from './game/adaptive';
import { isRestoring } from './runtimeFlags';
export interface Settings { pinHash?: string; includePending: boolean; g1NoLimit: boolean; hsWager?: boolean; lenientTime?: boolean /* 时限宽松 ×1.5（r7） */;
  pinHint?: { q: string; a: string };            // 找回问题（答案存哈希）
  sfx?: boolean; tts?: boolean; volume?: number;  // 技术QA P3-4
  kinderDemoReward?: boolean;                     // D1：演示后仍给⭐（默认是）
  tutorialReplay?: Record<string, boolean>;
  pinNudged?: boolean                              // r15：没密码时第一次换档案已提示过设密码
  recConfirmed?: boolean                           // r15 R141-2：家长把恢复码打回来确认过已抄好
  recPrompted?: boolean                            // r12：升级前设的密码：已提示过生成恢复码
  restoredSeen?: boolean                           // r15.4.3 较真家长 P3：恢复提示已在一次家长页里显示过，下次进家长页自动收起
  restoredFromAt?: string                          // r13：用备份密码 / 恢复码恢复后，家长页提示「已从X月X日的备份恢复」
  switchNoPin?: boolean                            // r12：切换档案不用密码（默认关）
  pinRec?: string                                  // r11：恢复码哈希
  pinReset?: PendingReset                          // r11：等待生效的密码重设（24 小时）
  pinResetDoneAt?: number                          // r11：密码被重设的时间（家长页一直提示，点〔知道了〕清掉）
}
export interface Profile { id: string; name: string; avatar: string; grade: GradeKey; volumes: string[] | null; limit: TimeLimit;
  electives?: Electives   /* r16 R-13 / r16.1：高二选科（{ all: true } =「还没选科（全科）」，高二及以上新档案默认；首选 1 + 再选 2；没有 = 全科），见 game/electives.ts */;
  volsKnown?: string[]   /* r15.4.4：保存「已学册别」时题库里有哪些册别（之后题库新增的册别自动勾上一次） */; volNotice?: string[]   /* r15.4.4：自动勾上的新册别（家长页提示一次） */; charId?: string; tutorialDone?: boolean; tutorialV036?: boolean; lastGrade?: GradeKey /* r8b：上次在入口选的年级 */; charIds?: Record<string, string> /* r8b：按学段记角色（幼儿园/小学/初中用小狗，高中用研究员） */; tips?: Record<string, boolean> /* D14 首次提示 */; electNote?: boolean /* r17.1 学霸 r17-11 §6-2：〔添加孩子〕新建的 ≥11 年级档案，第一次进地图提示「默认全科」后清掉；备份恢复的旧档案没有，不提示 */; kinderGuide?: boolean /* r9 小班首次引导看过 */; unlimited?: { weekday?: boolean; weekend?: boolean } /* r9：「不限」是单独开关，时长最少 5 分钟 */; pinVault?: PinVault /* r11：家长密码副本 */; recHash?: string /* r12：恢复码哈希独立副本 */ }
/** 实际生效的每日时长（0 = 不限）：r9 起 limit 最少 5 分钟，不限由 unlimited 开关决定 */
export const effLimit = (p: Pick<Profile, 'limit' | 'unlimited'>): TimeLimit => ({ weekday: p.unlimited?.weekday ? 0 : Math.max(MIN_LIMIT, p.limit.weekday), weekend: p.unlimited?.weekend ? 0 : Math.max(MIN_LIMIT, p.limit.weekend) });
export const MIN_LIMIT = 5;
export interface Progress { stars: Record<string, number>; plays: Record<string, { day: string; count: number }>; masteredStars: number; xp: number; termLit?: Record<string, number> /* r17：小班期末关已点亮的爱心（没完成时接着点） */ }
export const DEFAULT_SETTINGS: Settings = { includePending: false, g1NoLimit: false };
export const AVATARS = ['🧒', '👧', '👦', '🧑‍🎓', '🧑‍🔬', '🐱', '🐶', '🐰', '🦊', '🐼', '🦁', '🐯'];
export const newProfile = (name: string, grade: GradeKey, avatar = '🧒'): Profile =>
  ({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, avatar, grade, volumes: null, limit: { ...bandConfig(grade).dailyMinutes }, ...(needsElectives(grade) ? { electives: { ...ALL_SUBJECTS } } : {}) });
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
    // r15.4.4：保存勾选时已知的册别 / 待提示的新册别（旧备份没有这两项 → 按 VOL_ADDED 推断，见 game/volumes.ts syncNewVolumes）
    ...(Array.isArray(x.volumes) && Array.isArray(x.volsKnown) ? { volsKnown: x.volsKnown.filter((v): v is string => typeof v === 'string') } : {}),
    ...(Array.isArray(x.volNotice) && x.volNotice.length ? { volNotice: x.volNotice.filter((v): v is string => typeof v === 'string').slice(0, 40) } : {}),
    ...(() => {   // r9 迁移：旧档案里的 0（不限）→ unlimited 开关 = 开，时长恢复默认值（最少 5 分钟）
      const un = isObj(x.unlimited) ? x.unlimited : {};
      const one = (k: 'weekday' | 'weekend') => { const v = typeof lim[k] === 'number' && Number.isFinite(lim[k]) && Number(lim[k]) >= 0 ? Math.min(240, Number(lim[k])) : def[k];   /* r15.4 技术QA P2-2：上限 240（家长页最多能设 240） */ return v === 0 && lim[k] === 0 ? { v: Math.max(MIN_LIMIT, def[k] || MIN_LIMIT), off: true } : { v: Math.max(MIN_LIMIT, v), off: un[k] === true }; };
      const a = one('weekday'), b = one('weekend');
      return { limit: { weekday: a.v, weekend: b.v }, ...(a.off || b.off ? { unlimited: { weekday: a.off, weekend: b.off } } : {}) };
    })(),
    ...(() => { const e = cleanElectives(x.electives); return e ? { electives: e } : {}; })(),   // r16.1：选科（以前读档时被丢掉）
    charId: typeof x.charId === 'string' ? x.charId : undefined, ...(x.tutorialDone === true ? { tutorialDone: true } : {}), ...(x.tutorialV036 === true ? { tutorialV036: true } : {}),
    // r9：修复时保留 r8b/D14 的新字段（以前被丢掉，导致「记住上次选择」、各学段角色丢失）
    ...(typeof x.lastGrade === 'string' && GRADES.has(x.lastGrade) ? { lastGrade: x.lastGrade as GradeKey } : {}),
    ...(isObj(x.charIds) ? { charIds: Object.fromEntries(Object.entries(x.charIds).filter(([, v]) => typeof v === 'string')) as Record<string, string> } : {}),
    ...(isObj(x.tips) ? { tips: Object.fromEntries(Object.entries(x.tips).filter(([, v]) => v === true)) as Record<string, boolean> } : {}),
    ...(isObj(x.kinderGuide) || x.kinderGuide === true ? { kinderGuide: true } : {}),
    ...(x.electNote === true ? { electNote: true } : {}),   // r17.1 r17-11：刚建好、还没进过地图的高二 / 高三档案（刷新后还提示一次）
    ...(isObj(x.pinVault) && typeof x.pinVault.pinHash === 'string' && x.pinVault.pinHash ? { pinVault: x.pinVault as unknown as PinVault } : {}), ...(typeof x.recHash === 'string' && x.recHash ? { recHash: x.recHash } : {}) };   // r11：家长密码副本
}
export const loadSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await guarded<Partial<Settings>>('settings', x => isObj(x) ? x as Partial<Settings> : null, () => ({}))) });
export const saveSettings = (s: Settings) => saveKV('settings', s);
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
export const saveProfiles = (p: Profile[]) => saveKV('profiles', p);
const starRec = (x: unknown) => Object.fromEntries(Object.entries(numRec(x)).map(([k, v]) => [k, Math.min(3, Math.max(0, v))]));
const numRec = (x: unknown) => isObj(x) ? Object.fromEntries(Object.entries(x).filter(([, v]) => Number.isFinite(v))) as Record<string, number> : {};
/** r15 技术QA R141-5：导入 / 读取时数字夹到 [0, max] */
const clampN = (v: unknown, max: number) => Number.isFinite(v) ? Math.min(max, Math.max(0, Number(v))) : 0;
export const loadProgress = (pid: string) => guarded<Progress>('progress:' + pid, x => isObj(x) ? {
  stars: starRec(x.stars), plays: isObj(x.plays) ? x.plays as Progress['plays'] : {},
  masteredStars: clampN(x.masteredStars, MASTERED_MAX), xp: clampN(x.xp, XP_MAX), ...(isObj(x.termLit) ? { termLit: Object.fromEntries(Object.entries(numRec(x.termLit)).map(([k, v]) => [k, Math.min(20, Math.max(0, Math.floor(v)))])) } : {}) } : null, emptyProgress);
export const saveProgress = (pid: string, p: Progress) => saveKV('progress:' + pid, p);
export const loadSkills = (pid: string) => guarded<Skills>('skills:' + pid, x => isObj(x) ? Object.fromEntries(Object.entries(x).filter(([, v]) => isObj(v) && Number.isFinite((v as { level?: number }).level))) as Skills : null, () => ({}));
export const saveSkills = (pid: string, s: Skills) => saveKV('skills:' + pid, s);
/* r16 较真家长 2：加载和恢复 / 合并用同一套字段表（sanitize.cleanUsage，保留 spent / wrapTail / capAt）；以前这里自己重建，漏了 spent → 取消的加时刷新后又复活 */
export const loadUsage = (pid: string) => guarded<Usage>('usage:' + pid, x => cleanUsage(x) ?? null, () => ({}));
export const saveUsage = (pid: string, u: Usage) => saveKV('usage:' + pid, u);
export const loadFlags = () => guarded<Record<string, number>>('flags', x => isObj(x) ? numRec(x) : null, () => ({}));
export const saveFlags = (f: Record<string, number>) => saveKV('flags', f);
/** 设备级时钟守卫（GDD §8.2）：记录见过的最大时间戳；发现倒退 > 10 分钟 → 锁定今日（家长密码解除） */
export interface ClockState { maxSeen: number; locked: boolean; lockedAt?: number; staleReset?: number }
export const loadClock = () => guarded<ClockState>('clock', x => isObj(x) && Number.isFinite(x.maxSeen) ? { maxSeen: Number(x.maxSeen), locked: !!x.locked, lockedAt: Number(x.lockedAt) || undefined } : null, () => ({ maxSeen: 0, locked: false }));
export const saveClock = (c: ClockState) => saveKV('clock', c);
/** r14.1：记下的「见过的最晚时间」比现在还晚 1 天以上——多半是别人把系统时钟调快过（共用设备 / 测试），基准作废、不上锁 */
export const STALE_AHEAD_MS = 24 * 3600e3;
export function checkClock(c: ClockState, now: number): ClockState {
  // r15 技术QA R141-1：不再把「基准在未来 1 天以上」当成过期作废——那样关着游戏把时钟调回 50 小时就不锁了。
  // 误锁的真正来源（休眠、按本地日期字符串判定、旧版本存下的锁）都已去掉；时区变化不影响 epoch 毫秒。基准确实有误时由家长「解除锁定 / 重置计时」重设
  if (false as boolean) { console.warn('[zy] 时钟基准在未来，作废', new Date(c.maxSeen).toISOString()); return { maxSeen: now, locked: false, staleReset: c.maxSeen }; }
  // r14.2 小萌新：锁定只由「现在的 epoch 毫秒比见过的最大值早 5 分钟以上」决定，每次都重新判定——
  // 以前存下来的 locked:true 会一直沿用（旧版本 / 时区切换造成的锁永远解不开）；时钟调回正确后自动解锁
  if (c.maxSeen && now < c.maxSeen - 5 * 60e3) return { ...c, locked: true, lockedAt: c.locked ? c.lockedAt ?? now : now };
  if (c.locked) console.warn('[zy] 旧的时间锁定没有真实的时钟回拨支撑，解除');
  return { maxSeen: Math.max(c.maxSeen || 0, now), locked: false };
}
/** 删档案时一并清理的 KV 键 */
export const profileKeys = (pid: string) => ['progress:' + pid, 'skills:' + pid, 'usage:' + pid, 'rollup:' + pid];
