// r16.1 (u) 较真家长_r16 P3：取消加时 + 改上限后，剩余旁边一句说明（不改任何时长计算）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cancelBonus, cancelLeftLine, remainingSec, addBonus, type Usage } from '../src/game/playtime';

const D = '2026-10-19'; const mon = new Date('2026-10-19T12:00:00');
describe('r16.1 (u) cancelLeftLine', () => {
  // 较真家长的复现：上限 5/5，加 +10，玩到剩 1:11（已用 13:49）时取消没用的加时，再把上限改回 15/15
  const used = 13 * 60 + 49;
  let u: Usage = addBonus({ [D]: { used: 0, bonus: 0 } }, D, 600); u = { [D]: { ...u[D], used } };
  const c = cancelBonus(u, D, 300);
  it('改回 15/15：剩余仍是 1:11（数值不变），说明写清一共已玩 13:49、按上限 15:00 还剩 1:11', () => {
    const left = remainingSec({ weekday: 15, weekend: 15 }, c, D, mon);
    expect(left).toBe(71);
    expect(cancelLeftLine(c[D], 900, left)).toBe('今天一共已玩 13 分 49 秒（含已用掉的加时 8 分 49 秒），今天的上限是 15 分钟，还剩 1 分 11 秒');
  });
  it('还是 5/5：今天上限 = 5:00 + 已用加时 8:49 = 13:49，剩 0:00', () => {
    const left = remainingSec({ weekday: 5, weekend: 5 }, c, D, mon);
    expect(left).toBe(0);
    expect(cancelLeftLine(c[D], 300, left)).toBe('今天一共已玩 13 分 49 秒（含已用掉的加时 8 分 49 秒），今天的上限是 13 分 49 秒，还剩 0 秒');
  });
  it('没取消过加时 / 没加时 / 不限时 → 不显示', () => {
    expect(cancelLeftLine(u[D], 300, 0)).toBeNull();
    expect(cancelLeftLine({ used: 60, bonus: 0 }, 300, 240)).toBeNull();
    expect(cancelLeftLine(c[D], 0, Infinity)).toBeNull();
    expect(cancelLeftLine(undefined, 300, 10)).toBeNull();
  });
  it('家长页时长表的「今日剩余」格子里接上这一行（时间锁定时不显示）', () => {
    const src = readFileSync('src/ui/Parent.tsx', 'utf8');
    expect(src).toMatch(/!clockLocked && m \? cancelLeftLine\(r, m \* 60, v\)[\s\S]{0,120}data-testid=\{'left-why-' \+ p\.id\}/);
  });
});
