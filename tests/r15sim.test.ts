/* r15 策划：题出完 → 每题最多 2 次（错题先），都出满 2 次 → 怪物提前撤退（正确率 ≥40% 通关，最多 1★）
   用真实题库（每关本课 + 同单元前面小节）和真实回合引擎模拟，输出每个年级的重复率与提前撤退率 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters, levelsOfUnit } from '../src/game/levels';
import { newRound, resolveRound, roundModeOf, type RState } from '../src/game/rounds';
import { refill } from '../src/game/draw';
import { bandOf } from '../src/game/grades';
import { PUPS } from '../src/game/characters';
function mk(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
export const R15: Record<string, { runs: number; asked: number; repeats: number; early: number; earlyClear: number }> = {};
describe('r15 题出完：每题最多 2 次 + 提前撤退', () => {
  for (const g of ['3', '4', '5', '6', '7']) it(`${g} 年级`, () => {
    const all = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all; const qs = playable(all, false); const by = new Map(qs.map(q => [q.key, q]));
    const mode = roundModeOf(bandOf(g as any))!; const R = mk(15); const st = R15[g] = { runs: 0, asked: 0, repeats: 0, early: 0, earlyClear: 0 };
    for (const ch of buildChapters(qs, null, all)) for (const l of ch.levels) {
      if (l.kind === 'boss' || l.redirect) continue;
      const idx = ch.levels.indexOf(l); const own = l.pool.map(k => by.get(k)!).filter(Boolean);
      const adj = ['语文', '诗词'].includes(ch.subject) ? [] : levelsOfUnit(ch.levels, l).filter(x => x.kind === 'normal' && !x.redirect && ch.levels.indexOf(x) < idx).reverse().map(x => x.pool.map(k => by.get(k)!).filter(q => q && !l.pool.includes(q.key)));
      for (let run = 0; run < 20; run++) {
        const c = PUPS[run % 5]; let s: RState = newRound(mode, l.kind as 'normal' | 'elite'); let pool = [...own]; let used: typeof own = []; const reps = new Map<string, number>(); const wrong = new Set<string>(); const count = new Map<string, number>(); let cor = 0, ans = 0, early = false;
        while (!s.over) {
          if (!pool.length) { const r = refill(used, own, adj, wrong, new Set(), reps); pool = r.pool; used = r.used; if (!pool.length) { early = true; break; } }
          const q = pool.shift()!; used.push(q); count.set(q.key, (count.get(q.key) ?? 0) + 1); ans++;
          const ok = R() < 0.75; if (ok) cor++; else wrong.add(q.key);
          [s] = resolveRound(s, c, { correct: ok, subject: c.major, difficulty: 2, fast: false, rng: R });
          if (s.over === 'lose') break;
        }
        for (const n of count.values()) expect(n).toBeLessThanOrEqual(2);
        st.runs++; st.asked += ans; st.repeats += [...count.values()].reduce((a, n) => a + n - 1, 0);
        if (early) { st.early++; if (cor / ans >= 0.4) st.earlyClear++; }
      }
    }
    console.log(`R15 ${g} 年级：${st.runs} 局，平均每局 ${(st.asked / st.runs).toFixed(1)} 题，重复 ${(st.repeats / st.runs).toFixed(2)} 道/局（${(100 * st.repeats / st.asked).toFixed(1)}%），提前撤退 ${(100 * st.early / st.runs).toFixed(1)}%（其中通关 ${st.early ? (100 * st.earlyClear / st.early).toFixed(0) : '-'}%）`);
  });
});
describe('r15 复习题间隔 / K–2 不连着出', async () => {
  const { spaceReviews, reviewAllowed, noAdjacent } = await import('../src/game/adaptive');
  it('前 2 题没有复习；每 4 题最多 1 道', () => {
    for (let k = 0; k < 200; k++) { const n = 4 + (k % 12); const list = Array.from({ length: n }, (_, i) => ({ key: 'q' + i, rev: (i * 7 + k) % 3 === 0 }));
      const out = spaceReviews(list, x => x.rev); const pos = out.map((x, i) => x.rev ? i : -1).filter(i => i >= 0);
      expect(pos.every(i => i >= 2)).toBe(true); for (let i = 1; i < pos.length; i++) expect(pos[i] - pos[i - 1]).toBeGreaterThanOrEqual(4);
      for (let i = 0; i + 4 <= out.length; i++) expect(out.slice(i, i + 4).filter(x => x.rev).length).toBeLessThanOrEqual(1); }
    expect(reviewAllowed(0, -1)).toBe(false); expect(reviewAllowed(2, -1)).toBe(true); expect(reviewAllowed(5, 2)).toBe(false); expect(reviewAllowed(6, 2)).toBe(true);
  });
  it('K–2：重复的题不连着出（只有 1 道题的关除外）', () => {
    for (let k = 0; k < 300; k++) { const m = 2 + (k % 4), n = 3 + (k % 8); const list = Array.from({ length: n }, (_, i) => ({ key: 'k' + ((i * (k + 1)) % m) }));
      const out = noAdjacent(list); expect(out.map(x => x.key).sort()).toEqual(list.map(x => x.key).sort());
      const cnt = Math.max(...[...new Set(list.map(x => x.key))].map(x => list.filter(y => y.key === x).length));
      if (cnt <= Math.ceil(n / 2)) for (let i = 1; i < out.length; i++) expect(out[i].key, JSON.stringify(out)).not.toBe(out[i - 1].key); }
  });
});
