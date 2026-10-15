/* 应用级数据：设置、档案、进度（KV 存 IndexedDB） */
import { getKV, setKV } from './db';
import type { GradeKey } from './game/questions';
import { bandConfig } from './game/grades';
import type { TimeLimit, Usage } from './game/playtime';
import type { Skills } from './game/adaptive';
export interface Settings { pinHash?: string; includePending: boolean; g1NoLimit: boolean }
export interface Profile { id: string; name: string; avatar: string; grade: GradeKey; volumes: string[] | null; limit: TimeLimit; charId?: string }
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

export const loadSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await getKV<Settings>('settings')) });
export const saveSettings = (s: Settings) => setKV('settings', s);
export async function loadProfiles() {
  const p = await getKV<Profile[]>('profiles');
  if (p) return p;
  const d = DEFAULT_PROFILES(); await setKV('profiles', d); return d;
}
export const saveProfiles = (p: Profile[]) => setKV('profiles', p);
export const loadProgress = async (pid: string) => ({ ...emptyProgress(), ...(await getKV<Progress>('progress:' + pid)) });
export const saveProgress = (pid: string, p: Progress) => setKV('progress:' + pid, p);
export const loadSkills = async (pid: string) => (await getKV<Skills>('skills:' + pid)) ?? {};
export const saveSkills = (pid: string, s: Skills) => setKV('skills:' + pid, s);
export const loadUsage = async (pid: string) => (await getKV<Usage>('usage:' + pid)) ?? {};
export const saveUsage = (pid: string, u: Usage) => setKV('usage:' + pid, u);
export const loadFlags = async () => (await getKV<Record<string, number>>('flags')) ?? {};
export const saveFlags = (f: Record<string, number>) => setKV('flags', f);
