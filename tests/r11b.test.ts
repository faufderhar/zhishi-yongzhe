import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { tickGrace, GRACE_MS } from '../src/game/playtime';
import { makeRecoveryCode, normCode, resetDue, newPending, RESET_DELAY_MS, findVault, lostMode, fmtWhen } from '../src/game/pinVault';
import { makePinHash, verifyPin } from '../src/game/pin';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
import { withBossFirst } from '../src/game/bossUsage';
import { repairProfile } from '../src/state';

test('R10-1 收尾倒计时：暂停不走、单步最多 2 秒、到 0 触发一次', () => {
  let g = { left: GRACE_MS, fire: false };
  for (let i = 0; i < 60; i++) g = tickGrace(g.left, 1000, true);
  expect(g.left).toBe(GRACE_MS);
  g = tickGrace(g.left, 60_000, false); expect(g.left).toBe(GRACE_MS - 2000);   // 卡顿 / 调时钟不跳
  let fires = 0; for (let i = 0; i < 200 && g.left > 0; i++) { g = tickGrace(g.left, 1000, false); if (g.fire) fires++; }
  expect(fires).toBe(1); expect(g.left).toBe(0);
});
test('R10-2 恢复码：8 位、无易混字符、哈希可校验、不分大小写/空格', async () => {
  for (let i = 0; i < 200; i++) { const c = makeRecoveryCode(); expect(c).toMatch(/^[A-HJKMNP-Z2-9]{8}$/); }
  const c = makeRecoveryCode(); const h = await makePinHash(c);
  expect(await verifyPin(normCode(c.toLowerCase().slice(0, 4) + ' ' + c.slice(4)), h)).toBe(true);
  expect(await verifyPin('AAAAAAAA', h)).toBe(c === 'AAAAAAAA');
});
test('R10-2 延时重设（r12 起 72 小时）：不到点不生效；时钟锁定不生效；把时钟调回申请之前不生效', () => {
  const t0 = new Date(2026, 9, 16, 9, 0).getTime(); const p = newPending(t0);
  expect(p.effectiveAt - t0).toBe(RESET_DELAY_MS);
  expect(resetDue(p, t0 + RESET_DELAY_MS - 1, false)).toBe(false);
  expect(resetDue(p, t0 + RESET_DELAY_MS, false)).toBe(true);
  expect(resetDue(p, t0 + RESET_DELAY_MS, true)).toBe(false);
  expect(resetDue(undefined, t0 * 2, false)).toBe(false);
  expect(fmtWhen(p.effectiveAt)).toBe('10月19日9点');
});
test('R10-2 副本：设置丢了从孩子档案恢复；全没了且有档案 → lost，没档案 → 首次设置', async () => {
  const v = { pinHash: 's2:x:y', recHash: 's2:a:b' };
  expect(await findVault({}, [{}, { pinVault: v }])).toEqual(v);
  expect(await findVault({ pinHash: 'f1:q:w', pinRec: 'r' }, [{ pinVault: v }])).toEqual({ pinHash: 'f1:q:w', pinHint: undefined, recHash: 'r' });
  expect(await findVault({}, [{}])).toBeNull();
  expect(lostMode(true)).toBe('lost'); expect(lostMode(false)).toBe('fresh');
  const p = repairProfile({ id: 'a', grade: '7', name: 'x', pinVault: v }); expect(p?.pinVault).toEqual(v);   // 档案修复不丢副本
});
test('bank usage 字段：boss 只进 Boss 关、Boss 优先出；未知值按 normal 并警告', () => {
  const raw = JSON.parse(readFileSync('public/banks/bank_7.json', 'utf8'));
  const list = raw.questions as any[];
  const all0 = loadBank(raw, 'bank_7.json').all; const qs0 = playable(all0, false);
  const ch0 = buildChapters(qs0, null, all0).find(c => c.levels.some(l => l.kind === 'boss'))!;
  const boss = ch0.levels.find(l => l.kind === 'boss')!;
  const normalLv = ch0.levels.find(l => l.kind === 'normal' && l.volume === boss.volume && l.unit === boss.unit)!;
  const pick = normalLv.pool[0]; const id = pick.split(':').slice(1).join(':');
  list.find(q => q.id === id).usage = 'boss';
  const odd = list.find(q => q.id !== id && !q.usage); odd.usage = 'weird';
  const b = loadBank(raw, 'bank_7.json');
  expect(b.warnings.some(w => w.id === odd.id && /usage=weird/.test(w.errors[0]))).toBe(true);
  expect(b.all.find(q => q.id === odd.id)?.usage).toBeUndefined();
  const chs = buildChapters(playable(b.all, false), null, b.all);
  const levels = chs.flatMap(c => c.levels);
  for (const l of levels) if (l.kind !== 'boss') expect(l.pool).not.toContain(pick);
  const b2 = levels.find(l => l.id === boss.id) ?? levels.find(l => l.kind === 'boss' && l.bossPool?.includes(pick));
  expect(b2?.bossPool).toContain(pick);
  expect(withBossFirst([{ key: 'B' }], [{ key: 'x' }, { key: 'B' }, { key: 'y' }], 3).map(q => q.key)).toEqual(['B', 'x', 'y']);
});
