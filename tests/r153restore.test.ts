// r15.3 技术QA R152-4：覆盖恢复写库前清洗数字
import { describe, it, expect } from 'vitest';
import { cleanKv, cleanAnswer, cleanWrong } from '../src/game/sanitize';

describe('r15.3 恢复数据清洗', () => {
  it('星星 / 经验 / 次数', () => {
    const p = cleanKv('progress:a', { stars: { a: 1e308, b: -2, c: 'NaN', d: null, e: 2.6 }, plays: { x: { day: '2026-10-16', count: -5 }, y: { day: 'd', count: 'NaN' } }, xp: 1e308, masteredStars: -1 }) as any;
    expect(p.stars).toEqual({ a: 3, b: 0, e: 3 }); expect(p.plays).toEqual({ x: { day: '2026-10-16', count: 0 } }); expect(p.xp).toBe(1e7); expect(p.masteredStars).toBe(0);
  });
  it('时长：负数归零、超大夹到一天、NaN / null 丢掉', () => {
    expect(cleanKv('usage:a', { d1: { used: -10, bonus: 1e308 }, d2: { used: 'NaN' }, d3: null, d4: { used: 1e308, bonus: null } })).toEqual({ d1: { used: 0, bonus: 86400 }, d4: { used: 86400, bonus: 0 } });
  });
  it('难度 / 标记 / 答题记录 / 错题本', () => {
    expect(cleanKv('skills:a', { 数学: { level: 1e308, right: -1, wrong: 'NaN' }, 英语: { level: null } })).toEqual({ 数学: { level: 5, right: 0, wrong: 0 } });
    expect(cleanKv('flags', { a: -1, b: 'NaN', c: 5 })).toEqual({ a: 0, c: 5 });
    expect(cleanAnswer({ profileId: 'a', questionId: 'q', correct: true, at: 'NaN' })).toBeUndefined();
    expect(cleanWrong({ id: 'a|q', profileId: 'a', qkey: 'q', box: 1e308, wrongCount: -3, addedAt: null, updatedAt: 1e308, due: null })).toMatchObject({ box: 3, wrongCount: 0, addedAt: 0, due: '' });
    expect(cleanKv('settings', { x: 1 })).toEqual({ x: 1 });
  });
});
