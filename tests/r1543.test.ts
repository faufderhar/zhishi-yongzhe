/* r15.4.3 学霸复测 r15.4.2：①×1.8 封顶与「加成到顶」提示 ②押对能量 +2 ③押错反击 ×1.25 ⑤押注说明 ⑥初一预计伤害标「技能另算」 */
import { describe, it, expect } from 'vitest';
import { newRound, resolveRound, estimateDealt, calcParts, type CardKind } from '../src/game/rounds';
import { SCIFI } from '../src/game/characters';
import { SKILL_DATA } from '../src/game/skills.data';
import { INNER_CAP } from '../src/game/balance';
const asuan = SCIFI.find(c => c.id === 'asuan')!, bola = SCIFI.find(c => c.id === 'bola')!;
const storm = SKILL_DATA.find(k => k.name === '数字风暴' && k.seg === 'H')!;
const st = (combo: number, focus = 0, kind: 'normal' | 'elite' | 'boss' = 'normal') => ({ ...newRound('h', kind, { level: 1 }), combo, focus, monsterHp: 5000, monsterMax: 5000 });

describe('r15.4.3 ① ×1.8 封顶（学霸：预计 25 / 押注 31，实际 49）', () => {
  it('复现：阿算 连击 4、标准卡化学 d1 预计 25 / 押注 31；轻击卡数学 d1 押注 + 数字风暴 = 49，内层正好 ×1.8', () => {
    const s = st(4);
    expect(estimateDealt(s, asuan, { subject: '化学', difficulty: 1, card: 'std' })).toBe(25);
    expect(estimateDealt(s, asuan, { subject: '化学', difficulty: 1, card: 'std', wager: true })).toBe(31);
    expect(estimateDealt(s, asuan, { subject: '数学', difficulty: 1, card: 'light', wager: true })).toBe(37);   // 被点的那张卡自己的预计
    const [, o] = resolveRound(s, asuan, { correct: true, subject: '数学', difficulty: 1, card: 'light', wager: true, forceSkill: storm, rng: () => 0.99 });
    expect(o.dealt).toBe(49);
    expect(o.capped).toBe(true);
    // 外层 = 26 × 0.8（难度1）× 1.2（主修）× 1.1（阿算数学）= 27.456；内层 = 1.2（连击5）× 0.9（轻击 d1）× 1.25（押注）× 1.4（技能）= 1.89 → 封顶 1.8
    expect(o.capInfo!.raw).toBeCloseTo(1.89, 5); expect(o.capInfo!.used).toBe(1.8);
    expect(o.dealt).toBe(Math.round(26 * 0.8 * 1.2 * 1.1 * 1.8));
  });
  it('任意状态：伤害 ≤ 外层 × 1.8；capped 只在内层 × 技能 > 1.8 时出现', () => {
    let clipped = 0, notClipped = 0;
    for (const c of [asuan, bola]) for (const combo of [0, 1, 2, 3, 5, 8]) for (const focus of [0, 1, 2]) for (const card of ['light', 'std', 'heavy'] as CardKind[]) for (const d of [1, 2, 3, 4, 5]) for (const sub of ['数学', '化学', '语文']) for (const wager of [false, true]) for (const sk of [null, storm]) {
      const s = st(combo, focus); const i = { subject: sub, difficulty: d, card, wager };
      const [, o] = resolveRound(s, c, { ...i, correct: true, forceSkill: sk, rng: () => 0.99 });
      const { outer, inner } = calcParts({ ...s, combo: s.combo + 1 }, c, i);
      const m = sk ? 1.4 : 1;
      expect(o.dealt).toBeLessThanOrEqual(Math.max(1, Math.round(outer * INNER_CAP)));
      expect(!!o.capped).toBe(inner * m > INNER_CAP + 1e-9);
      if (o.capped) clipped++; else notClipped++;
      if (!o.capped) expect(o.capInfo).toBeUndefined();
    }
    expect(clipped).toBeGreaterThan(0); expect(notClipped).toBeGreaterThan(0);
  });
  it('第一下就到顶不矛盾：轻击 + 押注 + 连击不高时不会到顶', () => {
    const [, o] = resolveRound(st(0), asuan, { correct: true, subject: '数学', difficulty: 1, card: 'light', wager: true, forceSkill: storm, rng: () => 0.99 });
    expect(o.capped).toBeFalsy();   // 1 × 0.9 × 1.25 × 1.4 = 1.575
  });
});

