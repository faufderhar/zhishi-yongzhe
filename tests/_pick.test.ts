// r11 题库难度影响评估：PICK_DIRS=dirA,dirB npx vitest run tests/_pick.test.ts
// 每个初一 / 高一关卡按真实题池模拟一局取题（drawNext，同 RoundBattle）：目标档 2/3/4，正确率 75%，题数≈模拟平均回合（普通 7 / 精英 13 / Boss 18）
import { test } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBank, playable, type Question } from '../src/game/questions';
import { buildChapters, levelsOfUnit, assignedBefore } from '../src/game/levels';
import { drawNext, normStem } from '../src/game/draw';
import { newTier, nextTier, isConsolidating } from '../src/game/consolidate';
import { pickWithMulti, isMultiSel } from '../src/game/multi';
import { pickHarder } from '../src/game/harder';
import { isBossOnly } from '../src/game/questions';
const TURNS = { normal: 7, elite: 13, boss: 18 } as const;
test.skipIf(!process.env.PICK_DIRS)('pick impact', () => {
  for (const dir of process.env.PICK_DIRS!.split(',')) for (const [g, band] of [['7', 'J'], ['10', 'H']] as const) {
    const all = loadBank(JSON.parse(readFileSync(`${dir}/bank_${g}.json`, 'utf8')), '').all; const qs = playable(all, false); const by = new Map(qs.map(q => [q.key, q]));
    const chs = buildChapters(qs, null, all);
    for (const base of [2, 3, 4]) {
      const st = { picks: 0, off: 0, up: 0, chalTurns: 0, chalNone: 0, heavyNone: 0, newNone: 0, rep: 0, levels: 0, repLevels: 0 };
      for (const ch of chs) for (const l of ch.levels) {
        const keys = l.kind === 'boss' ? [...new Set(levelsOfUnit(ch.levels, l).flatMap(x => x.pool))] : l.pool;
        const ts = new Set<string>(); const pool0 = keys.map(k => by.get(k)).filter((q): q is Question => !!q && !ts.has(normStem(q)) && !!ts.add(normStem(q)));
        const lk = new Set(l.pool); const prior0 = l.kind === 'boss' ? [] : [...assignedBefore(ch.levels, l)].filter(k => !lk.has(k)).map(k => by.get(k)).filter((q): q is Question => !!q && !isBossOnly(q));
        st.levels++; let lvRep = false;
        for (let run = 0; run < 20; run++) {
          let unused = [...pool0], used: Question[] = [], tier = newTier(base), multiUsed = 0;
          for (let turn = 1; turn <= TURNS[l.kind]; turn++) {
            const P = turn % 2 === 1;
            let recyc = false; if (!unused.length) { unused = used; used = []; recyc = true; }
            const ctx = { band, side: (P ? 'P' : 'M') as 'P' | 'M', turn, used: multiUsed, poolHas: pool0.some(isMultiSel) };
            const r = drawNext(unused, used, { pred: () => true, curated: new Set(), tier, multi: (xs, pk) => pickWithMulti(xs, ctx, pk) });
            const q = r.q!; if (r.repeat || recyc) { st.rep++; lvRep = true; } if (isMultiSel(q)) multiUsed++;
            st.picks++; if (q.difficulty !== tier.tier) st.off++; if (isConsolidating(tier) && q.difficulty > tier.tier) st.up++;
            unused = unused.filter(x => x.key !== q.key); used.push(q);
            if (P && band === 'J') { st.chalTurns++; const us = new Set(used.map(normStem)); if (q.difficulty >= 5 || !unused.some(x => x.unit === q.unit && x.subject === q.subject && x.difficulty === q.difficulty + 1 && !isMultiSel(x) && !us.has(normStem(x)))) st.chalNone++; }
            if (P && band === 'H') { st.chalTurns++; if (!unused.some(x => !isMultiSel(x) && x.difficulty > q.difficulty)) st.heavyNone++; }
            if (P) { const pr = prior0.filter(x => !used.some(u => u.key === x.key)); if (!pickHarder({ cur: tier.tier, lesson: unused, prior: pr, used, exclude: [q.key], subject: q.subject, skip: x => isMultiSel(x) })) st.newNone++; }
            tier = nextTier(tier, Math.random() < 0.75);
          }
        }
        if (lvRep) st.repLevels++;
      }
      const pc = (a: number, b: number) => (b ? (100 * a / b).toFixed(1) : '0') + '%';
      console.log(`PICK|${dir.split('/').pop()}|${band === 'J' ? '初一' : '高一'}|目标档${base}|偏离目标档 ${pc(st.off, st.picks)}|降档后反而更难 ${pc(st.up, st.picks)}|${band === 'J' ? `挑战题不可用 ${pc(st.chalNone, st.chalTurns)}` : `重击卡无更难题 ${pc(st.heavyNone, st.chalTurns)}`}|r12无更难题 ${pc(st.newNone, st.chalTurns)}|被迫重复 ${pc(st.rep, st.picks)}（${st.repLevels}/${st.levels} 关出现）`);
    }
  }
}, 600000);
