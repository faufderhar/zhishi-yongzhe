/* r17 C3：结算动画节拍（kFinaleClock）：B4 = max(1.2 s, 第 1 段朗读开始)，B5 = max(2.2 s, 第 2 段开始)；没声音 → 1.2 / 2.2 s；朗读一直不开始 → 看门狗 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { kFinaleClock, KFIN, CONFETTI_COLORS } from '../src/ui/kFinale';
let t = 0; const now = () => t;
beforeEach(() => { vi.useFakeTimers(); t = 0; }); afterEach(() => vi.useRealTimers());
const adv = async (ms: number) => { for (let i = 0; i < ms; i += 10) { t += 10; await vi.advanceTimersByTimeAsync(10); } };
const near = (got: [string, number][], want: [string, number][]) => { expect(got.map(x => x[0])).toEqual(want.map(x => x[0])); got.forEach((g, i) => expect(Math.abs(g[1] - want[i][1]), `${g[0]} ${g[1]}`).toBeLessThanOrEqual(10)); };   // 假时钟一格 10 ms
function run(voice: boolean) { const got: [string, number][] = []; const c = kFinaleClock({ voice, now, fire: b => got.push([b, t]) }); return { c, got }; }
describe('kFinaleClock', () => {
  it('没有声音：B4 1.2 s、B5 2.2 s（3 秒演完）', async () => {
    const { got } = run(false); await adv(4000); expect(got).toEqual([['b4', KFIN.b4], ['b5', KFIN.b5]]);
  });
  it('朗读早开始（0.9 s）：B4 不早于 1.2 s；第 2 段 3.1 s 开始 → B5 3.1 s', async () => {
    const { c, got } = run(true); await adv(900); c.seg(0); await adv(2200); c.seg(1); await adv(2000);
    near(got, [['b4', 1200], ['b5', 3100]]);
  });
  it('朗读晚开始（2.6 s）：B4 跟着第 1 段（2.6 s），B5 跟着第 2 段；B5 不早于 2.2 s', async () => {
    const { c, got } = run(true); await adv(2600); c.seg(0); await adv(1500); c.seg(1); await adv(100);
    near(got, [['b4', 2600], ['b5', 4100]]);
  });
  it('朗读一直不开始：4.5 s 看门狗飞星星，之后 3.5 s 再落彩带', async () => {
    const { got } = run(true); await adv(9000); expect(got).toEqual([['b4', KFIN.b4Wait], ['b5', KFIN.b4Wait + KFIN.b5Wait]]);
  });
  it('第 2 段先到（第 1 段没录音被跳过）：B4、B5 都不漏，顺序不乱', async () => {
    const { c, got } = run(true); await adv(1500); c.seg(1); await adv(1000); expect(got.map(x => x[0])).toEqual(['b4', 'b5']); expect(got[1][1]).toBe(2200);
  });
  it('跳过（点屏幕）：立刻 B4 + B5，之后不再重复', async () => {
    const { c, got } = run(true); await adv(100); c.finish(); await adv(9000); expect(got).toEqual([['b4', 100], ['b5', 100]]);
  });
  it('彩带颜色都是低饱和浅色（HSL 亮度 ≥ 80%），没有红色', () => {
    for (const hex of CONFETTI_COLORS) { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); const L = (Math.max(r, g, b) + Math.min(r, g, b)) / 2; expect(L, hex).toBeGreaterThanOrEqual(0.8); }
  });
});
