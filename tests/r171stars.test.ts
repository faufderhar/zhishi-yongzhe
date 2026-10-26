// r17.1 A2（学霸r16.1裁定_r17 §4.3 / r17-7）：整个初中段（初一 / 初二 / 初三）普通关 ★★★ = 八成 + 没复活 + 半血以上 + 至少答对 1 道挑战题；
// 挑战按钮整局都灰 → 不要求；精英 / Boss 不要求；判定 mode==='j'&&kind==='normal'，levelStars 逻辑不改。图例按年级段 + 关卡类型取一行。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { levelStars, chalCostStar, chalNeedOf, starRulesFor, STAR_RULES, STAR_RULES_ROUND, STAR_RULES_J_NORMAL, STAR_RULES_K, STAR_NOTE, CHAL_STAR_HINT } from '../src/game/levels';
import { roundModeOf } from '../src/game/rounds';
import { bandOf } from '../src/game/grades';
import { rulesFor } from '../src/ui/rules';

const run = (grade: string, kind: 'normal' | 'elite' | 'boss', o: { chalSeen?: boolean; chalRight?: number; correct?: number } = {}) => {
  const r = { win: true, correct: o.correct ?? 8, total: 10, revived: false, hpPct: 0.6, chalNeed: chalNeedOf(roundModeOf(bandOf(grade as never)), kind, o.chalSeen ?? true), chalRight: o.chalRight ?? 0 };
  return { stars: levelStars(r), hint: chalCostStar(r) };
};

describe('r17.1 初中普通关挑战题 3 星', () => {
  it('初三普通关 80% 没答对挑战题 → ★★ + 提示；答对 1 道 → ★★★；初一 / 初二同样', () => {
    for (const g of ['7', '8', '9']) {
      expect(run(g, 'normal')).toEqual({ stars: 2, hint: true });
      expect(run(g, 'normal', { chalRight: 1 })).toEqual({ stars: 3, hint: false });
    }
    expect(run('9', 'normal', { correct: 7, chalRight: 1 }).stars).toBe(2);   // 不到八成，挑战题也补不上
  });
  it('挑战按钮整局都灰（chalSeen=false）→ 不要求挑战题', () => {
    expect(run('9', 'normal', { chalSeen: false })).toEqual({ stars: 3, hint: false });
    expect(run('7', 'normal', { chalSeen: false })).toEqual({ stars: 3, hint: false });
  });
  it('精英 / Boss 不要求；小学、高中不要求', () => {
    for (const k of ['elite', 'boss'] as const) for (const g of ['7', '8', '9']) expect(run(g, k)).toEqual({ stars: 3, hint: false });
    for (const g of ['3', '6', '10', '11', '12']) expect(run(g, 'normal')).toEqual({ stars: 3, hint: false });
    expect(chalNeedOf('j', 'normal', true)).toBe(true); expect(chalNeedOf('h', 'normal', true)).toBe(false);
    expect(readFileSync('src/ui/RoundBattle.tsx', 'utf8')).toContain('chalNeed: chalNeedOf(mode, kind, chalSeen.current)');
  });
});
describe('r17-7 星级图例按年级段 + 关卡类型', () => {
  it('五行图例与裁定 §4.3 表格一致', () => {
    expect(starRulesFor('K')).toBe(STAR_RULES_K);
    expect(starRulesFor('G1')).toBe('⭐ 过关　⭐⭐ 答对六成　⭐⭐⭐ 答对八成'); expect(STAR_RULES).not.toMatch(/复活/);
    for (const b of ['G2', 'G3', 'H']) expect(starRulesFor(b, 'normal')).toBe('⭐ 过关　⭐⭐ 答对六成　⭐⭐⭐ 答对八成、没复活、剩一半血以上');
    expect(starRulesFor('J', 'normal')).toBe('⭐ 过关　⭐⭐ 答对六成　⭐⭐⭐ 答对八成、没复活、剩一半血以上，还要答对 1 道挑战题 🔥');
    expect(starRulesFor('J', 'elite')).toBe(STAR_RULES_ROUND); expect(starRulesFor('J', 'boss')).toBe(STAR_RULES_ROUND);   // 初一 Boss 不出挑战题图例
    expect(STAR_RULES_J_NORMAL).toContain('挑战题');
    expect(CHAL_STAR_HINT).toBe('其他条件都够 ⭐⭐⭐ 了，就差答对 1 道挑战题');
  });
  it('「?」规则页：复活 / 星星拆两条，星星 = 本段一行 + 补充说明；初中挑战题条写「初中普通关」', () => {
    const j = rulesFor('j', 'normal'), jb = rulesFor('j', 'boss'), h = rulesFor('h', 'normal');
    expect(j.map(r => r[0])).toEqual(expect.arrayContaining(['复活', '星星'])); expect(j.map(r => r[0])).not.toContain('复活和星星');
    expect(j.find(r => r[0] === '复活')![1]).toBe('血条空了可以挑战复活一次：最多 4 道题（本关没出过的新题优先）里答对 2 道，回到 50% 血量，不算回合。');
    expect(j.find(r => r[0] === '星星')![1]).toBe(`${STAR_RULES_J_NORMAL}。${STAR_NOTE}`);
    expect(jb.find(r => r[0] === '星星')![1]).toBe(`${STAR_RULES_ROUND}。${STAR_NOTE}`);
    expect(h.find(r => r[0] === '星星')![1].startsWith(STAR_RULES_ROUND)).toBe(true);
    expect(j.find(r => r[0] === '挑战题')![1]).toContain('初中普通关要拿 3 星，得至少答对一道挑战题（挑战按钮一直是灰的那关不算）。');
    expect(STAR_NOTE).toContain('复活过的关最多 ⭐⭐');
  });
  it('结算页 / 家长页用同一份', () => {
    expect(readFileSync('src/ui/Screens.tsx', 'utf8')).toContain('{starRulesFor(cfg.band, kind)}');
    const p = readFileSync('src/ui/Parent.tsx', 'utf8'); expect(p).toContain('report-star-rules"'); expect(p).toContain('{STAR_NOTE}');
  });
});
