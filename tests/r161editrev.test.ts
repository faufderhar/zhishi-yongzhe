// r16.1 (l) 技术QA P3-1：只改了解析 / 难度 / 停用 / 朗读文字等的内置题，预览说「更新 1」、确认后却「和内置题一样，不另存」——改动丢了。
// 现在：家长能改的每个字段都算改动；预览（classifyImport）和确认 / 启动合并（mergeImported）用同一个 sameAsBuiltin
import { describe, it, expect } from 'vitest';
import { mergeImported } from '../src/bankStore';
import { normalize, qRev, editRev, sameAsBuiltin, EDIT_FIELDS, loadBank, type Question } from '../src/game/questions';
import { classifyImport } from '../src/ui/Parent';
const base: any = { id: 'M7-001', grade: 7, subject: '数学', type: '选择', status: 'AI初审通过', textbook: '苏科版2024', unit: '七上·第1章', volume: '七年级上册', question: '1+1=?', tts_text: '一加一等于几', options: [{ text: '1' }, { text: '2' }], answer: 'B', explanation: '因为 1+1=2。', difficulty: 2, tags: ['加法'], knowledge_point: '加法', time: 30, source: 'AI', template: 'T1' };
const EDITS: Record<string, unknown> = { status: '停用', subject: '诗词', textbook: '人教版2024', unit: '七上·第2章', volume: '七年级下册', type: '多选', question: '1+1 等于几？', question_image: 'x.webp', question_audio: 'a.mp3', tts_text: '一加一', options: [{ text: '1' }, { text: '3' }],
  answer: 'A', tolerance: 0.5, explanation: '1 加 1 得 2。', difficulty: 3, tags: ['加法', '口算'], knowledge_point: '口算', time: 45, source: '家长', usage: 'boss', template: 'T2', visual: { item: '🍎', emoji: '🍎', count: 3, label: '苹果' } };
const B = normalize(base, 0); const bank = { builtin: { '7': { name: 'b', all: [B], bad: [], warnings: [] } as never }, byKey: new Map([[B.key, B]]) };
describe('r16.1 editRev / sameAsBuiltin', () => {
  it('每个可改字段都有用例', () => { expect(Object.keys(EDITS).sort()).toEqual([...EDIT_FIELDS].sort()); });
  it('原样导入 → 和内置题一样（不另存）；预览不算「更新」', () => {
    expect(sameAsBuiltin(B, normalize({ ...base }, 0), base)).toBe(true);
    const c = classifyImport(bank, loadBank({ questions: [base] }, 'x.json'), [base]); expect([c.isUpd, c.isNew, c.same.size]).toEqual([0, 0, 1]);
    const by = new Map<string, Question>([[B.key, B]]); expect(mergeImported(by, [{ ...base }]).same).toBe(1);
  });
  for (const [k, v] of Object.entries(EDITS)) it(`只改 ${k} → 算更新：预览「更新 1」，确认 / 启动合并时存下（不是「和内置题一样」）`, () => {
    const raw = { ...base, [k]: v }; const q = normalize(raw, 0);
    expect(editRev(q), k).not.toBe(editRev(B)); expect(sameAsBuiltin(B, q, raw), k).toBe(false);
    const c = classifyImport(bank, loadBank({ questions: [raw] }, 'x.json'), [raw]);
    if (loadBank({ questions: [raw] }, 'x.json').all.length) expect([c.isUpd, c.same.size], k).toEqual([1, 0]);
    const by = new Map<string, Question>([[B.key, B]]); const r = mergeImported(by, [{ ...raw, base_rev: qRev(B) }]);
    if (r.bad === 0) { expect(r.same, k).toBe(0); expect(r.superseded, k).toBe(0); expect(by.get(B.key), k).not.toBe(B); }
  });
  it('qRev（内容版本）不变：错题本 / 已存的 base_rev 照常对得上；只改解析的导入题在内置题没更新时保留，内置题内容更新后以新版为准（r16 规则）', () => {
    const raw = { ...base, explanation: '家长写的解析' }; expect(qRev(normalize(raw, 0))).toBe(qRev(B));
    const by = new Map<string, Question>([[B.key, B]]); const r = mergeImported(by, [{ ...raw, base_rev: qRev(B) }]);
    expect(r.superseded).toBe(0); expect(by.get(B.key)!.explanation).toBe('家长写的解析');
    const B2 = normalize({ ...base, question: '内置新版：1+1=?' }, 0); const by2 = new Map<string, Question>([[B2.key, B2]]);
    const r2 = mergeImported(by2, [{ ...raw, base_rev: qRev(B) }]); expect(r2.superseded).toBe(1); expect(by2.get(B2.key)).toBe(B2);
  });
  it('导入文件里没有的列（CSV 没有图片 / 知识点 / usage）不算改动', () => {
    const { knowledge_point: _k, time: _t, template: _tp, ...csvish } = base; expect(sameAsBuiltin(B, normalize(csvish, 0), csvish)).toBe(true);
  });
});
