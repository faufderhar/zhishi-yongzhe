// r17.1 学霸 r17-5：阶段线文案不再借用玩家技能「护体」——「多出的不会带到下一阶段」/「🚧 阶段线！第一阶段破了，多出 N 点没打进去」；数值不变
import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { newRound, resolveRound, estimateDealt, estimateOverflow, phaseOverflow } from '../src/game/rounds';
import { detailLines, guardText, phaseCapText } from '../src/game/dmgText';
import { SCIFI } from '../src/game/characters';

const asuan = SCIFI.find(c => c.id === 'asuan')!;
it('初二 Boss 第一阶段剩 10、打出 36 以上：只扣 10，预计行 / 飘字 / 明细是新文案', () => {
  const s0 = { ...newRound('j', 'boss'), monsterHp: 110 }; const inp = { subject: '数学', difficulty: 3, challenge: true };
  expect(s0.def.phases?.[1].hp).toBe(100);
  const est = estimateDealt(s0, asuan, inp); expect(est).toBe(10);
  const [s, o] = resolveRound(s0, asuan, { ...inp, correct: true, noSkill: true, rng: () => 0.999 });
  const raw = o.dmg!.per * o.dmg!.hits; expect(raw).toBeGreaterThanOrEqual(36);
  expect(o.dealt).toBe(10); expect(s.monsterHp).toBe(100); expect(phaseOverflow(o)).toBe(raw - 10); expect(estimateOverflow(s0, asuan, inp)).toBe(raw - 10);
  expect(phaseCapText(est)).toBe('本阶段最多扣 10，多出的不会带到下一阶段');
  expect(guardText(raw - 10)).toBe(`🚧 阶段线！第一阶段破了，多出 ${raw - 10} 点没打进去`);
  expect(detailLines(o.dmg!, o.dealt, o.absorbed ?? 0).at(-1)).toBe(`实际造成 10（🚧 阶段线！第一阶段破了，多出 ${raw - 10} 点没打进去）`);
});
it('src 里不再出现「被 Boss 护体挡住」「🛡 护体！第一阶段」', () => {
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
  for (const f of walk('src').filter(f => /\.(ts|tsx)$/.test(f))) { const t = readFileSync(f, 'utf8'); expect(t, f).not.toMatch(/被 Boss 护体挡住|🛡 护体！第一阶段/); }
});
