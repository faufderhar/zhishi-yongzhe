// r16.2：题库 v51 的 17 道数字键盘修正（src/v51/numeric.tsv）在游戏的数字键盘上按得出来、判得对。
//  r16.2 没有换到 v51（见 STATUS.md），所以读题库源目录（BANK_SRC，默认 /workspace/questions）；源不在 / 还没到 v51（CI）时跳过。
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { loadBank, judge, type Question } from '../src/game/questions';
import { fillKind, kindProblems, numTypeable, sciOf } from '../src/game/inputKind';
import { addNumKey } from '../src/game/keypad';
const SRC = process.env.BANK_SRC ?? '/workspace/questions/';
const FILE: Record<string, [string, string]> = { B8: ['初二', '8'], P8: ['初二', '8'], B10: ['高一', '10'], B11: ['高二', '11'], C11: ['高二', '11'], C9: ['初三', '9'] };
const PCT = ['B8-305', 'B10-276', 'B10-375', 'B11-341', 'C11-070', 'C11-092'];
const IDS = [...PCT, 'B8-293', 'C9-108', ...['325', '387', '470', '471', '474', '480', '484', '516', '526'].map(n => 'P8-' + n)];
const ver = (() => { try { return Number(readFileSync(SRC + 'src/VERSION', 'utf8').trim().replace(/^v/, '')); } catch { return 0; } })();
const have = ver >= 51 && Object.values(FILE).every(([n]) => existsSync(`${SRC}题库_${n}.json`));
const cache = new Map<string, Question[]>();
const get = (id: string) => { const [n, g] = FILE[id.split('-')[0]]; if (!cache.has(n)) cache.set(n, loadBank(JSON.parse(readFileSync(`${SRC}题库_${n}.json`, 'utf8')), `bank_${g}.json`).all);
  return cache.get(n)!.find(q => q.id === id)!; };
describe.skipIf(!have)('题库 v51：17 道数字键盘题', () => {
  it('17 题都在、都是填空 + 数字键盘；每个答案都是键盘能按出来的纯数字（没有 % ‰ ° ℃ +，初中没有 ×10ⁿ）', () => {
    expect(IDS.length).toBe(17);
    for (const id of IDS) { const q = get(id); expect(q, id).toBeTruthy(); expect(q.type, id).toBe('填空'); const sci = sciOf(q.grade);
      expect(fillKind(q, sci), id).toBe('num'); expect(kindProblems(q, 'num', sci), id).toEqual([]);
      for (const a of q.answer) { expect(numTypeable(a, sci), `${id} ${a}`).toBe(true); expect(a, id).not.toMatch(/[%‰°℃+×]/); } }
  });
  it('按键盘逐个按答案 → 判对；百分数题的 % 写在题干「____%」里，按数字就对', () => {
    for (const id of IDS) { const q = get(id); const typed = [...q.answer[0]].reduce(addNumKey, '');
      expect(typed, id).toBe(q.answer[0]); expect(judge(q, typed), id).toBe('full'); }
    for (const id of PCT) expect(get(id).question, id).toMatch(/_+%/);
    expect(get('C9-108').answer).toEqual(['5']); expect(get('B8-293').answer).toEqual(['1/4']);
    expect(judge(get('B8-293'), '0.25')).toBe('full');   // 分数题按数值等价判分
  });
});
