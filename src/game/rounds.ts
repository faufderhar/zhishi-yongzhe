/* D6 轮流回合引擎（实现规格 v0.3.6）+ 角色技能随机释放（v0.3.7）。纯函数，UI 与模拟测试共用 */
import type { Character } from './characters';
import type { LevelKind, Band } from './grades';
import { ROUND, LOW_GRADE_PATTERN, DIFF_MULT, comboMult, DODGE_CAP, DODGE_PER_FOCUS, DODGE_BONUS_CAP, FOCUS_MAX, FOCUS_DMG, ENERGY_CAP,
  WEAK, AFFINITY, CARDS, cardOut, INNER_CAP, CHALLENGE, WAGER, HURT_CAP, MULTI_STEP, REVIVE, LEVEL_UP, SKILL, type RoundMode, type MIntent, type RoundMonster } from './balance';
import { passive as PASSIVE } from './characters';
import { roll, newRoll, tickCd, type SkillRoll, type SkillDef, type SkillSeg } from './skills';

export type Side = 'P' | 'M';
export type CardKind = keyof typeof CARDS;
export type Wager = 'sure' | 'unsure' | null;
export interface RState {
  mode: RoundMode; seg: SkillSeg; kind: LevelKind; def: RoundMonster; shieldVal: number; baseDodge: number; perfectOn: boolean;
  side: Side; turn: number; cap: number;
  playerHp: number; playerMax: number; atk: number;
  monsterHp: number; monsterMax: number; shield: number; chargeBroken: boolean; mi: number; pattern: MIntent[];
  /** 控制技能：把怪物下一个意图降级（不推进循环索引） */
  intentMod: MIntent | null;
  combo: number; focus: number; energy: number; comboGuardUsed: boolean;
  /** 护体：下一次受伤 ×0.7，不叠加 */
  guard: boolean; silenced: number; debuffs: number; sk: SkillRoll;
  over: null | 'win' | 'lose' | 'retreat'; revived: boolean; noDeath: boolean;
  /** D14：Boss 二阶段「怒」 */
  rage?: boolean;
}
/** 怪物当前攻击（二阶段 ×1.2 四舍五入）；r10：蓄力重击按基础攻击 ×2，不叠加怒气 */
export const monAtk = (s: RState) => s.rage && s.def.rage ? Math.round(s.def.atk * s.def.rage) : s.def.atk;
export const roundModeOf = (band: Band): RoundMode | null => band === 'G2' || band === 'G3' ? 'p36' : band === 'J' ? 'j' : band === 'H' ? 'h' : null;
const SEG_OF: Record<RoundMode, SkillSeg> = { p36: 'P36', j: 'J', h: 'H' };
export function newRound(mode: RoundMode, kind: LevelKind, opts: { lowGrade?: boolean; level?: number; noDeath?: boolean } = {}): RState {
  const S = ROUND[mode], def = S.monsters[kind], lv = Math.min(LEVEL_UP.max, Math.max(1, opts.level ?? 1)) - 1;
  const pattern = opts.lowGrade ? LOW_GRADE_PATTERN : def.pat;
  const hp = S.player.hp + lv * LEVEL_UP.hp;
  return { mode, seg: SEG_OF[mode], kind, def: opts.lowGrade ? { ...def, pat: LOW_GRADE_PATTERN, half: undefined } : def, shieldVal: S.shield, baseDodge: S.dodge, perfectOn: S.perfect,
    side: 'P', turn: 0, cap: def.cap, playerHp: hp, playerMax: hp, atk: S.player.atk + lv * LEVEL_UP.atk,
    monsterHp: def.hp, monsterMax: def.hp, shield: 0, chargeBroken: false, mi: 0, pattern, intentMod: null,
    combo: 0, focus: 0, energy: 0, comboGuardUsed: false, guard: false, silenced: 0, debuffs: 0, sk: newRoll(),
    over: null, revived: false, noDeath: !!opts.noDeath };
}
/** 下一个对方回合的意图（控制技能降级优先；Boss 半血后从下一个意图起换循环） */
export function nextIntent(s: RState): MIntent { return s.intentMod ?? s.pattern[s.mi % s.pattern.length]; }
export const baseIntent = (s: RState): MIntent => s.pattern[s.mi % s.pattern.length];
export const downgrade = (it: MIntent): MIntent => it === 'heavy' ? 'atk' : 'idle';
export const phaseOf = (s: RState) => s.def.phases && s.monsterHp <= s.def.phases[1].hp ? 1 : 0;
export const weakOf = (s: RState) => s.def.phases?.[phaseOf(s)].weak;
export function intentLabel(s: RState) {
  const it = nextIntent(s), A = monAtk(s), down = !!s.intentMod;
  const tag = down ? ' ↓' : '';
  switch (it) {
    case 'idle': return { icon: '💤', short: '💤 发呆' + tag, grey: true, down, long: '怪物被技能打乱了，下次对方回合它会发呆，不会攻击！' };
    case 'atk': return { icon: '⚔', short: `⚔ ${A}${tag}`, grey: down, down, long: down ? `重击被降级了，只剩普通攻击 ${A} 点。答对就能闪开。` : `怪物要攻击了！对方回合答对就能闪开，答错会受到 ${A} 点伤害。` };
    case 'charge': return { icon: '⚡', short: '⚡ 蓄力', grey: false, down, long: '怪物在蓄力，下次会放重击（×2）！这题答对能打断它。' };
    case 'heavy': return s.chargeBroken
      ? { icon: '💥', short: `💥 ${A}`, grey: true, down, long: `蓄力被你打断了，重击只剩 ${A} 点。` }
      : { icon: '💥', short: `💥 ${2 * s.def.atk}`, grey: false, down, long: `重击来了！答对闪开，答错受到 ${2 * s.def.atk} 点伤害。` };
    case 'shield': return { icon: '🛡', short: `🛡 要开盾`, grey: false, down, long: `怪物想开护盾！答对就能破盾，答错它会挡掉你下一击的 ${s.shieldVal} 点伤害。` };
  }
}

