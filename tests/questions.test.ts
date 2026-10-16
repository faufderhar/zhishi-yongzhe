import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { validateQuestion, loadBank, playable, judge, isCorrect, kinderChoices, choicesOf, parseGradeKey, parseNum, ttsText, normalize, gameReadyMismatch, gradeFromFileName, canPlay } from '../src/game/questions';
import { csvToQuestions, parseCSV, toCSV } from '../src/game/csv';

const SRC = '/workspace/questions/';
const hasSrc = (() => { try { return readdirSync(SRC).length > 0; } catch { return false; } })();
const pub = (g: string) => JSON.parse(readFileSync(new URL(`../public/banks/bank_${g}.json`, import.meta.url), 'utf8'));
const base = { id: 'x', status: 'AI初审通过', subject: '数学', grade: 7, type: '选择', question: 'q',
  options: [{ text: '1' }, { text: '2' }, { text: '3' }, { text: '4' }], answer: 'B', explanation: '', difficulty: 2, tags: [] };

describe('内置题库（v5/v6）', () => {
  const EXPECT: Record<string, number> = { K1: 246, 1: 676, 2: 436, 3: 643, 4: 667, 5: 639, 6: 655, 7: 811, 10: 1241 };   // v15
  for (const g of Object.keys(EXPECT)) {
    it(`${g}：全部通过校验，可玩 ${EXPECT[g]} 题，年级来自文件/字段`, () => {
      const b = loadBank(pub(g), `bank_${g}.json`);
      expect(b.bad).toEqual([]);
      expect(b.grade).toBe(g);
      expect(b.all.every(q => q.grade === g)).toBe(true);
      expect(b.counts.playable).toBe(EXPECT[g]);
      expect(b.warnings.filter(w => w.errors[0].includes('game_ready'))).toEqual([]);
    });
  }
  it('小学 1–6 年级可玩合计 3716', () => {
    const t = ['1', '2', '3', '4', '5', '6'].reduce((a, g) => a + loadBank(pub(g), `bank_${g}.json`).counts.playable, 0);
    expect(t).toBe(3716);
  });
  it('跨文件唯一键不冲突（科学题 K3-xxx 与幼儿园 K1 区分）', () => {
    const keys = new Set<string>(); let n = 0;
    for (const g of Object.keys(EXPECT)) for (const q of loadBank(pub(g), `bank_${g}.json`).all) { keys.add(q.key); n++; }
    expect(keys.size).toBe(n);
    const sci = loadBank(pub('3'), 'bank_3.json').all.filter(q => q.subject === '科学');
    expect(sci.length).toBeGreaterThan(0);
    expect(sci.every(q => q.grade === '3' && q.id.startsWith('K'))).toBe(true);
  });
  it('每道题用标准答案作答都判对（含分数）', () => {
    for (const g of Object.keys(EXPECT)) for (const q of loadBank(pub(g)).all) expect(judge(q, q.type === '多选' ? q.answer : q.answer[0]), q.key).toBe('full');
  });
  it('1–2 年级每题都有 tts_text', () => {
    for (const g of ['1', '2']) for (const q of loadBank(pub(g)).all) expect(ttsText(q), q.key).toBeTruthy();
  });
  it.runIf(hasSrc)('public/banks 与 /workspace/questions 源文件一致', () => {
    const map: Record<string, string> = { K1: '幼儿园小班', 7: '初一', 10: '高一' };
    for (const g of Object.keys(EXPECT)) {
      const src = JSON.parse(readFileSync(SRC + `题库_${map[g] ?? g + '年级'}.json`, 'utf8'));
      expect(pub(g).questions.length).toBe(src.questions.length);
    }
  });
});

describe('校验规则', () => {
  it('年级：K1-K3、1–12；文件名识别', () => {
    expect(parseGradeKey('K1')).toBe('K1'); expect(parseGradeKey(0)).toBe('K1'); expect(parseGradeKey(10)).toBe('10');
    expect(parseGradeKey('K4')).toBeNull(); expect(parseGradeKey(13)).toBeNull();
    expect(gradeFromFileName('题库_3年级.json')).toBe('3'); expect(gradeFromFileName('题库_游戏可用_初一.csv')).toBe('7');
    expect(gradeFromFileName('题库_幼儿园小班.json')).toBe('K1'); expect(gradeFromFileName('bank_10.json')).toBe('10');
  });
  it('缺 grade 时用文件年级；不看 id 前缀', () => {
    const b = loadBank({ questions: [{ ...base, id: 'K3-001', grade: undefined }] }, '题库_3年级.json');
    expect(b.all[0].grade).toBe('3'); expect(b.all[0].key).toBe('3:K3-001');
  });
  it('选择/多选/判断/填空/status/需家长确认要 review_note', () => {
    expect(validateQuestion(base)).toEqual([]);
    expect(validateQuestion({ ...base, answer: 'E' })[0]).toContain('只有 4 个选项');
    expect(validateQuestion({ ...base, type: '多选', answer: 'AC' })).toEqual([]);
    expect(validateQuestion({ ...base, type: '判断', options: undefined, answer: '是' })).toContain('判断题答案须为 对/错');
    expect(validateQuestion({ ...base, type: '填空', options: undefined, answer: [] })).toContain('答案为空');
    expect(validateQuestion({ ...base, status: '未知' }).length).toBe(1);
    expect(validateQuestion({ ...base, status: '需家长确认' })).toContain('需家长确认 必须写 review_note');
    expect(validateQuestion({ ...base, grade: 'K1' })).toContain('幼儿园题最多 3 个选项');
  });
  it('game_ready 以 status 重新计算，不一致给提示', () => {
    expect(gameReadyMismatch({ status: 'AI初审通过', game_ready: true })).toBeNull();
    expect(gameReadyMismatch({ status: '需家长确认', game_ready: '是' })).toContain('不一致');
    const b = loadBank({ questions: [{ ...base, status: '待审核', game_ready: true }] });
    expect(b.warnings.length).toBe(1); expect(b.counts.playable).toBe(0);
  });
});

