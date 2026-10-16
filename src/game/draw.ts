/* r11 学霸：一局内取题（我方 / 对方回合、挑战题、多选保底、难度回落都走这里）。
   1) 一局内不重复：按题号去重，并按题干（去空白/公式符号）去重；只有本关题池全部出过才重复。
   2) 难度回落时：在所有没出过的题里优先 ≤ 当前档（最接近的低档），不再因为「精选题 / 关外没见过」的分组先挑到更难的。
      没出过的题里没有 ≤ 当前档的，才取最接近的（可能更难）——不重复优先（与策划确认：去重优先于不升档）。 */
import { pickByTier, isConsolidating, type Tier } from './consolidate';
export const normStem = (q: { question: string }) => q.question.replace(/[\s$，。,.？?！!“”"]+/g, '');
export interface DrawOpts<T> { pred: (x: T) => boolean; curated: Set<string>; seen?: Set<string>; tier: Tier;
  multi: (xs: T[], pick: (ys: T[]) => T | undefined) => T | undefined /* 多选规则：force 时只挑多选、不允许时排除多选 */ }
type Q = { key: string; question: string; difficulty: number };
export function drawNext<T extends Q>(unused: T[], used: T[], o: DrawOpts<T>): { q: T | undefined; repeat: boolean } {
  const usedStems = new Set(used.map(normStem));
  const fresh0 = unused.filter(x => !usedStems.has(normStem(x)));   // 同题干的另一题号也算出过
  const allowed = fresh0.filter(o.pred);
  const groups = (xs: T[]) => [xs.filter(x => o.curated.has(x.key)), xs.filter(x => !o.seen?.has(x.key)), xs];
  const byGroups = (xs: T[]) => { for (const g of groups(xs)) { if (!g.length) continue; const r = o.multi(g, ys => pickByTier(ys, o.tier)); if (r) return r; } return undefined; };
  if (isConsolidating(o.tier)) { const low = allowed.filter(x => x.difficulty <= o.tier.tier); const r = low.length ? byGroups(low) : undefined; if (r) return { q: r, repeat: false }; }
  const r = byGroups(allowed) ?? pickByTier(allowed, o.tier) ?? pickByTier(fresh0, o.tier);   // 多选规则 / 对方回合限制挑不出时，仍先用没出过的题
  if (r) return { q: r, repeat: false };
  // 本关题池全部出过：才重复（错题、较早出的优先由调用方排序）
  const rep = used.filter(o.pred); return { q: pickByTier(rep.length ? rep : used, o.tier), repeat: true };
}
