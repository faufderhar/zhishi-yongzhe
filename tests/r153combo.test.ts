// r15.3 学霸：「+1 技能」（技能让连击一次 +2）在真实对局里会出现吗？——用真实结算模拟整局（我方 / 对方回合交替、随机对错）
import { it, expect } from 'vitest';
import { newRound, resolveRound } from '../src/game/rounds';
import { PUPS, SCIFI } from '../src/game/characters';
import { skillsFor } from '../src/game/skills';
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const sim = (c: (typeof PUPS)[number], mode: 'j' | 'h', games = 200) => { let jumps = 0;
  for (let g = 0; g < games; g++) { let s = { ...newRound(mode, 'normal'), monsterHp: 9999, monsterMax: 9999 };
    for (let t = 0; t < 14; t++) { const prev = s.combo; const [ns] = resolveRound(s, c, { correct: rnd() < 0.8, subject: c.major, difficulty: 3, rng: rnd, card: 'std' }); if (ns.combo - prev >= 2) jumps++; s = ns; } }
  return jumps; };
it('有「连击额外 +1」技能的角色：整局模拟里确实出现连击 +2；没有这个技能的角色不会出现', () => {
  const out: string[] = [];
  for (const [mode, seg] of [['j', 'J'], ['h', 'H']] as const) for (const c of [...PUPS, ...SCIFI]) {
    const has = skillsFor(seg, c.major).some(k => k.effect === 'A125C'); const n = sim(c, mode);
    out.push(`${seg} ${c.name}(${c.major}) 有技能=${has} 连击+2 次数=${n}/200 局`);
    if (has) expect(n, c.name).toBeGreaterThan(20); else expect(n, c.name).toBe(0);
  }
  console.log(out.join('\n'));
});
