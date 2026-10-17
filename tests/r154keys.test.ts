// r15.4 学霸：物理键盘的「-」（普通减号键、小键盘、中文输入法、全角）都能输入；「-」只在数的开头的规则不变
import { describe, it, expect } from 'vitest';
import { physKey, addNumKey } from '../src/game/keypad';
describe('r15.4 物理键盘按键归一', () => {
  it('各种减号都当「-」', () => {
    for (const e of [{ key: '-', code: 'Minus' }, { key: '-', code: 'NumpadSubtract' }, { key: 'Subtract' }, { key: '－' }, { key: '−' }, { key: 'Process', code: 'Minus' }, { key: 'Process', code: 'NumpadSubtract' }, { key: 'Unidentified', code: 'Minus' }])
      expect(physKey(e, false), JSON.stringify(e)).toBe('-');
  });
  it('输入法下的数字 / 分数线 / 小数点', () => {
    expect(physKey({ key: 'Process', code: 'Digit3' }, false)).toBe('3');
    expect(physKey({ key: 'Process', code: 'Numpad7' }, false)).toBe('7');
    expect(physKey({ key: 'Process', code: 'Slash' }, false)).toBe('/');
    expect(physKey({ key: '３' }, false)).toBe('3');
    expect(physKey({ key: '／' }, false)).toBe('/');
  });
  it('字母键盘原样', () => { expect(physKey({ key: '–' }, true)).toBe('–'); expect(physKey({ key: 'a' }, true)).toBe('a'); });
  it('「-」只在数的开头：-3/2 能打出来，3- 不会出现', () => {
    const type = (s: string) => [...s].reduce((v, k) => addNumKey(v, physKey({ key: k }, false)), '');
    expect(type('-3/2')).toBe('-3/2'); expect(type('3-')).toBe('3'); expect(type('3/-2')).toBe('3/-2'); expect(type('－3')).toBe('-3');
  });
});
