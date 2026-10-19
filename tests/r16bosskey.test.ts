// r16 R-5（新年级关卡设计 §5.2）：CHAPTER_BOSS 的 key 带年级 / 册别——初一、初二都有「第1章」，不能串
import { it, expect } from 'vitest';
import { CHAPTER_BOSS, chapterBoss, skinFor, type BossRow } from '../src/game/monsterSkin';
it('初二「第1章」不会拿到初一第1章的名字，初一也不会拿到初二的', () => {
  const row: BossRow = ['8', '数学', '', '八上·第1章 三角形', '测试三角将', 0, '八年级上册'];
  CHAPTER_BOSS.push(row);
  try {
    // 初一：显式年级 / 旧调用（只给学段）都还是初一的名字
    expect(chapterBoss('J', '数学', '七上·第1章 数学与我们同行·1.1 生活 数学', { grade: '7', volume: '七年级上册' })?.name).toBe('数学旅行家');
    expect(chapterBoss('J', '数学', '第1章 数学与我们同行')?.name).toBe('数学旅行家');
    expect(chapterBoss('J', '数学', '八上·第1章 三角形·1.1 认识三角形')?.name, '没传年级 = 初一，不能拿到初二的行').toBeUndefined();
    // 初二：只认自己的行（年级 + 册别 + 章）
    expect(chapterBoss('J', '数学', '八上·第1章 三角形·1.1 认识三角形', { grade: '8', volume: '八年级上册' })?.name).toBe('测试三角将');
    expect(chapterBoss('J', '数学', '八上·第1章 三角形·1.1 认识三角形', { grade: '8', volume: '八年级下册' })?.name, '册别不同').toBeUndefined();
    expect(chapterBoss('J', '数学', '第1章 数学与我们同行', { grade: '8', volume: '八年级上册' })?.name, '初二不拿初一的').toBeUndefined();
    expect(chapterBoss('J', '数学', '八上·第1章 三角形扩展', { grade: '8', volume: '八年级上册' })?.name, '章名前缀不能半截匹配').toBeUndefined();
    expect(skinFor('数学', 'boss', 'J', '八上·第1章 三角形·1.2', { grade: '8', volume: '八年级上册' })!.name).toBe('测试三角将');
    // 高一数学按章名（hMathBoss）只给高一；高二同名章不套高一的
    expect(skinFor('数学', 'boss', 'H', '必修第一册·第1章 集合')!.name).toBe('交并迷雾主');
    expect(skinFor('数学', 'boss', 'H', '必修第一册·第1章 集合', { grade: '11' })!.name).not.toBe('交并迷雾主');
  } finally { CHAPTER_BOSS.splice(CHAPTER_BOSS.indexOf(row), 1); }
});
