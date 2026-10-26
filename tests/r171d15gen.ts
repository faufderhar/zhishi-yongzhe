// r17.1 D15 §6.4：伤害指纹（只改显示 → 改前改后 ROut.dealt / hits / taken 必须完全相同）
import { newRound, resolveRound, type CardKind } from '../src/game/rounds';
import { SCIFI, PUPS } from '../src/game/characters';
import { SKILL_DATA } from '../src/game/skills.data';
export function fingerprint(): string[] {
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const chars = [...SCIFI, ...PUPS]; const subs = ['数学', '语文', '物理', '化学', '英语']; const sks = SKILL_DATA.filter(k => /^A/.test(k.effect));
  const out: string[] = [];
  for (let n = 0; n < 300; n++) {
    const c = chars[Math.floor(rnd() * chars.length)], mode = rnd() < 0.5 ? 'h' : 'j' as const;
    const s = { ...newRound(mode, 'normal', { level: 1 }), combo: Math.floor(rnd() * 8), focus: Math.floor(rnd() * 3), shield: rnd() < 0.3 ? Math.floor(rnd() * 15) : 0, monsterHp: 5000, monsterMax: 5000 };
    const partial = rnd() < 0.15, sk = !partial && rnd() < 0.3 ? sks[Math.floor(rnd() * sks.length)] : undefined;
    const i = { correct: rnd() < 0.85, partial, subject: subs[Math.floor(rnd() * subs.length)], difficulty: 1 + Math.floor(rnd() * 5), card: (['light', 'std', 'heavy'] as CardKind[])[Math.floor(rnd() * 3)], wager: !partial && rnd() < 0.4, challenge: mode === 'j' && rnd() < 0.3, stepIndex: rnd() < 0.2 ? Math.floor(rnd() * 3) : undefined, forceSkill: sk, noSkill: !sk, rng: () => 0.99 };
    const [, o] = resolveRound(s, c, i);
    out.push(`${o.dealt}|${o.hits.join('+')}|${o.taken}|${o.dmg ? o.dmg.per + '/' + o.dmg.base.toFixed(6) + '/' + o.dmg.innerUsed.toFixed(6) : '-'}`);
  }
  return out;
}
