/* D6 轮流回合引擎（实现规格 v0.3.6）。纯函数，UI 与模拟测试共用 */
import type { Character } from './characters';
import type { LevelKind, Band } from './grades';
import { ROUND, LOW_GRADE_PATTERN, DIFF_MULT, comboMult, DODGE_CAP, DODGE_PER_FOCUS, DODGE_BONUS_CAP, FOCUS_MAX, FOCUS_DMG, ENERGY_CAP,
  WEAK, AFFINITY, CARDS, WAGER, HURT_CAP, MULTI_STEP, REVIVE, LEVEL_UP, type RoundMode, type MIntent, type RoundMonster } from './balance';
import { passive as PASSIVE } from './characters';

export type Side = 'P' | 'M';
export type CardKind = keyof typeof CARDS;
export type Wager = 'sure' | 'unsure' | null;
export interface RState {
  mode: RoundMode; kind: LevelKind; def: RoundMonster; shieldVal: number; baseDodge: number; perfectOn: boolean;
  side: Side; turn: number; cap: number;
  playerHp: number; playerMax: number; atk: number;
  monsterHp: number; monsterMax: number; shield: number; chargeBroken: boolean; mi: number; pattern: MIntent[];
  combo: number; focus: number; energy: number; comboGuardUsed: boolean;
  over: null | 'win' | 'lose' | 'retreat'; revived: boolean; noDeath: boolean;
}
export const roundModeOf = (band: Band): RoundMode | null => band === 'G2' || band === 'G3' ? 'p36' : band === 'J' ? 'j' : band === 'H' ? 'h' : null;
export function newRound(mode: RoundMode, kind: LevelKind, opts: { lowGrade?: boolean; level?: number; noDeath?: boolean } = {}): RState {
  const S = ROUND[mode], def = S.monsters[kind], lv = Math.min(LEVEL_UP.max, Math.max(1, opts.level ?? 1)) - 1;
  const pattern = opts.lowGrade ? LOW_GRADE_PATTERN : def.pat;
  const hp = S.player.hp + lv * LEVEL_UP.hp;
  return { mode, kind, def: opts.lowGrade ? { ...def, pat: LOW_GRADE_PATTERN, half: undefined } : def, shieldVal: S.shield, baseDodge: S.dodge, perfectOn: S.perfect,
    side: 'P', turn: 0, cap: def.cap, playerHp: hp, playerMax: hp, atk: S.player.atk + lv * LEVEL_UP.atk,
    monsterHp: def.hp, monsterMax: def.hp, shield: 0, chargeBroken: false, mi: 0, pattern,
    combo: 0, focus: 0, energy: 0, comboGuardUsed: false, over: null, revived: false, noDeath: !!opts.noDeath };
}
/** 下一个对方回合的意图（Boss 半血后从下一个意图起换循环） */
export function nextIntent(s: RState): MIntent { return s.pattern[s.mi % s.pattern.length]; }
export const phaseOf = (s: RState) => s.def.phases && s.monsterHp <= s.def.phases[1].hp ? 1 : 0;
export const weakOf = (s: RState) => s.def.phases?.[phaseOf(s)].weak;
export function intentLabel(s: RState) {
  const it = nextIntent(s), A = s.def.atk;
  switch (it) {
    case 'atk': return { icon: '⚔', short: `⚔ ${A}`, grey: false, long: `怪物要攻击了！对方回合答对就能闪开，答错会受到 ${A} 点伤害。` };
    case 'charge': return { icon: '⚡', short: '⚡ 蓄力', grey: false, long: '怪物在蓄力，下次会放重击（×2）！这题答对能打断它。' };
    case 'heavy': return s.chargeBroken
      ? { icon: '💥', short: `💥 ${A}`, grey: true, long: `蓄力被你打断了，重击只剩 ${A} 点。` }
      : { icon: '💥', short: `💥 ${2 * A}`, grey: false, long: `重击来了！答对闪开，答错受到 ${2 * A} 点伤害。` };
    case 'shield': return { icon: '🛡', short: `🛡 ${s.shieldVal}`, grey: false, long: `怪物想开护盾！答对就能破盾，答错它会挡掉你下一击的 ${s.shieldVal} 点伤害。` };
  }
}

