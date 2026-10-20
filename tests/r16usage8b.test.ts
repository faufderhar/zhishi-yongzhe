// r16 步骤 8b（较真家长 2）：刷新 / 覆盖恢复 / 合并后仍是「已取消」、不能再取消（loadUsage 走 cleanUsage）；
// state.ts 的保存在 __zyRestoring 期间不写
import 'fake-indexeddb/auto';
const mem = new Map<string, string>(); (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() };
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { dayStr } from '../src/game/wrongbook';
import { cancelBonus, effBonus, remainingSec, bonusAllSpent, cancelPreview, bonusUsedSec, addBonus, SPENT_LINE, type Usage } from '../src/game/playtime';
import { cleanUsage } from '../src/game/sanitize';
import * as S from '../src/state';
import { importAll, exportAll, getKV, setKV, mergeAll } from '../src/db';
import { makePinHash } from '../src/game/pin';
const mon = new Date(2026, 9, 19, 12);   // 周一（本地时间正午：任何时区都是 10 月 19 日）
/* 覆盖恢复只保留「本机今天」那条用时，「今天」= 设备本地日期（db.ts / wrongbook.dayStr，按用户手机的时区，例如 Asia/Shanghai）。
   以前 D 写死 '2026-10-19'、却用真实时钟：换一天（或 CI 在 UTC 已是 10 月 20 日）就对不上。现在把时钟固定在 mon，D 用 App 的同一个日期函数算 */
const D = dayStr(mon);
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(mon); });
const L = (m: number) => ({ weekday: m, weekend: m });
// 报告复现：上限 5:00，用了 14:17（含 10 分钟加时），取消 → 已用加时 9:17
const cancelled = (): Usage => cancelBonus({ [D]: { used: 14 * 60 + 17, bonus: 600 } }, D, 300);
afterEach(() => { (globalThis as any).__zyRestoring = false; vi.useRealTimers(); });

describe('刷新 / 恢复 / 合并后仍是已取消', () => {
  const pid = 'kid';
  const setup = async () => { const h = await makePinHash('2468'); await setKV('settings', { includePending: false, pinHash: h }); await setKV('profiles', [{ id: pid, name: '小明', avatar: '🧒', grade: 'K1', volumes: null, limit: L(15), pinVault: { pinHash: h } }]); await S.saveUsage(pid, cancelled()); };
  const check = async () => { const u = await S.loadUsage(pid); const r = u[D]; expect(r).toMatchObject({ bonus: 557, spent: 557, capAt: 857 }); expect(bonusAllSpent(r)).toBe(true); expect(cancelPreview(r, 900).cancel).toBe(0); expect(remainingSec(L(15), u, D, mon)).toBe(43); };
  it('取消 → 刷新（loadUsage 读回）', async () => { await setup(); await check(); });
  it('取消前导出的备份 → 本机取消 → 覆盖恢复 → 刷新（今天的用时取本机那条，带 spent / capAt）', async () => { await setup(); await setKV('usage:' + pid, { [D]: { used: 857, bonus: 600 } }); const bk = await exportAll(); await S.saveUsage(pid, cancelled()); await importAll(bk, { pin: '2468' }); await check(); });
  it('取消后导出 → 覆盖恢复 → 刷新', async () => { await setup(); const bk = await exportAll(); await importAll(bk, { pin: '2468' }); await check(); });
  it('取消 → 导出 → 合并恢复 → 刷新', async () => { await setup(); const bk = await exportAll(); await mergeAll(bk, { pin: '2468', today: D }); await check(); });
});

describe('恢复期间 state.ts 的保存不写', () => {
  it('saveUsage / saveSettings / saveProfiles / saveProgress / saveSkills / saveFlags / saveClock 都不写；恢复结束后照常写', async () => {
    await setKV('usage:g', { [D]: { used: 1, bonus: 0 } }); await setKV('flags', { a: 1 });
    (globalThis as any).__zyRestoring = true;
    await S.saveUsage('g', { [D]: { used: 999, bonus: 0 } }); await S.saveFlags({ a: 2 }); await S.saveSettings({ x: 1 } as any); await S.saveProfiles([]); await S.saveProgress('g', { stars: { z: 3 } } as any); await S.saveSkills('g', { s: { level: 9 } } as any); await S.saveClock({ maxSeen: 1, locked: true });
    expect(await getKV<any>('usage:g')).toEqual({ [D]: { used: 1, bonus: 0 } }); expect(await getKV<any>('flags')).toEqual({ a: 1 });
    expect(await getKV<any>('progress:g')).toBeUndefined(); expect(await getKV<any>('skills:g')).toBeUndefined();
    (globalThis as any).__zyRestoring = false; await S.saveFlags({ a: 3 }); expect(await getKV<any>('flags')).toEqual({ a: 3 });
  });
});
