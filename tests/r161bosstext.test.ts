// r16.1 (v)(w)(x)(y) Boss补测裁定_r17 §2 §3：只改文案 / 显示，伤害、HP、阶段、技能概率一个数都不变
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newRound, resolveRound, estimateDealt, estimateOverflow, phaseOverflow } from '../src/game/rounds';
import { triggerWhy, TRIGGER_TAG, STORM_CARD, skillCardLine, roll, newRoll } from '../src/game/skills';
import { SKILL, ENERGY_CAP, ROUND } from '../src/game/balance';
import { detailLines, guardText, phaseCapText } from '../src/game/dmgText';
import { SCIFI, PUPS } from '../src/game/characters';
import { battleGrid } from './helpers/r161grid';

const asuan = SCIFI.find(c => c.id === 'asuan')!, suan = PUPS.find(c => c.id === 'suansuan')!;
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
  it('剩 10 到阶段线：预计 −10，并说「本阶段最多扣 10，多出的不会带到下一阶段」（r17-5 改文案）；实际也只扣 10，多出的 = 原始 − 10', () => {
    const est = estimateDealt(s0, asuan, inp); expect(est).toBe(10);
    const [s, o] = resolveRound(s0, asuan, { ...inp, correct: true, noSkill: true, rng: () => 0.999 });
    expect(o.dealt).toBe(10); expect(s.monsterHp).toBe(125);
    const raw = o.dmg!.per * o.dmg!.hits; expect(raw).toBeGreaterThan(10);
    expect(phaseOverflow(o)).toBe(raw - 10); expect(estimateOverflow(s0, asuan, inp)).toBe(raw - 10);
    expect(phaseCapText(est)).toBe('本阶段最多扣 10，多出的不会带到下一阶段');
    expect(guardText(52)).toBe('🚧 阶段线！第一阶段破了，多出 52 点没打进去');
    expect(detailLines(o.dmg!, o.dealt, o.absorbed ?? 0).at(-1)).toBe(`实际造成 10（🚧 阶段线！第一阶段破了，多出 ${raw - 10} 点没打进去）`);
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
describe('(y) 数字风暴文案 / 能量环 / 横幅', () => {
  it('角色卡：算算（P36 / J）写完整规则；阿算（H）加「冷却 3 回合」；别的角色不加', () => {
    expect(STORM_CARD).toBe('数字风暴：答对时有 20% 机会触发，本题伤害 ×1.4。能量攒满 5 点或连续 4 次答对没触发，下一次答对必定触发；触发后能量清零。');
    expect(skillCardLine('P36', '数学', 'suansuan')).toBe(STORM_CARD); expect(skillCardLine('J', '数学', 'suansuan')).toBe(STORM_CARD);
    expect(skillCardLine('H', '数学', 'asuan')).toBe(STORM_CARD + '冷却 3 回合。');
    expect(skillCardLine('P12', '数学', 'suansuan')).toBeNull();
    for (const c of [...PUPS, ...SCIFI].filter(c => c.id !== 'suansuan' && c.id !== 'asuan')) for (const seg of ['P36', 'J', 'H'] as const) expect(skillCardLine(seg, c.major, c.id)).toBeNull();
    expect(suan.desc).toBe('主修：数学题伤害 ×1.2\n被动：数学题再 ×1.1（合计 ×1.32）');   // r17.1 r17-3：主修 / 被动分两行
    expect(readFileSync('src/ui/Screens.tsx', 'utf8')).toMatch(/skillCardLine\(segOf\(cfg\.band\), c\.major, c\.id\)[\s\S]{0,120}data-testid=\{'char-skill-' \+ c\.id\}/);
  });
  it('触发原因：能量满 / 保底 / 幸运，和 roll 的必定触发条件同一处', () => {
    const r0 = newRoll();
    expect(triggerWhy(r0, 'H', 5)).toBe('energy'); expect(triggerWhy({ ...r0, dry: 4 }, 'H', 2)).toBe('pity'); expect(triggerWhy(r0, 'H', 2)).toBe('luck');
    expect(TRIGGER_TAG).toEqual({ energy: '能量满', pity: '保底触发', luck: '幸运触发' });
    // 必定触发：rng 永远 0.999（不会中 20%）时，能量满或保底仍触发；否则不触发
    const R = (r: typeof r0, e: number) => roll(r, { seg: 'H', major: '数学', side: 'P', correct: true, energy: e, rng: () => 0.999 })[1];
    expect(R(r0, 5)).not.toBeNull(); expect(R({ ...r0, dry: 4 }, 1)).not.toBeNull(); expect(R({ ...r0, dry: 3 }, 4)).toBeNull();
  });
  it('UI：横幅带原因小字；能量环加「保底」，演出期间显示结算后的值（不再停在旧值）', () => {
    expect(rb).toMatch(/const skTag = k \? TRIGGER_TAG\[triggerWhy\(bs\.sk, bs\.seg, bs\.energy \+ o\.energyGain\)\] : undefined; setRingE\(ns\.energy\);/);
    expect((rb.match(/tag: skTag/g) ?? []).length).toBe(2);
    expect(rb).toMatch(/\{ringE \?\? bs\.energy\}\/\{ENERGY_CAP\}<small className="ring-tag" data-testid="energy-tag">保底<\/small>/);
    expect(rb).toMatch(/setBs\(ns\); setRingE\(null\);/);
    expect(readFileSync('src/fx/skillFx.ts', 'utf8')).toMatch(/\$\{o\.tag \? `<small class="skill-tag">\$\{o\.tag\}<\/small>` : ''\}/);
  });
});
