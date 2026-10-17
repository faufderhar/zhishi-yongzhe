/* r15.4 技术QA P4-1：一局第一题在合格题里等概率随机（以前取列表里的第一个合格题，8 个新档案里 4 个首题相同） */
import { describe, it, expect } from 'vitest';
import { drawNext } from '../src/game/draw';
import { newTier } from '../src/game/consolidate';
const mk = (i: number, d: number) => ({ key: 'H7-' + i, question: '题' + i, difficulty: d });
const pool = [mk(1, 1), mk(2, 1), mk(3, 2), mk(4, 1), mk(5, 1), mk(6, 3), mk(7, 1)];
const opts = (first: boolean, seen = new Set<string>()) => ({ pred: () => true, curated: new Set(['H7-4', 'H7-1']), seen, tier: newTier(1), multi: (xs: typeof pool, pk: (ys: typeof pool) => typeof pool[0] | undefined) => pk(xs), first });
describe('r15.4 首题随机', () => {
  it('第一题：难度合格、没见过的 5 道题都能抽到，且大致均匀', () => {
    const cnt = new Map<string, number>(); for (let i = 0; i < 5000; i++) { const q = drawNext(pool, [], opts(true)).q!; cnt.set(q.key, (cnt.get(q.key) ?? 0) + 1); }
    expect([...cnt.keys()].sort()).toEqual(['H7-1', 'H7-2', 'H7-4', 'H7-5', 'H7-7']);
    for (const v of cnt.values()) { expect(v).toBeGreaterThan(800); expect(v).toBeLessThan(1200); }
  });
  it('第一题：见过的题不抽（还有没见过的时候）', () => {
    const seen = new Set(['H7-1', 'H7-2', 'H7-4']); for (let i = 0; i < 300; i++) expect(['H7-5', 'H7-7']).toContain(drawNext(pool, [], opts(true, seen)).q!.key);
  });
  it('后面的题照旧（确定的顺序，不受影响）', () => {
    const ks = new Set(Array.from({ length: 50 }, () => drawNext(pool, [], opts(false)).q!.key)); expect(ks.size).toBe(1);
  });
});
