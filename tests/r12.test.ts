/* r12：备份带密码 + 导入不取消重设；「难一档」相对当前难度、放宽到前序小节、重击卡兜底 */
import { describe, it, expect } from 'vitest';
import { pickHarder } from '../src/game/harder';
import { mergePin, backupVault } from '../src/game/backupPin';
import { cardOut, CARDS } from '../src/game/balance';
const Q = (key: string, difficulty: number, extra: Record<string, unknown> = {}) => ({ key, question: '题' + key, difficulty, subject: '数学', unit: 'U1', type: 'choice', ...extra });
describe('pickHarder', () => {
  it('相对当前自适应难度，不是相对目标档/本题', () => {
    const lesson = [Q('a', 2), Q('b', 3), Q('c', 4)];
    expect(pickHarder({ cur: 2, lesson, prior: [], used: [] })!.q.key).toBe('b');
    expect(pickHarder({ cur: 3, lesson, prior: [], used: [] })!.q.key).toBe('c');
  });
  it('本小节没有 → 前序小节；都没有 → undefined', () => {
    const lesson = [Q('a', 2)], prior = [Q('p', 3)];
    expect(pickHarder({ cur: 2, lesson, prior, used: [] })).toEqual({ q: prior[0], from: 'prior' });
    expect(pickHarder({ cur: 3, lesson, prior, used: [] })).toBeUndefined();
  });
  it('优先本小节，即使前序有正好 +1', () => {
    expect(pickHarder({ cur: 2, lesson: [Q('a', 4)], prior: [Q('p', 3)], used: [] })!.from).toBe('lesson');
  });
  it('不取出过的题干、排除题、跳过多选、其他科目；难度 5 没有更难', () => {
    const lesson = [Q('a', 3), Q('b', 3, { question: '题x' }), Q('c', 3, { subject: '语文' }), Q('d', 3, { multi: 1 })];
    expect(pickHarder({ cur: 2, lesson, prior: [], used: [Q('z', 2, { question: '题a' })], exclude: ['b'], subject: '数学', skip: (x: any) => !!x.multi })).toBeUndefined();
    expect(pickHarder({ cur: 5, lesson: [Q('a', 6)], prior: [], used: [] })).toBeUndefined();
  });
  it('重击卡用当前难度题时倍率按难度公式变小', () => {
    expect(cardOut(CARDS.heavy.out, 1)).toBeLessThan(cardOut(CARDS.heavy.out, 3));
  });
});
describe('备份密码', () => {
  const V = { pinHash: 'h-backup', recHash: 'r-backup' }, C = { pinHash: 'h-cur', recHash: 'r-cur' };
  const kv = (): [string, unknown][] => [['settings', { pinHash: 'h-backup', pinRec: 'r-backup', pinReset: { requestedAt: 1, effectiveAt: 2 }, x: 1 }], ['profiles', [{ id: 'p1' }]]];
  it('导出顶层 pin 优先读出', () => { expect(backupVault({ pin: V }, [])).toEqual({ pinHash: 'h-backup', pinHint: undefined, recHash: 'r-backup' }); expect(backupVault({}, kv())!.recHash).toBe('r-backup'); });
  it('当前没有密码 → 恢复备份的密码和恢复码，并写进每个档案', () => {
    const m = mergePin(kv(), { vault: null }, V); const s = m.kv[0][1] as any;
    expect(s.pinHash).toBe('h-backup'); expect(s.pinRec).toBe('r-backup'); expect((m.kv[1][1] as any)[0].pinVault.pinHash).toBe('h-backup');
    expect(s.pinReset).toBeUndefined(); expect(s.x).toBe(1);
  });
  it('当前有密码 → 保留当前密码', () => {
    const m = mergePin(kv(), { vault: C }, V); expect((m.kv[0][1] as any).pinHash).toBe('h-cur'); expect((m.kv[0][1] as any).pinRec).toBe('r-cur'); expect(m.vault).toBe(C);
  });
  it('导入不取消正在进行的重设', () => {
    const pr = { requestedAt: 10, effectiveAt: 20 };
    const m = mergePin([['settings', { pinHash: 'h-backup' }]], { vault: null, pinReset: pr }, V); expect((m.kv[0][1] as any).pinReset).toEqual(pr);
    const m2 = mergePin([], { vault: null, pinReset: pr }, null); expect((m2.kv[0][1] as any).pinReset).toEqual(pr);
  });
});
import { nextLock24, resumeLong, LONG_LOCK_MS, makePinHash, verifyPin, normAnswer, lockLeft } from '../src/game/pin';
import { hintCandidates, answerVariants, RESET_DELAY_MS, resetDue } from '../src/game/pinVault';
import { retreatCleared, levelStars } from '../src/game/levels';
describe('r12 密码找回', () => {
  it('找回问题 / 恢复码：连错 5 次锁 24 小时；关掉期间墙钟前进才扣，回拨不扣', () => {
    let s = { fails: 0, level: 0, until: 0, remain: 0 } as any; for (let i = 0; i < 4; i++) s = nextLock24(s, false, 1000); expect(lockLeft(s)).toBe(0);
    s = nextLock24(s, false, 1000); expect(s.remain).toBe(LONG_LOCK_MS);
    expect(resumeLong(s, 1000 + 3600e3).remain).toBe(LONG_LOCK_MS - 3600e3);
    expect(resumeLong(s, 0).remain).toBe(LONG_LOCK_MS);
    expect(resumeLong(s, 1000 + 99 * 3600e3).remain).toBe(LONG_LOCK_MS - 8 * 3600e3);   // r13 R12-2：关闭期间最多算 8 小时
  });
  it('迁移：r11 之前设的找回问题答案（r10 格式）仍然认', async () => {
    const r10 = { pinHash: await makePinHash('2468'), pinHint: { q: '孩子的小名是？', a: await makePinHash(normAnswer('测试小名')) } };
    const ok = async (ans: string, ...vs: any[]) => { for (const h of hintCandidates(...vs)) for (const v of answerVariants(ans)) if (await verifyPin(v, h)) return true; return false; };
    expect(await ok('测试小名', r10)).toBe(true);
    expect(await ok(' 测试 小名 ', r10)).toBe(true);
    expect(await ok('测试小名', { pinHint: { q: 'x', a: await makePinHash('别的') } }, { a: r10.pinHint.a })).toBe(true);   // 设置里的答案被换过，旧副本还在
    expect(await ok('别人', r10)).toBe(false);
  });
  it('延时重设 72 小时', () => { expect(RESET_DELAY_MS).toBe(72 * 3600e3); expect(resetDue({ requestedAt: 0, effectiveAt: RESET_DELAY_MS }, RESET_DELAY_MS, false)).toBe(true); expect(resetDue({ requestedAt: 0, effectiveAt: RESET_DELAY_MS }, RESET_DELAY_MS, true)).toBe(false); });
});
describe('r12 撤退', () => {
  it('正确率 ≥ 40%（半对 0.5）算通关最多 ★；< 40% 不得星', () => {
    expect(retreatCleared({ correct: 5.5, total: 14 })).toBe(false); expect(retreatCleared({ correct: 6, total: 15 })).toBe(true);
    expect(levelStars({ win: true, retreat: true, correct: 13, total: 14, revived: false })).toBe(1);
    expect(levelStars({ win: true, retreat: true, correct: 5, total: 14, revived: false })).toBe(0);
  });
});
import { tickPending, resumePending, pendingDue, newPending, GAP_CAP_MS } from '../src/game/pinVault';
describe('r12 技术QA R11-1：改系统时间拿不到家长权限', () => {
  const t0 = new Date(2026, 9, 16, 9).getTime();
  it('运行中把时钟往前调 25 小时 → 申请直接取消', () => {
    const p = newPending(t0); expect(tickPending(p, 30e3, 25 * 3600e3, t0 + 25 * 3600e3)).toBe('cancel');
  });
  it('关掉后把时钟往前调 25 小时 / 100 天再打开：最多只认 8 小时，不到期', () => {
    let p = newPending(t0); p = resumePending(p, t0 + 25 * 3600e3); expect(p.observed).toBe(GAP_CAP_MS); expect(pendingDue(p)).toBe(false);
    let q = newPending(t0); q = resumePending(q, t0 + 100 * 864e5); expect(pendingDue(q)).toBe(false);
  });
  it('往回调不补时间', () => { const p = resumePending(newPending(t0), t0 - 5 * 3600e3); expect(p.observed ?? 0).toBe(0); });
  it('就算真的到期也只是「到期」，仍要找回问题或恢复码（pendingDue 不会清密码）', () => {
    let p: any = newPending(t0); for (let i = 0; i < 9; i++) p = resumePending(p, (p.lastWall ?? t0) + GAP_CAP_MS); expect(pendingDue(p)).toBe(true);
  });
});
import { newTier, nextTier, tierCap } from '../src/game/consolidate';
describe('r13 自适应上限 min(目标+1, 3)', () => {
  const up = (t: any, n: number) => { for (let i = 0; i < n; i++) t = nextTier(t, true); return t; };
  it('目标 1 → 最高 2；目标 2/3/4 → 最高 3；目标 4 起步就是 3', () => {
    expect(up(newTier(1), 20).tier).toBe(2); expect(up(newTier(2), 20).tier).toBe(3); expect(up(newTier(3), 20).tier).toBe(3);
    expect(newTier(4).tier).toBe(3); expect(up(newTier(4), 20).tier).toBe(3); expect(tierCap(4)).toBe(3);
  });
  it('下限不变：最低 1', () => { let t: any = newTier(3); for (let i = 0; i < 20; i++) t = nextTier(t, false); expect(t.tier).toBe(1); });
  it('4 档只能来自挑战 / 重击（当前档 +1）', () => {
    const t = up(newTier(3), 20); expect(pickHarder({ cur: t.tier, lesson: [Q('a', 3), Q('b', 4)], prior: [], used: [] })!.q.difficulty).toBe(4);
  });
});
