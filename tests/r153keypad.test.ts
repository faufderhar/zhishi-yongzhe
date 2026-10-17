// r15.3 学霸：「-」只在数的开头；多指同时按按时间戳排序
import { it, expect } from 'vitest';
import { addNumKey, press, type Burst } from '../src/game/keypad';
const type = (s: string) => [...s].reduce(addNumKey, '');
it('「-」只能在开头 / 「/」后 / e 后，其他位置忽略', () => {
  expect(type('-3')).toBe('-3'); expect(type('3-')).toBe('3'); expect(type('3-4')).toBe('34'); expect(type('--3')).toBe('-3');
  expect(type('-3/-2')).toBe('-3/-2'); expect(type('1e-5')).toBe('1e-5'); expect(type('-15')).toBe('-15'); expect(type('1.5-')).toBe('1.5');
});
const run = (evs: [string, number][], gap = 5) => { let b: Burst | null = null, v = '', now = 1000;
  for (const [k, t] of evs) { b = press(b, v, t, now, x => addNumKey(x, k)); v = b.cur; now += gap; } return v; };
it('到达顺序 3,2,1,4、时间戳 1<2<3<4 → 1234（学霸 3214）', () => { expect(run([['3', 15], ['2', 10], ['1', 5], ['4', 20]])).toBe('1234'); });
it('「-」「3」一起按：按下更早的是 - → -3；按下更早的是 3 → 3（- 被忽略），不会出现 3-', () => {
  expect(run([['3', 10], ['-', 5]])).toBe('-3'); expect(run([['3', 5], ['-', 10]])).toBe('3'); expect(run([['-', 5], ['3', 5]])).toBe('-3');
});
it('同一时间戳保持到达顺序；正常顺序不受影响', () => { expect(run([['1', 5], ['2', 5], ['3', 5], ['4', 5]])).toBe('1234'); expect(run([['1', 1], ['0', 2], ['0', 3]])).toBe('100'); });
it('间隔超过 150 ms 另起一串；外部清空后重新开始', () => {
  let b = press(null, '', 100, 1000, x => addNumKey(x, '5')); b = press(b, b.cur, 50, 1300, x => addNumKey(x, '6')); expect(b.cur).toBe('56');   // 隔太久：时间戳早也不往前插
  const c = press(b, '', 400, 1310, x => addNumKey(x, '7')); expect(c.cur).toBe('7');
});
it('退格也按时间戳排', () => { expect(run([['2', 10], ['1', 5]])).toBe('12'); let b: Burst | null = null; b = press(b, '12', 30, 1000, x => x.slice(0, -1)); b = press(b, b.cur, 20, 1005, x => addNumKey(x, '3')); expect(b.cur).toBe('12'); });
