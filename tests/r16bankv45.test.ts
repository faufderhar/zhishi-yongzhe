/* r16：题库 v45（id 不变，不增不删）：导入的年级里 676 题有改动，其中 420 道判断题答案翻转（题干 / 解析 / 朗读一起改），252 题改选项。
   错题本 / 存档按 id 读当前题库：v44 时答错记下的题在 v45 改过后不再显示当时的答案；v44 版的导入 / 备份同号题不盖住内置 v45。
   样本 = tests/fixtures/r16_v44_changed.json（从 v44 提交的 bank 文件取，脚本生成） */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBank, normalize, qRev, type Question } from '../src/game/questions';
import { mergeImported } from '../src/bankStore';
import { onWrong, wrongStale } from '../src/game/wrongbook';
const fx = JSON.parse(readFileSync('tests/fixtures/r16_v44_changed.json', 'utf8')) as Record<'judge' | 'opt', { grade: string; old: any }[]>;
const banks: Record<string, ReturnType<typeof loadBank>> = {};
const cur = (g: string, id: string) => { banks[g] ??= loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`); return banks[g].all.find(q => q.id === id)!; };
const oldQ = (x: { grade: string; old: any }) => normalize({ ...x.old }, 0, x.grade as never);
const all = [...fx.judge, ...fx.opt];

describe('题库 v45：按 id 读当前题库', () => {
  it('内置题库是 v45 或更新（v46 只改 textbook_note，内容同 v45）；样本里判断题答案翻了、选项题改了', () => {
    for (const g of ['1', '7', '8', '10', '11', 'K2']) expect(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')).version).toMatch(/^v4[56]$/);
    expect(fx.judge.length).toBe(16); expect(fx.opt.length).toBe(16);
    for (const x of fx.judge) expect(cur(x.grade, x.old.id).answer[0]).not.toBe(x.old.answer);
  });
  it('key 不变、rev 变了', () => { for (const x of all) { const o = oldQ(x), c = cur(x.grade, x.old.id); expect(c.key).toBe(o.key); expect(qRev(c)).not.toBe(qRev(o)); } });
  it('错题本：v44 时答错的题（记了 rev）→ v45 改过就不显示当时的答案；没改的版本照常显示', () => {
    for (const x of all) { const o = oldQ(x), c = cur(x.grade, x.old.id);
      const wrongAns = o.type === '判断' ? (o.answer[0] === '对' ? '错' : '对') : o.options.map(z => z.key).find(k => !o.answer.includes(k))!;
      const e = onWrong(undefined, { profileId: 'p', qkey: o.key, subject: o.subject, rev: qRev(o) }, wrongAns);
      expect(wrongStale(e, c)).toBe(true); expect(wrongStale(e, o)).toBe(false); }
  });
  it('旧错题记录（没有 rev）：判断题翻转后，当时答的现在成了正确答案 → 不显示', () => {
    for (const x of fx.judge) { const was = x.old.answer === '对' ? '错' : '对'; expect(wrongStale({ lastAnswer: was }, cur(x.grade, x.old.id))).toBe(true); }
  });
  it('v44 版本的导入 / 备份同号题不盖住内置 v45', () => {
    for (const x of all) { const c = cur(x.grade, x.old.id); const by = new Map<string, Question>([[c.key, c]]);
      const r = mergeImported(by, [{ ...x.old, grade: x.grade, key: c.key }]); expect(r.superseded).toBe(1); expect(by.get(c.key)).toBe(c); }
  });
});
