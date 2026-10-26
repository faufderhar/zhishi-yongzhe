import { stemOf } from './adaptive';
/* r11 学霸：一局内取题（我方 / 对方回合、挑战题、多选保底、难度回落都走这里）。
   1) 一局内不重复：按题号去重，并按题干（去空白/公式符号）去重；只有本关题池全部出过才重复。
   2) 难度回落时：在所有没出过的题里优先 ≤ 当前档（最接近的低档），不再因为「精选题 / 关外没见过」的分组先挑到更难的。
      没出过的题里没有 ≤ 当前档的，才取最接近的（可能更难）——不重复优先（与策划确认：去重优先于不升档）。 */
import { pickByTier, isConsolidating, tierCost, tierCap, type Tier } from './consolidate';
export const normStem = (q: { question: string }) => q.question.replace(/[\s$，。,.？?！!“”"]+/g, '');
export interface DrawOpts<T> { pred: (x: T) => boolean; curated: Set<string>; seen?: Set<string>; tier: Tier;
  multi: (xs: T[], pick: (ys: T[]) => T | undefined) => T | undefined /* 多选规则：force 时只挑多选、不允许时排除多选 */
  force?: (x: T) => boolean /* r15.3 本回合必须出的题型（多选保底）：候选里有这类题时，先在这类题里按「没见过 → 见过」挑 */
  first?: boolean /* r15.4 技术QA P4-1：一局第一题——在合格的题（难度最接近、历史上没见过）里等概率随机挑，不按列表顺序取第一个 */; rnd?: () => number
  /* r17.1 学霸 r17-8 R1：普通题难度上限（默认 tierCap(tier.base)）。只有挑战题 / 重击卡（pickHarder / anyHarder，不走这里）能超过 */
  cap?: number
  /* r17.1 学霸 r17-9 R3 / R4：Boss 取题——按档降级（同档 没见过 → 以前答错 → 见过，再降一档…），fresh3Left = 本局还能用的「没见过的难度 ≥3」配额 */
  boss?: BossOpt }
type Q = { key: string; question: string; difficulty: number; usage?: string };
/** wrong = 本档案以前答错的题；fresh3Left = 本局还能用的「没见过的难度 ≥3」配额（R4） */
export interface BossOpt { wrong: Set<string>; fresh3Left: number }
export function drawNext<T extends Q>(unused: T[], used: T[], o: DrawOpts<T>): { q: T | undefined; repeat: boolean; over?: boolean } {
  const usedStems = new Set(used.map(normStem));
  const fresh0 = unused.filter(x => !usedStems.has(normStem(x)));   // 同题干的另一题号也算出过
  const allowed = fresh0.filter(o.pred);
  // r13 学霸：先按难度（最接近当前自适应档的那一档），同档里再按「精选且关外没见过 → 关外没见过 → 精选 → 其他」挑。
  // 以前先按分组再按难度：精选组里只剩 1 档的题时，闪避题会出到难度 1，而攻击题在 3。
  const groups = (xs: T[]) => { const un = (x: T) => !o.seen?.has(x.key), cu = (x: T) => o.curated.has(x.key); return [xs.filter(x => cu(x) && un(x)), xs.filter(un), xs.filter(cu), xs]; };
  /* r17.1 R1：同样近的两档一律取低的（以前按列表顺序，档 3 时难度 2 和 4 同样近常常出 4） */
  const nearest = (xs: T[]) => { if (!xs.length) return xs; const m = Math.min(...xs.map(x => tierCost(x.difficulty, o.tier))); const n = xs.filter(x => tierCost(x.difficulty, o.tier) === m); const lo = Math.min(...n.map(x => x.difficulty)); return n.filter(x => x.difficulty === lo); };
  const best = (ys: T[]) => { const n = nearest(ys); if (o.first && n.length) return n[Math.floor((o.rnd ?? Math.random)() * n.length) % n.length]; for (const g of groups(n)) if (g.length) return g[0]; return undefined; };
  const byGroups = (xs: T[]) => xs.length ? o.multi(xs, best) : undefined;   // 多选规则先筛（必须出 / 不许出），筛完再按难度 → 分组
  /* r15.3 学霸：先在「本档案历史上没见过」的题里挑，没有才用见过的。以前先按难度最接近：上一局出过、难度正好的题会压过没见过但差一档的题，
     重开一局就有一半是上一局的题（高一生物 8 道重复 4 道） */
  const hist = (xs: T[]) => { if (!o.seen) return xs; const u = xs.filter(x => !o.seen!.has(x.key)); return u.length ? u : xs; };
  /* r15.3 多选保底：「没见过的先」不能压过必出的多选——多选题全见过（保底允许重出见过的）时，以前没见过的普通题先被挑走，整局 0 道多选 */
  const byHist0 = (xs: T[]) => { const h = hist(xs); return (h !== xs ? byGroups(h) : undefined) ?? byGroups(xs); };
  const byHist = (xs: T[]) => { const f = o.force ? xs.filter(o.force) : []; return (f.length ? byHist0(f) : undefined) ?? byHist0(xs); };
  const cap = o.cap ?? tierCap(o.tier.base);
  if (o.boss) { const r = bossDraw(allowed, fresh0, o, cap); if (r) return { q: r.q, repeat: false, over: r.over }; }
  else {
    if (isConsolidating(o.tier)) { const low = allowed.filter(x => x.difficulty <= o.tier.tier); const r = low.length ? byHist(low) : undefined; if (r) return { q: r, repeat: false }; }
    /* r17.1 R1：普通题先只在 ≤ cap 的题里挑；≤ cap 的都出过了才取更难的（over = true，题头才说「都出过了」）。
       必出的多选（force）不受上限限制，否则多选保底会被挤掉 */
    const capped = allowed.filter(x => x.difficulty <= cap || (!!o.force && o.force(x) && !allowed.some(y => o.force!(y) && y.difficulty <= cap)));
    const r = (capped.length ? byHist(capped) : undefined) ?? byHist(allowed) ?? pickByTier(hist(allowed), o.tier, true) ?? pickByTier(hist(fresh0), o.tier, true);   // 多选规则 / 对方回合限制挑不出时，仍先用没出过的题
    if (r) return { q: r, repeat: false, over: r.difficulty > Math.max(cap, o.tier.tier) || (r.difficulty > o.tier.tier && !capped.some(x => x.difficulty <= o.tier.tier)) };
  }
  // 本关题池全部出过：才重复（错题、较早出的优先由调用方排序）
  const rep = used.filter(o.pred); return { q: pickByTier(rep.length ? rep : used, o.tier, true), repeat: true };
}
/** r17.1 学霸 r17-9 R3 / R4（裁定 §5.3）：Boss 取题。先出 Boss 专用题（≤ cap、没见过 / 答错过）；want = min(当前档, cap)；从 want 往下到 1 档，每档按
    没见过（难度 ≥3 时受本局配额限制）→ 以前答错 → 见过 → （配额用完、只剩没见过的）没见过；同层里精选（开局题单，Boss 专用题在前）先、再按列表顺序。
    整章 ≤ want 的都出过了才取更难的最低档（over = true）。多选规则（multi）和必出题型（force）照旧先筛。 */
export function bossTiered<T extends Q>(xs: T[], o: Pick<DrawOpts<T>, 'seen' | 'curated' | 'tier' | 'first' | 'rnd' | 'cap'> & { boss: BossOpt }): { q: T; over: boolean } | undefined {
  if (!xs.length) return undefined;
  const cap = o.cap ?? tierCap(o.tier.base), want = Math.min(o.tier.tier, cap);
  const sel = (ys: T[]) => { const c = ys.filter(x => o.curated.has(x.key)), g = c.length ? c : ys; return o.first ? g[Math.floor((o.rnd ?? Math.random)() * g.length) % g.length] : g[0]; };
  /* 裁定 r17-9 验收「Boss 专用题仍先出」：本局没出过、没见过或以前答错的 Boss 专用题（usage=boss）≤ cap 的先出（开局题单本来就把它们放最前） */
  const bo = xs.filter(x => x.usage === 'boss' && x.difficulty <= cap && (!o.seen?.has(x.key) || o.boss.wrong.has(x.key)));
  if (bo.length) return { q: sel(bo), over: false };
  for (let d = want; d >= 1; d--) {
    const at = xs.filter(x => x.difficulty === d); if (!at.length) continue;
    const un = at.filter(x => !o.seen?.has(x.key)), wr = at.filter(x => o.seen?.has(x.key) && o.boss.wrong.has(x.key)), sn = at.filter(x => o.seen?.has(x.key) && !o.boss.wrong.has(x.key));
    const quotaOk = d < 3 || o.boss.fresh3Left > 0;
    for (const layer of quotaOk ? [un, wr, sn] : [wr, sn, un]) if (layer.length) return { q: sel(layer), over: false };
  }
  const above = xs.filter(x => x.difficulty > want); if (!above.length) return undefined;
  const lo = Math.min(...above.map(x => x.difficulty)); const at = above.filter(x => x.difficulty === lo);
  const un = at.filter(x => !o.seen?.has(x.key)), wr = at.filter(x => o.seen?.has(x.key) && o.boss.wrong.has(x.key));
  return { q: sel(un.length ? un : wr.length ? wr : at), over: true };
}
function bossDraw<T extends Q>(allowed: T[], fresh0: T[], o: DrawOpts<T>, cap: number): { q: T; over: boolean } | undefined {
  let over = false; const pk = (ys: T[]) => { const r = bossTiered(ys, { ...o, cap, boss: o.boss! }); if (r) over = r.over; return r?.q; };
  const by = (xs: T[]) => xs.length ? o.multi(xs, pk) : undefined;
  const f = o.force ? allowed.filter(o.force) : [];
  const q = (f.length ? by(f) : undefined) ?? by(allowed) ?? pk(fresh0);
  return q ? { q, over } : undefined;
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
