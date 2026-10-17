// r15.3 学霸：「本题预计伤害」= 答对时实际伤害（含连击、押注、挑战、题卡、专注、被动、弱点、护盾、阶段下限；技能另算）
import { it, expect } from 'vitest';
import { newRound, resolveRound, estimateDealt, type RState } from '../src/game/rounds';
import { PUPS, SCIFI } from '../src/game/characters';
const chars = [...PUPS, ...SCIFI];
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
it('2000 个随机局面：估计值 = 答对且没触发技能时的实际伤害', () => {
  let n = 0;
  for (let t = 0; t < 2000; t++) {
    const mode = pick(['j', 'h'] as const), kind = pick(['normal', 'elite', 'boss'] as const);
    const c = pick(chars); const subj = pick([c.major, '数学', '英语', '物理', '语文']);
    let s: RState = newRound(mode, kind);
    s = { ...s, side: 'P', combo: Math.floor(rnd() * 6), focus: Math.floor(rnd() * 3), shield: rnd() < 0.3 ? Math.floor(rnd() * 15) : 0, monsterHp: rnd() < 0.2 ? Math.max(1, Math.floor(s.monsterMax * 0.55)) : s.monsterHp, energy: Math.floor(rnd() * 3) };
    const inp = { subject: subj, difficulty: 1 + Math.floor(rnd() * 5), card: mode === 'h' ? pick(['light', 'std', 'heavy'] as const) : 'std' as const, wager: mode === 'h' ? pick(['sure', 'unsure', null] as const) : null, challenge: mode === 'j' && rnd() < 0.5 };
    const est = estimateDealt(s, c, inp);
    const [, o] = resolveRound(s, c, { ...inp, correct: true, rng: () => 0.999999 });   // 真实结算（技能照常判定）
    if (o.skill) continue; n++;
    expect(est, JSON.stringify({ mode, kind, c: c.name, inp, combo: s.combo, shield: s.shield })).toBe(o.dealt);
  }
  expect(n).toBeGreaterThan(1500);
});
it('押「确定」×1.2、挑战 ×1.5 都进了估计值；估计不改动局面', () => {
  const c = PUPS[0]; const s = { ...newRound('h', 'normal'), side: 'P' as const, monsterHp: 999, monsterMax: 999 }; const snap = JSON.stringify(s);
  const a = estimateDealt(s, c, { subject: '物理', difficulty: 3, card: 'std' }), b = estimateDealt(s, c, { subject: '物理', difficulty: 3, card: 'std', wager: 'sure' });
  expect(b).toBeGreaterThan(a); expect(JSON.stringify(s)).toBe(snap);
  const j = { ...newRound('j', 'normal'), side: 'P' as const, monsterHp: 999, monsterMax: 999 };
  expect(estimateDealt(j, c, { subject: '物理', difficulty: 3, challenge: true })).toBeGreaterThan(estimateDealt(j, c, { subject: '物理', difficulty: 3 }));
});
