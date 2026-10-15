import { describe, it, expect } from 'vitest';
import { newBattle, resolveCorrect, resolveWrong, intentOf, calcDamage, newKinder, kinderAnswer } from '../src/game/battle';
import { PUPS, SCIFI } from '../src/game/characters';
const [suan, mo, lexi, bai] = PUPS;

describe('标准战斗', () => {
  it('意图循环 攻击→攻击→护盾', () => {
    expect([0, 1, 2, 3].map(intentOf)).toEqual(['attack', 'attack', 'shield', 'attack']);
  });
  it('伤害公式：攻击20×难度2(1.0)×主修1.2×数学被动1.1 = 26', () => {
    const s = newBattle('std');
    expect(calcDamage(s, suan, '数学', 2, 1)).toBe(26);
    expect(calcDamage(s, bai, '数学', 1, 1)).toBe(16);
    expect(calcDamage(s, bai, '数学', 2, 3)).toBe(24); // 连击3 ×1.2
  });
  it('答对攻击且怪物攻击 → 对拼受 50%', () => {
    const [s, r] = resolveCorrect(newBattle('std'), bai, 'attack', '数学', 2);
    expect(r.dealt).toBe(20); expect(r.taken).toBe(6);
    expect(s.monsterHp).toBe(40); expect(s.playerHp).toBe(94); expect(s.combo).toBe(1);
  });
  it('闪避：不受伤，反击 30%，专注+1，下次攻击 +25%', () => {
    const [s, r] = resolveCorrect(newBattle('std'), bai, 'dodge', '数学', 2);
    expect(r.taken).toBe(0); expect(r.dealt).toBe(6); expect(s.focus).toBe(1);
    expect(calcDamage(s, bai, '数学', 2, 1)).toBe(25);
  });
  it('答错：怪物攻击全额，护盾回合 50%，连击清零', () => {
    let s = newBattle('std'); s = { ...s, combo: 3 };
    const [s1, r1] = resolveWrong(s, bai);
    expect(r1.taken).toBe(12); expect(s1.combo).toBe(0);
    const s2 = { ...newBattle('std'), turn: 2 };
    const [s3, r2] = resolveWrong(s2, bai);
    expect(r2.taken).toBe(6); expect(s3.monsterShield).toBe(10);
  });
  it('护盾吸收伤害', () => {
    const s = { ...newBattle('std'), monsterShield: 10 };
    const [s1, r] = resolveCorrect(s, bai, 'attack', '数学', 2);
    expect(r.dealt).toBe(10); expect(s1.monsterHp).toBe(50);
  });
  it('Lexi 首次答错不断连击', () => {
    const s = { ...newBattle('std'), combo: 2 };
    const [s1] = resolveWrong(s, lexi); expect(s1.combo).toBe(2);
    const [s2] = resolveWrong(s1, lexi); expect(s2.combo).toBe(0);
  });
  it('小墨语文题回血', () => {
    const s = { ...newBattle('std'), playerHp: 50, turn: 2 };
    const [s1, r] = resolveCorrect(s, mo, 'attack', '语文', 2);
    expect(r.healed).toBe(3); expect(s1.playerHp).toBe(53);
  });
  it('击败怪物判胜，血量归零判负', () => {
    let s = newBattle('std');
    while (!s.over) s = resolveCorrect(s, suan, 'attack', '数学', 5)[0];
    expect(s.over).toBe('win');
    let t = newBattle('std');
    while (!t.over) t = resolveWrong(t, suan)[0];
    expect(t.over).toBe('lose'); expect(t.playerHp).toBe(0);
  });
});

describe('多选漏选', () => {
  it('半伤害且不受击', () => {
    const [s, r] = resolveCorrect(newBattle('std'), bai, 'attack', '数学', 2, 0.5);
    expect(r.dealt).toBe(10); expect(r.taken).toBe(0); expect(s.playerHp).toBe(100);
  });
  it('高一角色被动按主修判定', () => {
    const asuan = SCIFI[0];
    expect(calcDamage(newBattle('hs'), asuan, '数学', 2, 1)).toBe(Math.round(26 * 1.2 * 1.1));
  });
});

describe('幼儿园温和模式（策划确认单 D1）', () => {
  it('第 1 次点错 → 去掉刚点的那个选项（不随机）', () => {
    const [s, r] = kinderAnswer(newKinder(3), false, 'B', ['A', 'B']);
    expect(r).toBe('retry'); expect(s.removed).toEqual(['B']); expect(s.lit).toBe(0); expect(s.stars).toBe(0); expect(s.attempt).toBe(1);
  });
  it('再试答对 → correct，计入 retry', () => {
    let [s] = kinderAnswer(newKinder(3), false, 'A', ['A', 'B']);
    let r; [s, r] = kinderAnswer(s, true, 'C', ['B']);
    expect(r).toBe('correct'); expect(s.lit).toBe(1); expect(s.retry).toBe(1); expect(s.first).toBe(0); expect(s.removed).toEqual([]);
  });
  it('第 2 次又错 → demo，默认照样给星；关掉奖励则只亮爱心', () => {
    let [s] = kinderAnswer(newKinder(3), false, 'A', ['A', 'B']);
    expect(kinderAnswer(s, false, 'B', ['B'])[0]).toMatchObject({ lit: 1, stars: 1, demo: 1 });
    expect(kinderAnswer(s, false, 'B', ['B'], false)[0]).toMatchObject({ lit: 1, stars: 0, demo: 1 });
    void s;
  });
  it('只有 2 个选项：第 1 次点错直接进演示', () => {
    const [s, r] = kinderAnswer(newKinder(3), false, 'A', ['A']);
    expect(r).toBe('demo'); expect(s.demo).toBe(1);
  });
  it('三类之和 = 题数；3 颗爱心后完成', () => {
    let s = newKinder(3);
    s = kinderAnswer(s, true, 'C', ['A', 'B'])[0];
    s = kinderAnswer(kinderAnswer(s, false, 'A', ['A', 'B'])[0], true, 'C', ['B'])[0];
    s = kinderAnswer(kinderAnswer(s, false, 'A', ['A', 'B'])[0], false, 'B', ['B'])[0];
    expect([s.first, s.retry, s.demo, s.done]).toEqual([1, 1, 1, true]);
  });
});

