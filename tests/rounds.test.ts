/* D6 轮流回合：结算表逐行 + 验收清单中可单测的项（实现规格 v0.3.6） */
import { describe, it, expect } from 'vitest';
import { newRound, resolveRound, reviveRound, nextIntent, intentLabel, canUseSkill, skillOf, phaseOf, type RState } from '../src/game/rounds';
import { ROUND, CARDS } from '../src/game/balance';
import { PUPS, SCIFI } from '../src/game/characters';
const poet = PUPS.find(c => c.major === '诗词')!, lexi = SCIFI.find(c => c.major === '英语')!, momo = PUPS.find(c => c.major === '语文')!;
const P = (s: RState, correct: boolean, x: object = {}, end = true) => resolveRound(s, poet, { correct, subject: '诗词', difficulty: 2, rng: () => 0.99, ...x }, end);
const toM = (s: RState) => P(s, true)[0];   // 先打一个我方回合进入对方回合
const withIntent = (it: string, mode: 'j' | 'h' | 'p36' = 'j', kind: 'normal' | 'elite' | 'boss' = 'elite') => {
  let s = newRound(mode, kind); s = { ...s, monsterHp: 999, monsterMax: 999 };
  for (let k = 0; k < 8 && nextIntent(s) !== it; k++) s = { ...s, mi: s.mi + 1 };
  return toM(s);
};
describe('§3.2 balance 与表格一致', () => {
  it('数值', () => {
    expect([ROUND.p36.player, ROUND.j.player, ROUND.h.player]).toEqual([{ hp: 100, atk: 18 }, { hp: 100, atk: 20 }, { hp: 160, atk: 26 }]);
    const t = (m: 'p36' | 'j' | 'h') => (['normal', 'elite', 'boss'] as const).map(k => [ROUND[m].monsters[k].hp, ROUND[m].monsters[k].atk, ROUND[m].monsters[k].cap]);
    expect(t('p36')).toEqual([[50, 10, 12], [100, 13, 16], [126, 15, 22]]);
    expect(t('j')).toEqual([[60, 12, 12], [120, 16, 18], [153, 18, 24]]);
    expect(t('h')).toEqual([[90, 18, 12], [170, 24, 18], [234, 26, 26]]);
    expect([ROUND.p36.shield, ROUND.j.shield, ROUND.h.shield]).toEqual([8, 10, 15]);
    expect([ROUND.p36.dodge, ROUND.j.dodge, ROUND.h.dodge]).toEqual([0.3, 0.25, 0.25]);
    expect([ROUND.p36.perfect, ROUND.j.perfect, ROUND.h.perfect]).toEqual([false, true, true]);
    expect(ROUND.h.monsters.boss.phases!.map(p => p.hp)).toEqual([117, 117]);
  });
});
describe('§2 结算表', () => {
  it('我方先手、严格交替、每回合计 1', () => {
    let s = newRound('j', 'normal'); const sides: string[] = [];
    for (let k = 0; k < 6; k++) { sides.push(s.side); [s] = P(s, k % 2 === 0); }
    expect(sides.join('')).toBe('PMPMPM'); expect(s.turn).toBe(6);
  });
  it('我方答对：伤害符合公式、先扣护盾、专注清零', () => {
    let s = { ...newRound('j', 'normal'), shield: 10, focus: 2 };
    const [n, o] = P(s, true);   // 20×1.0×1(连击1)×1.2×1.5 = 36，先扣盾 10
    expect(o.dealt).toBe(26); expect(n.monsterHp).toBe(34); expect(n.shield).toBe(0); expect(n.focus).toBe(0);
  });
  it('我方答错：反击 A，闪避失败受 A；专注清零', () => {
    const [n, o] = P({ ...newRound('j', 'normal'), focus: 1 }, false);
    expect(o.taken).toBe(12); expect(n.playerHp).toBe(88); expect(n.focus).toBe(0);
  });
  it('我方答错闪避：初一无专注 1000 次闪避率 25%±3%，闪开不掉血', () => {
    let seed = 42; const rng = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    let d = 0; for (let k = 0; k < 1000; k++) { const [, o] = resolveRound(newRound('j', 'normal'), poet, { correct: false, subject: '诗词', difficulty: 2, rng }); if (o.dodged) { d++; expect(o.taken).toBe(0); expect(o.text).toBe('运气好闪开了！'); } }
    expect(Math.abs(d / 1000 - 0.25)).toBeLessThanOrEqual(0.03);
  });
  it('闪避率：每层专注 +10%，上限 60%；押确定为 0', () => {
    const at = (focus: number, x: object = {}) => P({ ...newRound('j', 'normal'), focus }, false, { rng: () => 0.44, ...x })[1].dodged;
    expect(at(2)).toBe(true); expect(at(1)).toBe(false);
    expect(P({ ...newRound('h', 'normal'), focus: 2 }, false, { rng: () => 0, wager: 'sure' })[1].dodged).toBe(false);
  });
  it('对方 ⚔：答对不掉血，答错受 A', () => {
    const s = withIntent('atk'); expect(P(s, true)[1].taken).toBe(0); expect(P(s, false)[1].taken).toBe(16);
  });
  it('对方 ⚡：答对打断（chargeBroken），之后 💥 答错受 A，意图显示灰色 A；未打断受 2A', () => {
    const s = withIntent('charge'); const [b] = P(s, true); expect(b.chargeBroken).toBe(true);
    let h = toM(b); expect(nextIntent(h)).toBe('heavy'); expect(intentLabel(h).short).toBe('💥 16'); expect(intentLabel(h).grey).toBe(true);
    const [after, o] = P(h, false); expect(o.taken).toBe(16); expect(after.chargeBroken).toBe(false);
    const [nb] = P(s, false); h = toM(nb); expect(intentLabel(h).short).toBe('💥 32'); expect(P(h, false)[1].taken).toBe(32); expect(P(h, true)[1].taken).toBe(0);
  });
  it('对方 🛡：答错得护盾，挡下一击后清零、不叠加；答对破盾', () => {
    const s = withIntent('shield', 'j', 'normal');
    expect(P(s, true)[0].shield).toBe(0);
    const [g] = P(s, false); expect(g.shield).toBe(10);
    const [n2] = P({ ...g, shield: 10 }, true); expect(n2.shield).toBe(0);
    const [g2] = P({ ...withIntent('shield', 'j', 'normal'), shield: 10 }, false); expect(g2.shield).toBe(10);
  });
  it('连击/能量：两种回合答对都累计，连到 3 额外 +1，上限 5；答错连击清零', () => {
    let s = newRound('j', 'normal'); s = { ...s, monsterHp: 999 };
    const e: number[] = []; for (let k = 0; k < 5; k++) { [s] = P(s, true); e.push(s.energy); }
    expect(e).toEqual([1, 2, 4, 5, 5]); expect(s.combo).toBe(5); [s] = P(s, false); expect(s.combo).toBe(0);
  });
  it('伤害最少 1', () => { const [, o] = resolveRound({ ...newRound('j', 'normal'), atk: 0.1 }, poet, { correct: true, subject: '数学', difficulty: 1 }); expect(o.dealt).toBe(1); });
});
describe('完美闪避与专注', () => {
  it('只在对方回合答对且快时触发，最多 2 层；我方回合结束清零；小学 3–6 不触发', () => {
    let s = withIntent('atk'); [s] = P(s, true, { fast: true }); expect(s.focus).toBe(1);
    s = { ...s, side: 'M', focus: 2 }; [s] = P(s, true, { fast: true }); expect(s.focus).toBe(2);
    expect(P(withIntent('atk'), true, { fast: false })[0].focus).toBe(0);
    expect(P({ ...newRound('j', 'normal'), focus: 0 }, true, { fast: true })[0].focus).toBe(0);
    expect(P(withIntent('atk', 'p36'), true, { fast: true })[0].focus).toBe(0);
    expect(P(withIntent('atk', 'h'), true, { wager: 'sure' })[1].perfect).toBe(true);
  });
});
describe('技能', () => {
  it('攻击类只在我方回合、防护类只在对方回合', () => {
    const s = { ...newRound('h', 'normal'), energy: 5 };
    expect(canUseSkill(s, skillOf(lexi))).toBe(true); expect(canUseSkill({ ...s, side: 'M' }, skillOf(lexi))).toBe(false);
    expect(canUseSkill(s, skillOf(momo))).toBe(false); expect(canUseSkill({ ...s, side: 'M' }, skillOf(momo))).toBe(true);
  });
  it('Echo 答对 2 次 70%；答错返还一半能量', () => {
    const s = { ...newRound('h', 'normal'), energy: 5 };
    const [, o] = resolveRound(s, lexi, { correct: true, subject: '英语', difficulty: 2, skill: true });
    expect(o.hits).toEqual([22, 22]);   // 26×1.2×0.7 = 21.8
    const [n2, o2] = resolveRound(s, lexi, { correct: false, subject: '英语', difficulty: 2, skill: true, rng: () => 0.99 });
    expect(o2.refund).toBe(1); expect(n2.energy).toBe(3);
  });
  it('护体：对方回合答错只受 50%', () => {
    const s = { ...withIntent('atk'), energy: 5 };
    expect(resolveRound(s, momo, { correct: false, subject: '语文', difficulty: 2, skill: true })[1].taken).toBe(8);
  });
});
describe('Boss 与高一', () => {
  it('Boss 半血后从下一个意图起换循环', () => {
    let s = { ...newRound('j', 'boss'), monsterHp: 70 }; [s] = P(s, true);
    expect(s.pattern).toEqual(['atk', 'charge', 'heavy']); expect(nextIntent(s)).toBe('atk');
  });
  it('高一 Boss 两阶段各 117，弱点不同', () => {
    const s = newRound('h', 'boss'); expect(s.monsterHp).toBe(234); expect(phaseOf(s)).toBe(0); expect(phaseOf({ ...s, monsterHp: 117 })).toBe(1);
    const a = P(s, true, { subject: '数学' })[1].dealt, b = P({ ...s, monsterHp: 117 }, true, { subject: '数学' })[1].dealt;
    expect(a).toBe(Math.round(26 * 1.5)); expect(b).toBe(26);
  });
  it('题卡与押注：反击 ×1.5×1.3 → 封顶 ×2.0；不太确定 ×0.5 并标记复习', () => {
    const s = newRound('h', 'normal');
    expect(P(s, false, { card: 'heavy', wager: 'sure' })[1].taken).toBe(35);   // 1.5×1.3=1.95，未超 2.0
    expect(P(s, false, { card: 'heavy', wager: 'sure', simSkillMult: 1 })[1].taken).toBeLessThanOrEqual(18 * 2);
    const [, u] = P(s, false, { card: 'light', wager: 'unsure' }); expect(u.taken).toBe(Math.round(18 * 0.8 * 0.5)); expect(u.review).toBe(true);
    expect(P(s, true, { card: 'heavy', wager: 'sure' })[1].dealt).toBe(Math.round(26 * 1.2 * CARDS.heavy.out * 1.2));
  });
  it('多步题：小问 ×1.0/1.3/1.6，答错中断并按重击 ×1.5 反击，整题算 1 回合', () => {
    let s = { ...newRound('h', 'elite'), monsterHp: 999 }; const ds: number[] = [];
    for (let k = 0; k < 2; k++) { const [n, o] = P(s, true, { card: 'heavy', stepIndex: k }, false); ds.push(o.dealt); s = n; }
    expect(s.turn).toBe(0); expect(ds).toEqual([Math.round(26 * 1.2 * 1.6), Math.round(26 * 1.2 * 1.6 * 1.1 * 1.3)]);
    const [n, o] = P(s, false, { card: 'heavy', stepIndex: 2 }); expect(o.taken).toBe(36); expect(n.turn).toBe(1); expect(n.side).toBe('M');
  });
});
describe('上限、复活、3–4 年级', () => {
  it('到上限撤退', () => { let s = { ...newRound('j', 'normal'), monsterHp: 999 }; while (!s.over) [s] = P(s, true); expect(s.over).toBe('retreat'); expect(s.turn).toBe(12); });
  it('复活：50% 血量、不计回合', () => { const s = reviveRound({ ...newRound('j', 'normal'), playerHp: 0, over: 'lose', turn: 5 }); expect(s.playerHp).toBe(50); expect(s.turn).toBe(5); expect(s.over).toBe(null); expect(s.revived).toBe(true); });
  it('小学 3–4 年级所有怪 ⚔⚔🛡', () => { const s = newRound('p36', 'boss', { lowGrade: true }); expect(s.pattern).toEqual(['atk', 'atk', 'shield']); });
});
