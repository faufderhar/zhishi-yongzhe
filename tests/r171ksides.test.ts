// r17.1（r16.1 延后项 b，小萌新 r16 问题 3）中班 L4「左右比多少」：两组图做成两个大按钮（只改显示，题库不动）
import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { loadBank, sideGroups, kinderChoices } from '../src/game/questions';
const bank = (f: string) => loadBank(JSON.parse(readFileSync('public/banks/' + f, 'utf8')), f);
const K2 = bank('bank_K2.json');
const EXPECT: Record<string, [number, number, string]> = { 'K2N-015': [6, 3, '左边'], 'K2N-016': [2, 7, '右边'], 'K2N-017': [8, 4, '左边'], 'K2N-018': [3, 9, '右边'], 'K2N-020': [7, 8, '右边'], 'K2N-021': [9, 8, '左边'], 'K2N-027': [9, 10, '右边'] };

it('中班 7 道「左边…，右边…，哪边…？」都拆成两组：个数对、问句留下、答案那组对', () => {
  const hit = K2.all.filter(q => sideGroups(q)).map(q => q.id).sort();
  expect(hit).toEqual(Object.keys(EXPECT).sort());
  for (const [id, [l, r, ans]] of Object.entries(EXPECT)) {
    const q = K2.all.find(x => x.id === id)!; const s = sideGroups(q)!;
    expect([s.left.length, s.right.length], id).toEqual([l, r]);
    expect(s.ask, id).toMatch(/哪边.*[？?]$/); expect(s.ask, id).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(new Set([...s.left, ...s.right]).size, id).toBe(1);   // 同一种图
    const key = q.options.find(o => o.text.trim() === ans)!.key; expect(q.answer, id).toEqual([key]);
  }
});
it('选项顺序固定：「左边」在左（不管题库里的 A/B 顺序、不管随机数）', () => {
  for (const id of Object.keys(EXPECT)) { const q = K2.all.find(x => x.id === id)!;
    for (const r of [0, 0.3, 0.99]) expect(kinderChoices(q, () => r).map(o => o.text.trim()), id).toEqual(['左边', '右边']); }
});
it('别的题都不受影响（所有题库没有误命中）', () => {
  for (const f of readdirSync('public/banks').filter(f => /^bank_.*\.json$/.test(f) && f !== 'bank_K2.json'))
    expect(bank(f).all.filter(q => sideGroups(q)).map(q => q.id), f).toEqual([]);
  // 形状像但选项不是「左边 / 右边」→ 不拆
  expect(sideGroups({ type: '选择', question: '左边🍎🍎，右边🍎，哪边多？', options: [{ key: 'A', text: '左边多' }, { key: 'B', text: '右边多' }] } as never)).toBeNull();
  expect(sideGroups({ type: '选择', question: '左边🍎🍎，右边🍎，哪边多？', options: [{ key: 'A', text: '左边' }, { key: 'B', text: '右边' }] } as never)).not.toBeNull();
});
