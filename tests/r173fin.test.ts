// r17.3 小萌新 r17.1 §2：最后一题答对 → 结算页 ≈ 3 s，不再等整句（技能名 + 变成好朋友）读完；结算页朗读仍排在它后面（afterVoiceThen）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { K_WAIT } from '../src/ui/Battle';
const src = readFileSync(new URL('../src/ui/Battle.tsx', import.meta.url), 'utf8');
const scr = readFileSync(new URL('../src/ui/Screens.tsx', import.meta.url), 'utf8');
describe('r17.3 幼儿园过关 ≈ 3 s', () => {
  it('finMs = 3000，其余上限不变', () => { expect(K_WAIT.finMs).toBe(3000); expect(K_WAIT.endCap).toBe(4000); expect(K_WAIT.nextCap).toBe(3500); });
  it('最后一题分支：按 finAt 收尾，不再 afterVoice 等整句', () => {
    const a = src.indexOf('if (last) {'), b = src.indexOf('onEnd({ win: true, correct: ns.first', a); const blk = src.slice(a, b);
    expect(blk).toMatch(/K_WAIT\.finMs/); expect(blk).not.toMatch(/Math\.min\(1600/); expect(blk).not.toMatch(/sleep\(Math\.min\(2500/);
    expect(blk.slice(blk.indexOf('const finAt'))).not.toMatch(/afterVoice\(/);
  });
  it('结算页自动朗读仍等前面的话读完（排队不打断）', () => { expect(scr).toMatch(/afterVoiceThen\(K_RESULT_AUTO\.minMs, K_RESULT_AUTO\.maxMs/); });
});
