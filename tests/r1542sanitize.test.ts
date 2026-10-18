// r15.4.2 技术QA P2：备份里每个数字 / 时间字段都过 sanitizeData；锁定值夹到 [now, now+最长]；设新密码清锁
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { sanitizeData, cleanKv, BACKUP_NUMERIC_FIELDS, SNOOZE_MAX_MS } from '../src/game/sanitize';
import { clampLock, lockLeft, LONG_LOCK_MS, LOCK_STEPS } from '../src/game/pin';
import { RESET_DELAY_MS } from '../src/game/pinVault';
const kvOf = (kv: [string, unknown][]) => new Map(sanitizeData({ kv }).kv as [string, unknown][]);
const BAD = [1e308, -1e308, Infinity, NaN, 'NaN', null, -5];
describe('r15.4.2 锁定值清洗', () => {
  it('pinLock 1e308 → 最多 15 分钟；until 夹到 [now, now+15分]', () => {
    const now = Date.now(); const m = kvOf([['zy.pinLock', { fails: 1e9, level: 1e308, until: 1e308, remain: 1e308, seenAt: 1e308 }]]);
    const l = m.get('zy.pinLock') as any; expect(l.remain).toBe(LOCK_STEPS[2]); expect(l.until).toBeLessThanOrEqual(Date.now() + LOCK_STEPS[2]); expect(l.until).toBeGreaterThanOrEqual(now);
    expect(l.fails).toBe(4); expect(l.level).toBe(99); expect(l.seenAt).toBeLessThanOrEqual(Date.now()); expect(lockLeft(l)).toBeLessThanOrEqual(15 * 60e3);
  });
  it('旧格式只有 until=1e308 也夹住', () => { const l = clampLock({ fails: 0, level: 3, until: 1e308 })!; expect(lockLeft(l)).toBeLessThanOrEqual(LOCK_STEPS[2]); });
  it('长锁 / 其它锁最多 24 小时', () => {
    for (const k of ['zy.hintLock', 'zy.recLock', 'zy.cancelLock', 'zy.importLock']) { const l = cleanKv(k, { fails: 2, level: 1, until: 1e308, remain: 1e308, long: true }) as any; expect(l.remain).toBe(LONG_LOCK_MS); expect(l.until).toBeLessThanOrEqual(Date.now() + LONG_LOCK_MS); }
    const pl = cleanKv('zy.pinLock', { fails: 0, level: 1, until: 1e308, remain: 1e308, long: true }) as any; expect(pl.remain).toBe(LONG_LOCK_MS);
  });
  it('过去的 until / 负 remain → 不锁', () => { const l = clampLock({ fails: 0, level: 0, until: 5, remain: -1e308 })!; expect(lockLeft(l)).toBe(0); expect(l.until).toBe(0); });
  it('NaN / 字符串 → 0 或丢掉', () => { expect(cleanKv('zy.pinLock', 'x')).toBeUndefined(); const l = clampLock({ fails: 'NaN', level: null, until: NaN, remain: NaN })!; expect(lockLeft(l)).toBe(0); expect(l.fails).toBe(0); });
  it('loadLock 读的时候也夹（parse 用 clampLock）', () => { const src = readFileSync('src/game/pin.ts', 'utf8'); expect(src).toMatch(/const parse = \(x: unknown, key = LK\): LockState \| null => clampLock\(x, key\)/); expect(src).toMatch(/parse\(await getKV\(key\), key\)/); });
  it('设新密码（恢复码重设 / 找回问题重设都走 finishSet）清家长密码锁和找回问题锁', () => {
    const src = readFileSync('src/ui/Parent.tsx', 'utf8'); const f = src.slice(src.indexOf('const finishSet'), src.indexOf('const finishSet') + 500);
    expect(f).toMatch(/nextLock\(lock, true/); expect(f).toMatch(/saveLock\(z\)/); expect(f).toMatch(/saveLock\(zh, LK_HINT\)/);
    expect(src).toMatch(/recset-ok[^\n]*finishSet\(np1/);
  });
});
describe('r15.4.2 其余数字字段', () => {
  it('backupSnoozeUntil ≤ now+30 天；坏值丢掉', () => {
    expect(cleanKv('backupSnoozeUntil', 1e308)).toBeLessThanOrEqual(Date.now() + SNOOZE_MAX_MS); expect(cleanKv('backupSnoozeUntil', NaN)).toBeUndefined(); expect(cleanKv('backupSnoozeUntil', -9)).toBe(0);
    const ok = Date.now() + 7 * 864e5; expect(cleanKv('backupSnoozeUntil', ok)).toBe(ok);
  });
  it('lastBackupAt ≤ now', () => { expect(cleanKv('lastBackupAt', 1e308)).toBeLessThanOrEqual(Date.now()); expect(cleanKv('lastBackupAt', 'x')).toBeUndefined(); });
  it('settings.volume / pinResetDoneAt / pinReset', () => {
    const now = Date.now(); const s = cleanKv('settings', { includePending: true, volume: 1e308, pinResetDoneAt: 1e308, pinHash: 'h', pinReset: { requestedAt: 1e308, effectiveAt: -1e308, netReq: 1e308, netLast: NaN, openTotal: 1e308, days: ['2026-10-18'] } }) as any;
    expect(s.volume).toBe(1); expect(s.pinResetDoneAt).toBeLessThanOrEqual(Date.now()); expect(s.pinHash).toBe('h'); expect(s.includePending).toBe(true);
    expect(s.pinReset.requestedAt).toBeLessThanOrEqual(Date.now()); expect(s.pinReset.requestedAt).toBeGreaterThanOrEqual(now); expect(s.pinReset.effectiveAt).toBeGreaterThanOrEqual(s.pinReset.requestedAt);
    expect(s.pinReset.effectiveAt).toBeLessThanOrEqual(Date.now() + RESET_DELAY_MS); expect(s.pinReset.netReq).toBeLessThanOrEqual(Date.now() + 864e5); expect('netLast' in s.pinReset).toBe(false); expect(s.pinReset.openTotal).toBeLessThanOrEqual(RESET_DELAY_MS * 10);
    expect((cleanKv('settings', { volume: 'loud', pinReset: { requestedAt: 'x' } }) as any)).toEqual({});
  });
  it('clock / rollup', () => {
    const c = cleanKv('clock', { maxSeen: 1e308, locked: 1, lockedAt: 1e308 }) as any; expect(c.maxSeen).toBeLessThanOrEqual(Date.now()); expect(c.locked).toBe(false); expect(c.lockedAt).toBeLessThanOrEqual(Date.now());
    expect(cleanKv('clock', { maxSeen: NaN })).toBeUndefined();
    const r = cleanKv('rollup:p1', { '2026-09': { math: { n: 1e308, ok: 1e308 }, cn: { n: 5, ok: 9 }, bad: { n: 'x' } }, junk: {} }) as any;
    expect(r).toEqual({ '2026-09': { math: { n: 1e6, ok: 1e6 }, cn: { n: 5, ok: 5 } } });
  });
  it('snapshot:last / corrupt:* 不带入；pinEverSet 只能是 1', () => {
    const m = kvOf([['snapshot:last', { a: 1 }], ['corrupt:settings:1', 'x'], ['zy.pinEverSet', 1e308], ['profiles', []]]); expect(m.has('snapshot:last')).toBe(false); expect(m.has('corrupt:settings:1')).toBe(false); expect(m.has('zy.pinEverSet')).toBe(false); expect(m.has('profiles')).toBe(true);
    expect(cleanKv('zy.pinEverSet', 1)).toBe(1);
  });
  it('每个坏值喂给每个数字键都不会留下非有限数 / 超范围', () => {
    const keys = ['zy.pinLock', 'zy.hintLock', 'zy.recLock', 'zy.cancelLock', 'zy.importLock', 'backupSnoozeUntil', 'lastBackupAt', 'clock', 'rollup:p', 'settings', 'flags', 'usage:p', 'progress:p', 'skills:p'];
    const walk = (v: unknown): void => { if (typeof v === 'number') { expect(Number.isFinite(v)).toBe(true); expect(v).toBeLessThanOrEqual(Date.now() + SNOOZE_MAX_MS); } else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    for (const b of BAD) for (const k of keys) {
      const shape: Record<string, unknown> = { 'zy.pinLock': { fails: b, level: b, until: b, remain: b, seenAt: b, gapUsed: b }, clock: { maxSeen: b, lockedAt: b }, 'rollup:p': { '2026-01': { m: { n: b, ok: b } } }, settings: { volume: b, pinResetDoneAt: b, pinReset: { requestedAt: Date.now() - 1, effectiveAt: b, netReq: b, netLast: b, lastWall: b, observed: b, openTotal: b, sessionOpen: b, gapUsed: b } }, flags: { a: b }, 'usage:p': { '2026-10-18': { used: b, bonus: b, wrap: b } }, 'progress:p': { stars: { a: b }, plays: { a: { day: 'x', count: b } }, xp: b, masteredStars: b }, 'skills:p': { m: { level: b, right: b, wrong: b } } };
      walk(cleanKv(k, shape[k] ?? (k.startsWith('zy.') ? shape['zy.pinLock'] : b)));
    }
  });
  it('字段清单覆盖所有键（报告用）', () => { const names = BACKUP_NUMERIC_FIELDS.map(r => r[0]).join('|'); for (const k of ['zy.pinLock', 'zy.importLock', 'backupSnoozeUntil', 'lastBackupAt', 'settings.volume', 'pinReset', 'clock', 'rollup', 'answers', 'wrong', 'usage', 'progress', 'skills', 'flags', 'limit']) expect(names).toContain(k); });
});
