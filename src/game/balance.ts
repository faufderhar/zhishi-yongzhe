/* 数值表（GDD §4.2–4.3），试玩后直接改这里 */
import type { LevelKind } from './grades';
export const DIFF_MULT: Record<number, number> = { 1: 0.8, 2: 1.0, 3: 1.2, 4: 1.5, 5: 1.8 };
/** 旧连击表：只给 1–2 年级的简易战斗（battle.ts）用，D14 不改 */
export function legacyComboMult(c: number) { return c >= 8 ? 1.5 : c >= 5 ? 1.35 : c >= 3 ? 1.2 : c >= 2 ? 1.1 : 1; }
/* D14（v0.3.8）倍率封顶：内层 M = min(INNER_CAP, 连击 × 专注 × 技能 × 题卡 × 挑战) */
export const COMBO_STEP = 0.05, COMBO_CAP = 1.3, INNER_CAP = 1.8, CHALLENGE = { out: 1.5, ctr: 1.5 };
export function comboMult(c: number) { return Math.min(COMBO_CAP, 1 + COMBO_STEP * Math.max(0, c - 1)); }
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
export type MIntent = 'atk' | 'charge' | 'heavy' | 'shield' | 'idle';
export interface RoundMonster { hp: number; atk: number; cap: number; pat: MIntent[]; half?: MIntent[]; phases?: { hp: number; weak?: string }[]; rage?: number /* D14：二阶段攻击倍率 */ }
export interface RoundStats { player: { hp: number; atk: number }; shield: number; dodge: number; perfect: boolean; monsters: Record<LevelKind, RoundMonster> }
const N: MIntent[] = ['atk', 'atk', 'shield'], E: MIntent[] = ['atk', 'charge', 'heavy'], B: MIntent[] = ['atk', 'atk', 'charge', 'heavy'], R: MIntent[] = ['atk', 'charge', 'heavy'];
/** Boss 关的时长（回合上限），以后可能再调：只改这里（D14：小学 28 / 初一 28 / 高一 30） */
export const BOSS_CAP = { p36: 28, j: 28, h: 30 };
/** 三星条件（D14）：答对率 ≥ 80%、没复活、剩余血量 ≥ 50% */
export const STAR3 = { acc: 0.8, hp: 0.5 }, STAR2 = { acc: 0.6 };
export const ROUND: Record<RoundMode, RoundStats> = {
  p36: { player: { hp: 100, atk: 18 }, shield: 8, dodge: 0.30, perfect: false, monsters: {
    normal: { hp: 66, atk: 10, cap: 14, pat: N }, elite: { hp: 125, atk: 13, cap: 20, pat: E }, boss: { hp: 165, atk: 13, cap: BOSS_CAP.p36, pat: B, half: E } } },
  j: { player: { hp: 100, atk: 20 }, shield: 10, dodge: 0.25, perfect: true, monsters: {
    normal: { hp: 80, atk: 12, cap: 14, pat: N }, elite: { hp: 150, atk: 16, cap: 20, pat: E },
    boss: { hp: 200, atk: 14, cap: BOSS_CAP.j, pat: B, half: R, rage: 1.2, phases: [{ hp: 100 }, { hp: 100 }] } } },
  h: { player: { hp: 160, atk: 26 }, shield: 15, dodge: 0.25, perfect: true, monsters: {
    normal: { hp: 100, atk: 18, cap: 14, pat: N }, elite: { hp: 190, atk: 24, cap: 20, pat: E },
    boss: { hp: 250, atk: 22, cap: BOSS_CAP.h, pat: B, half: R, rage: 1.2, phases: [{ hp: 125, weak: '数学' }, { hp: 125, weak: '化学' }] } } },
};
/** r17.1（Boss补测裁定_r17 §1.5 / §4 #5）：Boss 两阶段 HP 按年级覆盖，不改 ROUND（ROUND.h 高一定稿 250、ROUND.j 初一/初二 200 不动）。
    高二 130+130 = 260，高三沿用高二。阶段溢出仍不带入；D14 内层封顶 ×1.8、连击 ×1.3 等常量不变。只列在这里的年级才变。 */
export const BOSS_PHASES_BY_GRADE: Record<string, [number, number]> = { '11': [130, 130], '12': [130, 130] };
/** 小学 3–4 年级：所有怪都用 ⚔ → ⚔ → 🛡 */
export const LOW_GRADE_PATTERN: MIntent[] = N;
export const LEVEL_UP = { hp: 5, atk: 1, max: 20 };
export const DODGE_CAP = 0.6, DODGE_PER_FOCUS = 0.10, DODGE_BONUS_CAP = 0.10;
export const FOCUS_MAX = 2, FOCUS_DMG = 0.25, ENERGY_CAP = 5;
export const PERFECT_FRACTION = 0.5, PERFECT_NOLIMIT_SEC = 8;
export const WEAK = 1.5, RESIST = 0.6, AFFINITY = 1.2;
export const CARDS = { light: { label: '轻击', diff: -1, out: 0.8, ctr: 0.8 }, std: { label: '标准', diff: 0, out: 1, ctr: 1 }, heavy: { label: '重击', diff: 1, out: 1.6, ctr: 1.5 } } as const;
/** r10（D14 修正 2）：高一题卡伤害倍率随难度缩放：有效 = 1 + (卡 − 1) × k，k = 0.5 / 0.75 / 1（难度 1 / 2 / ≥3）；答错风险不变 */
export const CARD_K: Record<number, number> = { 1: 0.5, 2: 0.75 };
export const cardOut = (out: number, difficulty: number) => 1 + (out - 1) * (difficulty >= 3 ? 1 : CARD_K[difficulty] ?? 0.5);
/* r15.4.2 游戏策划：高一押注改成我方回合看题前的开关（默认不押）。押：答对伤害 ×1.25（算进内层封顶 ×1.8）、能量 +1；答错（含半对）反击 ×1.25 且不能闪避 */
export const WAGER = { out: 1.25, ctr: 1.25, energy: 1 };
export const HURT_CAP = 2.0;
export const MULTI_STEP = [1.0, 1.3, 1.6];
export const REVIVE = { need: 2, tries: 4, hp: 0.5 };

/* ===== 角色技能随机释放（v0.3.7 角色技能规格 §2.1 / 确认单 D13） ===== */
export const SKILL = {
  rate: { visual: 0.35, battle: 0.20 },
  pity: { visual: 3, battle: 4 },            // 连续 N 次答对没触发 → 下一次必触发
  atk: { A14: 1.4, A2H: 0.7, A13P: 1.3, A125C: 1.25 },
  guardHurt: 0.7, healPct: 0.05,
  weight: { guard: 5, heal: 3, control: 2, atk: 1, visual: 1 },
  particleCap: { K: 30, P12: 40, P36: 40, J: 60, H: 60 },
  lowFps: 45,
} as const;
