// r16.1（总管）：「内置题已更新」列出是哪些题（id + 题干开头，多的折叠），并告诉家长可以从备份重新导入改过的题
import { it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mergeImported, shortStem, type SupRow } from '../src/bankStore';
import { normalize, qRev, type Question } from '../src/game/questions';
import { SupersededNote, ElectivesPicker } from '../src/ui/Parent';
const mk = (id: string, stem: string, ans = 'A'): any => ({ id, grade: 7, subject: '数学', type: '选择', status: 'AI初审通过', question: stem, options: [{ text: '1' }, { text: '2' }], answer: ans, difficulty: 2, tags: [] });
it('mergeImported 记下被内置新版盖掉的题：年级 / id / 科目 / 题干开头', () => {
  const by = new Map<string, Question>(); const b1 = normalize(mk('M7-001', '内置新版题干：一个很长很长很长很长很长很长很长的题干，超过二十四个字'), 0); by.set(b1.key, b1);
  const b2 = normalize(mk('M7-002', '第二题'), 1); by.set(b2.key, b2);
  const r = mergeImported(by, [{ ...mk('M7-001', '家长改过的旧版：一个很长很长很长很长很长很长很长的题干', 'B'), base_rev: 'old' }, { ...mk('M7-002', '家长改的', 'B'), base_rev: qRev(b2) }, mk('M7-003', '新题')]);
  expect(r.superseded).toBe(1); expect(r.supList).toEqual([{ grade: '7', id: 'M7-001', subject: '数学', stem: shortStem('家长改过的旧版：一个很长很长很长很长很长很长很长的题干') }]);
  expect(r.supList[0].stem.endsWith('…')).toBe(true); expect([...r.supList[0].stem].length).toBeLessThanOrEqual(25);
  expect(shortStem('求 $x^2$ 的值')).toBe('求 … 的值');
});
it('提示：少的全列；多的列 5 道、其余折叠；说可以从备份重新导入', () => {
  const rows = (n: number): SupRow[] => Array.from({ length: n }, (_, i) => ({ grade: '7', id: `M7-${100 + i}`, subject: '数学', stem: `题${i}` }));
  const few = renderToStaticMarkup(createElement(SupersededNote, { n: 2, list: rows(2) }));
  expect(few).toContain('内置题已更新'); expect(few).toContain('M7-100'); expect(few).toContain('M7-101'); expect(few).toContain('初一'); expect(few).toContain('题1'); expect(few).not.toContain('sup-more');
  expect(few).toMatch(/备份[^<]*重新导入/);
  const many = renderToStaticMarkup(createElement(SupersededNote, { n: 12, list: rows(12) }));
  expect(many).toContain('data-testid="sup-more"'); expect(many).toContain('还有 7 道'); expect(many).toContain('M7-111');
  expect(many.indexOf('M7-104')).toBeLessThan(many.indexOf('sup-more')); expect(many.indexOf('M7-105')).toBeGreaterThan(many.indexOf('sup-more'));
});
it('选科控件：全科默认选中；已选科显示首选 / 再选，不完整时提示', () => {
  const all = renderToStaticMarkup(createElement(ElectivesPicker, { e: { all: true }, onChange() {} }));
  expect(all).toMatch(/class="chip on" data-testid="el-all"/); expect(all).toContain('el-all-hint'); expect(all).not.toContain('el-first-');
  const none = renderToStaticMarkup(createElement(ElectivesPicker, { e: undefined, onChange() {} })); expect(none).toMatch(/class="chip on" data-testid="el-all"/);
  const half = renderToStaticMarkup(createElement(ElectivesPicker, { e: { first: '物理', second: ['化学'] }, onChange() {} }));
  expect(half).toMatch(/class="chip on" data-testid="el-picked"/); expect(half).toContain('el-invalid'); expect(half).toMatch(/class="chip on" data-testid="el-first-物理"/);
  const done = renderToStaticMarkup(createElement(ElectivesPicker, { e: { first: '物理', second: ['化学', '地理'] }, onChange() {} }));
  expect(done).not.toContain('el-invalid'); expect(done).toMatch(/data-testid="el-second-生物" disabled/);
});
