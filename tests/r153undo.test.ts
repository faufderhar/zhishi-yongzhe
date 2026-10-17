// r15.3 技术QA R152-3 / R152-4：撤销恢复连家长密码一起回到恢复前；覆盖恢复写库前清洗数字（真实 IndexedDB 流程）
import 'fake-indexeddb/auto';
const mem = new Map<string, string>(); (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() };
import { it, expect } from 'vitest';
import { importAll, getKV, setKV, currentPin, exportAll } from '../src/db';
import { makePinHash, verifyPin } from '../src/game/pin';

it('本机 1357 → 用备份（2468）覆盖恢复 → 撤销恢复：回到 1357（所有副本）', async () => {
  const h1357 = await makePinHash('1357'), h2468 = await makePinHash('2468');
  const prof = (h: string) => [{ id: 'a', name: '小明', avatar: '🧒', grade: '7', volumes: null, limit: { weekday: 30, weekend: 60 }, pinVault: { pinHash: h } }];
  await setKV('settings', { includePending: false, pinHash: h2468 }); await setKV('profiles', prof(h2468)); await setKV('progress:a', { stars: { x: 1e308 }, plays: {}, xp: 'NaN', masteredStars: -4 });
  const backupA = await exportAll();
  await setKV('settings', { includePending: false, pinHash: h1357 }); await setKV('profiles', prof(h1357)); await setKV('progress:a', { stars: { y: 2 }, plays: {}, xp: 10, masteredStars: 0 });
  await importAll(backupA, { pin: '1357' });
  const after = await currentPin(); expect(await verifyPin('2468', after.vault!.pinHash)).toBe(true);
  const p = await getKV<any>('progress:a'); expect(p.stars).toEqual({ x: 3 }); expect(p.xp).toBe(0); expect(p.masteredStars).toBe(0);   // R152-4
  const snap = await getKV<any>('snapshot:last'); await importAll(snap, { trusted: true });
  const back = await currentPin(); expect(await verifyPin('1357', back.vault!.pinHash)).toBe(true); expect(await verifyPin('2468', back.vault!.pinHash)).toBe(false);
  const st = await getKV<any>('settings'); const ps = await getKV<any[]>('profiles');
  expect(await verifyPin('1357', st.pinHash)).toBe(true); expect(await verifyPin('1357', ps![0].pinVault.pinHash)).toBe(true);
  { const k = [...mem.keys()].find(x => mem.get(x)!.includes('"hash"'))!; expect(await verifyPin('1357', JSON.parse(mem.get(k)!).hash)).toBe(true); }   // localStorage 副本
  expect((await getKV<any>('progress:a')).stars).toEqual({ y: 2 });
});