describe('r15.4.3 ② 押对能量 = 基础 +1 + 押注额外 +1', () => {
  it('不押 +1，押 +2；开关写「能量额外 +1」', async () => {
    const s = st(0);
    const [, a] = resolveRound(s, bola, { correct: true, subject: '化学', difficulty: 2, card: 'std', noSkill: true });
    const [, b] = resolveRound(s, bola, { correct: true, subject: '化学', difficulty: 2, card: 'std', wager: true, noSkill: true });
    expect(a.energyGain).toBe(1); expect(b.energyGain).toBe(2); expect(b.bet).toBe(true); expect(a.bet).toBeUndefined();
    const src = (await import('node:fs')).readFileSync('src/ui/RoundBattle.tsx', 'utf8');
    expect(src).toContain("'押注：答对伤害 ×1.25，能量额外 +1；答错反击 ×1.25，且不能闪避'");
  });
});

describe('r15.4.3 ③ 押错反击 ×1.25 真的乘上了，结果写明', () => {
  it('意图 18：标准卡押错受到 23（18×1.25），轻击卡押错 18（18×0.8×1.25），重击卡 34（18×1.5×1.25）；不押标准 18', async () => {
    const { hurtNote } = await import('../src/ui/RoundBattle');
    const s = st(0);
    const go = (card: CardKind, wager: boolean) => resolveRound(s, bola, { correct: false, subject: '化学', difficulty: 2, card, wager, rng: () => 0.99 })[1];
    expect(s.def.atk).toBe(18);
    const sb = go('std', true), lb = go('light', true), hb = go('heavy', true), sn = go('std', false);
    expect([sb.taken, lb.taken, hb.taken, sn.taken]).toEqual([23, 18, 34, 18]);
    expect(sb.text).toContain('押注失手：反击 ×1.25'); expect(lb.text).toContain('押注失手：反击 ×1.25');
    expect(hurtNote(lb)).toBe('（18 × 轻击卡 ×0.8 × 押注 ×1.25 = 18）');
    expect(hurtNote(sb)).toBe('（18 × 押注 ×1.25 = 23）');
    expect(hurtNote(hb)).toBe('（18 × 重击卡 ×1.5 × 押注 ×1.25 = 34）');
    expect(hurtNote(sn)).toBe('');
    // 押注不能闪避：rng 再小也不闪
    const [, d] = resolveRound(s, bola, { correct: false, subject: '化学', difficulty: 2, card: 'std', wager: true, rng: () => 0 });
    expect(d.dodged).toBe(false); expect(d.taken).toBe(23);
  });
});

describe('r15.4.3 ⑤ 押注说明弹窗', () => {
  it('弹窗点〔知道了〕才记看过（不再是显示那一刻就记）', async () => {
    const src = (await import('node:fs')).readFileSync('src/ui/RoundBattle.tsx', 'utf8');
    expect(src).toMatch(/const closeBetHint = \(\) => \{ setBetHint\(false\); markTip\('betHint'\); \}/);
    expect(src).not.toMatch(/setBetHint\(true\); markTip\('betHint'\)/);
    expect(src).toContain('data-testid="bet-hint-ok"');
  });
});

describe('r15.4.3 ④ 押注开关每回合重新选（行为不变，写明）', () => {
  it('开关旁、说明弹窗、？规则都有「每回合重新选」', async () => {
    const { BET_RESET, BET_HINT_LINES } = await import('../src/ui/RoundBattle');
    const { rulesFor } = await import('../src/ui/rules');
    expect(BET_RESET).toBe('每回合重新选');
    expect(BET_HINT_LINES.join('')).toContain('每回合重新选');
    expect(rulesFor('h').find(r => r[0] === '押注')![1]).toContain('每回合重新选');
    const src = (await import('node:fs')).readFileSync('src/ui/RoundBattle.tsx', 'utf8');
    expect(src).toMatch(/setCard\('std'\); setWager\(false\)/);   // 每回合仍自动回到关
  });
});
