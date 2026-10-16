import { test } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBank, playable, isBossOnly } from '../src/game/questions';
import { buildChapters, assignedBefore } from '../src/game/levels';
import { isMultiSel } from '../src/game/multi';
import { normStem } from '../src/game/draw';
test.skipIf(!process.env.LVC)('lv counts', () => {
  const all = loadBank(JSON.parse(readFileSync('public/banks/bank_7.json', 'utf8')), '').all; const qs = playable(all, false); const by = new Map(qs.map(q => [q.key, q]));
  for (const ch of buildChapters(qs, null, all)) for (const l of ch.levels.slice(0, 12)) {
    const p = l.pool.map(k => by.get(k)!).filter(Boolean); const lk = new Set(l.pool);
    const pr = [...assignedBefore(ch.levels, l)].filter(k => !lk.has(k)).map(k => by.get(k)!).filter(q => q && !isBossOnly(q) && !isMultiSel(q));
    const d = (xs: typeof p) => [1, 2, 3, 4, 5].map(i => xs.filter(q => q.difficulty === i).length).join('/');
    const nm = p.filter(q => !isMultiSel(q)); const stems = new Set(nm.map(normStem)).size;
    const ms = p.filter(q => isMultiSel(q)).map(q => q.question.slice(0, 14)).join('|');
    console.log(`${ch.subject}|${l.id}|${l.name}|${l.kind}|pool ${p.length}|非多选 d1-5 ${d(nm)}|去重题干 ${stems}/${nm.length}|前序 d1-5 ${d(pr)}|多选: ${ms}`);
  }
});
import { drawNext } from '../src/game/draw';
import { newTier, nextTier } from '../src/game/consolidate';
import { pickWithMulti } from '../src/game/multi';
import { pickHarder } from '../src/game/harder';
test.skipIf(!process.env.LVC)('harder per level', () => {
  const all = loadBank(JSON.parse(readFileSync('public/banks/bank_7.json', 'utf8')), '').all; const qs = playable(all, false); const by = new Map(qs.map(q => [q.key, q]));
  const ch = buildChapters(qs, null, all).find(c => c.subject === '数学')!;
  for (const l of ch.levels.slice(0, 9)) for (const base of [2, 3, 4]) {
    const pool0 = l.pool.map(k => by.get(k)!).filter(Boolean); const lk = new Set(l.pool);
    const prior0 = [...assignedBefore(ch.levels, l)].filter(k => !lk.has(k)).map(k => by.get(k)!).filter(q => q && !isBossOnly(q));
    let turns = 0, none = 0;
    for (let run = 0; run < 200; run++) { let unused = [...pool0]; const used: typeof pool0 = []; let tier = newTier(base);
      for (let t = 1; t <= 7; t += 2) { const q = drawNext(unused, used, { pred: () => true, curated: new Set(), tier, multi: (xs, pk) => pickWithMulti(xs, { band: 'J', side: 'P', turn: t, used: 0, poolHas: false }, pk) }).q; if (!q) break;
        turns++; if (!pickHarder({ cur: tier.tier, lesson: unused.filter(x => x !== q), prior: prior0.filter(x => !used.includes(x)), used, exclude: [q.key], subject: q.subject, skip: x => !!isMultiSel(x) })) none++;
        unused = unused.filter(x => x !== q); used.push(q); tier = nextTier(tier, Math.random() < 0.75); tier = nextTier(tier, Math.random() < 0.75); } }
    console.log(`H ${l.name} 目标${base} 无更难 ${(100 * none / turns).toFixed(0)}%`);
  }
});
