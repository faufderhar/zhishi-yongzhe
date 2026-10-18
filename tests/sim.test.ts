/* D14（v0.3.8）模拟：按 /workspace/playtest/sim/final4.py 的前提用我们的引擎跑 4000 局/格，对比 D14 规格 §8 表（通关率 ±2 个百分点）
   前提：2 级题、科目 = 角色主修；5 个角色轮流各 800 局（真实被动与技能池）；完美闪避占对方回合答对的 50%；复活 = 4 次机会答对 2 题；每题 15–25 秒；高一标准卡、不押注 */
import { describe, it, expect } from 'vitest';
import { newRound, resolveRound, reviveRound, type RState } from '../src/game/rounds';
import { type RoundMode, STAR3 } from '../src/game/balance';
import { PUPS, SCIFI } from '../src/game/characters';
function mk(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
export function simulate(mode: RoundMode, kind: 'normal' | 'elite' | 'boss', acc: number, n = 4000, seed = 2026, chal?: number, bet = false /* r15.4.2：高一我方回合全押注 */) {
  const R = mk(seed); const chars = (mode === 'h' ? SCIFI : PUPS).slice(0, 5);
  let kills = 0, turns = 0, win = 0, norev = 0, ret = 0, hp = 0, s3 = 0, hits = 0; const secs: number[] = [];
  for (let k = 0; k < n; k++) {
    const c = chars[k % chars.length];
    let s: RState = newRound(mode, kind); let Q = 0, cor = 0, ans = 0;
    while (!s.over) {
      Q++; ans++; const ch = chal != null && s.side === 'P'; const correct = R() < (ch ? chal : acc); if (correct) cor++;
      const fast = s.side === 'M' && correct && R() < 0.5;
      let o; [s, o] = resolveRound(s, c, { correct, subject: c.major, difficulty: ch ? 3 : 2, fast, rng: R, challenge: ch, wager: bet && s.side === 'P' });
      if (o.side === 'P' && o.dealt > 0) hits++;
      if (s.over === 'lose' && !s.revived) {
        let ok = 0, t = 0; while (ok < 2 && t < 4) { t++; Q++; if (R() < acc) ok++; }
        if (ok >= 2) s = reviveRound(s); else s = { ...s, revived: true };
      }
    }
    if (s.over === 'win') kills++; turns += s.turn; let sec = 0; for (let q = 0; q < Q; q++) sec += 15 + 10 * R(); secs.push(sec / 60);
    if (s.over !== 'lose') { win++; hp += s.playerHp / s.playerMax; if (!s.revived) norev++; if (s.over === 'retreat') ret++;
      if (s.over === 'win' && cor / ans >= STAR3.acc && !s.revived && s.playerHp / s.playerMax >= STAR3.hp) s3++; }
  }
  secs.sort((a, b) => a - b);
  return { kill: kills / n, turns: turns / n, norev: norev / n, win: win / n, ret: ret / n, hp: hp / win, s3: s3 / n, hits: hits / n, min: secs.reduce((a, b) => a + b) / n, p90: secs[9 * n / 10] };
}
// D14 §8：[mode, kind, acc, 平均回合, 不复活通关, 含复活+撤退通关, 撤退, 3★, 胜者剩血, 时长]
type Row = [RoundMode, 'normal' | 'elite' | 'boss', number, number, number, number, number, number, number, number];
export const DOC38: Row[] = [
  ['p36', 'normal', .75, 7.0, 1, 1, .02, .52, .89, 2.3], ['p36', 'normal', .6, 8.9, 1, 1, .128, .23, .78, 3.0],
  ['p36', 'elite', .75, 12.7, .991, 1, .035, .43, .77, 4.2], ['p36', 'elite', .6, 15.6, .888, .978, .219, .11, .54, 5.3],
  ['p36', 'boss', .75, 16.6, .977, .998, .008, .41, .70, 5.5], ['p36', 'boss', .6, 20.6, .745, .926, .088, .08, .47, 7.1],
  ['j', 'normal', .75, 7.3, 1, 1, .021, .53, .87, 2.4], ['j', 'normal', .6, 9.4, .997, .999, .162, .24, .71, 3.1],
  ['j', 'elite', .75, 13.0, .977, .998, .034, .43, .70, 4.3], ['j', 'elite', .6, 15.9, .763, .94, .222, .10, .48, 5.5],
  ['j', 'boss', .75, 18.4, .936, .99, .025, .39, .63, 6.2], ['j', 'boss', .6, 22.2, .542, .816, .139, .06, .40, 7.9],
  ['h', 'normal', .7, 7.7, .999, 1, .049, .42, .83, 2.6], ['h', 'normal', .6, 9.3, .998, 1, .156, .24, .73, 3.1],
  ['h', 'elite', .7, 13.5, .948, .993, .067, .30, .64, 4.5], ['h', 'elite', .6, 15.5, .781, .94, .189, .11, .49, 5.4],
  ['h', 'boss', .7, 18.2, .887, .982, .012, .26, .55, 6.2], ['h', 'boss', .6, 20.8, .607, .853, .053, .08, .41, 7.3],
];
const f = (x: number) => (x * 100).toFixed(1) + '%';
describe('D14 v0.3.8 模拟（4000 局，对比规格 §8）', () => {
  for (const [m, k, a, t, nr, w, ret, s3, hp, min] of DOC38) it(`${m} ${k} ${a * 100}%`, () => {
    const r = simulate(m, k, a);
    console.log(`SIM38|${m}|${k}|${a * 100}%|回合 ${r.turns.toFixed(1)} (${t})|不复活 ${f(r.norev)} (${f(nr)})|通关 ${f(r.win)} (${f(w)})|撤退 ${f(r.ret)} (${f(ret)})|3★ ${f(r.s3)} (${f(s3)})|剩血 ${(r.hp * 100).toFixed(0)}% (${(hp * 100).toFixed(0)}%)|${r.min.toFixed(1)}/${r.p90.toFixed(1)} 分 (${min})`);
    expect(Math.abs(r.norev - nr)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(r.win - w)).toBeLessThanOrEqual(0.02);
  });
});
