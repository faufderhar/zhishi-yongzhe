/* r16：题库 v44（id 不变）：初二–高二 选项文字改写、8 道判断题 对→错、K2N-033 题干「个」→「只」、高一新增 P10-321。
   和 v43 一样：错题本 / 存档按 id 读当前题库——v43 时答错记下的题（带 rev）在 v44 改过后不再显示当时的答案；
   v43 版本的导入 / 备份同号题不盖住内置 v44。样本 = tests/fixtures/r16_v43_changed.json（从 v43 提交的 bank 文件取，脚本生成） */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBank, normalize, qRev, type Question } from '../src/game/questions';
import { mergeImported } from '../src/bankStore';
import { onWrong, wrongStale } from '../src/game/wrongbook';
const fx = JSON.parse(readFileSync('tests/fixtures/r16_v43_changed.json', 'utf8')) as Record<'judge' | 'opt' | 'stem', { grade: string; old: any }[]>;
const banks: Record<string, ReturnType<typeof loadBank>> = {};
const cur = (g: string, id: string) => { banks[g] ??= loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`); return banks[g].all.find(q => q.id === id)!; };
const oldQ = (x: { grade: string; old: any }) => normalize({ ...x.old }, 0, x.grade as never);
const all = [...fx.judge, ...fx.opt, ...fx.stem];

describe('题库 v44：按 id 读当前题库', () => {
  it('v44 内容到位：K2N-033 用「只」、P10-321 在高一、8 道判断 对→错', () => {
    expect(cur('K2', 'K2N-033').question).toContain('1只🐤'); expect(cur('K2', 'K2N-033').question).not.toContain('个');
    expect(cur('10', 'P10-321')).toBeTruthy();
    expect(fx.judge.length).toBe(8); for (const x of fx.judge) { expect(x.old.answer).toBe('对'); expect(cur(x.grade, x.old.id).answer[0]).toBe('错'); }
    expect(fx.stem.map(x => x.old.id)).toContain('K2N-033'); expect(fx.opt.length).toBeGreaterThan(10);
  });
  it('key 不变、rev 变了', () => { for (const x of all) { const o = oldQ(x), c = cur(x.grade, x.old.id); expect(c.key).toBe(o.key); expect(qRev(c)).not.toBe(qRev(o)); } });
  it('错题本：v43 时答错的题（记了 rev）→ v44 改过就不显示当时的答案', () => {
    for (const x of all) { const o = oldQ(x), c = cur(x.grade, x.old.id);
      const wrongAns = o.type === '判断' ? (o.answer[0] === '对' ? '错' : '对') : o.options.map(z => z.key).find(k => !o.answer.includes(k))!;
      const e = onWrong(undefined, { profileId: 'p', qkey: o.key, subject: o.subject, rev: qRev(o) }, wrongAns);
      expect(wrongStale(e, c)).toBe(true); expect(wrongStale(e, o)).toBe(false); }
  });
  it('旧错题记录（没有 rev）：判断题 对→错 后，当时答的「错」现在是正确答案 → 不显示', () => {
    for (const x of fx.judge) expect(wrongStale({ lastAnswer: '错' }, cur(x.grade, x.old.id))).toBe(true);
  });
  it('v43 版本的导入 / 备份同号题不盖住内置 v44', () => {
    for (const x of all) { const c = cur(x.grade, x.old.id); const by = new Map<string, Question>([[c.key, c]]);
      const r = mergeImported(by, [{ ...x.old, grade: x.grade, key: c.key }]); expect(r.superseded).toBe(1); expect(by.get(c.key)).toBe(c); }
  });
});
