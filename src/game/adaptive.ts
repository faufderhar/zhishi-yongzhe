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
