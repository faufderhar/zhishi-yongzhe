// r17.1 B2：开放大班 K3 / 初三 9 / 高三 12（PROFILE_GRADES、BUILTIN_GRADES、首页、学段入口、默认头像）；可见性仍按 FORCE_HIDDEN + 自动规则（≥10 题 / 小节）
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PROFILE_GRADES, bandOf } from '../src/game/grades';
import { computeVisibility, isHiddenBy, FORCE_HIDDEN } from '../src/game/visibility';
import { BUILTIN_GRADES } from '../src/bankStore';
import { STAGES } from '../src/game/stages';
import { HOME_GRADES } from '../src/ui/Screens';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters, BANK_ORDER_GRADES } from '../src/game/levels';
const bank = (g: string) => loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`);
const ALL15 = ['K1', 'K2', 'K3', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
it('15 个年级全开：档案 / 内置题库 / 首页 / 学段入口', () => {
  expect(PROFILE_GRADES).toEqual(ALL15); expect(BUILTIN_GRADES).toEqual(ALL15);
  expect(HOME_GRADES.map(x => x.g)).toEqual(ALL15); expect(HOME_GRADES.every(x => x.open)).toBe(true);
  for (const g of ['K3', '9', '12']) expect(STAGES.flatMap(s => s.grades).find(x => x.key === g)?.grade, g).toBe(g);
  expect([bandOf('K3'), bandOf('9'), bandOf('12')]).toEqual(['K', 'J', 'H']);
  expect(FORCE_HIDDEN).toEqual({ '11': ['物理'] });   // 新年级没有强制隐藏
});
it('大班：6 科、每个小节 ≥ 10 道可玩题（幼儿园本来就不受自动规则，按规则也全部可见）；册内按题库顺序（数到20 在最前）', () => {
  const b = bank('K3'); expect(b.bad).toEqual([]); const vis = computeVisibility(b.all);
  expect(vis.rows).toEqual([]);
  const sec = new Map<string, number>(); for (const q of playable(b.all, false)) sec.set(q.subject + '|' + q.unit, (sec.get(q.subject + '|' + q.unit) ?? 0) + 1);
  expect([...sec].filter(([, n]) => n < 10)).toEqual([]);
  expect(BANK_ORDER_GRADES.has('K3')).toBe(true);
  const chs = buildChapters(playable(b.all, false), null, b.all);
  expect(chs.map(c => c.subject).sort()).toEqual(['儿歌古诗', '生活常识', '英语', '认识动物', '数数', '颜色形状'].sort());
  expect(chs.find(c => c.subject === '数数')!.levels[0].unit).toBe('数到20');
  expect(chs.every(c => c.levels.some(l => l.kind === 'boss'))).toBe(true);
});
// r17.2（题库 v58 初三 +78）：r17.1 时自动规则藏的 5 册（语文 / 历史 / 物理 九上、数学 / 物理 中考复习）小节都补到 ≥ 10 → 一册不藏，8 科全可见；没加 AUTO_EXEMPT（tests/r172v58）
it('初三：v58 后自动规则一册都不藏 → 语文、历史、物理回来；8 科全可见', () => {
  const b = bank('9'); expect(b.bad).toEqual([]); const vis = computeVisibility(b.all);
  expect(vis.rows).toEqual([]); expect([...vis.hiddenSubj]).toEqual([]);
  const vq = b.all.filter(q => !isHiddenBy(vis, q)); const chs = buildChapters(playable(vq, false), null, vq);
  expect([...new Set(chs.map(c => c.subject))].sort()).toEqual(['化学', '历史', '数学', '物理', '英语', '诗词', '语文', '道德与法治'].sort());
});
it('高三：自动规则一册都不藏（物理选必三 / 一轮复习都够 10 题 → 物理可见）', () => {
  const b = bank('12'); expect(b.bad).toEqual([]); const vis = computeVisibility(b.all);
  expect(vis.rows).toEqual([]);
  const chs = buildChapters(playable(b.all, false), null, b.all);
  expect(chs.map(c => c.subject)).toContain('物理'); expect(chs.length).toBe(10);
});
