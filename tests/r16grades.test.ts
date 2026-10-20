// r16：开放中班 K2 / 初二 8 / 高二 11；大班 / 初三 / 高三还不开（r17）；初二生物、地理和高二物理由 FORCE_HIDDEN 藏起来（总管 r16；第 10 步起不再假设题库里没有这些科目）
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PROFILE_GRADES, bandOf } from '../src/game/grades';
import { FORCE_HIDDEN, computeVisibility, isHiddenBy } from '../src/game/visibility';
import { BUILTIN_GRADES } from '../src/bankStore';
import { STAGES } from '../src/game/stages';
import { HOME_GRADES } from '../src/ui/Screens';
import { loadBank, playable, type Question } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
const bank = (g: string) => loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`);
it('档案年级 / 内置题库 / 首页 / 学段入口：K2、8、11 打开；K3、9、12 不开', () => {
  for (const g of ['K2', '8', '11']) {
    expect(PROFILE_GRADES, g).toContain(g); expect(BUILTIN_GRADES, g).toContain(g);
    expect(HOME_GRADES.find(x => x.g === g)?.open, g).toBe(true);
    expect(STAGES.flatMap(s => s.grades).find(x => x.key === g)?.grade, g).toBe(g);
  }
  for (const g of ['K3', '9', '12']) {
    expect(PROFILE_GRADES, g).not.toContain(g); expect(BUILTIN_GRADES, g).not.toContain(g);
    expect(HOME_GRADES.find(x => x.g === g)?.open ?? false, g).toBe(false);
    expect(STAGES.flatMap(s => s.grades).find(x => x.key === g)?.grade, g).toBeUndefined();
  }
  expect(STAGES.find(s => s.id === 'K')!.grades.map(x => x.key)).toEqual(['K1', 'K2']);
  expect([bandOf('K2'), bandOf('8'), bandOf('11')]).toEqual(['K', 'J', 'H']);
});
it('强制隐藏：高二物理（r16.1 起初二生物 / 地理不再强制隐藏）；别的年级同名科目不受影响（不依赖题库里有没有这些题）', () => {
  expect(FORCE_HIDDEN).toEqual({ '11': ['物理'] });   // r16.1（总管）：题库 v47 初二生物 / 地理够题，解除强制隐藏
  const v = computeVisibility([]); const q = (grade: string, subject: string) => ({ grade, subject, volume: '任意册' }) as Question;
  expect(isHiddenBy(v, q('8', '生物'))).toBe(false); expect(isHiddenBy(v, q('8', '地理'))).toBe(false); expect(isHiddenBy(v, q('11', '物理'))).toBe(true);
  expect(isHiddenBy(v, q('8', '物理'))).toBe(false); expect(isHiddenBy(v, q('10', '物理'))).toBe(false); expect(isHiddenBy(v, q('11', '生物'))).toBe(false); expect(isHiddenBy(v, q('7', '生物'))).toBe(false);
});
it('三个新年级题库能读、0 坏题，能建关；每章有 Boss', () => {
  for (const g of ['K2', '8', '11']) {
    const b = bank(g); expect(b.bad, g).toEqual([]); expect(b.all.every(q => q.grade === g), g).toBe(true);
    const vis = computeVisibility(b.all); const vq = b.all.filter(q => !isHiddenBy(vis, q));
    const chs = buildChapters(playable(vq, false), null, vq);
    const want = new Set(playable(b.all, false).filter(q => !isHiddenBy(vis, q)).map(q => q.subject));   // 题库里有、且没被藏的科目
    expect(new Set(chs.map(c => c.subject)), g).toEqual(want); for (const s of FORCE_HIDDEN[g as never] ?? []) expect(want.has(s), `${g} ${s}`).toBe(false);
    expect(chs.every(c => c.levels.some(l => l.kind === 'boss')), g).toBe(true);
  }
});
