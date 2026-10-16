/* r8：多选题出题规则、共用怪物池的 Boss 名前缀 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBank, type Question } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
import { newRound, resolveRound } from '../src/game/rounds';
import { PUPS } from '../src/game/characters';
import { pickWithMulti, multiRule, isMultiSel } from '../src/game/multi';
import { pickByTier, newTier } from '../src/game/consolidate';
import { skinFor } from '../src/game/monsterSkin';
const bank = (g: string) => loadBank(JSON.parse(readFileSync(new URL(`../public/banks/bank_${g}.json`, import.meta.url), 'utf8')), `bank_${g}.json`).all.filter(q => q.status === 'AI初审通过' || q.status === '已通过');
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
/** 按 RoundBattle 的回合逻辑模拟一局：每回合 1 题，题池用完后复用已答题 */
function run(band: string, pool0: Question[], acc: number) {
  let s = newRound(band === 'H' ? 'h' : 'j', 'normal'); let pool = [...pool0]; let used: Question[] = []; let multi = 0; const bad: string[] = [];
  const tier = newTier(2); const c = PUPS.find(x => x.major === '数学')!;
  for (let k = 0; k < 40 && !s.over; k++) {
    if (!pool.length) { pool = used; used = []; }
    const ctx = { band, side: s.side as 'P' | 'M', turn: s.turn + 1, used: multi, poolHas: pool0.some(isMultiSel) };
    let q = pickWithMulti(pool, ctx, xs => pickByTier(xs, tier));
    if (!q) { pool = [...pool, ...used]; used = []; q = pickWithMulti(pool, ctx, xs => pickByTier(xs, tier))!; }
    if (isMultiSel(q)) { multi++; if (ctx.side !== 'P') bad.push('对方回合出了多选'); if (ctx.turn === 1) bad.push('第 1 回合出了多选'); }
    pool = pool.filter(x => x.key !== q.key); used.push(q);
    s = resolveRound(s, c, { correct: rnd() < acc, subject: q.subject, difficulty: q.difficulty, rng: rnd, noSkill: true })[0];
  }
  return { multi, bad };
}
describe('r8 多选规则', () => {
  const lv = buildChapters(bank('7')).find(c => c.subject === '历史')!.levels[0];
  const by = new Map(bank('7').map(q => [q.key, q])); const pool = lv.pool.map(k => by.get(k)!);
  it('初一历史第 1 关题池里有多选题', () => { expect(pool.filter(isMultiSel).length).toBeGreaterThanOrEqual(1); });
  it('初一历史第 1 关模拟 2000 局（正确率 30%–100%）：每局 1–2 道多选，只在我方回合、不在第 1 回合', () => {
    for (let i = 0; i < 2000; i++) { const r = run('J', pool, 0.3 + 0.7 * (i % 8) / 7); expect(r.bad).toEqual([]); expect(r.multi).toBeGreaterThanOrEqual(1); expect(r.multi).toBeLessThanOrEqual(2); }
  });
  it('多选优先于「最接近难度」：难度差很远也会出', () => {
    const far = { ...pool.find(isMultiSel)!, difficulty: 5 }; const near = pool.filter(q => !isMultiSel(q)).map(q => ({ ...q, difficulty: 2 }));
    const q = pickWithMulti([...near, far], { band: 'J', side: 'P', turn: 3, used: 0, poolHas: true }, xs => pickByTier(xs, newTier(2)));
    expect(q).toBe(far);
  });
  it('小学 / 幼儿园不出；第 1 回合、对方回合不出；满 2 道不再出', () => {
    for (const band of ['K', 'G1', 'G2', 'G3']) expect(multiRule({ band, side: 'P', turn: 3, used: 0, poolHas: true }).allow).toBe(false);
    expect(multiRule({ band: 'H', side: 'P', turn: 1, used: 0, poolHas: true }).allow).toBe(false);
    expect(multiRule({ band: 'H', side: 'M', turn: 2, used: 0, poolHas: true }).allow).toBe(false);
    expect(multiRule({ band: 'H', side: 'P', turn: 5, used: 2, poolHas: true }).allow).toBe(false);
    expect(multiRule({ band: 'H', side: 'P', turn: 3, used: 0, poolHas: true }).force).toBe(true);
  });
});
describe('r8 共用怪物池的 Boss 名加学科前缀', () => {
  it('历史/地理、科学/化学、道法/政治、语文/诗词 Boss 名带前缀；数学、物理不带', () => {
    expect(skinFor('历史', 'boss')!.name).toBe('历史·化石地球仪巨人');
    expect(skinFor('地理', 'boss')!.name).toBe('地理·化石地球仪巨人');
    expect(skinFor('政治', 'boss')!.name).toMatch(/^政治·/); expect(skinFor('化学', 'boss')!.name).toMatch(/^化学·/);
    expect(skinFor('数学', 'boss')!.name).toBe('圆周率国王'); expect(skinFor('物理', 'boss')!.name).not.toMatch(/·/);
    expect(skinFor('历史', 'normal')!.name).not.toMatch(/·/);
  });
});
