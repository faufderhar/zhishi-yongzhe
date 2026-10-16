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

describe('r15 小萌新：K–2 同题干变体也不连着出', () => {
  it('noAdjacent 按题干', async () => {
    const { noAdjacent, stemOf } = await import('../src/game/adaptive');
    const L = [{ key: 'a1', question: '数一数，有几个草莓？' }, { key: 'a2', question: '数一数，有几个草莓？' }, { key: 'b', question: '1+1=?' }, { key: 'a3', question: '数一数，有几个草莓？' }, { key: 'c', question: '2+1=?' }];
    const r = noAdjacent(L);
    for (let i = 1; i < r.length; i++) expect(stemOf(r[i])).not.toBe(stemOf(r[i - 1]));
    expect(r.length).toBe(5);
  });
});

describe('r15.1 小萌新：K–2 全部课时，规范化题干不连着出', () => {
  it('所有课时随机 30 次', async () => {
    const fs = await import('node:fs');
    const { noAdjacent, stemOf } = await import('../src/game/adaptive');
    let lessons = 0, bad: string[] = [];
    for (const f of ['bank_K1', 'bank_1', 'bank_2']) {
      const qs = JSON.parse(fs.readFileSync(`public/banks/${f}.json`, 'utf8')).questions as { id: string; unit: string; question: string }[];
      const by = new Map<string, { key: string; question: string }[]>();
      for (const q of qs) { const k = q.unit; by.set(k, [...(by.get(k) ?? []), { key: q.id, question: q.question }]); }
      for (const [u, list] of by) { lessons++;
        const cnt = new Map<string, number>(); list.forEach(x => cnt.set(stemOf(x), (cnt.get(stemOf(x)) ?? 0) + 1));
        for (let r = 0; r < 30; r++) {
          const n = Math.min(list.length, 8); const pick = [...list].sort(() => Math.random() - .5).slice(0, n);
          const c2 = new Map<string, number>(); pick.forEach(x => c2.set(stemOf(x), (c2.get(stemOf(x)) ?? 0) + 1));
          if (Math.max(...c2.values()) > Math.ceil(n / 2)) continue;   // 数学上不可能
          const o = noAdjacent(pick);
          for (let i = 1; i < o.length; i++) if (stemOf(o[i]) === stemOf(o[i - 1])) { bad.push(`${f} ${u}: ${o[i].question}`); break; }
        }
      }
    }
    expect(lessons).toBeGreaterThan(20);
    expect(bad.slice(0, 5)).toEqual([]);
    expect(stemOf({ key: 'a', question: '数一数，有几个气球？🎈🎈' })).toBe(stemOf({ key: 'b', question: '数一数，有几个气球？🎈🎈🎈🎈🎈' }));
  });
});

describe('r15.1 策划：高一数学 Boss 按章改名换色', () => {
  it('5 章改名，其他章不变', async () => {
    const { skinFor } = await import('../src/game/monsterSkin');
    const n = (u: string) => skinFor('数学', 'boss', 'H', u);
    expect(n('必修第一册·第4章 指数与对数·第1节 指数')?.name).toBe('对数巨塔主');
    expect(n('必修第一册·第5章 函数概念与性质')?.name).toBe('奇偶双面王');
    expect(n('必修第一册·第6章 幂函数、指数函数和对数函数·第2节')?.name).toBe('指对双生龙');
    expect(n('第7章 三角函数')?.name).toBe('周期轮回将');
    expect(n('第8章 函数应用')?.name).toBe('零点潜行者');
    expect(n('第1章 集合')?.name).toBe('函数魔方帝');
    expect(n('第4章 指数与对数')?.hue).not.toBe(n('第5章 函数概念与性质')?.hue);
    expect(n('第4章 指数与对数')?.id).toBe(n('第1章 集合')?.id);
  });
});
