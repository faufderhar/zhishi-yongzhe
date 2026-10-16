/* r12 学霸：整局 14 回合 + 复活，所有初一 / 高一关卡，题池够时 0 重复（题号 + 题干） */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBank, playable, type Question } from '../src/game/questions';
import { buildChapters, levelsOfUnit } from '../src/game/levels';
import { drawNext, normStem, unseen } from '../src/game/draw';
import { newTier, nextTier } from '../src/game/consolidate';
import { pickWithMulti, isMultiSel } from '../src/game/multi';
import { pickHarder } from '../src/game/harder';
test('14 回合 + 复活 0 重复', () => {
  let levels = 0, bad = 0, exhausted = 0;
  for (const [g, band] of [['7', 'J'], ['10', 'H']] as const) {
    const all = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all; const qs = playable(all, false); const by = new Map(qs.map(q => [q.key, q]));
    for (const ch of buildChapters(qs, null, all)) for (const l of ch.levels) {
      const keys = l.kind === 'boss' ? [...new Set(levelsOfUnit(ch.levels, l).flatMap(x => x.pool))] : l.pool;
      const reserve = keys.map(k => by.get(k)).filter((q): q is Question => !!q);
      const uniq = new Set(reserve.map(normStem)).size; levels++;
      for (let run = 0; run < 3; run++) {
        let pool = reserve.slice(0, 8), used: Question[] = [], tier = newTier(2), mu = 0, rep = false;
        const reveal = (q: Question) => { if (used.some(u => u.key === q.key || normStem(u) === normStem(q))) rep = true; pool = pool.filter(x => x.key !== q.key); used.push(q); };
        for (let turn = 1; turn <= 14; turn++) {
          if (!unseen(pool, used).length) { const f = unseen(reserve, used); if (f.length) pool = f; else { exhausted++; break; } }
          const P = turn % 2 === 1; const ctx = { band, side: (P ? 'P' : 'M') as 'P' | 'M', turn, used: mu, poolHas: reserve.some(isMultiSel) };
          const q = drawNext(pool, used, { pred: () => true, curated: new Set(), tier, multi: (xs, pk) => pickWithMulti(xs, ctx, pk) }).q!; if (isMultiSel(q)) mu++;
          const h = P && turn % 4 === 1 ? pickHarder({ cur: tier.tier, lesson: pool, prior: [], used: [...used, q], exclude: [q.key] }) : undefined;
          reveal(h ? h.q : q); tier = nextTier(tier, Math.random() < 0.75);
        }
        for (const q of unseen([...pool, ...reserve], used).slice(0, 3)) reveal(q);   // 复活 3 题
        if (rep && uniq >= 17) bad++;
      }
    }
  }
  console.log(`REPEAT levels=${levels} bad=${bad} exhausted=${exhausted}`);
  expect(bad).toBe(0);
}, 120000);
