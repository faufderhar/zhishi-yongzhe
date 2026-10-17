// r15.2.1 学霸：填空负数 / 分数判分（键盘顺序修复后，-3/2、-1、3/-2 等都要判对）
import { describe, it, expect } from 'vitest';
import { judge, parseNum, type Question } from '../src/game/questions';

const fill = (answer: string[]) => ({ type: '填空', answer, options: [] } as unknown as Question);
describe('r15.2.1 填空负数和分数', () => {
  it('-3/2 的各种写法判对', () => {
    const q = fill(['-3/2']);
    for (const v of ['-3/2', '3/-2', '-1.5', '−3/2', '-6/4', ' -3/2 ']) expect(judge(q, v), v).toBe('full');
    for (const v of ['3-/2', '3/2', '1.5', '-', '/']) expect(judge(q, v), v).toBe('wrong');
  });
  it('-1 判对，「1-」判错', () => {
    const q = fill(['-1']);
    for (const v of ['-1', '-1.0', '-2/2']) expect(judge(q, v), v).toBe('full');
    for (const v of ['1-', '1', '--1']) expect(judge(q, v), v).toBe('wrong');
  });
  it('100 / 41 不被截断判对', () => {
    expect(judge(fill(['100']), '100')).toBe('full'); expect(judge(fill(['100']), '1')).toBe('wrong');
    expect(judge(fill(['41']), '41')).toBe('full'); expect(judge(fill(['41']), '4')).toBe('wrong');
  });
  it('parseNum：分母负号、坏输入', () => {
    expect(parseNum('3/-2')).toBe(-1.5); expect(parseNum('3-/2')).toBeNull(); expect(parseNum('1-')).toBeNull();
  });
});
