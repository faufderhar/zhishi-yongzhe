import { DIFF_MULT, comboMult, PLAYER, MONSTERS } from './balance';
import type { LevelKind } from './grades';
import { passive, type Character } from './characters';

export type Intent = 'attack' | 'shield';
export interface BattleState {
  mode: 'std' | 'hs';
  playerHp: number; playerMax: number; atk: number;
  monsterHp: number; monsterMax: number; monsterAtk: number; monsterShield: number; shieldAmt: number;
  turn: number; combo: number; focus: number; usedLexiPassive: boolean;
  over: null | 'win' | 'lose'; log: string[]; noDeath: boolean; revived: boolean; kind: LevelKind;
}
export function intentOf(turn: number): Intent { return turn % 3 === 2 ? 'shield' : 'attack'; }

/** noDeath：不会失败（小学 1–2 年级简易模式），血量最低留 1 */
export function newBattle(mode: 'std' | 'hs', kind: LevelKind = 'normal', noDeath = false): BattleState {
  const p = PLAYER[mode], m = MONSTERS[mode][kind];
  return { mode, playerHp: p.hp, playerMax: p.hp, atk: p.atk, monsterHp: m.hp, monsterMax: m.hp, monsterAtk: m.atk,
    monsterShield: 0, shieldAmt: m.shield, turn: 0, combo: 0, focus: 0, usedLexiPassive: false, over: null, log: [], noDeath, revived: false, kind };
}

export function calcDamage(s: BattleState, ch: Character, subject: string, difficulty: number, combo: number): number {
  let d = s.atk * (DIFF_MULT[difficulty] ?? 1) * comboMult(combo);
  if (subject === ch.major) d *= 1.2;
  if (passive.mathBonus(ch) && subject === '数学') d *= 1.1;
  d *= 1 + 0.25 * s.focus;
  return Math.max(1, Math.round(d));
}

function hitMonster(s: BattleState, dmg: number) {
  const absorbed = Math.min(s.monsterShield, dmg);
  s.monsterShield -= absorbed;
  s.monsterHp = Math.max(0, s.monsterHp - (dmg - absorbed));
  return dmg - absorbed;
}
function endTurn(s: BattleState) {
  if (s.noDeath && s.playerHp <= 0) s.playerHp = 1;
  if (s.monsterHp <= 0) s.over = 'win';
  else if (s.playerHp <= 0) s.over = 'lose';
  s.turn++;
}

export type Action = 'attack' | 'dodge';
export interface TurnResult { dealt: number; taken: number; healed: number }

/** 答对后执行行动 */
export function resolveCorrect(prev: BattleState, ch: Character, action: Action, subject: string, difficulty: number, mult = 1): [BattleState, TurnResult] {
  const s = { ...prev, log: prev.log.slice() };
  s.combo++;
  const intent = intentOf(s.turn);
  const base = Math.max(1, Math.round(calcDamage(s, ch, subject, difficulty, s.combo) * mult));
  const partial = mult < 1;
  let dealt = 0, taken = 0, healed = 0;
  if (action === 'attack') {
    dealt = hitMonster(s, base); s.focus = 0;
    if (intent === 'attack' && s.monsterHp > 0 && !partial) { taken = Math.round(s.monsterAtk * 0.5); }
  } else {
    dealt = hitMonster(s, Math.max(1, Math.round(base * 0.3)));
    s.focus = Math.min(2, s.focus + 1);
  }
  if (intent === 'shield' && s.monsterHp > 0) s.monsterShield += s.shieldAmt;
  if (passive.heal(ch) && subject === '语文') healed = Math.min(3, s.playerMax - s.playerHp);
  s.playerHp = Math.max(0, Math.min(s.playerMax, s.playerHp - taken + healed));
  s.log.push(`回合${s.turn + 1}: 答对·${action === 'attack' ? '攻击' : '闪避'} 造成${dealt} 受到${taken}`);
  endTurn(s);
  return [s, { dealt, taken, healed }];
}

/** 答错/超时 */
export function resolveWrong(prev: BattleState, ch: Character): [BattleState, TurnResult] {
  const s = { ...prev, log: prev.log.slice() };
  const intent = intentOf(s.turn);
  const taken = intent === 'attack' ? s.monsterAtk : Math.round(s.monsterAtk * 0.5);
  if (passive.comboGuard(ch) && !s.usedLexiPassive) s.usedLexiPassive = true; else s.combo = 0;
  if (intent === 'shield') s.monsterShield += s.shieldAmt;
  s.playerHp = Math.max(0, s.playerHp - taken);
  s.log.push(`回合${s.turn + 1}: 答错 受到${taken}`);
  endTurn(s);
  return [s, { dealt: 0, taken, healed: 0 }];
}

/** 简易模式：怪物要攻击就闪避，否则攻击（GDD §4.1） */
export const autoAction = (s: BattleState): Action => intentOf(s.turn) === 'attack' ? 'dodge' : 'attack';
/** 复活：回到 50% 血量（每关 1 次，GDD §4.4） */
export function revive(s: BattleState): BattleState {
  return { ...s, playerHp: Math.ceil(s.playerMax / 2), over: null, revived: true, log: [...s.log, '复活'] };
}
/** 题目用完时：怪物未倒下按剩余血量比较判定（原型简化） */
export function outOfQuestions(s: BattleState): 'win' | 'lose' {
  return s.monsterHp / s.monsterMax <= s.playerHp / s.playerMax ? 'win' : 'lose';
}

/* ---------- 幼儿园温和模式（不会失败） ---------- */
export interface KinderState { hearts: number; lit: number; attempt: 0 | 1; removed: string[]; stars: number; done: boolean; first: number; retry: number; demo: number }
export const newKinder = (hearts: number): KinderState => ({ hearts, lit: 0, attempt: 0, removed: [], stars: 0, done: false, first: 0, retry: 0, demo: 0 });
export type KinderOutcome = 'correct' | 'retry' | 'demo';
/**
 * 策划确认单 D1：
 *  - 第 1 次点错 → retry：去掉「孩子刚点的那个」选项，同题再答；若去掉后只剩正确项 → 直接 demo
 *  - 第 2 次点对 → correct（计「再试答对」）；第 2 次又错 → demo（计「看演示学会」）
 *  - 每完成 1 题点亮 1 颗爱心；demo 是否给⭐由 demoReward 决定（默认给）
 * wrongVisible = 当前仍显示的错误选项 key。
 */
export function kinderAnswer(prev: KinderState, correct: boolean, pickedKey: string, wrongVisible: string[], demoReward = true): [KinderState, KinderOutcome] {
  if (prev.done) return [prev, 'correct'];
  if (!correct && prev.attempt === 0) {
    const removed = [...prev.removed, pickedKey];
    if (wrongVisible.some(k => k !== pickedKey)) return [{ ...prev, attempt: 1, removed }, 'retry'];
  }
  const lit = Math.min(prev.hearts, prev.lit + 1);
  const kind: 'first' | 'retry' | 'demo' = correct ? (prev.attempt === 0 ? 'first' : 'retry') : 'demo';
  const star = correct || demoReward ? 1 : 0;
  return [{ ...prev, lit, stars: prev.stars + star, attempt: 0, removed: [], done: lit >= prev.hearts, [kind]: prev[kind] + 1 }, correct ? 'correct' : 'demo'];
}
