/* r16：题库 v43 改了判断题答案 / 单选选项文字 / 高一选项位置（id 不变）。错题本和存档总是按 id 读当前题库：
   旧答案字母不再对到新选项上；家长导入（或备份恢复）里的旧版同号题不会盖住内置新版；导出再导入的内置题不变成导入题。 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBank, normalize, qRev, exportQuestion, type Question } from '../src/game/questions';
import { mergeImported } from '../src/bankStore';
import { onWrong, wrongStale } from '../src/game/wrongbook';
const fx = JSON.parse(readFileSync('tests/fixtures/r16_v42_changed.json', 'utf8')) as Record<'judge' | 'opt' | 'swap', { grade: string; old: any }[]>;
const banks: Record<string, ReturnType<typeof loadBank>> = {};
const cur = (g: string, id: string) => { banks[g] ??= loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`); return banks[g].all.find(q => q.id === id)!; };
const oldQ = (x: { grade: string; old: any }) => normalize({ ...x.old, grade: x.old.grade }, 0, x.grade as never);
const all = [...fx.judge, ...fx.opt, ...fx.swap];

describe('题库 v43：按 id 读当前题库', () => {
  it('内置题库已是最新（r16 = v46；r16.1 = v47，已有题内容不变）', () => { for (const g of ['8', '10', '11']) expect(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')).version).toMatch(/^v(4[678]|5[012])$/); });   // r16.2：v50 → v51
  it('样本：每类都有，旧版和当前版内容版本不同、key 相同', () => {
    for (const k of ['judge', 'opt', 'swap'] as const) expect(fx[k].length).toBeGreaterThan(0);
    for (const x of all) { const o = oldQ(x), c = cur(x.grade, x.old.id); expect(c.key).toBe(o.key); expect(qRev(c)).not.toBe(qRev(o)); }
  });
  it('错题本：答错时记了 rev → 题改了就不再显示旧答案；没改的题照常显示', () => {
    for (const x of all) { const o = oldQ(x), c = cur(x.grade, x.old.id);
      const wrongAns = o.type === '判断' ? (o.answer[0] === '对' ? '错' : '对') : o.options.map(z => z.key).find(k => !o.answer.includes(k))!;
      const e = onWrong(undefined, { profileId: 'p', qkey: o.key, subject: o.subject, rev: qRev(o) }, wrongAns);
      expect(wrongStale(e, c)).toBe(true); expect(wrongStale(e, o)).toBe(false); }
  });
  it('错题本旧记录（没有 rev）：判断题对→错后，当时答的「错」现在是正确答案 → 不显示', () => {
    for (const x of fx.judge) { const o = oldQ(x), c = cur(x.grade, x.old.id); const was = o.answer[0] === '对' ? '错' : '对';
      expect(wrongStale({ lastAnswer: was }, c)).toBe(c.answer[0] === was); }
  });
  it('导入的旧版同号题（备份恢复 / 旧导入，没有 base_rev）不盖住内置新版', () => {
    for (const x of all) { const c = cur(x.grade, x.old.id); const by = new Map<string, Question>([[c.key, c]]);
      const r = mergeImported(by, [{ ...x.old, grade: x.grade, key: c.key }]); expect(r.superseded).toBe(1); expect(by.get(c.key)).toBe(c); }
  });
  it('导入时记了 base_rev：内置题后来更新 → 用内置新版；内置题没变 → 用家长改过的版本', () => {
    const x = fx.opt[0], o = oldQ(x), c = cur(x.grade, x.old.id);
    const edited = { ...x.old, grade: x.grade, key: c.key, question: x.old.question + '（家长改过）' };
    let by = new Map<string, Question>([[c.key, c]]); mergeImported(by, [{ ...edited, base_rev: qRev(o) }]); expect(by.get(c.key)).toBe(c);
    by = new Map<string, Question>([[c.key, c]]); mergeImported(by, [{ ...edited, base_rev: qRev(c) }]); expect(by.get(c.key)!.question).toContain('家长改过');
  });
  it('导出再导入的内置题：内容版本和内置一样（导入时不另存、加载时不覆盖）', () => {
    for (const g of ['10', '8', 'K2']) { cur(g, ''); const b = banks[g]; for (const q of b.all.slice(0, 300)) {
      const back = normalize({ ...exportQuestion(q), grade: g }, 0, g as never); expect(qRev(back)).toBe(qRev(q));
      const by = new Map<string, Question>([[q.key, q]]); const r = mergeImported(by, [{ ...exportQuestion(q), grade: g, key: q.key }]); expect(r.same).toBe(1); expect(by.get(q.key)).toBe(q); } }
  });
});
