// 初一 / 高一「必出多选」关卡清单：MULTI_OUT=<md> npx vitest run tests/_multi.test.ts
import { test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters, levelsOfUnit } from '../src/game/levels';
test.skipIf(!process.env.MULTI_OUT)('multi list', () => {
  const L: string[] = ['# 初一 / 高一 必出多选题的关卡清单', '', `生成：r11（题库 v19，public/banks）。规则（r8 策划）：初一 / 高一、本关题池里有多选题 → 每局至少 1 道、最多 2 道，只在我方回合、第 1 回合不出。`,
    '「本关多选数」= 本关题池里的多选题数（≥1 即必出）。Boss 关的题取整个单元，「单元多选数」是可能出到的数量；Boss 是否必出只看 Boss 自己题池里的多选数。', ''];
  for (const [g, gn] of [['7', '初一'], ['10', '高一']]) {
    const all = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`).all;
    const qs = playable(all, false); const by = new Map(qs.map(q => [q.key, q]));
    const isM = (k: string) => by.get(k)?.type === '多选';
    L.push(`## ${gn}`, '', '| 科目 | 章 | 关卡 | 类型 | 本关多选数 | 本关题数 | 单元多选数（Boss） |', '|---|---|---|---|---|---|---|');
    let n = 0;
    for (const ch of buildChapters(qs, null, all)) for (const l of ch.levels) {
      const m = l.pool.filter(isM).length;
      const um = l.kind === 'boss' ? [...new Set(levelsOfUnit(ch.levels, l).flatMap(x => x.pool))].filter(isM).length : 0;
      if (!m && !um) continue; if (m) n++;
      L.push(`| ${ch.subject} | ${l.unit ?? ''} | ${l.name} | ${l.kind === 'boss' ? 'Boss' : l.kind === 'elite' ? '精英' : '普通'} | ${m} | ${l.pool.length} | ${l.kind === 'boss' ? um : ''} |`);
    }
    L.push('', `${gn}必出多选的关卡：${n} 个`, '');
  }
  writeFileSync(process.env.MULTI_OUT!, L.join('\n'));
});
