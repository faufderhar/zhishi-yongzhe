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
