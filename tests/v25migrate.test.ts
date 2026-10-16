import { it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters, starOf, isUnlocked } from '../src/game/levels';
/* r15.1 题库 v25：初一 / 高一小节加题后平均分关变多，旧关卡的星星不丢、已打过的关仍解锁（需要 /tmp/v24 的旧题库） */
for (const g of ['7', '10']) it.skipIf(!existsSync(`/tmp/v24/bank_${g}.json`))(`v24 → v25 星星迁移 ${g}`, () => {
  const lv = (f: string) => { const all = loadBank(JSON.parse(readFileSync(f, 'utf8')), '').all; return buildChapters(playable(all, false), null, all); };
  const old = lv(`/tmp/v24/bank_${g}.json`), nw = lv(`public/banks/bank_${g}.json`);
  const stars: Record<string, number> = {}; for (const c of old) for (const l of c.levels) if (!l.redirect) stars[l.id] = 3;
  let lost = 0, oldN = 0, locked = 0; const newIds = nw.flatMap(c => c.levels);
  const covered = new Set(newIds.flatMap(l => [l.id, ...(l.aliases ?? [])]));
  for (const id of Object.keys(stars)) { oldN++; if (!covered.has(id)) lost++; }
  for (const c of nw) c.levels.forEach((l, i) => { if (starOf(l, stars) > 0 && !isUnlocked(c.levels, i, stars)) locked++; });
  console.log(`V25 ${g}: 旧关 ${oldN} → 新关 ${newIds.length}；没有对应的新关 ${lost}；有星却锁着 ${locked}`);
  expect(locked).toBe(0); expect(lost / oldN).toBeLessThan(0.02);
});
it('v30：需家长确认的题默认不出（打开「显示待审核题」才出），「五上·白鹭」照常成关', () => {
  const all = loadBank(JSON.parse(readFileSync('public/banks/bank_5.json', 'utf8')), '').all;
  const q = all.find(x => x.id === 'Y5-169')!; expect(q.status).toBe('需家长确认');
  expect(playable(all, false).some(x => x.id === 'Y5-169')).toBe(false);
  expect(playable(all, true).some(x => x.id === 'Y5-169')).toBe(true);
  const lv = buildChapters(playable(all, false), null, all).flatMap(c => c.levels).filter(l => l.lesson?.includes('白鹭') && !l.redirect && l.kind !== 'boss');
  expect(lv.length).toBeGreaterThan(0); expect(lv.reduce((a, l) => a + l.pool.length, 0)).toBeGreaterThanOrEqual(9);
});
