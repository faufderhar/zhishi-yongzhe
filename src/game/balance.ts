/* 数值表（GDD §4.2–4.3），试玩后直接改这里 */
import type { LevelKind } from './grades';
export const DIFF_MULT: Record<number, number> = { 1: 0.8, 2: 1.0, 3: 1.2, 4: 1.5, 5: 1.8 };
export function comboMult(c: number) { return c >= 8 ? 1.5 : c >= 5 ? 1.35 : c >= 3 ? 1.2 : c >= 2 ? 1.1 : 1; }
export const PLAYER = { std: { hp: 100, atk: 20 }, hs: { hp: 160, atk: 26 } };
export interface MonsterStat { name: string; emoji: string; hp: number; atk: number; shield: number; img: 'k' | 'j' | 'jb' | 'h' | 'hb' }
/** 怪物血量按关卡题数缩放过（原型：普通 6 题左右能打完） */
export const MONSTERS: Record<'std' | 'hs', Record<LevelKind, MonsterStat>> = {
  std: {
    normal: { name: '数字哥布林', emoji: '👺', hp: 60, atk: 12, shield: 10, img: 'j' },
    elite: { name: '墨汁史莱姆', emoji: '🟣', hp: 100, atk: 16, shield: 12, img: 'jb' },
    boss: { name: '大魔王·墨汁史莱姆', emoji: '👾', hp: 160, atk: 18, shield: 14, img: 'jb' },
  },
  hs: {
    normal: { name: '惯性幽灵', emoji: '👻', hp: 120, atk: 18, shield: 14, img: 'h' },
    elite: { name: '惯性幽灵·强化', emoji: '👻', hp: 180, atk: 22, shield: 16, img: 'h' },
    boss: { name: '熵之塔·守门人', emoji: '🗿', hp: 260, atk: 26, shield: 20, img: 'hb' },
  },
};
export const MONSTER = { kinder: { name: '调皮乌云', emoji: '☁️', hearts: 3 }, std: MONSTERS.std.normal, hs: MONSTERS.hs.normal };
export const AUTO_ATTACK_SECONDS = 3;
/** 题目用完怪物没倒：精英/Boss 继续出题，最多再出这么多倍 */
export const EXTRA_QUESTION_FACTOR = 1;

/* ===== D6 轮流回合（GDD v0.3.6 §4.4 / 实现规格 §3.2），所有数值只在这里改 ===== */
export type RoundMode = 'p36' | 'j' | 'h';
export type MIntent = 'atk' | 'charge' | 'heavy' | 'shield';
export interface RoundMonster { hp: number; atk: number; cap: number; pat: MIntent[]; half?: MIntent[]; phases?: { hp: number; weak: string }[] }
export interface RoundStats { player: { hp: number; atk: number }; shield: number; dodge: number; perfect: boolean; monsters: Record<LevelKind, RoundMonster> }
const N: MIntent[] = ['atk', 'atk', 'shield'], E: MIntent[] = ['atk', 'charge', 'heavy'], B: MIntent[] = ['atk', 'atk', 'charge', 'heavy'];
export const ROUND: Record<RoundMode, RoundStats> = {
  p36: { player: { hp: 100, atk: 18 }, shield: 8, dodge: 0.30, perfect: false, monsters: {
    normal: { hp: 50, atk: 10, cap: 12, pat: N }, elite: { hp: 100, atk: 13, cap: 16, pat: E }, boss: { hp: 126, atk: 15, cap: 22, pat: B, half: E } } },
  j: { player: { hp: 100, atk: 20 }, shield: 10, dodge: 0.25, perfect: true, monsters: {
    normal: { hp: 60, atk: 12, cap: 12, pat: N }, elite: { hp: 120, atk: 16, cap: 18, pat: E }, boss: { hp: 153, atk: 18, cap: 24, pat: B, half: E } } },
  h: { player: { hp: 160, atk: 26 }, shield: 15, dodge: 0.25, perfect: true, monsters: {
    normal: { hp: 90, atk: 18, cap: 12, pat: N }, elite: { hp: 170, atk: 24, cap: 18, pat: E },
    boss: { hp: 234, atk: 26, cap: 26, pat: B, half: E, phases: [{ hp: 117, weak: '数学' }, { hp: 117, weak: '化学' }] } } },
};
/** 小学 3–4 年级：所有怪都用 ⚔ → ⚔ → 🛡 */
export const LOW_GRADE_PATTERN: MIntent[] = N;
export const LEVEL_UP = { hp: 5, atk: 1, max: 20 };
export const DODGE_CAP = 0.6, DODGE_PER_FOCUS = 0.10, DODGE_BONUS_CAP = 0.10;
export const FOCUS_MAX = 2, FOCUS_DMG = 0.25, ENERGY_CAP = 5;
export const PERFECT_FRACTION = 0.5, PERFECT_NOLIMIT_SEC = 8;
export const WEAK = 1.5, RESIST = 0.6, AFFINITY = 1.2;
export const CARDS = { light: { label: '轻击', diff: -1, out: 0.8, ctr: 0.8 }, std: { label: '标准', diff: 0, out: 1, ctr: 1 }, heavy: { label: '重击', diff: 1, out: 1.6, ctr: 1.5 } } as const;
export const WAGER = { sureOut: 1.2, sureHurt: 1.3, unsureCtr: 0.5 };
export const HURT_CAP = 2.0;
export const MULTI_STEP = [1.0, 1.3, 1.6];
export const REVIVE = { need: 2, tries: 4, hp: 0.5 };
