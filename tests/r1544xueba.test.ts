/* r15.4.4 学霸：结果里每个倍率都写来源——押错反击「基础 18 × 轻击卡 ×0.8 × 押注 ×1.25 = 18」、对方回合受到的伤害、加成到顶「加成：连击… × 重击卡… × 押注… = ×2.63，已到上限，按 ×1.8 算」 */
import { describe, it, expect } from 'vitest';
import { newRound, resolveRound, innerParts, calcParts, type CardKind } from '../src/game/rounds';
import { SCIFI } from '../src/game/characters';
import { SKILL_DATA } from '../src/game/skills.data';
import { hurtNote, capNote } from '../src/ui/RoundBattle';
const asuan = SCIFI.find(c => c.id === 'asuan')!, bola = SCIFI.find(c => c.id === 'bola')!;
const storm = SKILL_DATA.find(k => k.name === '数字风暴' && k.seg === 'H')!;
const st = (combo: number, focus = 0) => ({ ...newRound('h', 'normal', { level: 1 }), combo, focus, monsterHp: 5000, monsterMax: 5000 });
const prod = (p: [string, number][]) => p.reduce((a, [, m]) => a * m, 1);
describe('加成到顶：逐项写来源，乘起来等于封顶前的倍率', () => {
  it('学霸复现那一下（阿算 连击 → 5、轻击 d1、押注、数字风暴）', () => {
    const [, o] = resolveRound(st(4), asuan, { correct: true, subject: '数学', difficulty: 1, card: 'light', wager: true, forceSkill: storm, rng: () => 0.99 });
    expect(o.capped).toBe(true);
    expect(capNote(o)).toBe('（加成：连击5 ×1.2 × 轻击卡 ×0.9 × 押注 ×1.25 × 技能「数字风暴」 ×1.4 = ×1.89，已到上限，按 ×1.8 算）');
  });
  it('真实战斗里的那一下（浏览器测试 r1543-xueba ①：高一、重击卡 + 押注 + 答对，连击 / 专注叠上去）：重击卡、押注都写出来', () => {
    let n = 0;
    for (const c of [asuan, bola]) for (const combo of [0, 1, 2, 3, 5, 8]) for (const focus of [0, 1, 2]) for (const card of ['light', 'std', 'heavy'] as CardKind[]) for (const d of [1, 3, 5]) for (const wager of [false, true]) for (const sk of [undefined, storm]) {
      const s = st(combo, focus); const i = { subject: '化学', difficulty: d, card, wager };
      const [, o] = resolveRound(s, c, { ...i, correct: true, forceSkill: sk, noSkill: !sk, rng: () => 0.99 });
      if (!o.capped) { expect(capNote(o)).toBe(''); continue; }
      n++; const p = o.capInfo!.parts!; expect(p.length).toBeGreaterThan(0);
      expect(prod(p)).toBeCloseTo(o.capInfo!.raw, 9);
      expect(p.every(([l, m]) => l && m !== 1)).toBe(true);
      const t = capNote(o); expect(t).toMatch(/^（加成：.+ = ×\d+\.\d\d，已到上限，按 ×1\.8 算）$/);
      if (card !== 'std') expect(t).toContain(card === 'heavy' ? '重击卡 ×' : '轻击卡 ×'); if (wager) expect(t).toContain('押注 ×1.25'); if (focus) expect(t).toContain(`专注${focus} ×`);
      // innerParts 和 calcParts 的内层一致（不含技能）
      expect(prod(innerParts({ ...s, combo: s.combo + 1 }, i))).toBeCloseTo(calcParts({ ...s, combo: s.combo + 1 }, c, i).inner, 9);
    }
    expect(n).toBeGreaterThan(20);
  });
});
describe('受到的伤害：基础 + 每个倍率的来源', () => {
  it('我方回合答错：轻击 / 押注 / 挑战 / 护体', () => {
    const s = st(0);
    const go = (card: CardKind, wager: boolean, challenge = false, guard = false) => resolveRound({ ...s, guard }, bola, { correct: false, subject: '化学', difficulty: 2, card, wager, challenge, rng: () => 0.99 })[1];
    expect(hurtNote(go('light', true))).toBe('（基础 18 × 轻击卡 ×0.8 × 押注 ×1.25 = 18）');
    const g = go('std', true, false, true); expect(hurtNote(g)).toBe(`（基础 18 × 押注 ×1.25 × 护体 ×0.7 = ${g.taken}）`);
    const ch = go('heavy', false, true); expect(hurtNote(ch)).toBe('（基础 18 × 重击卡 ×1.5 × 挑战 ×1.5，最多 ×2 = 36）');   // 反击倍率封顶 ×2 也写明
  });
  it('对方回合：蓄力重击 ×2、漏选减半、护体', () => {
    const s = { ...st(0), side: 'M' as const, pattern: ['heavy' as const], mi: 0, chargeBroken: false };
    const [, a] = resolveRound(s, bola, { correct: false, subject: '化学', difficulty: 2, rng: () => 0.99 });
    expect(a.taken).toBe(36); expect(hurtNote(a)).toBe('（基础 18 × 蓄力重击 ×2 = 36）');
    const [, b] = resolveRound({ ...s, guard: true }, bola, { correct: false, subject: '化学', difficulty: 2, rng: () => 0.99 });
    expect(hurtNote(b)).toBe(`（基础 18 × 蓄力重击 ×2 × 护体 ×0.7 = ${b.taken}）`);
    const [, c] = resolveRound({ ...s, pattern: ['atk' as const] }, bola, { correct: false, subject: '化学', difficulty: 2, rng: () => 0.99 });
    expect(c.taken).toBe(18); expect(hurtNote(c)).toBe('');   // 普通攻击没有额外倍率：不写
  });
});
