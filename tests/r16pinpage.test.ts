// r16 第 8 步 (c) 较真家长：密码页——倒计时单独组件（父组件不再每秒 setState）、恢复码「已输入 n/8 位」、首次设置答案输两次、
//  修改家长密码也自检、设完密码马上再输一次核对
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { CodeCount } from '../src/ui/Parent';

const src = readFileSync('src/ui/Parent.tsx', 'utf8');
const gate = src.slice(src.indexOf('export function ParentGate'), src.indexOf('function LockLeft') > 0 ? src.indexOf('\n}\n', src.indexOf('export function ParentGate')) : undefined);
const cc = (v: string) => renderToStaticMarkup(createElement(CodeCount, { v }));

describe('r16 8c 密码页', () => {
  it('恢复码框显示已输入几位（分两组）、还差几位 / 多了几位；空时不显示', () => {
    expect(cc('')).toBe('');
    expect(cc('ab3')).toContain('已输入 3/8 位：AB3，还差 5 位');
    expect(cc('abcd-efgh')).toContain('已输入 8/8 位：ABCD EFGH<');
    expect(cc('ABCDEFGHJK')).toContain('已输入 8/8 位：ABCD EFGH（多了 2 位）');
    expect(cc('-- ')).toContain('已输入 0/8 位，还差 8 位');
  });
  it('倒计时挪进 LockLeft：ParentGate 里不再有每秒 setNow / tickLock', () => {
    expect(gate).not.toMatch(/setNow|tickLock\(/);
    expect(src).toMatch(/function LockLeft[\s\S]*tickLock\(cur, dt, Date\.now\(\)\)[\s\S]*saveLock\(n, k\)/);
    expect(gate).toContain('isRestoring()');   // 覆盖恢复时重新读锁仍在父组件（r16.2：runtimeFlags，不再是 window.__zyRestoring）
    expect((gate.match(/<LockLeft /g) ?? []).length).toBe(3);
  });
  it('恢复码输入框和「再输入一遍」都带计数', () => {
    expect(src).toMatch(/data-testid="rec-input"[^\n]*<CodeCount v=\{rc\} \/>/);
    expect(src).toMatch(/data-testid="rec-type"[^\n]*<CodeCount v=\{v\} \/>/);
  });
  it('首次设置：答案输两次，不一致提示且不能确定', () => {
    expect(gate).toContain('data-testid="hint-answer2"');
    expect(gate).toMatch(/hint-mismatch/);
    expect(gate).toMatch(/data-testid="hint-ok" disabled=\{[^}]*normAnswer\(ha2\) !== normAnswer\(ha\)/);
  });
  it('设完（记下恢复码之后）进入 verify：再输一次，用存下来的 settings 核对；可重新设置', () => {
    expect(gate).toMatch(/onConfirmed=\{[^}]*setMode\('verify'\)/); expect(gate).toMatch(/onLater=\{[^}]*setMode\('verify'\)/);
    expect(gate).toMatch(/mode === 'verify'[\s\S]*getKV<[^>]*>\('settings'\)[\s\S]*verifyPin\(p/);
    expect(gate).toMatch(/pin-verify-reset[\s\S]{0,40}|setResetting\(true\); setMode\('pin'\)/);
  });
  it('修改家长密码：setSettings 后 checkPinSaved，失败报错退回输入新密码', () => {
    const tab = src.slice(src.indexOf('function PinTab'));
    expect(tab).toMatch(/pinHash: await makePinHash\(p\) \}\); markPinSet\(\);[\s\S]{0,200}checkPinSaved\(p\)[\s\S]{0,300}setStep\('new'\); return;/);
  });
});
