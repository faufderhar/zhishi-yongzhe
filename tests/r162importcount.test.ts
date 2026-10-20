// r16.2 技术QA B2（P4，P3-2 剩下的一半）：导入 25 题，其中 12 题高二物理（强制隐藏）→ 预览和结果都说「可玩 13」+「会被隐藏 12」，用同一个计数函数
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { importCounts, importResultMsg, classifyImport } from '../src/ui/Parent';
import { loadBank, type Question } from '../src/game/questions';
import { computeVisibility } from '../src/game/visibility';
import { BUILTIN_GRADES } from '../src/bankStore';
const builtin = Object.fromEntries(BUILTIN_GRADES.map(g => [g, loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`)]));
const vis = computeVisibility(Object.values(builtin).flatMap(b => b.all));
const bank = { vis, builtin, byKey: new Map<string, Question>() };
const mk = (id: string, grade: number, subject: string, volume: string) => ({ id, grade, subject, volume, unit: '导入单元', type: '选择', status: '已通过', question: `导入题 ${id}`, options: [{ text: 'a' }, { text: 'b' }], answer: 'A' });
// 技术QA 的 hid161.json：5 初二生物 + 5 初二地理 + 12 高二物理 + 3 初二数学
const raw = [...Array.from({ length: 5 }, (_, i) => mk(`ZB8-${i}`, 8, '生物', '八年级上册')), ...Array.from({ length: 5 }, (_, i) => mk(`ZD8-${i}`, 8, '地理', '八年级上册')),
  ...Array.from({ length: 12 }, (_, i) => mk(`ZP11-${i}`, 11, '物理', '必修第三册')), ...Array.from({ length: 3 }, (_, i) => mk(`ZM8-${i}`, 8, '数学', '八年级上册'))];
it('25 题里 12 题高二物理：可玩 13，会被隐藏 12（初二生物 / 地理 v47 起已开放，算可玩）', () => {
  const b = loadBank({ questions: raw }, 'hid161.json'); expect(b.bad).toEqual([]); expect(b.all.length).toBe(25); expect(b.counts.playable).toBe(25);
  const cls = classifyImport(bank, b, raw); expect([cls.isNew, cls.isUpd, cls.same.size]).toEqual([25, 0, 0]);
  expect(importCounts(bank, b, cls.same)).toEqual({ playable: 13, hidden: 12 });
  const msg = importResultMsg({ saved: 25, isNew: 25, isUpd: 0, same: 0, bad: 0, ...importCounts(bank, b, cls.same) });
  expect(msg).toContain('可玩 13 题'); expect(msg).toContain('另有 12 题'); expect(msg).toContain('会被隐藏'); expect(msg).not.toContain('可玩 25');
});
it('没有隐藏题时：可玩 = 状态可玩的题数，结果不提隐藏', () => {
  const r2 = raw.filter(x => x.subject !== '物理'); const b = loadBank({ questions: r2 }, 'x.json');
  expect(importCounts(bank, b, new Set())).toEqual({ playable: 13, hidden: 0 });
  expect(importResultMsg({ saved: 13, isNew: 13, isUpd: 0, same: 0, bad: 0, playable: 13, hidden: 0 })).not.toMatch(/隐藏/);
});
it('预览和结果都用 importCounts（同一个函数）；预览的「可玩」不再是 bank.counts.playable', () => {
  const s = readFileSync('src/ui/Parent.tsx', 'utf8');
  expect(s).toMatch(/setPv\(\{[^\n]*\.\.\.importCounts\(bank, b, cls\.same\)/);
  expect(s).toMatch(/const n = importCounts\(bank, pv\.bank, cls\.same\);[\s\S]{0,40}setMsg\(importResultMsg\(/);
  expect(s).toMatch(/data-testid="pv-playable">可玩 \{pv\.playable\}/); expect(s).not.toMatch(/可玩 \{pv\.bank\.counts\.playable\}/);
});
