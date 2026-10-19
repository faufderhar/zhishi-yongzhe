// r16 2e：Boss 名对照表（中班 v34 / 初二 v36 / 高一 v39 / 高二 v37）→ chapterBoss.gen.json（scripts/import-boss-names.py 生成，不手改）
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
import { chapterBoss, CHAPTER_BOSS } from '../src/game/monsterSkin';
import GEN from '../src/game/chapterBoss.gen.json';
const UNUSED = ['10|历史|必修下册|星球合唱家'];   // 纲要下第九单元可玩题不够 12 道，暂时没有 Boss 关
it('gen.json = 导入脚本输出（没被手改）', () => {
  const before = readFileSync('src/game/chapterBoss.gen.json', 'utf8');
  execFileSync('python3', ['scripts/import-boss-names.py']);
  expect(readFileSync('src/game/chapterBoss.gen.json', 'utf8')).toBe(before);
  expect((GEN as unknown[]).length).toBe(206);
});
it('中班 / 初二 / 高二每个章节 Boss 都有对照表名字；对照表每行都用上；同年级不重名', () => {
  const used = new Set<string>();
  for (const g of ['K2', '8', '11', '10']) {
    const all = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all;
    const names: string[] = [];
    for (const c of buildChapters(playable(all, false), null, all)) for (const l of c.levels.filter(l => l.kind === 'boss')) {
      const n = chapterBoss(undefined, c.subject, l.unit, { grade: g, volume: l.volume })?.name;
      if (g !== '10') expect(n, `${g} ${c.subject} ${l.volume} ${l.unit}`).toBeTruthy();
      if (n) { names.push(n); const r = CHAPTER_BOSS.find(r => r[0] === g && r[4] === n); if (r?.[6]) used.add(`${g}|${r[1]}|${r[6]}|${n}`); }
    }
    expect(names.filter((n, i) => names.indexOf(n) !== i), `${g} 重名`).toEqual([]);
  }
  const rows = (GEN as string[][]).map(r => `${r[0]}|${r[1]}|${r[6]}|${r[4]}`);
  expect(rows.filter(r => !used.has(r))).toEqual(UNUSED);
});
it('Boss 数与对照表一致：中班 23 / 初二 77 / 高二 75（设计稿写 26 / 107 / 89：初二、高二差额是未开放 / 题库里没有的生物地理、物理；中班差 3 个待策划确认）', () => {
  const n = (g: string) => { const all = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all; return buildChapters(playable(all, false), null, all).flatMap(c => c.levels).filter(l => l.kind === 'boss').length; };
  expect([n('K2'), n('8'), n('11')]).toEqual([23, 77, 75]);
});
