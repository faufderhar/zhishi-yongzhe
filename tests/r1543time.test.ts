// r15.4.3 较真家长 P2-4 / P3：取消加时后数字前后一致；用完时的文案
import { it, expect } from 'vitest';
import { addBonus, addUsage, cancelBonus, bonusUsedSec, cancelPreview, bonusAllSpent, remainingSec, type Usage } from '../src/game/playtime';
import { timeLeftText } from '../src/ui/Screens';
const D = '2026-10-18', L5 = { weekday: 5, weekend: 5 }, L15 = { weekday: 15, weekend: 15 };
it('上限 5 分钟、加 10 分钟、玩了 9:14 → 取消没用的 5:46；之后把上限改回 15，留下的 4:14 仍是「已用掉、不能取消」', () => {
  let u: Usage = addBonus({}, D, 600); u = addUsage(u, D, 554, 900);
  expect(cancelPreview(u[D], 300)).toEqual({ cancel: 346, leftAfter: 0 });
  u = cancelBonus(u, D, 300); expect(u[D]).toMatchObject({ bonus: 254, spent: 254, used: 554 });
  expect(bonusAllSpent(u[D])).toBe(true);
  expect(bonusUsedSec(u[D], 300)).toBe(254); expect(bonusUsedSec(u[D], 900)).toBe(254);   // 以前上限 15 时算成 0 →「取消没用的 4:14」
  expect(cancelPreview(u[D], 900).cancel).toBe(0);
  expect(remainingSec(L5, u, D)).toBe(0); expect(remainingSec(L15, u, D)).toBe(900 - 554);   // r16 较真家长 1：取消时上限 capAt = 5:00 + 4:14；改成 15 后今天上限 = max(15:00, 9:14) = 15:00（以前 15:00 + 4:14，多出 4:14）
});
it('取消后又加 10 分钟 → 新加的可以取消，留下的已用部分不变', () => {
  let u: Usage = addBonus({}, D, 600); u = addUsage(u, D, 554, 900); u = cancelBonus(u, D, 300); u = addBonus(u, D, 600);
  expect(bonusAllSpent(u[D])).toBe(false); expect(bonusUsedSec(u[D], 300)).toBe(254); expect(cancelPreview(u[D], 300).cancel).toBe(600);
  u = cancelBonus(u, D, 300); expect(u[D]).toMatchObject({ bonus: 254, spent: 254 });
});
it('全部没用就取消 → 不留 spent', () => { const u = cancelBonus(addBonus({}, D, 600), D, 300); expect(u[D]).toEqual({ used: 0, bonus: 0 }); });
it('P3 文案：用完时不再写「还能玩 0 分钟（含今天临时加时…）」', () => {
  expect(timeLeftText(0, 254)).toBe('今天的时间已用完（其中临时加时 4 分钟也已用完）');
  expect(timeLeftText(0, 0)).toBe('今天还能玩 0 分钟'); expect(timeLeftText(600, 600)).toBe('今天还能玩 10 分钟（含今天临时加时 10 分钟）');
});
it('r15.4.4 较真家长：加时取消后（只剩取消前已用的部分）首页 / 地图不再写「含今天临时加时」；取消后再加 10 分钟照常写', async () => {
  const { bonusShown, cancelBonus, addBonus } = await import('../src/game/playtime');
  const day = '2026-10-19'; const u0 = { [day]: { used: 611, bonus: 600 } } as any;
  expect(bonusShown(u0, day)).toBe(600);
  const u1 = cancelBonus(u0, day, 300); expect(u1[day].bonus).toBe(311); expect(bonusShown(u1, day)).toBe(0);
  const { timeLeftText } = await import('../src/ui/Screens'); expect(timeLeftText(600, bonusShown(u1, day))).toBe('今天还能玩 10 分钟');
  const u2 = addBonus(u1, day, 600); expect(bonusShown(u2, day)).toBe(911);
});
