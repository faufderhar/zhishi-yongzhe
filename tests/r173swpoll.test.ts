// r17.3（学霸 r17.2.1：页开着跨发版 20 秒+ 无更新条 / 无自动刷新——以前只在启动、切回前台 ≥60 秒、每小时检查）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeUpdateTrigger, UPDATE_POLL_MS, NUDGE_MIN_GAP_MS } from '../src/swUpdate';

describe('r17.3 SW 更新检查节流', () => {
  const mk = () => { let t = 1_000_000; const runs: string[] = []; const tr = makeUpdateTrigger(w => runs.push(w), NUDGE_MIN_GAP_MS, () => t); return { tr, runs, adv: (ms: number) => { t += ms; } }; };
  it('可见轮询 5 分钟，focus/online/pageshow 限 1 次/分钟', () => {
    expect(UPDATE_POLL_MS).toBe(5 * 60e3); expect(NUDGE_MIN_GAP_MS).toBe(60e3);
  });
  it('还没检查过：第一次 focus 就查', () => { const { tr, runs } = mk(); expect(tr.nudge('focus')).toBe(true); expect(runs).toEqual(['focus']); });
  it('启动检查后 1 分钟内 focus / online / pageshow 都跳过；满 1 分钟再查', () => {
    const { tr, runs, adv } = mk(); tr.kick('load');
    adv(1000); expect(tr.nudge('pageshow')).toBe(false); adv(30e3); expect(tr.nudge('focus')).toBe(false); adv(28e3); expect(tr.nudge('online')).toBe(false);
    adv(1001); expect(tr.nudge('focus')).toBe(true); adv(10); expect(tr.nudge('focus')).toBe(false);
    expect(runs).toEqual(['load', 'focus']);
  });
  it('轮询 / 切回前台（kick）不受限流，但会重置限流起点', () => {
    const { tr, runs, adv } = mk(); tr.kick('load'); adv(5); tr.kick('poll'); adv(5); tr.kick('visible'); adv(59e3); expect(tr.nudge('focus')).toBe(false);
    expect(runs).toEqual(['load', 'poll', 'visible']);
  });
  const src = readFileSync('src/swUpdate.ts', 'utf8');
  it('setupSW：只在页面可见时轮询；focus / online / pageshow 走限流；启动检查也记时间', () => {
    expect(src).toMatch(/setInterval\(\(\) => \{ if \(document\.visibilityState === 'visible'\) trig\.kick\('poll'\); \}, testPoll > 0 \? testPoll : UPDATE_POLL_MS\)/);
    expect(src).toMatch(/for \(const ev of \['focus', 'online', 'pageshow'\] as const\) window\.addEventListener\(ev, \(\) => \{ trig\.nudge\(ev\); \}\)/);
    expect(src).toMatch(/window\.addEventListener\('load', \(\) => \{ trig\.kick\('load'\); \}\)/);
    expect(src).not.toMatch(/60 \* 60e3/);   // 每小时那次被可见轮询取代
    expect(src).toMatch(/if \(Date\.now\(\) - hiddenAt < 60e3\) return; trig\.kick\('visible'\)/);   // r14：60 秒内回来不算切回前台（保留）
  });
  it('测试钩子 __zyUpdatePollMs 只在测试构建里，且在生产包钩子清单里', () => {
    expect(src).toMatch(/const testPoll = __TEST_HOOKS__ \? Number\(\(window as unknown as \{ __zyUpdatePollMs\?: number \}\)\.__zyUpdatePollMs\) \|\| 0 : 0;/);
    expect(readFileSync('scripts/check-prod-hooks.mjs', 'utf8')).toMatch(/'__zyUpdatePollMs'/);
  });
});
