/* r15 较真家长：取消申请 / 覆盖恢复都不能把家长锁在外面（用他的备份 /workspace/zy_backup_1017.json 的副本） */
import 'fake-indexeddb/auto';
const mem = new Map<string, string>(); (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() };
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { importAll, getKV, setKV, currentPin, exportAll, backupSecretOk } from '../src/db';
import { makePinHash, verifyPin } from '../src/game/pin';
import { findRec, normCode, newPending, writeLocal, writeRec } from '../src/game/pinVault';
const file = () => JSON.parse(readFileSync('tests/fixtures/backup_1017.json', 'utf8'));
const pinOk = async (p: string) => { const v = (await currentPin()).vault; return !!v && await verifyPin(p, v.pinHash); };
const recOk = async (c: string) => { const st = await getKV<any>('settings'); const ps = await getKV<any[]>('profiles') ?? []; const h = await findRec(st, ps, getKV); return !!h && await verifyPin(normCode(c), h); };
describe('较真家长：备份 1017', () => {
  beforeEach(async () => { localStorage.clear(); await importAll(file(), { trusted: true }); });
  it('备份本身：2468 和 SKHF6CMH 都对', async () => {
    expect(await backupSecretOk(file(), '2468')).toBe(true); expect(await backupSecretOk(file(), 'SKHF6CMH')).toBe(true);
    expect(await pinOk('2468')).toBe(true); expect(await recOk('SKHF6CMH')).toBe(true);
  });
  it('申请延时重设 → 取消申请：密码、恢复码都不变', async () => {
    const st = await getKV<any>('settings'); await setKV('settings', { ...st, pinReset: newPending(Date.now()) });
    const s2 = await getKV<any>('settings'); const { pinReset: _x, ...rest } = s2; void _x; await setKV('settings', rest);
    expect(await pinOk('2468')).toBe(true); expect(await recOk('SKHF6CMH')).toBe(true);
  });
  it('本机现在密码 2468 → 覆盖恢复（输 2468）：之后 2468、SKHF6CMH 都对', async () => {
    await importAll(file(), { pin: '2468' });
    expect(await pinOk('2468')).toBe(true); expect(await recOk('SKHF6CMH')).toBe(true);
  });
  it('本机被别人改成 1357（共用浏览器）→ 输备份的 2468 覆盖恢复：之后 2468、SKHF6CMH 都对，1357 不再对', async () => {
    const st = await getKV<any>('settings'); const h = await makePinHash('1357'); await setKV('settings', { ...st, pinHash: h }); writeLocal({ ...(await currentPin()).vault!, pinHash: h });
    await importAll(file(), { pin: '2468' });
    expect(await pinOk('2468')).toBe(true); expect(await pinOk('1357')).toBe(false); expect(await recOk('SKHF6CMH')).toBe(true);
  });
  it('本机恢复码在备份之后重新生成过 → 用恢复码 SKHF6CMH 覆盖恢复：之后备份的 2468 和 SKHF6CMH 都对', async () => {
    const nh = await makePinHash('ZZZZ2222'); const st = await getKV<any>('settings'); await setKV('settings', { ...st, pinRec: nh }); await writeRec(nh, setKV);
    await importAll(file(), { backupSecret: 'SKHF6CMH' });
    expect(await pinOk('2468')).toBe(true); expect(await recOk('SKHF6CMH')).toBe(true);
  });
  it('导出 → 恢复 往返：密码 / 恢复码不变', async () => {
    const ex = await exportAll(); localStorage.clear(); await importAll(ex, { pin: '2468' });
    expect(await pinOk('2468')).toBe(true); expect(await recOk('SKHF6CMH')).toBe(true);
  });
});
