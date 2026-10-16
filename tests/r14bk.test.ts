import 'fake-indexeddb/auto';
const mem = new Map<string, string>(); (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() };
import { it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { backupSecretOk, importAll, getKV, setKV, currentPin, exportAll } from '../src/db';
import { makePinHash, verifyPin } from '../src/game/pin';
const file = () => JSON.parse(readFileSync('/workspace/zhishi/backup_test.json', 'utf8'));
it('复现文件：旧密码 / 恢复码能验证备份', async () => {
  expect(await backupSecretOk(file(), '2468')).toBe(true);
  expect(await backupSecretOk(file(), 'NTJZG9PT')).toBe(true);
});
for (const secret of ['2468', 'NTJZG9PT', 'ntjz-g9pt']) it(`导出 → 改密码 1357 → 在「当前密码」框输 ${secret} 导入成功`, async () => {
  await importAll(file(), { trusted: true });
  const st = await getKV<Record<string, unknown>>('settings');
  await setKV('settings', { ...st, pinHash: await makePinHash('1357') });
  localStorage.clear();
  const exported = await exportAll(); void exported;
  await expect(importAll(file(), { pin: '9999' })).rejects.toThrow();
  await importAll(file(), { pin: secret });
  const v = (await currentPin()).vault!;
  expect(await verifyPin('2468', v.pinHash)).toBe(true);   // 走备份验证 → 密码变成备份里的
});
it('当前密码正确 → 恢复后仍用现在的密码', async () => {
  await importAll(file(), { trusted: true });
  const st = await getKV<Record<string, unknown>>('settings');
  const h = await makePinHash('1357'); await setKV('settings', { ...st, pinHash: h }); localStorage.clear();
  await importAll(file(), { pin: '1357' });
  expect(await verifyPin('1357', (await currentPin()).vault!.pinHash)).toBe(true);
});
import { mergeBackup } from '../src/game/merge';
import { mergeAll } from '../src/db';
it('合并规则：加档案、星取高、错题/记录并集去重、设备状态保持本机', () => {
  const cur = { kv: [['profiles', [{ id: 'a', name: 'A' }]], ['progress:a', { stars: { L1: 1, L2: 3 }, xp: 50, masteredStars: 1, plays: { L1: { day: 'd', count: 2 } } }], ['settings', { pinHash: 'CUR' }], ['usage:a', { '2026-10-16': { used: 60, bonus: 0 } }]] as [string, unknown][],
    answers: [[1, { profileId: 'a', questionId: 'q1', at: 1 }]] as any, wrong: [{ id: 'a|q1', updatedAt: 5 }], bank: [] };
  const bk = { kv: [['profiles', [{ id: 'a', name: 'A-old' }, { id: 'b', name: 'B' }]], ['progress:a', { stars: { L1: 3, L2: 1, L3: 2 }, xp: 20, masteredStars: 4 }], ['progress:b', { stars: { X: 2 } }], ['settings', { pinHash: 'OLD' }], ['usage:a', { '2026-10-16': { used: 999, bonus: 0 } }], ['usage:b', { '2026-10-16': { used: 999, bonus: 0 }, '2026-10-15': { used: 5, bonus: 0 } }]] as [string, unknown][],
    answers: [[7, { profileId: 'a', questionId: 'q1', at: 1 }], [8, { profileId: 'a', questionId: 'q2', at: 2 }]] as any, wrong: [{ id: 'a|q1', updatedAt: 9 }, { id: 'a|q2' }], bank: [] };
  const { out, summary } = mergeBackup(cur as any, bk as any, '2026-10-16'); const m = new Map(out.kv);
  expect((m.get('profiles') as any[]).map(p => p.name)).toEqual(['A', 'B']);
  expect((m.get('progress:a') as any).stars).toEqual({ L1: 3, L2: 3, L3: 2 }); expect((m.get('progress:a') as any).xp).toBe(50); expect((m.get('progress:a') as any).masteredStars).toBe(4);
  expect((m.get('settings') as any).pinHash).toBe('CUR'); expect(m.get('usage:a')).toEqual({ '2026-10-16': { used: 60, bonus: 0 } });
  expect(m.get('usage:b')).toEqual({ '2026-10-15': { used: 5, bonus: 0 } });
  expect(out.answers.length).toBe(2); expect(out.wrong.length).toBe(2); expect((out.wrong.find(w => w.id === 'a|q1') as any).updatedAt).toBe(9);
  expect(summary).toEqual({ profilesAdded: 1, levelsUpdated: 3, wrongAdded: 1, answersAdded: 1 });
});
it('合并需要现在的家长密码；先快照，撤销能回到合并前', async () => {
  await importAll(file(), { trusted: true });
  const st = await getKV<Record<string, unknown>>('settings'); await setKV('settings', { ...st, pinHash: await makePinHash('1357') }); localStorage.clear();
  const before = await exportAll(); const nProf = ((await getKV<any[]>('profiles')) ?? []).length;
  const bk = file(); const kv = new Map(bk.stores.kv); kv.set('profiles', [...(kv.get('profiles') as any[]), { id: 'zz-new', name: '新', avatar: '🐱', grade: '3', volumes: null, limit: { weekday: 30, weekend: 30 } }]); bk.stores.kv = [...kv.entries()];
  await expect(mergeAll(bk, { pin: '2468', today: '2026-10-16' })).rejects.toThrow();   // 备份时的旧密码不能用来合并
  const r = await mergeAll(bk, { pin: '1357', today: '2026-10-16' });
  expect(r.summary.profilesAdded).toBe(1); expect(((await getKV<any[]>('profiles')) ?? []).length).toBe(nProf + 1);
  expect(await verifyPin('1357', (await currentPin()).vault!.pinHash)).toBe(true);
  const snap = await getKV<any>('snapshot:last'); expect(snap.exportedAt).toBeTruthy();
  await importAll(snap, { trusted: true }); expect(((await getKV<any[]>('profiles')) ?? []).length).toBe(nProf); void before;
});