/* ---- 技能：每个角色 1 个（小学 3–6 / 初一 / 高一同用；高一 6 选 3 冷却未做） ---- */
export interface Skill { name: string; cost: number; kind: 'attack' | 'guard'; desc: string; mult?: number; hits?: number; hitMult?: number; pierce?: boolean; hurt?: number }
export const SKILLS: Record<string, Skill> = {
  数学: { name: '数字风暴', cost: 3, kind: 'attack', desc: '我方回合：答对伤害 ×1.5', mult: 1.5 },
  英语: { name: 'Echo 回声', cost: 3, kind: 'attack', desc: '我方回合：答对攻击 2 次，每次 70%', hits: 2, hitMult: 0.7 },
  化学: { name: '炼金爆裂', cost: 4, kind: 'attack', desc: '我方回合：答对伤害 ×1.8，无视护盾', mult: 1.8, pierce: true },
  语文: { name: '墨韵护体', cost: 3, kind: 'guard', desc: '对方回合：本次答错只受 50%', hurt: 0.5 },
  诗词: { name: '月下吟', cost: 2, kind: 'guard', desc: '对方回合：本次答错只受 50%', hurt: 0.5 },
};
export const skillOf = (c: Character) => SKILLS[c.major];
export const canUseSkill = (s: RState, sk: Skill | undefined) => !!sk && !s.over && s.energy >= sk.cost && (sk.kind === 'attack' ? s.side === 'P' : s.side === 'M');

export interface RInput {
  correct: boolean; partial?: boolean; subject: string; difficulty: number;
  fast?: boolean;          // 对方回合用时 ≤ 时限一半
  card?: CardKind; wager?: Wager; skill?: boolean;
  rng?: () => number;      // 闪避判定
  stepIndex?: number;      // 多步题第几小问（0 起）；仅我方回合
  simSkillMult?: number;   // 模拟专用：通用技能倍率
}
export interface ROut { side: Side; intent?: MIntent; dealt: number; hits: number[]; taken: number; dodged: boolean; perfect: boolean; healed: number;
  energyGain: number; refund: number; skillUsed: boolean; brokeCharge: boolean; brokeShield: boolean; gotShield: boolean; review: boolean; text: string }

export function calcD(s: RState, c: Character, i: RInput) {
  const card = CARDS[i.card ?? 'std'];
  let d = s.atk * (DIFF_MULT[i.difficulty] ?? 1) * comboMult(s.combo) * (i.subject === c.major ? AFFINITY : 1) * (1 + FOCUS_DMG * s.focus)
    * (weakOf(s) === i.subject ? WEAK : 1) * card.out * (i.wager === 'sure' ? WAGER.sureOut : 1) * (i.simSkillMult ?? 1);
  if (PASSIVE.mathBonus(c) && i.subject === '数学') d *= 1.1;
  if (i.stepIndex != null) d *= MULTI_STEP[Math.min(i.stepIndex, MULTI_STEP.length - 1)];
  return d;
}
const r1 = (x: number) => Math.max(1, Math.round(x));
function hit(s: RState, d: number, pierce = false) {
  const ab = pierce ? 0 : Math.min(s.shield, d);
  if (!pierce && s.shield) s.shield = 0;   // 护盾挡一次后清零（不叠加）
  const dealt = d - ab; s.monsterHp = Math.max(0, s.monsterHp - dealt); return dealt;
}

