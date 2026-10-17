/* r15.4 策划定稿：取消重设申请要家长密码或恢复码；和恢复码重设共用「连错 5 次锁 24 小时」计数；文字是策划定稿 */
import 'fake-indexeddb/auto';
const mem = new Map<string, string>(); (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() };
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { makePinHash, nextLock24, lockLeft, LONG_LOCK_MS } from '../src/game/pin';
import { cancelSecretOk, RESET_WHY, CANCEL_BTN } from '../src/ui/ResetCancel';
describe('r15.4 取消重设申请', () => {
  it('家长密码或恢复码才能取消；别的不行', async () => {
    const s = { pinHash: await makePinHash('2468'), pinRec: await makePinHash('SKHF6CMH') };
    expect(await cancelSecretOk(s, '2468')).toBe(true); expect(await cancelSecretOk(s, 'skhf-6cmh')).toBe(true);
    for (const x of ['', '1357', '0000', 'SKHF6CMX', 'abc']) expect(await cancelSecretOk(s, x)).toBe(false);
  });
  it('连错 5 次锁 24 小时（nextLock24，同一个 LK_REC 计数）', () => {
    let l = { fails: 0, level: 0, until: 0 }; for (let i = 0; i < 5; i++) l = nextLock24(l, false, 0); expect(lockLeft(l, 0)).toBe(LONG_LOCK_MS);
    const src = readFileSync('src/ui/ResetCancel.tsx', 'utf8'); expect(src).toMatch(/saveLock\(n, LK_REC\)/); expect(readFileSync('src/ui/Parent.tsx', 'utf8')).toMatch(/saveLock\(n, LK_REC\)/);
  });
  it('App：两个取消按钮都只打开输入框，不再直接清掉申请', () => {
    const a = readFileSync('src/App.tsx', 'utf8');
    expect(a).not.toMatch(/data-testid="pin-reset-(full-)?cancel" onClick=\{\(\) => \{?\s*setSettings/);
    expect(a.match(/onClick=\{\(\) => setCancelBox\(true\)\}>\{CANCEL_BTN\}/g)!.length).toBe(2);
    expect(CANCEL_BTN).toBe('不是我申请的？输入家长密码取消'); expect(a).toMatch(/<h1>有人申请重设家长密码<\/h1>/); expect(a).toMatch(/data-testid="pin-reset-full-ok".{0,80}>知道了</);
  });
  it('「为什么要等 3 天？」和「没有恢复码？」是策划定稿文字', () => {
    expect(RESET_WHY).toEqual(['从申请算起要满 72 小时。', '这期间要在 3 个不同的日子打开游戏，每次开满 5 分钟，关着的时间才算数；累计要开满 30 分钟。', '到期前请联一次网，用来核对时间。', '如果平板的时间被往回调过，这次申请会取消，需要重新申请。', '等待期间，每次打开都会提醒「有人申请重设家长密码」；不是你申请的，输入家长密码就能取消。']);
    const p = readFileSync('src/ui/Parent.tsx', 'utf8'); expect(p).toMatch(/约 3 天后答对找回问题即可重设/); expect(p).not.toMatch(/72 小时后到期|任何人都能/);
  });
});
