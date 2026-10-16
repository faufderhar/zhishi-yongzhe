import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters, elitePool } from '../src/game/levels';
import { selectQuestions } from '../src/game/adaptive';
// r14.1 学霸：连续几局同一关——本档案历史上没答过的题出完之前，不会出上一局的题（含初一生物）
describe('连续重开同一关：历史没答过优先', () => {
  for (const subj of ['数学', '生物', '历史']) it(`初一 ${subj}`, () => {
    const all = loadBank(JSON.parse(readFileSync('public/banks/bank_7.json', 'utf8')), '').all; const qs = playable(all, false);
    const ch = buildChapters(qs, null, all).find(c => c.subject === subj); if (!ch) return;
    const by = new Map(qs.map(q => [q.key, q]));
    for (const l of ch.levels.filter(x => x.kind === 'normal' && !x.redirect).slice(0, 6)) {
      const pool = l.pool.map(k => by.get(k)!).filter(Boolean); const seen = new Set<string>(); const n = 6;
      for (let run = 0; run < 3; run++) {
        const rank = (q: { key: string }) => seen.has(q.key) ? 2 : 0;
        const unseenBefore = pool.filter(q => !seen.has(q.key)).length;
        const pref = elitePool(pool, [], seen, new Set(), n);
        const got = selectQuestions({ pool: pref, fallback: [...pool].sort((a, b) => rank(a) - rank(b)), rank, n, target: 2, kind: 'normal' });
        const repeats = got.filter(q => seen.has(q.key)).length;
        expect(repeats, `${l.name} 第 ${run + 1} 局`).toBe(Math.max(0, Math.min(n, got.length) - unseenBefore));
        got.forEach(q => seen.add(q.key));
      }
    }
  });
});