export interface RInput {
  correct: boolean; partial?: boolean; subject: string; difficulty: number;
  fast?: boolean;          // 对方回合用时 ≤ 时限一半
  card?: CardKind; wager?: Wager;
  rng?: () => number;      // 闪避判定 + 技能判定（可注入种子）
  stepIndex?: number;      // 多步题第几小问（0 起）；仅我方回合；技能只在第 0 小问判定
  forceSkill?: SkillDef | null; // 多步题后续小问沿用第一小问的技能
  noSkill?: boolean;       // 模拟专用：关闭随机技能
  simSkillMult?: number;   // 模拟专用：通用技能倍率
  challenge?: boolean;     // D14 初一挑战题：答对内层 ×1.5；答错不能闪避、反击 ×1.5
}
export interface ROut { side: Side; intent?: MIntent; dealt: number; hits: number[]; taken: number; dodged: boolean; perfect: boolean; healed: number;
  energyGain: number; skill: SkillDef | null; guardUsed: boolean; brokeCharge: boolean; brokeShield: boolean; gotShield: boolean; review: boolean; text: string; downgraded?: [MIntent, MIntent]; partial?: boolean; phaseShift?: boolean; capped?: boolean; rage?: boolean }

/** D14：返回外层伤害（固定倍率 / 高一押注、多步段倍率，不封顶）与内层倍率（连击×专注×题卡×挑战，技能另乘后统一封顶 ×1.8） */
export function calcParts(s: RState, c: Character, i: RInput) {
  const card = CARDS[i.card ?? 'std'];
  let outer = s.atk * (DIFF_MULT[i.difficulty] ?? 1) * (i.subject === c.major ? AFFINITY : 1) * (weakOf(s) === i.subject ? WEAK : 1) * (i.wager === 'sure' ? WAGER.sureOut : 1);
  if (PASSIVE.mathBonus(c) && i.subject === '数学') outer *= 1.1;
  if (i.stepIndex != null) outer *= MULTI_STEP[Math.min(i.stepIndex, MULTI_STEP.length - 1)];
  const inner = comboMult(s.combo) * (1 + FOCUS_DMG * s.focus) * cardOut(card.out, i.difficulty) * (i.challenge ? CHALLENGE.out : 1) * (i.simSkillMult ?? 1);
  return { outer, inner };
}
/** 无技能时的伤害（封顶后） */
export function calcD(s: RState, c: Character, i: RInput) { const { outer, inner } = calcParts(s, c, i); return outer * Math.min(INNER_CAP, inner); }
const r1 = (x: number) => Math.max(1, Math.round(x));
/** 命中：护盾依次抵扣（多段时剩余护盾留给下一段）；pierce 不扣护盾、护盾不变 */
function hit(s: RState, d: number, pierce = false, o?: ROut) {
  if (o?.phaseShift) return 0;   // 本击已打破第一阶段：同一次攻击的后续段不再结算
  const ab = pierce ? 0 : Math.min(s.shield, d);
  if (!pierce) s.shield -= ab;
  let dealt = d - ab;
  // 高一 Boss 两阶段（策划裁定 7）：第一阶段溢出伤害不带入第二阶段，第二阶段满 117 开始
  if (s.def.phases && phaseOf(s) === 0) { const floor = s.def.phases[1].hp; if (s.monsterHp - dealt <= floor) { dealt = s.monsterHp - floor; s.monsterHp = floor; if (o) o.phaseShift = true; s.shield = 0;
    // D14：Boss 怒了——换循环（从头开始），攻击 ×1.2
    if (s.def.half) { s.pattern = s.def.half; s.mi = 0; }
    if (s.def.rage) { s.rage = true; if (o) o.rage = true; }
    return dealt; } }
  s.monsterHp = Math.max(0, s.monsterHp - dealt); return dealt;
}

