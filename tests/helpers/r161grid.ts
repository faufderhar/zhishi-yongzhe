// r16.1 (v)-(y)：战斗数值网格（只读结算结果，用来证明文案改动没动任何数字）。
// 同一份代码在 r16.1 (u) 提交 6f22bd6 的 src 上跑出的结果存在 tests/fixtures/r161_battle_grid.json
import { createHash } from 'node:crypto';
import { newRound, resolveRound, estimateDealt, type RState } from '../../src/game/rounds';
import { PUPS, SCIFI } from '../../src/game/characters';

export function battleGrid() {
  const rows: unknown[] = [];
  const chars = [...PUPS, ...SCIFI];
  for (const mode of ['p36', 'j', 'h'] as const) for (const kind of ['normal', 'elite', 'boss'] as const) {
    const s00 = newRound(mode, kind);
    for (const hp of [s00.monsterMax, Math.ceil(s00.monsterMax / 2) + 7, Math.ceil(s00.monsterMax / 2) + 1, 9]) for (const c of chars) for (const combo of [0, 2, 4]) for (const energy of [0, 3, 4]) for (const dry of [0, 3, 4]) for (const rv of [0.05, 0.5, 0.999]) for (const side of ['P', 'M'] as const) for (const correct of [true, false]) {
      const s0: RState = { ...s00, monsterHp: hp, combo, energy, side, sk: { ...s00.sk, dry }, shield: hp === 9 ? 4 : 0 };
      let x = rv; const rng = () => { x = (x * 9301 + 0.49297) % 1; return x; };
      const [s, o] = resolveRound(s0, c, { correct, subject: c.major, difficulty: 3, rng });
      rows.push([mode, kind, hp, c.id, combo, energy, dry, rv, side, correct, o.dealt, o.hits, o.taken, o.healed, s.monsterHp, s.playerHp, s.energy, s.sk.dry, o.skill?.id ?? null, !!o.phaseShift, !!o.rage, s.over ?? null,
        side === 'P' ? estimateDealt(s0, c, { subject: c.major, difficulty: 3 }) : null]);
    }
  }
  return { n: rows.length, sha: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
}
