// r17.2：题库 v57 → v58（import-bank.py）。v58 只给初三补 78 题（语文 / 历史 / 物理九上、物理 / 数学中考复习），其它年级逐题不变。
// r17.1 时这 5 册因「有小节不满 10 题」被自动规则整册藏掉；v58 补够后按规则自动可见——AUTO_EXEMPT 仍为空、FORCE_HIDDEN 不变。
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUILTIN_GRADES } from '../src/bankStore';
import { AUTO_EXEMPT, FORCE_HIDDEN, MIN_SECTION_QS, autoHidden, computeVisibility, isHiddenBy } from '../src/game/visibility';
import { loadBank, playable } from '../src/game/questions';
import { REV_CHANGED_SINCE_R16 } from '../src/game/revChanged';
const raw = (g: string) => JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8'));
const NEWLY = [['语文', '九年级上册'], ['历史', '九年级上册'], ['物理', '九年级上册'], ['物理', '中考复习（不分册）'], ['数学', '中考复习（不分册）']] as const;
it('v58：所有内置年级版本号 v58；release.json v58 / 可玩 23470（v57 23392 + 初三 78）', () => {
  for (const g of BUILTIN_GRADES) expect(raw(g).version, g).toBe('v58');
  expect(JSON.parse(readFileSync('public/banks/release.json', 'utf8'))).toEqual({ release: 'v58', playable: 23470 });
});
it('AUTO_EXEMPT 仍为空；FORCE_HIDDEN 只有高二物理', () => {
  expect([...AUTO_EXEMPT]).toEqual([]); expect(FORCE_HIDDEN).toEqual({ '11': ['物理'] });
});
it('初三 5 册：每个小节可玩题 ≥ 10 → 自动规则不藏，题目可见', () => {
  const b = loadBank(raw('9'), 'bank_9.json'); expect(b.bad).toEqual([]);
  expect(autoHidden(b.all)).toEqual([]);
  const vis = computeVisibility(b.all);
  for (const [s, v] of NEWLY) {
    const qs = playable(b.all, false).filter(q => q.subject === s && q.volume === v); expect(qs.length, `${s}|${v}`).toBeGreaterThan(0);
    const sec = new Map<string, number>(); for (const q of qs) sec.set(q.unit ?? '', (sec.get(q.unit ?? '') ?? 0) + 1);
    expect([...sec].filter(([, n]) => n < MIN_SECTION_QS), `${s}|${v}`).toEqual([]);
    expect(qs.every(q => !isHiddenBy(vis, q)), `${s}|${v}`).toBe(true);
  }
  expect([...vis.hiddenSubj]).toEqual([]);
});
it('v58 新增题没进 REV 集合（只新增、已有题不变）', () => {
  const ids = raw('9').questions.map((q: { id: string }) => q.id) as string[];
  expect(ids.filter(id => REV_CHANGED_SINCE_R16.has(id))).toEqual([]);
});