/** 结算一个回合（每回合 1 题）。多步题：每小问调一次，传 stepIndex，最后一小问或答错时 endTurn=true */
export function resolveRound(prev: RState, c: Character, i: RInput, endTurn = true): [RState, ROut] {
  const s: RState = { ...prev }; const rng = i.rng ?? Math.random;
  const o: ROut = { side: s.side, dealt: 0, hits: [], taken: 0, dodged: false, perfect: false, healed: 0, energyGain: 0, skill: null, guardUsed: false, brokeCharge: false, brokeShield: false, gotShield: false, review: false, text: '' };
  // 多选漏选（策划裁定 6）：不算答对；不判技能 / 完美闪避 / 专注 / 能量，连击不变
  const part = !!i.partial && i.correct; const ok = i.correct && !part; if (part) o.partial = true;
  if (ok) {
    s.combo++; const g = 1 + (s.combo === 3 ? 1 : 0); o.energyGain = Math.min(ENERGY_CAP, s.energy + g) - s.energy; s.energy += o.energyGain;
    if (PASSIVE.heal(c)) { const h = Math.min(3, s.playerMax - s.playerHp); s.playerHp += h; o.healed = h; }
  } else if (part) { /* 连击、能量不变 */ } else if (PASSIVE.comboGuard(c) && !s.comboGuardUsed && s.combo > 0) s.comboGuardUsed = true; else s.combo = 0;
  // 技能判定：能量 +1 之后；只有答对；多步题只在第一小问
  let sk: SkillDef | null = i.forceSkill ?? null;
  if (ok && !i.noSkill && i.forceSkill === undefined && (i.stepIndex ?? 0) === 0) {
    const [r, k] = roll(s.sk, { seg: s.seg, major: c.major, side: s.side, correct: true, energy: s.energy, silenced: s.silenced > 0, rng });
    s.sk = r; sk = k; if (k) s.energy = 0;
  }
  o.skill = ok ? sk : null;
  const hurtMult = (...m: number[]) => Math.min(HURT_CAP, m.reduce((a, b) => a * b, 1));
  const guardMult = () => s.guard ? SKILL.guardHurt : 1;
  const takeHurt = (base: number, ...m: number[]) => { const t = r1(base * hurtMult(...m, guardMult())); if (s.guard) { s.guard = false; o.guardUsed = true; } return t; };
  if (s.side === 'P') {
    const card = CARDS[i.card ?? 'std'];
    if (ok) {
      const { outer, inner } = calcParts(s, c, i);
      const e = sk?.effect;
      const capM = (m: number) => { if (inner * m > INNER_CAP + 1e-9) o.capped = true; return Math.min(INNER_CAP, inner * m); };
      if (e === 'A2H') { for (let k = 0; k < 2; k++) { const d = hit(s, r1(outer * capM(SKILL.atk.A2H)), false, o); o.hits.push(d); o.dealt += d; } }
      else { const m = e === 'A14' ? SKILL.atk.A14 : e === 'A13P' ? SKILL.atk.A13P : e === 'A125C' ? SKILL.atk.A125C : 1; const d = hit(s, r1(outer * capM(m)), e === 'A13P', o); o.hits.push(d); o.dealt = d; }
      if (e !== 'A13P' && o.hits.length) s.shield = 0;   // 护盾挡完这一击（或多段）后清零，不叠加
      if (e === 'A125C') s.combo++;                        // 连击 +1 在本次伤害计算之后
      o.text = o.dealt ? '⚔ 攻击命中！' : '⚔ 被护盾挡住了';
    } else if (part) {   // 我方回合漏选：50% 伤害，不反击
      const d = hit(s, r1(calcD(s, c, i) * 0.5), false, o); o.hits.push(d); o.dealt = d; s.shield = 0;
      o.text = '漏选：只造成一半伤害，怪物没有反击';
    } else {
      const dodge = i.wager === 'sure' || i.challenge ? 0 : Math.min(DODGE_CAP, s.baseDodge + DODGE_PER_FOCUS * s.focus + Math.min(DODGE_BONUS_CAP, 0));
      if (rng() < dodge) { o.dodged = true; o.text = '运气好闪开了！'; }
      else {
        o.taken = takeHurt(monAtk(s), i.stepIndex != null ? CARDS.heavy.ctr : card.ctr, i.wager === 'sure' ? WAGER.sureHurt : i.wager === 'unsure' ? WAGER.unsureCtr : 1, i.challenge ? CHALLENGE.ctr : 1);
        o.text = '怪物反击！';
      }
      if (i.wager === 'unsure') o.review = true;
    }
    if (endTurn || !ok) s.focus = 0;   // 我方回合结束时专注清零
  } else {
    const it = nextIntent(s); o.intent = it; s.mi++; s.intentMod = null;
    if (ok) {
      if (s.perfectOn && (i.fast || i.wager === 'sure')) { o.perfect = true; s.focus = Math.min(FOCUS_MAX, s.focus + 1); if (s.debuffs) s.debuffs--; }
      if (it === 'charge') { s.chargeBroken = true; o.brokeCharge = true; o.text = '⚡ 打断了蓄力！'; }
      else if (it === 'heavy') { s.chargeBroken = false; o.text = '💥 闪开了重击！'; }
      else if (it === 'shield') { o.brokeShield = true; o.text = '🛡 破盾成功！'; }
      else if (it === 'idle') o.text = '💤 怪物在发呆';
      else o.text = '闪避成功！';
      if (o.perfect) o.text = '完美闪避！' + o.text.replace('闪避成功！', '');
    } else {
      const m = (i.wager === 'sure' ? WAGER.sureHurt : 1) * (part ? 0.5 : 1);   // 对方回合漏选：按答错结算，受到伤害减半
      if (it === 'atk') { o.taken = takeHurt(monAtk(s), m); o.text = '被攻击了'; }
      else if (it === 'heavy') { o.taken = takeHurt(s.chargeBroken ? monAtk(s) : 2 * s.def.atk, m); s.chargeBroken = false; o.text = '💥 被重击了'; }
      else if (it === 'charge') { s.chargeBroken = false; o.text = '⚡ 怪物蓄力成功，下次重击 ×2'; }
      else if (it === 'shield') { s.shield = s.shieldVal; o.gotShield = true; o.text = `🛡 怪物开了护盾（挡 ${s.shieldVal}）`; }
      else o.text = '💤 怪物在发呆，没有攻击';
      if (i.wager === 'unsure') o.review = true;
      if (part) o.text = '漏选：' + o.text + (o.taken ? '（伤害减半）' : '');
    }
    // 守护池技能（对方回合答对后生效）
    if (ok && sk) {
      if (sk.effect === 'G70') s.guard = true;
      else if (sk.effect === 'H5') { const h = Math.min(Math.round(s.playerMax * SKILL.healPct), s.playerMax - s.playerHp); s.playerHp += h; o.healed += h; }
      else if (sk.effect === 'F1') { if (s.debuffs) s.debuffs--; s.silenced = 0; s.focus = Math.min(FOCUS_MAX, s.focus + 1); }
      else if (sk.effect === 'C') {
        const from = baseIntent(s), to = downgrade(from);
        if (from === 'charge') s.chargeBroken = true;   // ⚡ 取消后，后面的 💥 按「已打断」处理
        s.intentMod = to; o.downgraded = [from, to];
      }
    }
  }
  s.playerHp = Math.max(s.noDeath ? 1 : 0, s.playerHp - o.taken);
  // Boss 半血后换循环：从下一个意图开始（控制效果保留到新循环第一个意图）
  if (o.phaseShift) o.text += o.rage ? ' Boss 怒了！攻击变强，还换了招式' : ' 第一阶段被打破！进入第二阶段（满血 ' + s.monsterHp + '）';
  if (s.def.half && !s.def.phases && s.pattern !== s.def.half && s.monsterHp < s.monsterMax / 2) { s.pattern = s.def.half; s.mi = 0; }
  if (endTurn || !ok) {
    s.turn++; s.sk = tickCd(s.sk); if (s.silenced) s.silenced--;
    if (o.skill?.cd) s.sk = { ...s.sk, cd: { ...s.sk.cd, [o.skill.id]: o.skill.cd } };   // 本回合触发的冷却从下一回合起算
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
