// r15.4.3 较真家长 P1：设新密码后的自检——所有副本都得能用刚输入的密码通过，否则报出对不上的副本
import 'fake-indexeddb/auto';
const mem = new Map<string, string>(); (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() };
import { it, expect } from 'vitest';
import { setKV, checkPinSaved } from '../src/db';
import { makePinHash } from '../src/game/pin';
import { writeLocal } from '../src/game/pinVault';
const prof = (h: string) => [{ id: 'a', name: '小明', avatar: '🧒', grade: '7', pinVault: { pinHash: h } }];
it('四份副本都是新密码 → 通过', async () => {
  const h = await makePinHash('2468'); await setKV('settings', { pinHash: h }); await setKV('profiles', prof(h)); writeLocal({ pinHash: h });
  expect(await checkPinSaved('2468', 1)).toEqual({ ok: true, bad: [] });
});
it('库里的设置还是旧密码（没存上 / 被旧值写回）→ 不通过，指出 settings 和锁屏用的 vault', async () => {
  const n = await makePinHash('2468'), o = await makePinHash('1357'); await setKV('settings', { pinHash: o }); await setKV('profiles', prof(n)); writeLocal({ pinHash: n });
  const r = await checkPinSaved('2468', 2, 5); expect(r.ok).toBe(false); expect(r.bad).toEqual(['settings', 'vault']);
});
it('localStorage / 档案副本是旧的 → 不通过', async () => {
  const n = await makePinHash('2468'), o = await makePinHash('1357'); await setKV('settings', { pinHash: n }); await setKV('profiles', prof(o)); writeLocal({ pinHash: o });
  expect((await checkPinSaved('2468', 1)).bad).toEqual(['local', 'profile']);
});
it('输入时丢了一位（存的是 246 的指纹）→ 用 2468 自检不通过', async () => {
  const h = await makePinHash('246'); await setKV('settings', { pinHash: h }); await setKV('profiles', prof(h)); writeLocal({ pinHash: h });
  expect((await checkPinSaved('2468', 1)).ok).toBe(false);
});
it('写库稍晚一点到 → 等一会儿再查，通过', async () => {
  const n = await makePinHash('2468'), o = await makePinHash('1357'); await setKV('settings', { pinHash: o }); await setKV('profiles', prof(n)); writeLocal({ pinHash: n });
  setTimeout(() => void setKV('settings', { pinHash: n }), 30);
  expect((await checkPinSaved('2468', 10, 20)).ok).toBe(true);
});
