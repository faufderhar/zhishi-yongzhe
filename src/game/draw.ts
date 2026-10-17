import { stemOf } from './adaptive';
/* r11 学霸：一局内取题（我方 / 对方回合、挑战题、多选保底、难度回落都走这里）。
   1) 一局内不重复：按题号去重，并按题干（去空白/公式符号）去重；只有本关题池全部出过才重复。
   2) 难度回落时：在所有没出过的题里优先 ≤ 当前档（最接近的低档），不再因为「精选题 / 关外没见过」的分组先挑到更难的。
      没出过的题里没有 ≤ 当前档的，才取最接近的（可能更难）——不重复优先（与策划确认：去重优先于不升档）。 */
import { pickByTier, isConsolidating, tierCost, type Tier } from './consolidate';
export const normStem = (q: { question: string }) => q.question.replace(/[\s$，。,.？?！!“”"]+/g, '');
export interface DrawOpts<T> { pred: (x: T) => boolean; curated: Set<string>; seen?: Set<string>; tier: Tier;
  multi: (xs: T[], pick: (ys: T[]) => T | undefined) => T | undefined /* 多选规则：force 时只挑多选、不允许时排除多选 */ }
type Q = { key: string; question: string; difficulty: number };
export function drawNext<T extends Q>(unused: T[], used: T[], o: DrawOpts<T>): { q: T | undefined; repeat: boolean } {
  const usedStems = new Set(used.map(normStem));
  const fresh0 = unused.filter(x => !usedStems.has(normStem(x)));   // 同题干的另一题号也算出过
  const allowed = fresh0.filter(o.pred);
  // r13 学霸：先按难度（最接近当前自适应档的那一档），同档里再按「精选且关外没见过 → 关外没见过 → 精选 → 其他」挑。
  // 以前先按分组再按难度：精选组里只剩 1 档的题时，闪避题会出到难度 1，而攻击题在 3。
  const groups = (xs: T[]) => { const un = (x: T) => !o.seen?.has(x.key), cu = (x: T) => o.curated.has(x.key); return [xs.filter(x => cu(x) && un(x)), xs.filter(un), xs.filter(cu), xs]; };
  const nearest = (xs: T[]) => { if (!xs.length) return xs; const m = Math.min(...xs.map(x => tierCost(x.difficulty, o.tier))); return xs.filter(x => tierCost(x.difficulty, o.tier) === m); };
  const best = (ys: T[]) => { const n = nearest(ys); for (const g of groups(n)) if (g.length) return g[0]; return undefined; };
  const byGroups = (xs: T[]) => xs.length ? o.multi(xs, best) : undefined;   // 多选规则先筛（必须出 / 不许出），筛完再按难度 → 分组
  /* r15.3 学霸：先在「本档案历史上没见过」的题里挑，没有才用见过的。以前先按难度最接近：上一局出过、难度正好的题会压过没见过但差一档的题，
     重开一局就有一半是上一局的题（高一生物 8 道重复 4 道） */
  const hist = (xs: T[]) => { if (!o.seen) return xs; const u = xs.filter(x => !o.seen!.has(x.key)); return u.length ? u : xs; };
  const byHist = (xs: T[]) => { const h = hist(xs); return (h !== xs ? byGroups(h) : undefined) ?? byGroups(xs); };
  if (isConsolidating(o.tier)) { const low = allowed.filter(x => x.difficulty <= o.tier.tier); const r = low.length ? byHist(low) : undefined; if (r) return { q: r, repeat: false }; }
  const r = byHist(allowed) ?? pickByTier(hist(allowed), o.tier) ?? pickByTier(hist(fresh0), o.tier);   // 多选规则 / 对方回合限制挑不出时，仍先用没出过的题
  if (r) return { q: r, repeat: false };
  // 本关题池全部出过：才重复（错题、较早出的优先由调用方排序）
  const rep = used.filter(o.pred); return { q: pickByTier(rep.length ? rep : used, o.tier), repeat: true };
}
/** r12 学霸：本局没出过的题（题号 + 规范化题干都没出过；候选内部同题干只留一道） */
export function unseen<T extends Q>(xs: T[], used: T[]): T[] {
  const ks = new Set(used.map(x => x.key)), st = new Set(used.map(normStem)), seen = new Set<string>();
  return xs.filter(x => { const t = normStem(x); if (ks.has(x.key) || st.has(t) || seen.has(t)) return false; seen.add(t); return true; });
}

/** r13 技术QA R12-3 / 策划：本关题池出完时补题。先本关备用（Boss 为整单元）里本局没出过的；再同单元相邻小节（按传入顺序，前面的先），
    一次补一个小节；都出完才重复：只放回 1 道（错题优先、较早出的优先），其余仍算本局出过。 */
/** r15：一局里同一道题最多出现几次 */
export const REPEAT_CAP = 2;
export function refill<T extends Q>(used: T[], reserve: T[], adj: T[][], wrong: Set<string> = new Set(), noRepeat: Set<string> = new Set(), reps: Map<string, number> = new Map()): { pool: T[]; used: T[]; kind: 'reserve' | 'adj' | 'repeat' | 'none' } {
  const fresh = unseen(reserve, used); if (fresh.length) return { pool: fresh, used, kind: 'reserve' };
  const g = adj.map(x => unseen(x, used)).find(x => x.length); if (g) return { pool: g, used, kind: 'adj' };
  if (!used.length) return { pool: [], used, kind: 'none' };
  // r14：本局作为挑战题出过的不再拿来重复（以前错题优先会把挑战题又当闪避题出）
  // r14.1 技术QA R14-1：以前错题优先 + 重复后又排回队尾——唯一的那道错题会被一遍遍重复（一题出 4 次）。现在先挑重复次数最少的，再错题优先，再最早出的
  // r15 策划：重复时每道题一局最多出 2 次（首次 + 1 次重复）；以前答错的先重复；都出满 2 次 → kind 'none'（怪物提前撤退）
  const last = used[used.length - 1]; const cand0 = used.filter(x => !noRepeat.has(x.key) && (reps.get(x.key) ?? 0) < REPEAT_CAP - 1);
  const lastStem = last ? stemOf(last) : ''; const cand1 = cand0.filter(x => x !== last && stemOf(x) !== lastStem); const cand = cand1.length ? cand1 : cand0.length > 1 ? cand0.filter(x => x !== last) : cand0;   /* r15：也按题干避开 */   // 尽量不连续出同一道
  const rep = [...cand].sort((a, b) => +wrong.has(b.key) - +wrong.has(a.key) || used.indexOf(a) - used.indexOf(b))[0];
  if (rep) reps.set(rep.key, (reps.get(rep.key) ?? 0) + 1);
  if (!rep) return { pool: [], used, kind: 'none' };
  return { pool: [rep], used: used.filter(x => x !== rep), kind: 'repeat' };
}
