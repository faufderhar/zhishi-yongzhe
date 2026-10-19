/* r16 D15：伤害加成摘要 / 明细只改显示；明细推出的数 = 实际伤害 */
import { describe, it, expect } from 'vitest';
import { newRound, resolveRound, estimateDealt, estimateInfo, type CardKind } from '../src/game/rounds';
import { SCIFI, PUPS } from '../src/game/characters';
import { SKILL_DATA } from '../src/game/skills.data';
import { summary, summaryText, detailLines, fmtX } from '../src/game/dmgText';
const asuan = SCIFI.find(c => c.id === 'asuan')!;
const st = (mode: 'h' | 'j', combo = 0, focus = 0, shield = 0) => ({ ...newRound(mode, 'normal', { level: 1 }), combo, focus, shield, monsterHp: 5000, monsterMax: 5000 });
const lastNum = (L: string[]) => Number(L.filter(l => /≈ \d+/.test(l)).pop()!.match(/≈ (\d+)/)![1]);
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe('D15 验收', () => {
  it('学霸那一击：主修 ×1.32 · 重击卡 ×1.6 · 押注 ×1.25 · 已到上限 ×1.8，明细最后 ≈ 93 = 实际', () => {
    let hit = null as null | { o: ReturnType<typeof resolveRound>[1] };
    for (const d of [1, 2, 3, 4, 5]) { const [, o] = resolveRound(st('h'), asuan, { correct: true, subject: '数学', difficulty: d, card: 'heavy', wager: true, noSkill: true }); if (o.dealt === 93) { hit = { o }; break; } }
    expect(hit).not.toBeNull(); const o = hit!.o;
    const s = summary(o.dmg)!; expect(summaryText(s)).toBe('主修 ×1.32 · 重击卡 ×1.6 · 押注 ×1.25 · 已到上限 ×1.8');
    const L = detailLines(o.dmg!, o.dealt, o.absorbed);
    expect(L).toContain('封顶加成：重击卡 ×1.6 · 押注 ×1.25 = ×2'); expect(L).toContain('已到上限，按 ×1.8 算');
    expect(lastNum(L)).toBe(93); expect(L[L.length - 1]).toMatch(/≈ 93$/);
    // 题卡预计伤害同一套
    expect(o.dmg!.diff).toBe(1.5); expect(o.dmg!.atk).toBe(26);
    const inp = { subject: '数学', difficulty: 4, card: 'heavy' as CardKind, wager: true };
    { expect(estimateDealt(st('h'), asuan, inp)).toBe(93); expect(summaryText(summary(estimateInfo(st('h'), asuan, inp))!)).toBe(summaryText(s)); }
  });
  it('随机 20 次命中（含技能、专注、连击、押注、挑战、多步、漏选、护盾）：明细推算和实际差 ≤1', () => {
    const chars = [...SCIFI, ...PUPS]; const subs = ['数学', '语文', '物理', '化学', '英语']; const sks = SKILL_DATA.filter(k => /^A/.test(k.effect));
    let n = 0;
    while (n < 20) {
      const c = chars[Math.floor(rnd() * chars.length)], mode = rnd() < 0.5 ? 'h' : 'j' as const;
      const s = st(mode, Math.floor(rnd() * 8), Math.floor(rnd() * 3), rnd() < 0.3 ? Math.floor(rnd() * 15) : 0);
      const partial = rnd() < 0.15, sk = !partial && rnd() < 0.3 ? sks[Math.floor(rnd() * sks.length)] : undefined;
      const i = { correct: true, partial, subject: subs[Math.floor(rnd() * subs.length)], difficulty: 1 + Math.floor(rnd() * 5), card: (['light', 'std', 'heavy'] as CardKind[])[Math.floor(rnd() * 3)], wager: !partial && rnd() < 0.4, challenge: mode === 'j' && rnd() < 0.3, stepIndex: rnd() < 0.2 ? Math.floor(rnd() * 3) : undefined, forceSkill: sk, noSkill: !sk, rng: () => 0.99 };
      const [, o] = resolveRound(s, c, i); if (!o.dealt || !o.dmg) continue; n++;
      const L = detailLines(o.dmg, o.dealt, o.absorbed);
      const est = Math.max(1, Math.round(o.dmg.base * o.dmg.innerUsed * (o.dmg.half ? 0.5 : 1)));
      expect(Math.abs(lastNum(L) - est)).toBeLessThanOrEqual(1);
      expect(Math.abs(o.dmg.per * o.dmg.hits - (o.dealt + (o.absorbed ?? 0)))).toBeLessThanOrEqual(1);
      if (o.absorbed) expect(L[L.length - 1]).toContain(`护盾挡掉 ${o.absorbed}`);
      // 外层 × 难度 × 攻击 = 基础
      expect(o.dmg.atk * o.dmg.diff * o.dmg.outer.reduce((a, [, m]) => a * m, 1)).toBeCloseTo(o.dmg.base, 6);
    }
  });
  it('没有任何加成、没封顶 → 不显示第二行；多于 3 个 → 只留最大的 3 个 + 「等」', () => {
    const c = PUPS.find(x => x.major !== '数学')!;
    const [, o] = resolveRound(st('j'), c, { correct: true, subject: c.major === '语文' ? '英语' : '语文', difficulty: 2, card: 'std', noSkill: true });
    expect(summary(o.dmg)).toBeNull();
    const [, o2] = resolveRound(st('j', 5, 2), asuan, { correct: true, subject: '数学', difficulty: 3, card: 'heavy', wager: true, challenge: true, noSkill: true });
    const s = summary(o2.dmg)!; expect(s.items.length).toBe(3); expect(s.more).toBe(true); expect(summaryText(s)).toMatch(/ 等 · 已到上限 ×1\.8$/);
    expect(summary(o2.dmg, 1)!.items.length).toBe(1);
  });
  it('倍率两位小数、去掉末尾 0；加成名用中文', () => {
    expect(fmtX(1.6)).toBe('×1.6'); expect(fmtX(1.32)).toBe('×1.32'); expect(fmtX(2)).toBe('×2'); expect(fmtX(1.2 * 1.1)).toBe('×1.32');
    const [, o] = resolveRound(st('j', 3, 1), asuan, { correct: true, subject: '数学', difficulty: 3, card: 'light', challenge: true, stepIndex: 1, noSkill: true });
    const names = [...o.dmg!.outer, ...o.dmg!.inner].map(([n]) => n);
    for (const x of names) expect(['主修', '克制', '多步题', '连击', '专注', '轻击卡', '标准卡', '重击卡', '挑战题', '押注', '技能']).toContain(x);
  });
  it('双段技能：每段 ≈ per，共 2 段', () => {
    const a2h = SKILL_DATA.find(k => k.effect === 'A2H'); if (!a2h) return;
    const [, o] = resolveRound(st('h'), asuan, { correct: true, subject: '化学', difficulty: 3, card: 'std', forceSkill: a2h, rng: () => 0.99 });
    expect(o.dmg!.hits).toBe(2); expect(detailLines(o.dmg!, o.dealt).join('\n')).toContain('共 2 段'); expect(o.dmg!.per * 2).toBe(o.dealt);
  });
});
