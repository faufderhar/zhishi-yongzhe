// r15.3 较真家长 / 小萌新：今天用时永远 ≤ 上限（含加时）+ 3:00 收尾；家长页「已用 + 收尾」拆分
import { describe, it, expect } from 'vitest';
import { clampUsageAdd, splitUsed, graceBudgetMs, tickGrace, GRACE_MS, fmtMS } from '../src/game/playtime';

type Scr = 'map' | 'battle' | 'result';
/** 按 App 的计时逻辑逐秒模拟：answer 屏（battle）里到时开始收尾；收尾走完强制结算 → 结算页；其余界面照常计时（r15） */
function simulate(limitSec: number, plan: { s: Scr; sec: number }[], bonus = 0, batch = 5) {
  let used = 0, acc = 0, grace: number | null = null; let forced = false;
  const base = () => limitSec + bonus;
  for (const step of plan) for (let t = 0; t < step.sec; t++) {
    const scr: Scr = forced && step.s === 'battle' ? 'result' : step.s;
    const over = used >= base() && scr === 'battle';
    if (over && grace === null) grace = graceBudgetMs(used, base());
    if (!over) grace = null;
    if (grace !== null) { const g = tickGrace(grace, 1000, false); grace = g.left; if (g.fire) { grace = null; forced = true; } }
    acc += 1000;
    const near = base() - (used + acc / 1000) <= 6;
    if (acc >= batch * 1000 || (near && acc >= 1000)) { const sec = Math.floor(acc / 1000); acc -= sec * 1000; used += clampUsageAdd(used, sec, base(), grace !== null || over); }
  }
  return used;
}
describe('r15.3 收尾封顶', () => {
  it('5 分钟上限：打到时间 → 收尾 3 分钟 → 结算页 / 地图再待 5 分钟 → 已用最多 8:00', () => {
    const u = simulate(300, [{ s: 'battle', sec: 300 + 240 }, { s: 'result', sec: 120 }, { s: 'map', sec: 300 }]);
    expect(u).toBeLessThanOrEqual(480); expect(u).toBeGreaterThanOrEqual(478);
  });
  it('15 分钟上限同理（小萌新 15:59 → 不超过 18:00）', () => {
    expect(simulate(900, [{ s: 'map', sec: 60 }, { s: 'battle', sec: 900 }, { s: 'result', sec: 30 }, { s: 'battle', sec: 400 }, { s: 'map', sec: 600 }])).toBeLessThanOrEqual(1080);
  });
  it('到时时不在战斗里（地图 / 结算页）：不再涨，也没有收尾', () => {
    expect(simulate(300, [{ s: 'map', sec: 1000 }])).toBe(300);
  });
  it('含加时：上限 5 + 10 分钟 → 最多 18:00', () => {
    expect(simulate(300, [{ s: 'battle', sec: 2000 }, { s: 'map', sec: 500 }], 600)).toBeLessThanOrEqual(1080);
  });
  it('clampUsageAdd：不限时照常加；上限下调到已用以下时不再加', () => {
    expect(clampUsageAdd(10000, 5, Infinity, false)).toBe(5);
    expect(clampUsageAdd(400, 5, 300, false)).toBe(0); expect(clampUsageAdd(470, 30, 300, true)).toBe(10); expect(clampUsageAdd(500, 5, 300, true)).toBe(0);
  });
  it('收尾时长扣掉已经多记的秒数；同一天再次进入收尾不再给 3 分钟', () => {
    expect(graceBudgetMs(300, 300)).toBe(GRACE_MS); expect(graceBudgetMs(304, 300)).toBe(GRACE_MS - 4000); expect(graceBudgetMs(480, 300)).toBe(0);
  });
  it('家长页拆分：已用 5:00 + 收尾 3:00', () => {
    const s = splitUsed(480, 300); expect(`已用 ${fmtMS(s.play)} + 收尾 ${fmtMS(s.wrap)}`).toBe('已用 5:00 + 收尾 3:00');
    expect(splitUsed(200, 300)).toEqual({ play: 200, wrap: 0 }); expect(splitUsed(5000, Infinity)).toEqual({ play: 5000, wrap: 0 });
    expect(fmtMS(552)).toBe('9:12');
  });
});
