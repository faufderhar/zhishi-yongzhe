/* r15.3 学霸：填空数字键盘的两条规则（纯函数，便于测试）
   1) 「-」只能出现在一个数的开头：输入开头、紧跟 / 之后（分母为负）、紧跟 e 之后（×10ⁿ 的负指数）；其他位置按了不算（不会出现「3-」）
   2) 多指几乎同时按下：按 pointerdown 的时间戳排序，而不是事件到达的先后。
      实测（CDP Input.dispatchTouchEvent）：浏览器把事件带的 timestamp 原样放进 e.timeStamp；
      同一个 touchStart 里带多个手指时，各 pointerdown 的 timeStamp 相同，顺序就是手指列表的顺序。 */
export const minusOk = (v: string) => v === '' || v.endsWith('/') || v.endsWith('e');
/* r15.4.2 学霸：已经输了数字再按「-」= 给这个数切换正负（把负号放到 / 拿掉在数的开头），不再弹「负号要先按」提示（他等提示时超时了 2 题）。
   规则 1 不变：结果里的「-」仍然只在一个数的开头。有 ×10ⁿ（e）时切换的是指数（最后输入的那个数）；分数切换整个分数的正负（放在最前面） */
export function toggleMinus(v: string): string {
  if (minusOk(v)) return v + '-';
  const i = v.lastIndexOf('e'); const st = i >= 0 ? i + 1 : 0; const seg = v.slice(st);
  return v.slice(0, st) + (seg.startsWith('-') ? seg.slice(1) : '-' + seg);
}
export const addNumKey = (v: string, k: string) => (k === '-' ? toggleMinus(v) : v + k);
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

/** r15.4 学霸：物理键盘按键归一。数字键盘：中文输入法下 key 常是 'Process' 或全角符号，按 code 认（Minus / NumpadSubtract / Digit3 / Numpad3 / Slash / Period）；
    全角／数学减号（－ − – —）、旧浏览器的 'Subtract' 都当「-」。字母键盘不改 '–' '—'（英语里另有用处，原样过正则） */
export function physKey(e: { key: string; code?: string }, letters: boolean): string {
  const k = e.key, c = e.code ?? '';
  if (letters) return k;
  if (['－', '−', '–', '—', 'Subtract'].includes(k) || ((k === 'Process' || k === 'Unidentified') && (c === 'Minus' || c === 'NumpadSubtract'))) return '-';
  if (k === 'Process' || k === 'Unidentified') { const m = c.match(/^(?:Digit|Numpad)(\d)$/); if (m) return m[1]; if (c === 'Slash' || c === 'NumpadDivide') return '/'; if (c === 'Period' || c === 'NumpadDecimal') return '.'; }
  if (k === '／') return '/'; if (k === '。' || k === '．') return '.';
  if (/^[０-９]$/.test(k)) return String.fromCharCode(k.charCodeAt(0) - 0xFF10 + 48);
  return k;
}