/** 结算一个回合（每回合 1 题）。多步题：每小问调一次，传 stepIndex，最后一小问或答错时 endTurn=true */
export function resolveRound(prev: RState, c: Character, i: RInput, endTurn = true): [RState, ROut] {
  const s: RState = { ...prev }; const rng = i.rng ?? Math.random;
  const o: ROut = { side: s.side, dealt: 0, hits: [], taken: 0, dodged: false, perfect: false, healed: 0, energyGain: 0, refund: 0, skillUsed: false, brokeCharge: false, brokeShield: false, gotShield: false, review: false, text: '' };
  const sk = i.skill ? skillOf(c) : undefined; const useSk = !!sk && canUseSkill(s, sk);
  if (useSk) { s.energy -= sk!.cost; o.skillUsed = true; }
  const ok = i.correct;
  if (ok) {
    s.combo++; const g = 1 + (s.combo === 3 ? 1 : 0); o.energyGain = Math.min(ENERGY_CAP, s.energy + g) - s.energy; s.energy += o.energyGain;
    if (PASSIVE.heal(c)) { const h = Math.min(3, s.playerMax - s.playerHp); s.playerHp += h; o.healed = h; }
  } else if (PASSIVE.comboGuard(c) && !s.comboGuardUsed && s.combo > 0) s.comboGuardUsed = true; else s.combo = 0;
  const hurtMult = (...m: number[]) => Math.min(HURT_CAP, m.reduce((a, b) => a * b, 1));
  if (s.side === 'P') {
    const card = CARDS[i.card ?? 'std'];
    if (ok) {
      const base = calcD(s, c, i) * (i.partial ? 0.5 : 1);
      if (useSk && sk!.hits) { for (let k = 0; k < sk!.hits; k++) { const d = hit(s, r1(base * sk!.hitMult!)); o.hits.push(d); o.dealt += d; } }
      else { const d = hit(s, r1(base * (useSk ? sk!.mult ?? 1 : 1)), useSk && sk!.pierce); o.hits.push(d); o.dealt = d; }
      o.text = o.dealt ? `⚔ 攻击命中！` : '⚔ 被护盾挡住了';
    } else {
      if (useSk) { o.refund = Math.floor(sk!.cost / 2); s.energy = Math.min(ENERGY_CAP, s.energy + o.refund); }
      const dodge = i.wager === 'sure' ? 0 : Math.min(DODGE_CAP, s.baseDodge + DODGE_PER_FOCUS * s.focus + Math.min(DODGE_BONUS_CAP, 0));
      if (rng() < dodge) { o.dodged = true; o.text = '运气好闪开了！'; }
      else {
        const m = hurtMult(i.stepIndex != null ? CARDS.heavy.ctr : card.ctr, i.wager === 'sure' ? WAGER.sureHurt : i.wager === 'unsure' ? WAGER.unsureCtr : 1);
        o.taken = r1(s.def.atk * m); o.text = '怪物反击！';
      }
      if (i.wager === 'unsure') o.review = true;
    }
    if (endTurn || !ok) s.focus = 0;   // 我方回合结束时专注清零
  } else {
    const it = nextIntent(s); o.intent = it; s.mi++;
    if (ok) {
      if (s.perfectOn && (i.fast || i.wager === 'sure')) { o.perfect = true; s.focus = Math.min(FOCUS_MAX, s.focus + 1); }
      if (it === 'charge') { s.chargeBroken = true; o.brokeCharge = true; o.text = '⚡ 打断了蓄力！'; }
      else if (it === 'heavy') { s.chargeBroken = false; o.text = '💥 闪开了重击！'; }
      else if (it === 'shield') { o.brokeShield = true; o.text = '🛡 破盾成功！'; }
      else o.text = '闪避成功！';
      if (o.perfect) o.text = '完美闪避！' + o.text.replace('闪避成功！', '');
    } else {
      const m = hurtMult(i.wager === 'sure' ? WAGER.sureHurt : 1, useSk && sk!.hurt ? sk!.hurt : 1);
      if (it === 'atk') { o.taken = r1(s.def.atk * m); o.text = '被攻击了'; }
      else if (it === 'heavy') { o.taken = r1((s.chargeBroken ? s.def.atk : 2 * s.def.atk) * m); s.chargeBroken = false; o.text = '💥 被重击了'; }
      else if (it === 'charge') { s.chargeBroken = false; o.text = '⚡ 怪物蓄力成功，下次重击 ×2'; }
      else { s.shield = s.shieldVal; o.gotShield = true; o.text = `🛡 怪物开了护盾（挡 ${s.shieldVal}）`; }
      if (i.wager === 'unsure') o.review = true;
    }
  }
  s.playerHp = Math.max(s.noDeath ? 1 : 0, s.playerHp - o.taken);
  // Boss 半血后换循环：从下一个意图开始
  if (s.def.half && s.pattern !== s.def.half && s.monsterHp < s.monsterMax / 2) { s.pattern = s.def.half; s.mi = 0; }
  if (endTurn || !ok) {
    s.turn++;
    if (s.monsterHp <= 0) s.over = 'win';
    else if (s.playerHp <= 0) s.over = 'lose';
    else if (s.turn >= s.cap) s.over = 'retreat';
    s.side = s.side === 'P' ? 'M' : 'P';
  } else if (s.monsterHp <= 0) { s.turn++; s.over = 'win'; s.side = 'M'; }
  return [s, o];
}
/** 复活成功：回到 50% 血量，不计回合、不推进循环；之后如果已到上限则撤退 */
export function reviveRound(s: RState): RState {
  const n = { ...s, playerHp: Math.round(s.playerMax * REVIVE.hp), revived: true, over: null as RState['over'] };
  if (n.turn >= n.cap) n.over = 'retreat';
  return n;
}
export const roundsLeft = (s: RState) => s.cap - s.turn;
