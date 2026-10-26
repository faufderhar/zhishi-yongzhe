// r17.1（r16.1 延后项 g）D15 §6 倍率文案统一：只改显示；验收 §6.4
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newRound, resolveRound, estimateInfo } from '../src/game/rounds';
import { SCIFI, PUPS } from '../src/game/characters';
import { SKILL_DATA } from '../src/game/skills.data';
import { summary, summaryText, detailLines } from '../src/game/dmgText';
import { TIP_TEXT } from '../src/ui/rules';
import { fingerprint } from './r171d15gen';
const asuan = SCIFI.find(c => c.id === 'asuan')!, suan = PUPS.find(c => c.id === 'suansuan')!;
const st = (mode: 'h' | 'j', combo = 0, focus = 0) => ({ ...newRound(mode, 'normal', { level: 1 }), combo, focus, monsterHp: 5000, monsterMax: 5000 });

describe('r17.1 D15 §6', () => {
  it('数值没动：300 次结算的 dealt / 段 / 受伤 / per / base 和改前（3ed8339）完全相同', () => {
    expect(fingerprint()).toEqual(JSON.parse(readFileSync('tests/fixtures/r171_d15_fp.json', 'utf8')).fp);
  });
  it('学霸那一击：摘要「主修 ×1.2 · 重击卡 ×1.6 · 押注 ×1.25 等 · 已到上限 ×1.8」，明细不封顶行分开写主修 / 被动，末行 ≈ 93', () => {
    const [, o] = resolveRound(st('h'), asuan, { correct: true, subject: '数学', difficulty: 4, card: 'heavy', wager: true, noSkill: true });
    expect(o.dealt).toBe(93);
    expect(summaryText(summary(o.dmg)!)).toBe('主修 ×1.2 · 重击卡 ×1.6 · 押注 ×1.25 等 · 已到上限 ×1.8');
    const L = detailLines(o.dmg!, o.dealt);
    expect(L[1]).toMatch(/^不封顶加成：主修 ×1\.2 · 被动「阿算」×1\.1 → 基础/);
    expect(L[L.length - 1]).toMatch(/≈ 93$/);
    const [, o2] = resolveRound(st('j'), suan, { correct: true, subject: '数学', difficulty: 3, card: 'std', noSkill: true });
    expect(summaryText(summary(o2.dmg)!)).toBe('主修 ×1.2 · 算算 ×1.1');
  });
  it('轻击卡是减益：「专注 ×1.25 · 连击 ×1.1 ｜ 减：轻击卡 ×0.85」，明细写来源（基础 ×0.8，难度 2 按 75% 生效）', () => {
    const c = PUPS.find(x => x.major === '语文')!;
    const [, o] = resolveRound(st('h', 2, 1), c, { correct: true, subject: '物理', difficulty: 2, card: 'light', noSkill: true });
    const s = summary(o.dmg)!; expect(summaryText(s)).toBe('专注 ×1.25 · 连击 ×1.1 ｜ 减：轻击卡 ×0.85');
    expect(s.neg.map(x => x.name)).toEqual(['轻击卡']);
    expect(detailLines(o.dmg!)).toContain('封顶加成：连击 ×1.1 · 专注 ×1.25；减：轻击卡 ×0.85（基础 ×0.8，难度 2 按 75% 生效） = ×1.17');
    const [, o3] = resolveRound(st('h'), c, { correct: true, subject: '物理', difficulty: 3, card: 'light', noSkill: true });
    expect(detailLines(o3.dmg!)[2]).toBe('封顶加成：减：轻击卡 ×0.8');   // 难度 ≥3 不写括号
    const [, oh] = resolveRound(st('h'), c, { correct: true, subject: '物理', difficulty: 1, card: 'heavy', noSkill: true });
    expect(detailLines(oh.dmg!)[2]).toBe('封顶加成：重击卡 ×1.3（基础 ×1.6，难度 1 按 50% 生效）');
  });
  it('漏选是减益：「减：漏选 ×0.5」', () => {
    const c = PUPS.find(x => x.major === '语文')!;
    const [, o] = resolveRound(st('h'), c, { correct: true, partial: true, subject: '物理', difficulty: 3, card: 'std', noSkill: true });
    expect(summaryText(summary(o.dmg)!)).toBe('减：漏选 ×0.5');
  });
  it('青莲剑歌：摘要没有 ×0.7 减益，单独一段「2 段×70%」；明细「每段 ×0.7（共 2 段）」+ 每段 × 2 段 = 合计 + 灰字说明', () => {
    const a2h = SKILL_DATA.find(k => k.effect === 'A2H')!;
    const c = PUPS.find(x => x.major === '语文')!;
    const [, o] = resolveRound(st('h'), c, { correct: true, subject: '物理', difficulty: 2, card: 'light', forceSkill: a2h, rng: () => 0.99 });
    const t = summaryText(summary(o.dmg)!);
    expect(t).toBe(`${a2h.name} 2 段×70% ｜ 减：轻击卡 ×0.85`); expect(t).not.toMatch(/×0\.[67]\b/);
    const L = detailLines(o.dmg!, o.dealt);
    expect(L[2]).toContain(`技能「${a2h.name}」每段 ×0.7（共 2 段）`);
    expect(L.find(l => /（每段）× 2 段 = \d+$/.test(l))).toBe("26 × ×0.6 ≈ 15（每段）× 2 段 = 30")   // §6.2 C 原例;
    expect(o.dmg!.per * 2).toBe(o.dealt);
    expect(L).toContain(`${a2h.name}：每段 70%，2 段合计约 140%，每段的倍率算在 ×1.8 上限里`);
  });
  it('题卡预计（estimateInfo）同一套写法；封顶提示改一个词', () => {
    expect(summaryText(summary(estimateInfo(st('h'), asuan, { subject: '数学', difficulty: 2, card: 'light' }))!)).toBe('主修 ×1.2 · 阿算 ×1.1 ｜ 减：轻击卡 ×0.85');
    expect(TIP_TEXT.cap).toContain('技能（多段技能按每段算）');
  });
  it('题卡卡面：第一行基础值，第二行「题越难效果越足 · 本题 ×…」；主修标签分开写', () => {
    const src = readFileSync('src/ui/RoundBattle.tsx', 'utf8');
    expect(src).toMatch(/伤害 ×\{CARDS\[k\]\.out\} · 答错反击 ×\{CARDS\[k\]\.ctr\}/);
    expect(src).toContain('题越难效果越足');
    expect(src).not.toContain('1.32');
  });
});
