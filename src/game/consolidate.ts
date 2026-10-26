/* 关内难度回落（策划 r6 裁定 4）：连续答错 2 题 → 下一题降 1 档（最多降 1 档）；在降档状态下连续答对 2 题 → 回到原难度。
   不显示「降难度」文字；初一 / 高一在降档题的卡片角上显示小标签「巩固题」，小学及以下不显示。 */
export interface Tier { base: number; tier: number; right: number; wrong: number }
/** r13（策划）：自适应难度上限 = min(目标档 + 1, 3)；下限不变（1）。4 档只能通过挑战题 / 重击卡（当前档 +1）出现 */
export const tierCap = (base: number) => Math.min(base + 1, 3);
export const newTier = (base: number): Tier => ({ base, tier: Math.min(base, tierCap(base)), right: 0, wrong: 0 });
/** r12（策划，学霸 r11）：按原设计双向自适应——连错 2 题降 1 档（最低 1，一次只降 1 档，不会直接掉到 1）；连对 2 题升 1 档（最高 max） */
export function nextTier(t: Tier, correct: boolean, down = 2, max = tierCap(t.base)): Tier {
  if (correct) { const right = t.right + 1; return right >= 2 ? { ...t, tier: Math.min(max, t.tier + 1), right: 0, wrong: 0 } : { ...t, right, wrong: 0 }; }
  const wrong = t.wrong + 1;
  return wrong >= down ? { ...t, tier: Math.max(1, t.tier - 1), right: 0, wrong: 0 } : { ...t, wrong, right: 0 };
}
export const isConsolidating = (t: Tier) => t.tier < t.base;
/** 从候选里按档位取题：降档时取最接近 tier 的题，尽量不低于 tier（最多降 1 档） */
/** 离当前档的「距离」（巩固期低于当前档的额外加罚） */
export const tierCost = (d: number, t: Tier) => (isConsolidating(t) && d < t.tier ? 10 : 0) + Math.abs(d - t.tier);
export function pickByTier<T extends { difficulty: number }>(cands: T[], t: Tier, lowTie = false): T | undefined {
  if (!cands.length) return undefined;
  // 不降档时也按「最接近当前档」取，避免同一关内 3→5→3→2 来回跳（补测报告 #6）；同分保持原顺序
  // r17.1 学霸 R1（lowTie）：同样近时取低的那档（轮流回合关：drawNext / 高中选卡）
  const cost = (d: number) => tierCost(d, t);
  return cands.reduce((b, q) => cost(q.difficulty) < cost(b.difficulty) || (lowTie && cost(q.difficulty) === cost(b.difficulty) && q.difficulty < b.difficulty) ? q : b);
}
export const showConsolidateTag = (band: string) => band === 'J' || band === 'H';
