import { describe, it, expect } from 'vitest';
import { fmtBackupTime } from '../src/ui/Parent';
import { pendingWaitedMs, pendingDays, newPending, RESET_DELAY_MS, PEND_DAYS } from '../src/game/pinVault';

describe('r15.4 家长页', () => {
  it('备份时间用本机时间「10月17日 07:56」，不出现 ISO / Z', () => {
    const t = new Date(2026, 9, 17, 7, 56).getTime();
    expect(fmtBackupTime(t)).toBe('10月17日 07:56');
    expect(fmtBackupTime(new Date(t).toISOString())).toBe('10月17日 07:56');
  });
  it('忘记密码页进度条的上限和规则常量一致（72 小时 / 3 天）', () => {
    expect(RESET_DELAY_MS).toBe(72 * 3600e3); expect(PEND_DAYS).toBe(3);
    const p = newPending(Date.now()); expect(pendingWaitedMs(p)).toBe(0); expect(pendingDays(p)).toBeLessThanOrEqual(1);
  });
});
