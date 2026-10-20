// r16.1 (p)(q)(s)(t) 较真家长_r16：修改家长密码当场再验、恢复码重设答案输两次、改密码时键盘在最上面、改完按钮还在
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/ui/Parent.tsx', 'utf8');
const tab = src.slice(src.indexOf('function PinTab'), src.indexOf('const OLD_HINT_QUESTIONS'));
const gate = src.slice(src.indexOf('export function ParentGate'), src.indexOf('function PinTab'));
const recset = gate.slice(gate.indexOf("mode === 'recset'"), gate.indexOf("mode === 'forgot'"));

describe('r16.1 (p) 修改家长密码：存好后当场再验', () => {
  it('确认 + 自检通过后进入 verify，不直接 done', () => {
    expect(tab).toMatch(/checkPinSaved\(p\)[\s\S]{0,400}setStep\('verify'\);\s*\n\s*\}/);
    expect(tab).not.toMatch(/checkPinSaved\(p\)[^\n]*\n[^\n]*setStep\('done'\)/);
  });
  it('verify 用存下来的 settings 核对；对了才 done（并提示恢复码仍有效）；错了不计锁定次数、可重新设置', () => {
    const v = tab.slice(tab.indexOf("if (step === 'verify')"), tab.indexOf("if (step !== 'menu') return"));
    expect(v).toContain('再输一次刚设的密码试试'); expect(v).toContain('这一步输错不计次数');
    expect(v).toMatch(/getKV<[^>]*>\('settings'\)[\s\S]*verifyPin\(p, st\?\.pinHash/);
    expect(v).toMatch(/setViaChange\(true\); setStep\('done'\)/);
    expect(v).not.toMatch(/note\(|noteH\(|saveLock/);
    expect(v).toMatch(/pintab-verify-reset[\s\S]{0,120}setStep\('new'\)/);
  });
});
describe('r16.1 (q) 恢复码重设：找回答案输两次', () => {
  it('有第二个框、不一致提示、不一致时确定是灰的、「还差」里说明', () => {
    expect(recset).toContain('data-testid="recset-answer2"');
    expect(recset).toContain('recset-answer-mismatch');
    expect(recset).toMatch(/data-testid="recset-ok" disabled=\{[^}]*normAnswer\(ha2\) !== normAnswer\(ha\)\}/);
    expect(recset).toContain('再输一次相同的答案');
  });
  it('和首次设置同一个校验（normAnswer 比较两框）', () => {
    expect(gate).toMatch(/data-testid="hint-ok" disabled=\{[^}]*normAnswer\(ha2\) !== normAnswer\(ha\)/);
  });
  it('进入 recset 时第二个框清空', () => {
    expect(gate).toMatch(/setMode\('recset'\);[^\n]*setHa2\(''\)/);
  });
});
describe('r16.1 (s)(t) 键盘位置 / 按钮', () => {
  it('改密码时只显示键盘（不再压在开关 / 找回问题 / 恢复码卡片下面），并滚到键盘', () => {
    const pad = tab.slice(tab.indexOf("if (step !== 'menu') return"));
    expect(pad.slice(0, pad.indexOf('</div>;'))).not.toMatch(/toggles|HintEdit|RecGen/);
    expect(tab).toMatch(/scrollIntoView\?\.\(\{ block: 'start' \}\)/);
  });
  it('done 页面也有「修改家长密码…」按钮（第二次、第三次改完都在）', () => {
    const done = tab.slice(tab.indexOf("if (step === 'done')"), tab.indexOf("if (step === 'verify')"));
    expect(done).toContain('{changeBtn}');
    expect(tab).toMatch(/const changeBtn = <button [^\n]*data-testid="pintab-change"[^\n]*setStep\('old'\)/);
  });
});
