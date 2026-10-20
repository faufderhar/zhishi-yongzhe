/* r16.1（题库 v48）：填空题的 input_type 字段——带字段按字段（numeric → 数字键盘；text → 字母键盘 / 系统输入法，按字母规则再分），不带按答案自动判断。
   全部内置填空都带字段，且和自动判断一致（0 不一致）；R16_KB_AUDIT48=1 时写 /workspace/playtest/r16dev/填空键盘审计_v48.md（含盒子上的大班 / 初三 / 高三 v48 源） */
import { it, expect } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { loadBank, normalize, type Question } from '../src/game/questions';
import { fillKind, kindProblems, sciOf } from '../src/game/inputKind';
import { boxPath } from './boxSrc';
const grades = readdirSync('public/banks').map(f => f.match(/^bank_(\w+)\.json$/)?.[1]).filter(Boolean) as string[];
const fills = grades.flatMap(g => loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`).all.filter(q => q.type === '填空'));
const auto = (q: Question) => fillKind({ ...q, input_type: undefined }, sciOf(q.grade));
it('字段规则：numeric → num；text → letters / ime（同一条字母规则）；没字段 → 自动判断', () => {
  expect(fillKind({ subject: '数学', answer: ['3', '三'], input_type: 'numeric' })).toBe('num');
  expect(fillKind({ subject: '数学', answer: ['12'], input_type: 'text' })).toBe('ime');
  expect(fillKind({ subject: '英语', answer: ['apple'], input_type: 'text' })).toBe('letters');
  expect(fillKind({ subject: '化学', answer: ['CO2'], input_type: 'text' })).toBe('ime');
  expect(fillKind({ subject: '数学', answer: ['12'] })).toBe('num');
  expect(normalize({ id: 'X', grade: 7, subject: '数学', type: '填空', question: 'q', answer: '2', input_type: 'numeric' }).input_type).toBe('numeric');
  expect(normalize({ id: 'X', grade: 7, subject: '数学', type: '填空', question: 'q', answer: '2', input_type: 'bogus' }).input_type).toBeUndefined();
});
it('内置题库（v48）：每道填空都带 input_type，和自动判断一致；分配的键盘打得出答案', () => {
  expect(fills.length).toBeGreaterThan(2500);
  expect(fills.filter(q => !q.input_type).map(q => q.id)).toEqual([]);
  expect(fills.filter(q => fillKind(q, sciOf(q.grade)) !== auto(q)).map(q => `${q.id} ${q.input_type} auto=${auto(q)} ${q.answer.join('|')}`)).toEqual([]);
  expect(fills.filter(q => kindProblems(q, fillKind(q, sciOf(q.grade)), sciOf(q.grade)).length).map(q => q.id)).toEqual([]);
});
it('审计（R16_KB_AUDIT48=1）', () => {
  if (!process.env.R16_KB_AUDIT48) return;
  const ext: Question[] = []; for (const n of ['幼儿园大班', '初三', '高三']) { const f = boxPath(`questions/题库_${n}.json`); if (existsSync(f)) ext.push(...loadBank(JSON.parse(readFileSync(f, 'utf8')), f).all.filter(q => q.type === '填空')); }
  const all = [...fills, ...ext]; const cnt: Record<string, number> = {}; const mis: string[] = []; const nof: string[] = [];
  for (const q of all) { const k = fillKind(q, sciOf(q.grade)); cnt[k] = (cnt[k] ?? 0) + 1; if (!q.input_type) nof.push(q.id); else if (k !== auto(q)) mis.push(`| ${q.id} | ${q.input_type} | ${auto(q)} | ${q.answer.join(' / ')} |`); }
  const unc = readFileSync(boxPath('questions/填空输入类型_不确定_v48.csv'), 'utf8').trim().split(/\r?\n/).slice(1).map(l => l.split(','));
  const byId = new Map(all.map(q => [q.id, q]));
  const L = ['# 填空键盘审计 · 题库 v48（r16.1）', '', `- 填空 ${all.length} 道（内置 ${fills.length} + 盒子源 大班 / 初三 / 高三 ${ext.length}）；带 input_type ${all.length - nof.length}，没带 ${nof.length}${nof.length ? '：' + nof.slice(0, 20).join('、') : ''}`,
    `- 键盘：数字 ${cnt.num ?? 0}、字母 ${cnt.letters ?? 0}、系统输入法 ${cnt.ime ?? 0}`, `- 字段 vs 程序自动判断不一致：**${mis.length}** 道`, ...(mis.length ? ['', '| id | input_type | 自动判断 | 答案 |', '|---|---|---|---|', ...mis] : []),
    '', '## 规则（程序 src/game/inputKind.ts fillKind，唯一决定点）', '', '1. input_type = numeric → 数字键盘（高一到高三有 ×10ⁿ）。', '2. input_type = text → 不出数字键盘：答案都能用字母键盘打（a–z、空格、\' -），且是英语题或答案里有字母 → 字母键盘；否则系统输入法。',
    '3. 没有 input_type（家长自己出的题、旧备份）→ 自动判断：所有答案是纯数且至少一个能用数字键盘打 → 数字键盘；否则同第 2 条。', '',
    '## 题库标的 12 道「不确定」（填空输入类型_不确定_v48.csv）', '', '| id | 答案 | 题库标注 | 程序键盘 | 意见 |', '|---|---|---|---|---|',
    ...unc.map(r => { const q = byId.get(r[0]); const k = q ? fillKind(q, sciOf(q.grade)) : '（不在题库）'; const a = r[5];
      const why = /[:∶]/.test(a) && !/时|点/.test(a) ? '同意 text：比号数字键盘打不出' : /^[A-Za-z]/.test(a) ? '同意 text：化学式带数字，字母键盘打不出 → 输入法' : '可以改 numeric（有一个纯数答案，数字键盘更好打；汉字 / 单位写法输入法里照样判对）——请题库审核定';
      return `| ${r[0]} | ${a.replace(/\|/g, " / ")} | ${r[6]} | ${k} | ${why} |`; })];
  writeFileSync(boxPath('playtest/r16dev/填空键盘审计_v48.md'), L.join('\n') + '\n');
});
