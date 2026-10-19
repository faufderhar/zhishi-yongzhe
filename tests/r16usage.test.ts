// r16 步骤 8a（较真家长 1）：取消加时后改每日上限不再多出时间（capAt / effBonus）
import { describe, it, expect } from 'vitest';
import { cancelBonus, effBonus, remainingSec, bonusAllSpent, cancelPreview, bonusUsedSec, addBonus, SPENT_LINE, type Usage } from '../src/game/playtime';
import { cleanUsage } from '../src/game/sanitize';
const D = '2026-10-19'; const mon = new Date(2026, 9, 19, 12);   // 周一
const L = (m: number) => ({ weekday: m, weekend: m });
// 报告复现：上限 5:00，用了 14:17（含 10 分钟加时），取消 → 已用加时 9:17
const cancelled = (): Usage => cancelBonus({ [D]: { used: 14 * 60 + 17, bonus: 600 } }, D, 300);

describe('effBonus / capAt', () => {
  it('取消时记下 capAt = 5:00 + 9:17 = 14:17，spent 9:17', () => { const r = cancelled()[D]; expect(r).toMatchObject({ bonus: 557, spent: 557, capAt: 857 }); expect(bonusAllSpent(r)).toBe(true); });
  it('改成 15:00 → 今天上限 15:00，剩 0:43；改回 5:00 → 上限 14:17，剩 0；改成 10:00 → 上限 14:17，剩 0', () => {
    const u = cancelled(), r = u[D];
    expect(900 + effBonus(r, 900)).toBe(900); expect(remainingSec(L(15), u, D, mon)).toBe(43);
    expect(300 + effBonus(r, 300)).toBe(857); expect(remainingSec(L(5), u, D, mon)).toBe(0);
    expect(600 + effBonus(r, 600)).toBe(857); expect(remainingSec(L(10), u, D, mon)).toBe(0);
  });
  it('改大上限后不会再出现可取消的部分（d7765c0 回归）', () => { const r = cancelled()[D]; for (const lim of [300, 600, 900, 3600]) { expect(cancelPreview(r, lim).cancel).toBe(0); expect(bonusUsedSec(r, lim)).toBe(557); } });
  it('没取消过：effBonus = bonus（和以前一样）', () => { const r = { used: 100, bonus: 600 }; for (const lim of [300, 900]) expect(effBonus(r, lim)).toBe(600); });
  it('旧记录（没有 capAt）：退回 min(spent, used − wrap − 每日上限)', () => { const r = { used: 857, bonus: 557, spent: 557 }; expect(effBonus(r, 300)).toBe(557); expect(effBonus(r, 900)).toBe(0); expect(effBonus({ ...r, wrap: 100 }, 300)).toBe(457); });
  it('取消后家长又加 10 分钟：新加的照常叠加', () => { const u = addBonus(cancelled(), D, 600), r = u[D]; expect(bonusAllSpent(r)).toBe(false); expect(effBonus(r, 900)).toBe(600); expect(effBonus(r, 300)).toBe(1157); });
  it('显示：单独一行「今天加时已用 9:17（剩余部分已取消）」', () => expect(SPENT_LINE(557)).toBe('今天加时已用 9:17（剩余部分已取消）'));
  it('cleanUsage 保留 spent / wrapTail / capAt / wrap', () => { const x = { [D]: { used: 900, bonus: 557, spent: 557, capAt: 857, wrap: 30, wrapTail: 20, junk: 1 } }; expect(cleanUsage(x)).toEqual({ [D]: { used: 900, bonus: 557, spent: 557, capAt: 857, wrap: 30, wrapTail: 20 } }); });
});

