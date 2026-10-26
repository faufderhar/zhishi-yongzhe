// r17.1 学霸 r17-13：F1「解除负面状态」只加注释（当前没有负面状态来源），逻辑不变
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
it('skills.ts / rounds.ts 注明「当前没有负面状态来源」，且仓库里没有地方加 debuffs / silenced', () => {
  const r = readFileSync('src/game/rounds.ts', 'utf8'), k = readFileSync('src/game/skills.ts', 'utf8');
  expect(k).toContain('当前没有负面状态来源'); expect(r).toContain('当前没有负面状态来源');
  expect(r).toContain("else if (sk.effect === 'F1') { if (s.debuffs) s.debuffs--; s.silenced = 0; s.focus = Math.min(FOCUS_MAX, s.focus + 1); }");
  expect(r).not.toMatch(/debuffs\s*(\+\+|\+=)|silenced\s*(\+\+|\+=)|silenced\s*=\s*[1-9]/);
});
