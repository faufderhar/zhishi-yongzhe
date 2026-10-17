/* r15.3 学霸：填空数字键盘的两条规则（纯函数，便于测试）
   1) 「-」只能出现在一个数的开头：输入开头、紧跟 / 之后（分母为负）、紧跟 e 之后（×10ⁿ 的负指数）；其他位置按了不算（不会出现「3-」）
   2) 多指几乎同时按下：按 pointerdown 的时间戳排序，而不是事件到达的先后。
      实测（CDP Input.dispatchTouchEvent）：浏览器把事件带的 timestamp 原样放进 e.timeStamp；
      同一个 touchStart 里带多个手指时，各 pointerdown 的 timeStamp 相同，顺序就是手指列表的顺序。 */
export const minusOk = (v: string) => v === '' || v.endsWith('/') || v.endsWith('e');
export const addNumKey = (v: string, k: string) => (k === '-' && !minusOk(v) ? v : v + k);
export type KeyFn = (v: string) => string;
export interface Burst { base: string; cur: string; at: number; ev: { t: number; f: KeyFn }[] }
export const BURST_MS = 150;
/** 记一次按下：t = 按下时间戳（e.timeStamp），now = 处理时刻。
    相隔 BURST_MS 以内的按键算一串：晚到但时间更早的键插回它该在的位置，整串从串开始前的值重算。
    当前值被外部改过（换题清空等）就重新开一串。 */
export function press(b: Burst | null, value: string, t: number, now: number, f: KeyFn): Burst {
  const nb: Burst = !b || now - b.at > BURST_MS || value !== b.cur ? { base: value, cur: value, at: now, ev: [] } : { ...b, ev: [...b.ev] };
  let i = nb.ev.length; while (i > 0 && nb.ev[i - 1].t > t) i--;   // 同一时间戳保持到达顺序
  nb.ev.splice(i, 0, { t, f }); nb.at = now;
  nb.cur = nb.ev.reduce((v, e) => e.f(v), nb.base);
  return nb;
}
