/* 简化自适应难度（GDD §6.9） */
import type { Question } from './questions';
import { shuffle } from './questions';
import type { BandConfig, LevelKind } from './grades';
export interface SubjectSkill { level: number; right: number; wrong: number; locked?: boolean }
export type Skills = Record<string, SubjectSkill>;
export const newSkill = (cfg: BandConfig): SubjectSkill => ({ level: Math.min(cfg.adaptive.max, 2), right: 0, wrong: 0 });

export function updateSkill(s: SubjectSkill | undefined, correct: boolean, cfg: BandConfig): SubjectSkill {
  const cur = s ?? newSkill(cfg);
  if (cur.locked) return cur;
  const { up, down, min, max } = cfg.adaptive;
  if (correct) {
    const right = cur.right + 1;
    if (right >= up && cur.level < max) return { level: cur.level + 1, right: 0, wrong: 0 };
    return { ...cur, right, wrong: 0 };
  }
  const wrong = cur.wrong + 1;
  if (wrong >= down && cur.level > min) return { level: cur.level - 1, right: 0, wrong: 0 };
  return { ...cur, right: 0, wrong };
}

/** 选题：优先 difficulty = 目标等级，不够依次找 ±1、±2…；最近答对过的题排后；约 20% 来自到期错题 */
export function selectQuestions(opts: {
  pool: Question[]; fallback: Question[]; n: number; target: number; kind: LevelKind;
  due?: Question[]; recentCorrect?: Set<string>; rnd?: () => number; maxDifficulty?: number;
}): Question[] {
  const { pool, fallback, n, kind, due = [], recentCorrect = new Set(), rnd = Math.random } = opts;
  const out: Question[] = [], used = new Set<string>();
  const nReview = Math.min(due.length, Math.round(n * 0.2));
  for (const q of shuffle(due, rnd).slice(0, nReview)) { out.push(q); used.add(q.key); }
  const pick = (src: Question[], target: number, count: number) => {
    const cand = shuffle(src.filter(q => !used.has(q.key) && q.difficulty <= (opts.maxDifficulty ?? 5)), rnd);
    cand.sort((a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target) || (+recentCorrect.has(a.key)) - (+recentCorrect.has(b.key)));
    for (const q of cand.slice(0, count)) { out.push(q); used.add(q.key); }
  };
  const base = opts.target + (kind === 'elite' ? 1 : 0);
  while (out.length < n) {
    const before = out.length;
    // Boss：每 3 题出 1 道 +1 级
    const t = kind === 'boss' && (out.length + 1) % 3 === 0 ? base + 1 : base;
    pick(pool, t, 1);
    if (out.length === before) pick(fallback, t, 1);
    if (out.length === before) break;
  }
  return out;
}

/** 策划 J-10：同一关内同一 template（无则按第一个知识点 tag）最多 2 道，且尽量不相邻；
    候选不够时放宽（保证题数）。candidates 为同小节的其余题，用来替换超额的题。 */
export function spreadTemplates<T extends { key: string; tags: string[]; template?: string }>(qs: T[], candidates: T[] = []): T[] {
  const tk = (q: T) => q.template || q.tags[0] || q.key;
  const cnt = new Map<string, number>(); const keep: T[] = []; const over: T[] = [];
  for (const q of qs) { const n = cnt.get(tk(q)) ?? 0; if (n < 2) { keep.push(q); cnt.set(tk(q), n + 1); } else over.push(q); }
  for (const c of candidates) {
    if (keep.length >= qs.length) break;
    if (keep.some(k => k.key === c.key)) continue;
    const n = cnt.get(tk(c)) ?? 0; if (n < 2) { keep.push(c); cnt.set(tk(c), n + 1); }
  }
  for (const o of over) if (keep.length < qs.length) keep.push(o);
  // 不相邻：贪心挑与上一题模板不同的
  const out: T[] = []; const rest = keep.slice();
  while (rest.length) { const i = rest.findIndex(q => !out.length || tk(q) !== tk(out[out.length - 1])); out.push(rest.splice(i < 0 ? 0 : i, 1)[0]); }
  return out;
}