describe('可玩规则与开关', () => {
  const st = ['已通过', 'AI初审通过', '待审核', '需家长确认', '停用'] as const;
  const qs = loadBank({ questions: st.map((s, i) => ({ ...base, id: 'q' + i, status: s, review_note: 'x' })) }).all;
  it('默认：已通过 + AI初审通过', () => expect(playable(qs, false).map(q => q.status)).toEqual(['已通过', 'AI初审通过']));
  it('家长开关：加入 待审核 / 需家长确认，停用永不出', () => {
    expect(playable(qs, true).map(q => q.status)).toEqual(['已通过', 'AI初审通过', '待审核', '需家长确认']);
    expect(canPlay('停用', true)).toBe(false);
  });
  it('导入预览计数：可玩 / 待家长确认 / 待审核 / 停用', () => {
    expect(loadBank({ questions: qs.map(q => ({ ...base, id: q.id, status: q.status, review_note: 'x' })) }).counts)
      .toEqual({ playable: 2, pendingParent: 1, pending: 1, disabled: 1, total: 5 });
  });
});

describe('判题', () => {
  const f = (a: string[], t?: number) => normalize({ ...base, type: '填空', options: undefined, answer: a, tolerance: t });
  it('分数按数值比较', () => {
    expect(isCorrect(f(['2/3']), '4/6')).toBe(true);
    expect(isCorrect(f(['-1/8']), '-0.125')).toBe(true);
    expect(isCorrect(f(['0.5']), '1/2')).toBe(true);
    expect(isCorrect(f(['3/2']), '1又1/2')).toBe(true);
    expect(isCorrect(f(['-64/9']), '-64/9')).toBe(true);
    expect(isCorrect(f(['2/3']), '0.67')).toBe(false);
    expect(isCorrect(f(['0.0012']), '1.2e-3')).toBe(true);
    expect(isCorrect(f(['9.8'], 0.1), '9.75')).toBe(true);
    expect(isCorrect(normalize({ ...base, type: '填空', options: undefined, answer: '9.8', tolerance: '0.1' }), '9.85')).toBe(true);
    expect(isCorrect(f(['Wednesday', 'wednesday']), ' WEDNESDAY ')).toBe(true);
    expect(parseNum('1/0')).toBeNull(); expect(parseNum('abc')).toBeNull(); expect(parseNum('50%')).toBe(0.5);
  });
  it('多选：全对 / 漏选 / 错选', () => {
    const m = normalize({ ...base, type: '多选', answer: 'AB' });
    expect(judge(m, ['A', 'B'])).toBe('full'); expect(judge(m, ['A'])).toBe('partial'); expect(judge(m, ['A', 'C'])).toBe('wrong');
  });
  it('幼儿园最多 3 个选项且含正确答案', () => {
    for (const q of loadBank(pub('K1')).all) { const c = kinderChoices(q); expect(c.length).toBeLessThanOrEqual(3); expect(c.some(x => q.answer.includes(x.key))).toBe(true); }
  });
  it('朗读：tts_text 优先，- 不读，含公式不读', () => {
    expect(ttsText(normalize({ ...base, tts_text: '读这个' }))).toBe('读这个');
    expect(ttsText(normalize({ ...base, tts_text: '-' }))).toBeNull();
    expect(ttsText(normalize({ ...base, question: '求 $x$' }))).toBeNull();
    expect(choicesOf(normalize({ ...base, type: '判断', options: undefined, answer: '对' })).map(c => c.key)).toEqual(['对', '错']);
  });
});

describe('CSV 导入', () => {
  it('引号、逗号、换行、BOM', () => {
    expect(parseCSV('\uFEFFa,b\n"x,1","he said ""hi""\nok"\n')).toEqual([['a', 'b'], ['x,1', 'he said "hi"\nok']]);
  });
  it.runIf(hasSrc)('真实 CSV（3 年级）与 JSON 等价', () => {
    const csv = csvToQuestions(readFileSync(SRC + '题库_3年级.csv', 'utf8'));
    const b = loadBank({ questions: csv }, '题库_3年级.csv');
    expect(b.bad).toEqual([]);
    expect(b.counts.playable).toBe(643);
    for (const q of b.all) expect(judge(q, q.type === '多选' ? q.answer : q.answer[0]), q.key).toBe('full');
  });
  it('toCSV → csvToQuestions 往返', () => {
    const text = toCSV(['id', 'status', 'subject', 'grade', 'type', 'question', 'A', 'B', 'answer', 'tag'],
      [{ id: 'z1', status: '已通过', subject: '数学', grade: 4, type: '选择', question: '1,2 哪个大?', A: '1', B: '2', answer: 'B', tag: 'a|b' }]);
    const [q] = csvToQuestions(text);
    expect(q.options.length).toBe(2); expect(q.tags).toEqual(['a', 'b']); expect(validateQuestion(q)).toEqual([]);
  });
});
