// r16.2 题库审核 章单元名含点号括号清单_v50（63 个）：题名本身带「·」（沁园春·长沙 / 清平乐·村居 / 汤姆·索亚历险记 / 大卫·科波菲尔 / 沁园春·雪）
// 在 r16.1 里仍被 shortUnit 按「·」截成最后一段。显示名（地图关卡卡片、单元标题、关卡页头、结算、中断提示）都来自 Level.name / Level.unit。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { shortUnit, chapterOf } from '../src/game/levels';
import { levelSnapshot } from './helpers/r162levels';

const rows = readFileSync('tests/fixtures/dot_names_v50.csv', 'utf8').trim().split('\n').slice(1).map(l => l.split(','));
// 63 个名字的期望显示名（关卡卡片 / 没有章号时的单元标题）：去掉册别、第X单元 / 章 / 节、专题、科目这些层级前缀后的完整题名
const EXPECT: Record<string, string> = {
  '四下·古诗词 清平乐·村居': '古诗词 清平乐·村居', '六下·汤姆·索亚历险记': '汤姆·索亚历险记', '九上·第一单元·1 沁园春·雪': '1 沁园春·雪',
  '必修上·第一单元·沁园春·长沙': '沁园春·长沙', '选择性必修上·第三单元·大卫·科波菲尔（节选）': '大卫·科波菲尔（节选）',
  '七上·基础积累（字词·病句）': '基础积累（字词·病句）', '拓展（课外·毛泽东诗词）': '拓展（课外·毛泽东诗词）',
  '八上·引言·走进物理世界（奇妙的物理现象·物理学与科技强国·体验科学探究）': '走进物理世界（奇妙的物理现象·物理学与科技强国·体验科学探究）',
  '一轮复习·化学·专题1 化学反应原理综合·化学反应与能量（含电化学）': '化学反应与能量（含电化学）',
  '《清平乐·村居》': '《清平乐·村居》', '《西江月·夜行黄沙道中》': '《西江月·夜行黄沙道中》',
  '必修2·第1章 遗传因子的发现·第1节 孟德尔的豌豆杂交实验（一）': '孟德尔的豌豆杂交实验（一）', '必修2·第1章 遗传因子的发现·第2节 孟德尔的豌豆杂交实验（二）': '孟德尔的豌豆杂交实验（二）',
};
const tail = (u: string) => u.split('·').pop()!;   // 其余 50 个：最后一段本身就是完整题名（只有册别 / 单元前缀，或没有「·」）
const want = (u: string) => (EXPECT[u] ?? tail(u)).replace(/^第[一二三四五六七八九十\d]+(?:单元|[章课节])\s*/, '');

