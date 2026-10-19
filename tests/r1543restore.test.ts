// r15.4.3 技术QA P3-1：覆盖恢复后所有防误入锁 / 错误计数清零（IndexedDB 和 localStorage 两份），不从备份带入
import 'fake-indexeddb/auto';
const mem = new Map<string, string>(); (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() };
import { it, expect } from 'vitest';
import { importAll, getKV, setKV, exportAll } from '../src/db';
import { makePinHash, loadLock, lockLeft, LOCK_KEYS_ALL } from '../src/game/pin';

it('备份里锁 1e308 / 一个月后 / fails 4（hugeall）→ 恢复后 5 个锁都是 fails 0、level 0、remain 0；刷新（loadLock 取两份较严）也不锁', async () => {
  const h = await makePinHash('2468');
  await setKV('settings', { includePending: false, pinHash: h }); await setKV('profiles', [{ id: 'a', name: '小明', avatar: '🧒', grade: '7', volumes: null, limit: { weekday: 30, weekend: 60 }, pinVault: { pinHash: h } }]);
  const huge = { fails: 4, level: 1e308, until: 1e308, remain: 1e308, seenAt: 1e308 };
  for (const k of LOCK_KEYS_ALL) await setKV(k, k === 'zy.pinLock' ? huge : { ...huge, long: true });
  const bk = await exportAll();
  // 本机现在没锁；备份带着锁
  for (const k of LOCK_KEYS_ALL) { await setKV(k, { fails: 0, level: 0, until: 0, remain: 0, seenAt: Date.now() }); localStorage.setItem(k, JSON.stringify({ fails: 2, level: 0, until: 0, remain: 0 })); }
  await importAll(bk, { pin: '2468' });
  for (const k of LOCK_KEYS_ALL) {
    const v = await getKV<any>(k); expect(v, k).toMatchObject({ fails: 0, level: 0, until: 0, remain: 0 });
    expect(JSON.parse(localStorage.getItem(k)!), k).toMatchObject({ fails: 0, level: 0, remain: 0 });
    const l = await loadLock(k); expect(lockLeft(l), k).toBe(0); expect(l.fails, k).toBe(0); expect(l.level, k).toBe(0);
  }
});
it('备份锁 -5（fails 4）→ 恢复后 fails 0', async () => {
  await setKV('zy.pinLock', { fails: 4, level: 3, until: -5, remain: -5, seenAt: -5 }); const bk = await exportAll();
  await setKV('zy.pinLock', { fails: 0, level: 0, until: 0, remain: 0 });
  await importAll(bk, { pin: '2468' });
  expect(await getKV<any>('zy.pinLock')).toMatchObject({ fails: 0, level: 0, remain: 0 });
});
it('较真家长 P2-1：导出后（备份文件里还没有 lastBackupAt）再覆盖恢复 →「上次备份」保留本机记录，不变成从未备份', async () => {
  await setKV('lastBackupAt', undefined as any); const bk = await exportAll(); await new Promise(r => setTimeout(r, 10)); const t = Date.now(); await setKV('lastBackupAt', t);
  await importAll(bk, { pin: '2468' }); expect(await getKV<number>('lastBackupAt')).toBe(t);
});
it('较真家长 P2-1：本机没有记录 → 用这份备份的导出时间；未来的导出时间不采用', async () => {
  await setKV('lastBackupAt', undefined as any); const bk = await exportAll();
  await importAll(bk, { pin: '2468' }); expect(await getKV<number>('lastBackupAt')).toBe(Date.parse(bk.exportedAt));
  const fut = { ...bk, exportedAt: new Date(Date.now() + 864e5).toISOString() }; await setKV('lastBackupAt', undefined as any);
  await importAll(fut, { pin: '2468' }); expect(await getKV<number>('lastBackupAt')).toBeUndefined();
});
