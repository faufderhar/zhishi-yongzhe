// r16 R-13（/workspace/playtest/sim/R13_高一模拟.md §4）：Boss 两阶段弱点按年级 / 选科
import { it, expect } from 'vitest';
import { bossWeak, newRound, weakOf, calcD } from '../src/game/rounds';
import { ROUND, WEAK } from '../src/game/balance';
const phasesOf = (w: ReturnType<typeof bossWeak>) => newRound('h', 'boss', { weak: w }).def.phases!.map(p => p.weak);
it('高一（grade ≤ 10）任意科 Boss：弱点仍是数学 / 化学', () => {
  for (const s of ['语文', '历史', '物理', '数学']) { expect(bossWeak('10', s, { first: '物理', second: ['化学', '地理'] })).toBeNull(); expect(phasesOf(bossWeak('10', s))).toEqual(['数学', '化学']); }
  expect(bossWeak('7', '数学')).toBeNull(); expect(bossWeak('K2', '数数')).toBeNull(); expect(bossWeak(undefined, '数学')).toBeNull();
  expect(ROUND.h.monsters.boss.phases!.map(p => p.weak)).toEqual(['数学', '化学']);   // 共享定义没被改
});
it('高二选「物理 + 化学 + 地理」打地理 Boss：P1 = 地理，P2 = 物理（首选优先）', () => {
  const w = bossWeak('11', '地理', { first: '物理', second: ['化学', '地理'] }); expect(w).toEqual(['地理', '物理']); expect(phasesOf(w)).toEqual(['地理', '物理']);
  expect(bossWeak('11', '物理', { first: '物理', second: ['化学', '地理'] })).toEqual(['物理', '化学']);   // 本关 = 首选 → 再选第一个
  expect(bossWeak('11', '数学', { first: '历史', second: ['政治', '地理'] })).toEqual(['数学', '历史']);
  expect(bossWeak('11', '历史', { first: '历史' })).toEqual(['历史', '语文']);   // 只选了本关自己 → 语数英诗词
  expect(bossWeak('12', '化学', { first: '物理', second: ['化学', '生物'] })).toEqual(['化学', '物理']);
});
it('高二没选科：两阶段都没有弱点（不回落到数学 / 化学）', () => {
  for (const el of [undefined, null, {}, { second: [] }]) { const w = bossWeak('11', '地理', el); expect(w).toEqual([undefined, undefined]); expect(phasesOf(w)).toEqual([undefined, undefined]); }
  const s = newRound('h', 'boss', { weak: bossWeak('11', '数学') }); expect(weakOf(s)).toBeUndefined();
});
it('倍率不变：打中弱点 × 1.5，HP / 攻击不变', () => {
  expect(WEAK).toBe(1.5);
  const a = newRound('h', 'boss', { weak: ['地理', '物理'] }), b = newRound('h', 'boss');
  expect([a.monsterMax, a.def.atk, a.def.cap, a.def.phases!.map(p => p.hp)]).toEqual([b.monsterMax, b.def.atk, b.def.cap, b.def.phases!.map(p => p.hp)]);
  expect(typeof calcD).toBe('function');
});
