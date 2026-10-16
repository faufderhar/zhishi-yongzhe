import { test } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters, splitLesson } from '../src/game/levels';
import { isMultiSel } from '../src/game/multi';
test.skipIf(!process.env.RESPLIT)('resplit stats', () => {
  let changed = 0, total = 0, small = 0, renamed = 0, oldCnt = 0, newCnt = 0;
  for (const g of ['K1', '1', '2', '3', '4', '5', '6', '7', '10']) {
    const all = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all; const qs = playable(all, false);
    const lv = buildChapters(qs, null, all).flatMap(c => c.levels).filter(l => l.kind === 'normal' && l.lesson);
    const by = new Map(qs.map(q => [q.key, q])); const les = new Map<string, number>();
    for (const l of lv) les.set(l.lesson!, (les.get(l.lesson!) ?? 0) + l.pool.filter(k => !isMultiSel(by.get(k)!)).length);
    for (const [, n] of les) { const a = splitLesson(Array(n).fill(0), true).map(x => x.length), b = splitLesson(Array(n).fill(0)).map(x => x.length); oldCnt += a.length; newCnt += b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) changed++; small += a.filter(x => x < 6).length; }
    for (const l of lv) { total++; if ((l.aliases ?? []).some(a => a.includes('|N|'))) renamed++; }
    (globalThis as any).__x = 1;
  }
  console.log(`RESPLIT normal=${total} idChanged=${renamed} sizeChanged=${changed} old=${oldCnt} new=${newCnt} oldSmall(<6)=${small}`);
});
