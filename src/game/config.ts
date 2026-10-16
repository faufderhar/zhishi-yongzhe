/* 策划确认单（2026-10-15）设计参数；D1 演示奖励已由用户确认。D6 行动倒计时已取消（待策划新方案） */
export const DESIGN = {
  /** D1-①：小班两次答错看演示后，仍点亮爱心并给⭐（不计入「自己答对」）。false = 演示只点亮爱心、不给⭐ */
  kinderDemoReward: true,
  /** D6：小班答对后总时长 / 演示时长 / 第 1 次答错解锁 */
  kinder: { correctMs: 1200, demoMs: 2500, retryUnlockMs: 1500 /* r11：点错后固定锁 1.5 s（唯一来源） */ },
  /** D7：档案上限 */
  maxProfiles: 6,
};
