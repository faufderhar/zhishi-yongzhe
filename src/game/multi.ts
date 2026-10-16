/* r8 多选题出题规则（策划）：只在初一 / 高一；本关题池有多选题时每局至少 1 道、最多 2 道；
   只在我方回合出，第 1 回合不出；重复规则与普通题相同；小学、幼儿园不出。优先于「最接近难度」选题。 */
export const MULTI_MAX = 2;
export const multiBand = (band: string) => band === 'J' || band === 'H';
export const isMultiSel = (q: { type: string }) => q.type === '多选';
export interface MultiCtx { band: string; side: 'P' | 'M'; turn: number /* 1 起，即「第 N 回合」 */; used: number /* 本局已出多选数 */; poolHas: boolean }
/** 本回合能否出多选 / 是否必须出（本局还没出过，就在第一个可出的我方回合出，保证至少 1 道） */
export function multiRule(c: MultiCtx): { allow: boolean; force: boolean } {
  const allow = multiBand(c.band) && c.poolHas && c.side === 'P' && c.turn > 1 && c.used < MULTI_MAX;
  return { allow, force: allow && c.used === 0 };
}
/** 选本回合的题：force 时只在多选里按难度挑；不允许时排除多选；pick 为原有的「最接近难度」挑法 */
export function pickWithMulti<T extends { type: string }>(cands: T[], c: MultiCtx, pick: (xs: T[]) => T | undefined): T | undefined {
  const r = multiRule(c);
  if (r.force) { const m = cands.filter(isMultiSel); if (m.length) return pick(m) ?? m[0]; }
  const ok = r.allow ? cands : cands.filter(x => !isMultiSel(x));
  return pick(ok) ?? ok[0];
}
