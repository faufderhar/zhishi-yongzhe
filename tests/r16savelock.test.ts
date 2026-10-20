// r16 技术QA P3 saveLock：清零之后马上输错 5 次 → 刷新仍锁（正确 PIN 后 / 首次设置后 / 覆盖恢复后）；恢复期间 / 清零前看到的旧状态照旧丢掉
import 'fake-indexeddb/auto';
const mem = new Map<string, string>(); (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() };
import { it, expect, afterEach } from 'vitest';
import { nextLock, nextLock24, saveLock, loadLock, lockLeft, LK, LK_HINT, LK_REC, makePinHash, type LockState } from '../src/game/pin';
import { importAll, exportAll, setKV } from '../src/db';
import { setRestoring } from '../src/runtimeFlags';
afterEach(() => { setRestoring(false); });   // r16.2：模块内变量（不再是 window.__zyRestoring）
const wrong5 = async (start: LockState, key = LK, nx = nextLock) => { let l = start; for (let i = 0; i < 5; i++) { l = nx(l, false, Date.now()); await saveLock(l, key); } return l; };

it('正确 PIN 之后马上输错 5 次 → 刷新（loadLock）仍锁 1 分钟', async () => {
  let l = await loadLock(); l = nextLock(l, true, Date.now()); await saveLock(l);
  const after = await wrong5(l); expect(lockLeft(after)).toBe(60e3);
  const re = await loadLock(); expect(lockLeft(re)).toBeGreaterThan(59e3); expect(re.level).toBe(1);
});
it('首次设置（finishSet：三把锁都清零）之后马上输错 → 刷新仍锁；找回问题 / 恢复码 5 次 → 24 小时', async () => {
  const z = nextLock(await loadLock(), true, Date.now()); await saveLock(z);
  const zh = nextLock24(await loadLock(LK_HINT), true, Date.now()); await saveLock(zh, LK_HINT);
  const zr = nextLock24(await loadLock(LK_REC), true, Date.now()); await saveLock(zr, LK_REC);
  await wrong5(z); expect(lockLeft(await loadLock())).toBeGreaterThan(0);
  await wrong5(zh, LK_HINT, nextLock24); expect(lockLeft(await loadLock(LK_HINT))).toBeGreaterThan(23 * 3600e3);
  await wrong5(zr, LK_REC, nextLock24); expect(lockLeft(await loadLock(LK_REC))).toBeGreaterThan(23 * 3600e3);
});
it('覆盖恢复之后（恢复标志结束、重载读锁）马上输错 5 次 → 刷新仍锁', async () => {
  const h = await makePinHash('2468'); await setKV('settings', { includePending: false, pinHash: h }); await setKV('profiles', [{ id: 'a', name: '小明', avatar: '🧒', grade: '7', volumes: null, limit: { weekday: 30, weekend: 60 }, pinVault: { pinHash: h } }]);
  const bk = await exportAll(); await importAll(bk, { pin: '2468' }); setRestoring(false);   // 恢复标志结束（15 秒后 / 重载）。r16.2 前 node 里没有 window，标志根本没竖起来
  const l = await loadLock(); expect(lockLeft(l)).toBe(0); expect(l.fails).toBe(0);
  await wrong5(l); expect(lockLeft(await loadLock())).toBeGreaterThan(59e3);
});
it('恢复期间（__zyRestoring）不写；清零之前看到的旧状态（seenAt 更早）写不回去', async () => {
  const old: LockState = { fails: 3, level: 1, until: 0, remain: 0, seenAt: Date.now() - 5000 };
  await saveLock(nextLock(await loadLock(), true, Date.now()));   // 清零（seenAt = 现在）
  setRestoring(true); await saveLock({ ...old, remain: 300e3, until: Date.now() + 300e3 }); setRestoring(false);
  expect(lockLeft(await loadLock())).toBe(0);
  await saveLock(nextLock(old, false, Date.now()));                 // 旧计时器手里的 fails 3 → 4，seenAt 早于清零
  expect((await loadLock()).fails).toBe(0);
});
