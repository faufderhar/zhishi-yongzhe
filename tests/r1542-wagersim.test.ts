/* r15.4.2 游戏策划：押注开关改完后，高一 Boss 模拟（tests/sim.test.ts 同一套前提：2 级题、主修科目、5 个角色轮流、真实技能、复活 4 次机会对 2 题、每题 15–25 秒、标准卡），
   正确率 70% / 60%，全不押 vs 我方回合全押。要求：60% 时全押通关率低于不押；两档全押平均时长都更短。数值不在这里调。 */
import { describe, it, expect } from 'vitest';
import { simulate } from './sim.test';
const N = 20000;
export const WSIM: Record<string, ReturnType<typeof simulate>> = {};
describe('r15.4.2 高一 Boss：全押 vs 不押', () => {
  for (const acc of [0.7, 0.6]) it(`正确率 ${acc * 100}%`, () => {
    const no = WSIM[`${acc}-no`] = simulate('h', 'boss', acc, N, 2026, undefined, false);
    const all = WSIM[`${acc}-bet`] = simulate('h', 'boss', acc, N, 2026, undefined, true);
    const f = (r: typeof no) => `通关(含复活/撤退) ${(r.win * 100).toFixed(1)}% · 打倒 Boss ${(r.kill * 100).toFixed(1)}% · 不复活通关 ${(r.norev * 100).toFixed(1)}% · 撤退 ${(r.ret * 100).toFixed(1)}% · 平均 ${r.turns.toFixed(2)} 回合 · 平均 ${r.min.toFixed(2)} 分钟（P90 ${r.p90.toFixed(2)}）`;
    console.log(`WSIM 高一 Boss ${acc * 100}% ×${N} 局 | 不押：${f(no)}\nWSIM 高一 Boss ${acc * 100}% ×${N} 局 | 全押：${f(all)}`);
    expect(all.min).toBeLessThan(no.min); expect(all.turns).toBeLessThan(no.turns);
    if (acc === 0.6) expect(all.win).toBeLessThan(no.win);
  }, 120000);
});
