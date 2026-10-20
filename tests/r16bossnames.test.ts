// r16 2e：Boss 名对照表（中班 v34 / 初二 v36 / 高一 v39 / 高二 v37）→ chapterBoss.gen.json（scripts/import-boss-names.py 生成，不手改）
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { boxPath, missing } from './boxSrc';
import { execFileSync } from 'node:child_process';
import { loadBank, playable } from '../src/game/questions';
import { computeVisibility, isHiddenBy } from '../src/game/visibility';
import { buildChapters } from '../src/game/levels';
import { chapterBoss, CHAPTER_BOSS } from '../src/game/monsterSkin';
import GEN from '../src/game/chapterBoss.gen.json';
const UNUSED = ['10|历史|必修下册|星球合唱家'];   // 纲要下第九单元可玩题不够 12 道，暂时没有 Boss 关
// 对照表 CSV 只在开发机的题库源目录里（CI 上没有）：缺了就跳过「重新生成再比对」，提交的 gen.json 本身照样检查
const BOSS_CSV = [...readFileSync('scripts/import-boss-names.py', 'utf8').matchAll(/'([^']+\.csv)'/g)].map(m => boxPath(`questions/${m[1]}`));
it('gen.json = 导入脚本输出（没被手改）', ({ skip }) => {
  const miss = missing(...BOSS_CSV);
  skip(miss.length > 0, `开发机题库源不在（CI）：缺 ${miss.join('、')}——不重新生成比对`);
  // r16.1：游戏用题库 v48（v48 在源头改了初二两个 Boss 名，gen.json 用 import-boss-names.py 重新生成）——源目录不是 v48 就不重新生成比对（以后的版本先导入再改这里）
  const ver = missing(boxPath('questions/src/VERSION')).length ? '' : readFileSync(boxPath('questions/src/VERSION'), 'utf8').trim();
  skip(!['v48'].includes(ver), `题库源是 ${ver}，gen.json 钉在 v48——不重新生成比对`);
  const before = readFileSync('src/game/chapterBoss.gen.json', 'utf8');
  execFileSync('python3', ['scripts/import-boss-names.py', boxPath('questions')]);
  expect(readFileSync('src/game/chapterBoss.gen.json', 'utf8')).toBe(before);
});
it('提交的 chapterBoss.gen.json：206 行，每行 7 列、名字非空', () => {
  expect((GEN as unknown[]).length).toBe(206);
  for (const r of GEN as unknown[][]) { expect(r.length).toBe(7); expect(String(r[4]).length).toBeGreaterThan(0); }
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
it('Boss 数（只算可见的科目 / 册别，第 10 步 visibility）：中班 23 / 初二 77 / 高二 75（v46 高二地理选必二第三节进游戏后整册可见，第三节并进第二章，Boss 数同 v45 题库；设计稿 26 / 107 / 89 含还没开 / 还没进题库的初二生物地理、高二物理；中班差 3 个待策划确认）', () => {
  const n = (g: string) => { const all0 = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all; const vis = computeVisibility(all0); const all = all0.filter(q => !isHiddenBy(vis, q)); return buildChapters(playable(all, false), null, all).flatMap(c => c.levels).filter(l => l.kind === 'boss').length; };
  expect([n('K2'), n('8'), n('11')]).toEqual([23, 107, 75]);   // r16.1 题库 v47：初二生物 14 + 地理 16 个章 Boss 开放 → 77 + 30 = 107（= 设计稿初二 107）
});
