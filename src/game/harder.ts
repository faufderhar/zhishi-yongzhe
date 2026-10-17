/* r12（策划）：「难一档」相对当前自适应难度（关内 tier），不是相对目标档。
   先找本小节（本关题池里没出过的）；找不到放宽到同单元前序小节（不抽后面还没学的）。
   多选题、多步题不当挑战 / 重击的更难题。返回难度 > 当前档里最低的一档（优先正好 +1）。 */
import { normStem } from './draw';
type HQ = { key: string; question: string; difficulty: number; subject: string; unit?: string; type: string; usage?: string };
export interface HarderOpts<T> { cur: number; lesson: T[]; prior: T[]; used: T[]; exclude?: string[]; subject?: string; unit?: string; skip?: (x: T) => boolean }
export function pickHarder<T extends HQ>(o: HarderOpts<T>): { q: T; from: 'lesson' | 'prior' } | undefined {
  if (o.cur >= 5) return undefined;
  const stems = new Set(o.used.map(normStem)); const ex = new Set(o.exclude ?? []);
  const ok = (x: T) => x.difficulty > o.cur && !ex.has(x.key) && !stems.has(normStem(x)) && !(o.skip?.(x)) && (!o.subject || x.subject === o.subject) && (!o.unit || x.unit === o.unit);
  const best = (xs: T[]) => { const c = xs.filter(ok); if (!c.length) return undefined; const d = Math.min(...c.map(x => x.difficulty)); return c.find(x => x.difficulty === d); };
  const a = best(o.lesson); if (a) return { q: a, from: 'lesson' };
  const b = best(o.prior); if (b) return { q: b, from: 'prior' };
  return undefined;
}

/** r15.3 策划 A：没有「没出过」的更难题时的兜底——本课 / 题池里任何比当前档更难的题（含出过的、挑战过的）都行。
 *  取最低的更难一档；同档里 本局答错 → 历史没见过 → 以前答错 → 见过。一道都没有才返回 undefined（挑战按钮才灰） */
export function anyHarder<T extends HQ>(cands: T[], cur: number, o: { baseKey: string; subject?: string; exclude?: string[]; skip?: (x: T) => boolean; seen?: Set<string>; wrongRun?: Set<string>; wrongHist?: Set<string> }): T | undefined {
  const ex = new Set(o.exclude ?? []); const ks = new Set<string>();
  const any = cands.filter(x => x.difficulty > cur && x.key !== o.baseKey && !ex.has(x.key) && !(o.skip?.(x)) && (!o.subject || x.subject === o.subject) && !ks.has(x.key) && !!ks.add(x.key));
  if (!any.length) return undefined;
  const d = Math.min(...any.map(x => x.difficulty));
  const r = (x: T) => (o.wrongRun?.has(x.key) ? 0 : 4) + (!o.seen?.has(x.key) ? 0 : o.wrongHist?.has(x.key) ? 1 : 2);
  return any.filter(x => x.difficulty === d).sort((a, b) => r(a) - r(b))[0];
}
