// r15.4.3 较真家长 P2-4：取消加时后数字前后一致
import { it, expect } from 'vitest';
import { addBonus, addUsage, cancelBonus, bonusUsedSec, cancelPreview, bonusAllSpent, remainingSec, type Usage } from '../src/game/playtime';
const D = '2026-10-18', L5 = { weekday: 5, weekend: 5 }, L15 = { weekday: 15, weekend: 15 };
it('上限 5 分钟、加 10 分钟、玩了 9:14 → 取消没用的 5:46；之后把上限改回 15，留下的 4:14 仍是「已用掉、不能取消」', () => {
  let u: Usage = addBonus({}, D, 600); u = addUsage(u, D, 554, 900);
  expect(cancelPreview(u[D], 300)).toEqual({ cancel: 346, leftAfter: 0 });
  u = cancelBonus(u, D, 300); expect(u[D]).toMatchObject({ bonus: 254, spent: 254, used: 554 });
  expect(bonusAllSpent(u[D])).toBe(true);
  expect(bonusUsedSec(u[D], 300)).toBe(254); expect(bonusUsedSec(u[D], 900)).toBe(254);   // 以前上限 15 时算成 0 →「取消没用的 4:14」
  expect(cancelPreview(u[D], 900).cancel).toBe(0);
  expect(remainingSec(L5, u, D)).toBe(0); expect(remainingSec(L15, u, D)).toBe(900 + 254 - 554);   // 剩余时间算法不变（列给总管）
});
it('取消后又加 10 分钟 → 新加的可以取消，留下的已用部分不变', () => {
  let u: Usage = addBonus({}, D, 600); u = addUsage(u, D, 554, 900); u = cancelBonus(u, D, 300); u = addBonus(u, D, 600);
  expect(bonusAllSpent(u[D])).toBe(false); expect(bonusUsedSec(u[D], 300)).toBe(254); expect(cancelPreview(u[D], 300).cancel).toBe(600);
  u = cancelBonus(u, D, 300); expect(u[D]).toMatchObject({ bonus: 254, spent: 254 });
});
it('全部没用就取消 → 不留 spent', () => { const u = cancelBonus(addBonus({}, D, 600), D, 300); expect(u[D]).toEqual({ used: 0, bonus: 0 }); });
