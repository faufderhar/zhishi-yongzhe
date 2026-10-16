/* r14.2 小萌新：时区（北京 / 芝加哥 / 洛杉矶）和时区切换都不能被当成调钟；旧版本存下的锁定要重新判定 */
import { describe, it, expect } from 'vitest';
import { checkClock } from '../src/state';
import { dayStr } from '../src/game/wrongbook';
import { remainingSec, addBonus } from '../src/game/playtime';
const now = Date.parse('2026-10-16T18:50:00Z');
describe(`时钟检查（TZ=${process.env.TZ ?? '系统'}）`, () => {
  it('只按 epoch 毫秒：同一时刻在任何时区都不锁', () => {
    expect(checkClock({ maxSeen: now - 1000, locked: false }, now).locked).toBe(false);
    expect(checkClock({ maxSeen: now + 3 * 60e3, locked: false }, now).locked).toBe(false);   // 5 分钟内的误差
  });
  it('旧版本存下的 locked:true，没有真实回拨支撑 → 启动时解除', () => {
    const c = checkClock({ maxSeen: now - 60e3, locked: true, lockedAt: now - 86400e3 } as any, now);
    expect(c.locked).toBe(false); expect(c.maxSeen).toBe(now);
  });
  it('真的往回调 1 小时 → 锁；调回正确时间 → 自动解锁', () => {
    const a = checkClock({ maxSeen: now, locked: false }, now - 3600e3); expect(a.locked).toBe(true);
    expect(checkClock(a, now + 1000).locked).toBe(false);
  });
  it('换时区（北京 → 洛杉矶）：本地日期键「回到昨天」不算调钟；+10 分钟立刻生效', () => {
    // 北京时间写下的「今天」比洛杉矶的「今天」晚一天：这个键存在不能触发锁
    const sh = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(now));
    const here = dayStr(new Date(now)); expect(sh >= here).toBe(true);
    expect(checkClock({ maxSeen: now, locked: false }, now).locked).toBe(false);
    const u0 = { [sh]: { used: 30 * 60, bonus: 0 }, [here]: { used: 60 * 60, bonus: 0 } } as any;
    const lim = { weekday: 60, weekend: 60 } as any;
    const before = remainingSec(lim, u0, here, new Date(now)); const after = remainingSec(lim, addBonus(u0, here, 600), here, new Date(now));
    expect(after - before).toBe(600);
  });
});
