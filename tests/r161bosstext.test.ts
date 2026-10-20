// r16.1 (v)(w)(x)(y) Boss补测裁定_r17 §2 §3：只改文案 / 显示，伤害、HP、阶段、技能概率一个数都不变
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newRound, resolveRound, estimateDealt, estimateOverflow, phaseOverflow } from '../src/game/rounds';
import { SKILL, ENERGY_CAP, ROUND } from '../src/game/balance';
import { detailLines, guardText, phaseCapText } from '../src/game/dmgText';
import { SCIFI } from '../src/game/characters';
import { battleGrid } from './helpers/r161grid';

const asuan = SCIFI.find(c => c.id === 'asuan')!;
const rb = readFileSync('src/ui/RoundBattle.tsx', 'utf8');

describe('数值不变', () => {
  it('11.6 万种局面的结算（伤害 / 段 / 受伤 / 回血 / HP / 能量 / 保底计数 / 技能 / 阶段 / 预计伤害）和改文案前（6f22bd6）逐个一样', () => {
    expect(battleGrid()).toEqual(JSON.parse(readFileSync('tests/fixtures/r161_battle_grid.json', 'utf8')));
  });
  it('Boss HP、阶段线不变（高二 HP 按年级覆盖是 r17 的事）', () => {
    expect(ROUND.h.monsters.boss.hp).toBe(250); expect(ROUND.j.monsters.boss.hp).toBe(200);
    expect(newRound('h', 'boss').def.phases?.[1].hp).toBe(125); expect(newRound('j', 'boss').def.phases?.[1].hp).toBe(100);
  });
  it('技能概率 / 保底 / 能量上限仍是卡片文案里写的 20% / 4 次 / 5 点', () => {
    expect(SKILL.rate.battle).toBe(0.2); expect(SKILL.pity.battle).toBe(4); expect(ENERGY_CAP).toBe(5);
    expect(SKILL.atk.A14).toBe(1.4);
  });
});
describe('(v)(w)(x) 打穿阶段线', () => {
  const s0 = { ...newRound('h', 'boss'), monsterHp: 135 };
  const inp = { subject: '数学', difficulty: 3 };
  it('剩 10 到阶段线：预计 −10，并说「本阶段最多扣 10，多出的被 Boss 护体挡住」；实际也只扣 10，多出的 = 原始 − 10', () => {
    const est = estimateDealt(s0, asuan, inp); expect(est).toBe(10);
    const [s, o] = resolveRound(s0, asuan, { ...inp, correct: true, noSkill: true, rng: () => 0.999 });
    expect(o.dealt).toBe(10); expect(s.monsterHp).toBe(125);
    const raw = o.dmg!.per * o.dmg!.hits; expect(raw).toBeGreaterThan(10);
    expect(phaseOverflow(o)).toBe(raw - 10); expect(estimateOverflow(s0, asuan, inp)).toBe(raw - 10);
    expect(phaseCapText(est)).toBe('本阶段最多扣 10，多出的被 Boss 护体挡住');
    expect(guardText(52)).toBe('🛡 护体！第一阶段破了，多出 52 点没打进去');
    expect(detailLines(o.dmg!, o.dealt, o.absorbed ?? 0).at(-1)).toBe(`实际造成 10（🛡 护体！第一阶段破了，多出 ${raw - 10} 点没打进去）`);
  });
  it('没打穿 / 不是 Boss / 第二阶段 → 0，不显示', () => {
    expect(estimateOverflow({ ...newRound('h', 'boss') }, asuan, inp)).toBe(0);
    expect(estimateOverflow({ ...newRound('h', 'normal'), monsterHp: 5 }, asuan, inp)).toBe(0);
    expect(estimateOverflow({ ...newRound('h', 'boss'), monsterHp: 20 }, asuan, inp)).toBe(0);
  });
  it('UI：预计行加说明，命中时飘护体字（技能 / 普攻两处），技能另算仍在', () => {
    expect(rb).toMatch(/ov > 0 && <b data-testid="q-dmg-phase">（\{phaseCapText\(est\)\}）<\/b>/);
    expect((rb.match(/shieldFloat\(\); guardFloat\(\);/g) ?? []).length).toBe(2);
    expect(rb).toContain('data-testid="q-dmg-sk">技能另算');
  });
  it('(x) 过时的「满 117 开始」注释删掉了', () => {
    const r = readFileSync('src/game/rounds.ts', 'utf8');
    expect(r).not.toContain('117'); expect(r).toContain('第二阶段从 phases[1].hp 开始，溢出不带入（Boss补测裁定_r17 §2）');
  });
});
