// r17.1 A1（Boss补测裁定_r17 §1.5 / §4 #5–6）：Boss HP 按年级覆盖。高二 130+130 = 260（高三沿用），高一 250、初一/初二 200 不变；
// 阶段溢出不带入；D14 内层封顶 ×1.8、连击 ×1.3 不动；ROUND 共享定义不改。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newRound, resolveRound, bossForGrade } from '../src/game/rounds';
import { ROUND, BOSS_PHASES_BY_GRADE, INNER_CAP, COMBO_CAP } from '../src/game/balance';
import { SCIFI } from '../src/game/characters';
const asuan = SCIFI.find(c => c.id === 'asuan')!;
const hp = (g?: string, mode: 'h' | 'j' = 'h') => { const s = newRound(mode, 'boss', { grade: g }); return [s.monsterHp, s.monsterMax, s.def.hp, s.def.phases!.map(p => p.hp)]; };

describe('r17.1 Boss HP 按年级', () => {
  it('高二 Boss 满血 260，阶段线 130；高三沿用高二', () => {
    expect(hp('11')).toEqual([260, 260, 260, [130, 130]]);
    expect(hp('12')).toEqual([260, 260, 260, [130, 130]]);
  });
  it('高一 Boss 仍 250（125+125）；初一 / 初二 / 初三仍 200（100+100）；没传年级同 ROUND；ROUND 共享定义没改', () => {
    expect(hp('10')).toEqual([250, 250, 250, [125, 125]]); expect(hp(undefined)).toEqual([250, 250, 250, [125, 125]]);
    for (const g of ['7', '8', '9']) expect(hp(g, 'j')).toEqual([200, 200, 200, [100, 100]]);
    expect(ROUND.h.monsters.boss.hp).toBe(250); expect(ROUND.h.monsters.boss.phases!.map(p => p.hp)).toEqual([125, 125]);
    expect(ROUND.j.monsters.boss.hp).toBe(200);
    expect(Object.keys(BOSS_PHASES_BY_GRADE).sort()).toEqual(['11', '12']);   // 只有高二 / 高三变，其他年级都不降 HP
    // 只换 HP：普通 / 精英关、攻击、回合上限、狂暴、弱点都不变
    const b = newRound('h', 'boss', { grade: '11' }).def, d = ROUND.h.monsters.boss;
    expect([b.atk, b.cap, b.rage, b.pat, b.half, b.phases!.map(p => p.weak)]).toEqual([d.atk, d.cap, d.rage, d.pat, d.half, d.phases!.map(p => p.weak)]);
    expect(newRound('h', 'normal', { grade: '11' }).monsterMax).toBe(ROUND.h.monsters.normal.hp);
    expect(bossForGrade(ROUND.h.monsters.elite, '11')).toBe(ROUND.h.monsters.elite);
    // 选科弱点仍套用在覆盖后的阶段上
    expect(newRound('h', 'boss', { grade: '11', weak: ['物理', '数学'] }).def.phases).toEqual([{ hp: 130, weak: '物理' }, { hp: 130, weak: '数学' }]);
  });
  it('高二打穿阶段线：只扣到 130，多出的不带入第二阶段；D14 ×1.8 / 连击 ×1.3 常量不变', () => {
    const s0 = { ...newRound('h', 'boss', { grade: '11' }), monsterHp: 140 };
    const [s, o] = resolveRound(s0, asuan, { subject: '数学', difficulty: 3, correct: true, noSkill: true, rng: () => 0.999 });
    expect(o.dealt).toBe(10); expect(s.monsterHp).toBe(130); expect(o.phaseShift).toBe(true);
    expect(o.dmg!.per * o.dmg!.hits).toBeGreaterThan(10);
    expect(INNER_CAP).toBe(1.8); expect(COMBO_CAP).toBe(1.3);
    expect(readFileSync('src/ui/RoundBattle.tsx', 'utf8')).toMatch(/newRound\(mode, kind, \{[^}]*grade: questions\[0\]\?\.grade/);
  });
});
