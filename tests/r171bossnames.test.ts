// r17.1 B3：Boss 名对照表全量导入（大班 v39 / 初三 v47 / 高三 v50；初二 v48 / 高二 v49；初一 / 高一策划 r17 按章起名）
//   + 初三新版 P-1（新章号）/ P-2（章号同、章名不同 → 导入报错）+「科目·」前缀只给通用名（初一高一章节Boss名_r17_说明 §5.3）
import { it, expect } from 'vitest';
import { readFileSync, mkdtempSync, readdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boxPath, missing } from './boxSrc';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters, shortUnit } from '../src/game/levels';
import { computeVisibility, isHiddenBy } from '../src/game/visibility';
import { chapterBoss, skinFor, CHAPTER_BOSS, BOSS_NAME } from '../src/game/monsterSkin';
import GEN from '../src/game/chapterBoss.gen.json';

const bank = (g: string) => loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all;
// 主色（第 6 列）由 monsterSkin 按学段 / 美术分配（导入后改写），这里不比
const row = (g: string, s: string, n: string) => { const r = (GEN as unknown[][]).find(r => r[0] === g && r[1] === s && r[4] === n); return r && [...r.slice(0, 5), 0, r[6]]; };

it('初三数学九上按新章号：第1章 反比例函数 = 双曲线秋千，第2章 一元二次方程 = 方程金钥匙（P-1）', () => {
  expect(row('9', '数学', '双曲线秋千')).toEqual(['9', '数学', '', '九上·第1章 反比例函数', '双曲线秋千', 0, '九年级上册']);
  expect(row('9', '数学', '方程金钥匙')).toEqual(['9', '数学', '', '九上·第2章 一元二次方程', '方程金钥匙', 0, '九年级上册']);
  const v = { grade: '9', volume: '九年级上册' };
  expect(chapterBoss(undefined, '数学', '第1章 反比例函数', v)?.name).toBe('双曲线秋千');
  expect(chapterBoss(undefined, '数学', '九上·第2章 一元二次方程·2.1 一元二次方程的概念', v)?.name).toBe('方程金钥匙');
});
it('9A 英语：U5 旋律八音盒（在用）、U6 色彩心情盒、U8 侦探放大镜；停用的「荧屏遥控器」不导入', () => {
  const v = { grade: '9', volume: '九年级上册' };
  expect(['9A Unit 5 Music speaks', '9A Unit 6 The art of the brush', '9A Unit 8 The world of literature'].map(u => chapterBoss(undefined, '英语', u, v)?.name)).toEqual(['旋律八音盒', '色彩心情盒', '侦探放大镜']);
  expect(CHAPTER_BOSS.some(r => r[4] === '荧屏遥控器')).toBe(false);
});
it('初三 / 高三 / 初二 / 高二：可见科目的每个章 Boss 都有对照表名字，同年级不重名', () => {
  for (const [g, band, n] of [['9', 'J', 33], ['12', 'H', 77], ['8', 'J', 107], ['11', 'H', 75]] as const) {
    const all0 = bank(g); const vis = computeVisibility(all0); const all = all0.filter(q => !isHiddenBy(vis, q));
    const names: string[] = []; const miss: string[] = [];
    for (const c of buildChapters(playable(all, false), null, all)) for (const l of c.levels.filter(l => l.kind === 'boss')) {
      const ctx = { grade: g, volume: l.volume }; const cb = chapterBoss(band, c.subject, l.unit, ctx);
      if (!cb) miss.push(`${c.subject}|${l.volume}|${l.unit}`); else { names.push(cb.name); expect(skinFor(c.subject, 'boss', band, l.unit, ctx)?.name).toBe(cb.name); }
    }
    expect(miss, g).toEqual([]); expect(names.length, g).toBe(n);
    expect(names.filter((x, i) => names.indexOf(x) !== i), g).toEqual([]);
  }
});
it('初一 / 高一 r17 按章起名 37 行：每行都能命中题库里的章（含现在不够 12 题、还没 Boss 关的章），章标题不被括号里的「·」截断', () => {
  const R17 = [['7', '初一', 15], ['10', '高一', 22]] as const;
  for (const [g, f, n] of R17) {
    const rows = CHAPTER_BOSS.filter(r => r[0] === g && r[6] !== undefined && readFileSync(`scripts/boss-names/${f}章节Boss名_r17.csv`, 'utf8').includes(`,${r[4]},`));
    expect(rows.length, f).toBe(n);
    const qs = bank(g);
    for (const r of rows) expect(qs.some(q => q.subject === r[1] && q.volume === r[6] && chapterBoss(undefined, r[1], q.unit, { grade: g, volume: q.volume })?.name === r[4]), `${g} ${r[1]} ${r[3]} ${r[4]}`).toBe(true);
  }
  expect(shortUnit('七上·基础积累（字词·病句）')).toBe('基础积累（字词·病句）');
  expect(shortUnit('拓展（课外·毛泽东诗词）')).toBe('拓展（课外·毛泽东诗词）');
  expect(chapterBoss(undefined, '语文', '七上·基础积累（字词·病句）', { grade: '7', volume: '七年级上册' })?.name).toBe('字词小医生');
  expect(chapterBoss(undefined, '语文', '拓展（课外·毛泽东诗词）', { grade: '10', volume: '必修上册' })?.name).toBe('沁园雪梅仙');
});
it('「科目·」前缀只给通用名：按章起名的共用怪物池 Boss 不加，退回通用名时照旧加', () => {
  const named = skinFor('历史', 'boss', 'H', '纲要上·第六单元 辛亥革命与中华民国的建立', { grade: '10', volume: '必修上册' })!;
  expect(named.name).toBe('共和晨钟');
  expect(skinFor('地理', 'boss', 'H', '第一章 宇宙中的地球', { grade: '10', volume: '必修第一册' })!.name).toBe('宇宙星轨使');
  const generic = skinFor('历史', 'boss', 'H', '没有这一章', { grade: '10', volume: '必修上册' })!;
  expect(Object.values(BOSS_NAME.H).map(n => `历史·${n}`)).toContain(generic.name);
  const g7 = skinFor('地理', 'boss', 'J', '没有这一章', { grade: '7', volume: '七年级上册' })!.name; expect(Object.values(BOSS_NAME.J).map(n => `地理·${n}`)).toContain(g7);
});
it('P-2：对照表还是旧章序（「九上·第1章 一元二次方程」）而题库已改新章序 → 导入报错退出，不写 gen.json', ({ skip }) => {
  const src = boxPath('questions'); const files = [...readFileSync('scripts/import-boss-names.py', 'utf8').matchAll(/'([^'/]+\.csv)'/g)].map(m => m[1]);
  skip(missing(...files.map(f => join(src, f))).length > 0, '开发机题库源不在（CI）');
  const tmp = mkdtempSync(join(tmpdir(), 'r171p2-'));
  try {
    for (const f of readdirSync(src).filter(f => f.endsWith('.csv'))) copyFileSync(join(src, f), join(tmp, f));
    const f9 = join(tmp, '初三Boss名对照_v47.csv'); const t = readFileSync(f9, 'utf8');
    expect(t).toContain('九上·第1章 反比例函数,双曲线秋千');
    writeFileSync(f9, t.replace('九上·第1章 反比例函数,双曲线秋千', '九上·第1章 一元二次方程,方程金钥匙').replace('九上·第2章 一元二次方程,方程金钥匙', '九上·第2章 反比例函数,双曲线秋千'));
    const before = readFileSync('src/game/chapterBoss.gen.json', 'utf8');
    const r = spawnSync('python3', ['scripts/import-boss-names.py', tmp], { encoding: 'utf8' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('「九上·第1章 一元二次方程」的章名和题库不一致（题库同章号是「反比例函数」）');
    expect(r.stderr).toContain('「九上·第2章 反比例函数」的章名和题库不一致（题库同章号是「一元二次方程」）');
    expect(readFileSync('src/game/chapterBoss.gen.json', 'utf8')).toBe(before);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
