// r16：开放中班 K2 / 初二 8 / 高二 11；大班 / 初三 / 高三还不开（r17）；初二生物、地理和高二物理先藏起来（教材版本待确认）
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PROFILE_GRADES, HIDDEN_SUBJECTS, isHiddenSubject, bandOf } from '../src/game/grades';
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
it('隐藏科目：初二生物 / 地理、高二物理；别的年级同名科目不受影响', () => {
  expect(HIDDEN_SUBJECTS).toEqual({ '8': ['生物', '地理'], '11': ['物理'] });
  const q = (grade: string, subject: string) => ({ grade, subject }) as Question;
  expect(isHiddenSubject(q('8', '生物'))).toBe(true); expect(isHiddenSubject(q('8', '地理'))).toBe(true); expect(isHiddenSubject(q('11', '物理'))).toBe(true);
  expect(isHiddenSubject(q('8', '物理'))).toBe(false); expect(isHiddenSubject(q('10', '物理'))).toBe(false); expect(isHiddenSubject(q('11', '生物'))).toBe(false); expect(isHiddenSubject(q('7', '生物'))).toBe(false);
});
it('三个新年级题库能读、0 坏题，能建关；每章有 Boss', () => {
  const want: Record<string, string[]> = {
    K2: ['数数', '颜色形状', '认识动物', '生活常识', '儿歌古诗', '英语'],
    '8': ['语文', '诗词', '数学', '英语', '物理', '历史', '道德与法治'],
    '11': ['语文', '诗词', '数学', '英语', '化学', '生物', '历史', '地理', '政治'],
  };
  for (const g of ['K2', '8', '11']) {
    const b = bank(g); expect(b.bad, g).toEqual([]); expect(b.all.every(q => q.grade === g), g).toBe(true);
    const chs = buildChapters(playable(b.all, false), null, b.all);
    expect(new Set(chs.map(c => c.subject)), g).toEqual(new Set(want[g]));
    expect(chs.every(c => c.levels.some(l => l.kind === 'boss')), g).toBe(true);
  }
});
