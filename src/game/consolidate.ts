/* 关内难度回落（策划 r6 裁定 4）：连续答错 2 题 → 下一题降 1 档（最多降 1 档）；在降档状态下连续答对 2 题 → 回到原难度。
   不显示「降难度」文字；初一 / 高一在降档题的卡片角上显示小标签「巩固题」，小学及以下不显示。 */
export interface Tier { base: number; tier: number; right: number; wrong: number }
export const newTier = (base: number): Tier => ({ base, tier: base, right: 0, wrong: 0 });
export function nextTier(t: Tier, correct: boolean, down = 2): Tier {
  if (correct) { const right = t.right + 1; return t.tier < t.base && right >= 2 ? { ...t, tier: t.base, right: 0, wrong: 0 } : { ...t, right, wrong: 0 }; }
  const wrong = t.wrong + 1;
  return wrong >= down && t.tier === t.base && t.base > 1 ? { ...t, tier: t.base - 1, right: 0, wrong: 0 } : { ...t, wrong, right: 0 };
}
export const isConsolidating = (t: Tier) => t.tier < t.base;
/** 从候选里按档位取题：降档时取最接近 tier 的题，尽量不低于 tier（最多降 1 档） */
export function pickByTier<T extends { difficulty: number }>(cands: T[], t: Tier): T | undefined {
  if (!cands.length) return undefined;
  // 不降档时也按「最接近当前档」取，避免同一关内 3→5→3→2 来回跳（补测报告 #6）；同分保持原顺序
  const cost = (d: number) => (isConsolidating(t) && d < t.tier ? 10 : 0) + Math.abs(d - t.tier);
  return cands.reduce((b, q) => cost(q.difficulty) < cost(b.difficulty) ? q : b);
}
export const showConsolidateTag = (band: string) => band === 'J' || band === 'H';
