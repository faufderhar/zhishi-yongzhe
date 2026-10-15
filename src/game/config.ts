/* 策划确认单（2026-10-15）里「需要用户拍板」的两项，先按默认实现，家长页可改（Settings 覆盖） */
export const DESIGN = {
  /** D1-①：小班两次答错看演示后，仍点亮爱心并给⭐（不计入「自己答对」）。false = 演示只点亮爱心、不给⭐ */
  kinderDemoReward: true,
  /** D6-②：答对后行动选择倒计时（秒），超时自动〔攻击〕；0 = 不限时 */
  actionSeconds: { G2: 8, G3: 8, J: 8, H: 6 } as Record<string, number>,
  /** D6：小班答对后总时长 / 演示时长 / 第 1 次答错解锁 */
  kinder: { correctMs: 1200, demoMs: 2500, retryUnlockMs: 800 },
  /** D7：档案上限 */
  maxProfiles: 6,
};
