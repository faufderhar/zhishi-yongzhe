// r16 第 9 步 技术QA [P3]/[P4]：导入题库——大小 / 题数上限、GBK 只报一条「另存为 UTF-8」、题干 / 选项长度上限、上限内的大文件检查不卡太久
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { sizeIssue, encodingIssue, countIssue, IMPORT_MAX_BYTES, IMPORT_MAX_QUESTIONS, STEM_MAX } from '../src/game/importCheck';
import { loadBank, validateQuestion } from '../src/game/questions';
import { csvToQuestions } from '../src/game/csv';

const q0 = { id: 'T-1', grade: '3', subject: '数学', type: '选择', question: '1+1=?', options: [{ text: '2' }, { text: '3' }], answer: 'A', status: '已通过' };
describe('r16 导入题库检查', () => {
  it('大小上限：上限内放行，超过给一条拆分建议', () => {
    expect(sizeIssue(IMPORT_MAX_BYTES)).toBeNull();
    expect(sizeIssue(21 * 1024 * 1024)).toMatch(/文件太大（21 MB）.*拆成/);
  });
  it('题数上限', () => { expect(countIssue(IMPORT_MAX_QUESTIONS)).toBeNull(); expect(countIssue(60000)).toMatch(/60000 题.*最多导入 6000 题/); });
  it('GBK 的 CSV：按 UTF-8 解码出 U+FFFD → 只报一条「另存为 UTF-8」；正常 UTF-8 不报', () => {
    const gbk = Buffer.from([0x69, 0x64, 0x2c, 0xd5, 0xe2, 0xca, 0xc7, 0x0a, 0x31, 0x2c, 0xcc, 0xe2, 0x0a]);   // "id,这是\n1,题\n"（GBK）
    const text = new TextDecoder('utf-8').decode(gbk);
    const m = encodingIssue(text, '题库.csv'); expect(m).toMatch(/不是 UTF-8.*另存为 → CSV UTF-8/); expect(m!.split('\n').length).toBe(1);
    expect(encodingIssue('id,题干\n1,一加一\n', 'a.csv')).toBeNull();
    expect(encodingIssue('{"x":"\uFFFD"}', 'a.json')).toMatch(/UTF-8 重新保存/);
  });
  it('Parent：选新文件先清掉旧错误 / 预览；先查大小、编码、题数，再 loadBank；有进度提示', () => {
    const src = readFileSync('src/ui/Parent.tsx', 'utf8'); const f = src.slice(src.indexOf('const onFile = async'), src.indexOf('const doImport'));
    const at = (s: string) => { const i = f.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
    expect(at('setMsg(undefined); setPv(null);')).toBeLessThan(at('sizeIssue(f.size)'));
    expect(at('sizeIssue(f.size)')).toBeLessThan(at('await f.text()')); expect(at('encodingIssue(text')).toBeLessThan(at('csvToQuestions(text)'));
    expect(at('countIssue(list.length)')).toBeLessThan(at('loadBank(raw')); expect(f).toMatch(/setBusy\(`正在检查/); expect(src).toContain('data-testid="import-busy"');
    expect(src).not.toMatch(/pv\.bank\.all\.find\(x => x\.order === i\)/);
  });
  it('题干 / 选项长度上限（内置题都在上限内）', () => {
    expect(validateQuestion({ ...q0, question: 'x'.repeat(STEM_MAX) })).toEqual([]);
    expect(validateQuestion({ ...q0, question: 'x'.repeat(STEM_MAX + 1) }).join()).toMatch(/题干太长/);
    expect(validateQuestion({ ...q0, options: [{ text: 'x'.repeat(201) }, { text: '3' }] }).join()).toMatch(/选项太长/);
    for (const g of ['8', '10', '11', 'K2', '1']) { const b = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`); expect(b.bad.filter(x => x.errors.some(e => /太长/.test(e)))).toEqual([]); }
  });
  it('上限内最大的文件（6000 题）检查得够快', () => {
    const base = JSON.parse(readFileSync('public/banks/bank_8.json', 'utf8')).questions as any[];
    const qs = Array.from({ length: IMPORT_MAX_QUESTIONS }, (_, i) => ({ ...base[i % base.length], id: 'T8-' + i }));
    const t = performance.now(); const b = loadBank({ grade: '8', questions: qs }, 'x.json'); const ms = performance.now() - t;
    expect(b.all.length + b.bad.length).toBe(IMPORT_MAX_QUESTIONS); expect(ms).toBeLessThan(3000); console.log(`loadBank ${IMPORT_MAX_QUESTIONS} 题 ${ms.toFixed(0)} ms；JSON ${(JSON.stringify(qs).length / 1048576).toFixed(1)} MB`);
  });
  it('CSV 正常 UTF-8 仍能解析', () => { expect(csvToQuestions('id,grade,subject,type,question,A,B,answer\nT-1,3,数学,选择,1+1=?,2,3,A\n').length).toBe(1); });
});
import { totalIssue, IMPORT_MAX_TOTAL } from '../src/game/importCheck';
describe('r16 导入题总数上限', () => {
  it('累计超过上限 → 提示先清除', () => { expect(totalIssue(0, IMPORT_MAX_QUESTIONS)).toBeNull(); expect(totalIssue(IMPORT_MAX_TOTAL - 10, 11)).toMatch(/清除已导入/);
    expect(readFileSync('src/ui/Parent.tsx', 'utf8')).toMatch(/totalIssue\(bank\.importedCount, pv\.isNew\)/); });
});