describe('r16.2 章 / 单元名里的「·」和括号（63 个）', () => {
  it('清单 63 行都在', () => { expect(rows.length).toBe(63); });
  it('shortUnit：每个名字都是完整题名（不在题名中间截断、括号 / 书名号成对）', () => {
    const bad: string[] = [];
    for (const r of rows) { const u = r[3]; const s = shortUnit(u);
      if (s !== want(u)) bad.push(`${u} → ${s}（应为 ${want(u)}）`);
      for (const [a, b] of [['（', '）'], ['《', '》'], ['(', ')']]) if (s.split(a).length !== s.split(b).length) bad.push(`${u} → ${s} 括号不成对`); }
    expect(bad).toEqual([]);
  });
  it('有章号的名字：章标题是层级段本身（第一单元 / 第1章 …），不会是被截的题名', () => {
    for (const r of rows) { const c = chapterOf(r[3]); if (c) expect(r[3].includes(c.title.replace(/（.*$/, '')), r[3]).toBe(true); }
    expect(chapterOf('必修上·第一单元·沁园春·长沙')?.title).toBe('第一单元'); expect(chapterOf('九上·第一单元·1 沁园春·雪')?.title).toBe('第一单元');
    expect(chapterOf('四下·古诗词 清平乐·村居')).toBeNull(); expect(chapterOf('六下·汤姆·索亚历险记')).toBeNull();   // 没章号 → 单元标题也用 shortUnit
  });
  it('「类别·名字」（没有册别 / 章节层级）照旧只显示名字', () => {
    expect(shortUnit('英语单词·动物')).toBe('动物'); expect(shortUnit('拓展·纲要下')).toBe('纲要下'); expect(shortUnit('初高衔接·语法复习')).toBe('语法复习');
    expect(shortUnit('七上·第2章 有理数·2.2 数轴')).toBe('2.2 数轴'); expect(shortUnit('《清平乐·村居》')).toBe('《清平乐·村居》');
  });
  it('整份内置题库（v48；r16.2 起 v50）：只有这 4 关的显示名变了；所有关卡 id / 题池 / 册 / Boss 名和 eefc5aa 一样', () => {
    const fx = JSON.parse(readFileSync('tests/fixtures/r162_levels_eefc5aa.json', 'utf8')) as { struct_sha: string; names: Record<string, [string, string]> };
    const all = levelSnapshot();
    // r16.2 题库 v50：只多了六下《学弈》一关（语文|N|6:Y6-014）和高二物理（强制隐藏）；去掉 v50 新题后，其余关卡的题池 / 册 / Boss 名仍和 eefc5aa 一模一样
    //   （《学弈》原来的 2 题 Y6-014 / Y6-026 在 v48 不够开关，也不在任何题池里）
    const added = Object.keys(all).filter(k => !(k in fx.names)).sort();
    expect(added.filter(k => !(k.startsWith('物理|') && all[k].pool.split(',').every(x => x.startsWith('11:P11-'))))).toEqual(['语文|N|6:Y6-014']);
    const NEW50 = new Set(['E5-156', 'E5-157', 'E5-158', 'E5-159', 'E5-160', 'E6-158', 'E6-159', 'E6-160', 'E6-161', 'E6-162', 'Y6-470', 'Y6-471', 'Y6-472', 'Y6-473', 'Y6-474', 'Y6-475', 'Y6-476', 'Y6-477', 'Y6-014', 'Y6-026']);
    const now = Object.fromEntries(Object.entries(all).filter(([k]) => k in fx.names).map(([k, v]) => [k, { ...v, pool: v.pool.split(',').filter(x => !NEW50.has(x.split(':')[1])).join(',') }]));
    expect(Object.keys(now).sort()).toEqual(Object.keys(fx.names).sort());
    expect(createHash('sha1').update(JSON.stringify(Object.fromEntries(Object.entries(now).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, [v.pool, v.volume, v.boss ?? null]])))).digest('hex')).toBe(fx.struct_sha);
    const diff = Object.entries(now).filter(([k, v]) => v.name !== fx.names[k][0] || v.unit !== fx.names[k][1]).map(([k, v]) => [k, v.name, v.unit]);
    expect(diff).toEqual([
      ['语文|N|10:Y10-001', '沁园春·长沙', '第一单元'],
      ['语文|N|11:Y11-113', '大卫·科波菲尔（节选）', '第三单元'],
      ['语文|N|4:Y4-022', '古诗词 清平乐·村居', '古诗词 清平乐·村居'],
      ['语文|N|6:Y6-022', '汤姆·索亚历险记', '汤姆·索亚历险记'],
    ]);
  });
  it('各界面都直接用 Level.name / Level.unit（不再自己拆「·」）', () => {
    const sc = readFileSync('src/ui/Screens.tsx', 'utf8'), app = readFileSync('src/App.tsx', 'utf8');
    expect(sc).toContain('<small>{l.volume}</small> {l.unit}</div>'); expect(sc).toContain('title={l.name}>{l.name}</span>');
    expect((app.match(/title=\{screen\.level\.name\}/g) ?? []).length).toBeGreaterThanOrEqual(2);
    for (const f of ['src/ui/Screens.tsx', 'src/ui/Battle.tsx', 'src/ui/RoundBattle.tsx', 'src/ui/Parent.tsx', 'src/App.tsx']) expect(readFileSync(f, 'utf8'), f).not.toMatch(/split\(['"]·['"]\)/);
  });
});
