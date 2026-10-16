/* 移植 /workspace/playtest/sim/final.py：用我们的引擎跑 4000 次，对比 GDD v0.3.6 §4.4 表 */
import { describe, it, expect } from 'vitest';
import { newRound, resolveRound, reviveRound, type RState } from '../src/game/rounds';
import { ENERGY_CAP, type RoundMode } from '../src/game/balance';
import { PUPS } from '../src/game/characters';
const poet = PUPS.find(c => c.major === '诗词')!;
function mk(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
export function simulate(mode: RoundMode, kind: 'normal' | 'elite' | 'boss', acc: number, n = 4000, seed = 2026, real = false) {
  const R = mk(seed); const extra = mode === 'h' ? 1.2 : 1;   // final.py：高中 mult = 1.2×1.2
  let turns = 0, win = 0, norev = 0, ret = 0, hp = 0, nsk = 0, ncor = 0; const secs: number[] = [];
  for (let k = 0; k < n; k++) {
    let s: RState = newRound(mode, kind); let Q = 0;
    while (!s.over) {
      Q++; const correct = R() < acc;
      let mult = extra; let fire = false;
      if (real) { const fast = s.side === 'M' && correct && R() < 0.5; let o; [s, o] = resolveRound(s, poet, { correct, subject: '诗词', difficulty: 2, fast, rng: R, simSkillMult: s.side === 'P' ? extra : 1 }); if (o.skill) nsk++; if (correct) ncor++; }
      else {
      if (s.side === 'P' && correct) { const gain = s.combo + 1 === 3 ? 2 : 1; if (Math.min(ENERGY_CAP, s.energy + gain) >= 5) { mult *= 1.4; fire = true; } }
      const fast = s.side === 'M' && correct && R() < 0.5;
      [s] = resolveRound(s, poet, { correct, subject: '诗词', difficulty: 2, fast, rng: R, noSkill: true, simSkillMult: s.side === 'P' ? mult : 1 });
      if (fire) s = { ...s, energy: 0 };
      }
      if (s.over === 'lose' && !s.revived) {
        let ok = 0, t = 0; while (ok < 2 && t < 4) { t++; Q++; if (R() < acc) ok++; }
        if (ok >= 2) s = reviveRound(s); else s = { ...s, revived: true };
      }
    }
    turns += s.turn; let sec = 0; for (let q = 0; q < Q; q++) sec += 15 + 10 * R(); secs.push(sec / 60);
    if (s.over !== 'lose') { win++; hp += s.playerHp / s.playerMax; if (!s.revived) norev++; if (s.over === 'retreat') ret++; }
  }
  secs.sort((a, b) => a - b);
  return { turns: turns / n, norev: norev / n, win: win / n, ret: ret / n, hp: hp / win, min: secs.reduce((a, b) => a + b) / n, p10: secs[n / 10], p90: secs[9 * n / 10], nsk: nsk / n, perCorrect: nsk / Math.max(1, ncor) };
}
// [mode, kind, acc, 回合, 不复活通关, 通关, 撤退, 胜者剩血, 时长]
const DOC: [RoundMode, 'normal' | 'elite' | 'boss', number, number, number, number, number, number, number][] = [
  ['j', 'normal', .75, 5.9, 1, 1, .015, .87, 2.0], ['j', 'normal', .6, 7.5, 1, 1, .122, .74, 2.5],
  ['j', 'elite', .75, 10.1, .986, 1, .017, .71, 3.4], ['j', 'elite', .6, 12.8, .831, .962, .136, .49, 4.4],
  ['j', 'boss', .75, 12.6, .929, .989, .003, .60, 4.3], ['j', 'boss', .6, 15.5, .575, .81, .02, .42, 5.6],
  ['h', 'normal', .7, 6.4, 1, 1, .036, .84, 2.1], ['h', 'normal', .6, 7.4, 1, 1, .12, .75, 2.5],
  ['h', 'elite', .7, 10.1, .97, .998, .023, .68, 3.4], ['h', 'elite', .6, 11.8, .862, .965, .085, .55, 4.1],
  ['h', 'boss', .7, 13.7, .908, .985, .003, .54, 4.6], ['h', 'boss', .6, 15.9, .698, .898, .02, .39, 5.6],
  ['p36', 'normal', .75, 6.5, 1, 1, .017, .88, 2.2], ['p36', 'normal', .6, 7.9, 1, 1, .122, .77, 2.6],
  ['p36', 'elite', .75, 9.7, .997, 1, .036, .78, 3.2], ['p36', 'elite', .6, 12.0, .948, .99, .205, .57, 4.1],
  ['p36', 'boss', .75, 12.5, .968, .998, .011, .65, 4.2], ['p36', 'boss', .6, 15.6, .722, .927, .088, .44, 5.5],
];
describe('§4.4 模拟复现（4000 次）', () => {
  for (const [m, k, a, t, nr, w, ret, hp, min] of DOC) it(`${m} ${k} ${a * 100}%`, () => {
    const r = simulate(m, k, a);
    const f = (x: number) => (x * 100).toFixed(1) + '%';
    console.log(`SIM|${m}|${k}|${a * 100}%|${r.turns.toFixed(1)} (${t})|${f(r.norev)} (${f(nr)})|${f(r.win)} (${f(w)})|${f(r.ret)} (${f(ret)})|${(r.hp * 100).toFixed(0)}% (${hp * 100}%)|${r.min.toFixed(1)} (${min})`);
    // r6 裁定 7：高一 Boss 第一阶段溢出伤害不再带入第二阶段 → 回合数比文档（溢出带入）多 ~1.5，放宽到 2
    const hb = m === 'h' && k === 'boss';
    expect(Math.abs(r.turns - t)).toBeLessThanOrEqual(hb ? 2 : 0.5);
    expect(Math.abs(r.norev - nr)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(r.win - w)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(r.ret - ret)).toBeLessThanOrEqual(0.04);
    expect(Math.abs(r.hp - hp)).toBeLessThanOrEqual(0.04);
    expect(Math.abs(r.min - min)).toBeLessThanOrEqual(hb ? 0.8 : 0.3);
  });
});

// v0.3.7（随机技能）：/workspace/playtest/sim/final2.py → result_v037.md；我们用真实 85 技能效果（诗诗/诗词），final2 用通用 ×1.4 / 护体·回血·控制 5:3:2
// [mode, kind, acc, 回合, 不复活通关, 通关, 撤退, 胜者剩血, 平均触发次数, 时长]
const DOC37: [RoundMode, 'normal' | 'elite' | 'boss', number, number, number, number, number, number, number, number][] = [
  ['p36', 'normal', .75, 5.8, 1, 1, .022, .90, 1.3, 1.9], ['p36', 'normal', .6, 7.2, 1, 1, .123, .80, 1.2, 2.4],
  ['p36', 'elite', .75, 9.9, .998, 1, .041, .79, 2.2, 3.3], ['p36', 'elite', .6, 12.2, .951, .993, .231, .59, 2.1, 4.1],
  ['p36', 'boss', .75, 12.3, .981, .999, .013, .71, 2.8, 4.1], ['p36', 'boss', .6, 15.6, .774, .94, .101, .49, 2.8, 5.4],
  ['j', 'normal', .75, 5.5, 1, 1, .018, .88, 1.1, 1.8], ['j', 'normal', .6, 7.2, .999, 1, .119, .76, 1.2, 2.4],
  ['j', 'elite', .75, 10.2, .988, 1, .018, .74, 2.3, 3.4], ['j', 'elite', .6, 12.7, .844, .961, .135, .52, 2.2, 4.4],
  ['j', 'boss', .75, 12.7, .949, .993, .004, .65, 2.9, 4.3], ['j', 'boss', .6, 15.7, .633, .848, .039, .44, 2.8, 5.6],
  ['h', 'normal', .7, 6.0, 1, 1, .034, .85, 1.1, 2.0], ['h', 'normal', .6, 7.1, 1, 1, .117, .77, 1.1, 2.4],
  ['h', 'elite', .7, 10.3, .972, .996, .029, .70, 2.1, 3.4], ['h', 'elite', .6, 12.0, .878, .971, .095, .56, 2.1, 4.1],
  ['h', 'boss', .7, 13.7, .929, .99, .004, .60, 2.9, 4.6], ['h', 'boss', .6, 16.1, .729, .91, .022, .45, 2.9, 5.6],
];
describe('v0.3.7 随机技能模拟（真实技能效果，4000 次）', () => {
  for (const [m, k, a, t, nr, w, ret, hp, ns, min] of DOC37) it(`${m} ${k} ${a * 100}%`, () => {
    const r = simulate(m, k, a, 4000, 2026, true);
    const f = (x: number) => (x * 100).toFixed(1) + '%';
    console.log(`SIM37|${m}|${k}|${a * 100}%|${r.turns.toFixed(1)} (${t})|${f(r.norev)} (${f(nr)})|${f(r.win)} (${f(w)})|${f(r.ret)} (${f(ret)})|${(r.hp * 100).toFixed(0)}% (${(hp * 100).toFixed(0)}%)|${r.nsk.toFixed(1)} (${ns})|${r.min.toFixed(1)} (${min})|触发/答对 ${(r.perCorrect * 100).toFixed(1)}%`);
    expect(r.perCorrect).toBeGreaterThanOrEqual(0.2); expect(r.perCorrect).toBeLessThanOrEqual(0.31);
    const hb = m === 'h' && k === 'boss';
    expect(Math.abs(r.turns - t)).toBeLessThanOrEqual(hb ? 2 : 1.0);
    expect(Math.abs(r.norev - nr)).toBeLessThanOrEqual(0.08);
    expect(Math.abs(r.win - w)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(r.ret - ret)).toBeLessThanOrEqual(0.06);
    expect(Math.abs(r.hp - hp)).toBeLessThanOrEqual(0.07);
    expect(Math.abs(r.nsk - ns)).toBeLessThanOrEqual(0.5);
  });
});
