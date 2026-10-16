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
  pool: Question[]; fallback: Question[]; n: number; rank?: (q: Question) => number /* r14.1：历史排序（没答过 0 < 答错 1 < 答过 2），优先于难度贴近 */; target: number; kind: LevelKind;
  due?: Question[]; recentCorrect?: Set<string>; rnd?: () => number; maxDifficulty?: number;
}): Question[] {
  const { pool, fallback, n, kind, due = [], recentCorrect = new Set(), rnd = Math.random } = opts;
  const out: Question[] = [], used = new Set<string>();
  const nReview = Math.min(due.length, Math.round(n * 0.2));
  for (const q of shuffle(due, rnd).slice(0, nReview)) { out.push(q); used.add(q.key); }
  const pick = (src: Question[], target: number, count: number) => {
    const cand = shuffle(src.filter(q => !used.has(q.key) && q.difficulty <= (opts.maxDifficulty ?? 5)), rnd);
    cand.sort((a, b) => (opts.rank ? opts.rank(a) - opts.rank(b) : 0) || Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target) || (+recentCorrect.has(a.key)) - (+recentCorrect.has(b.key)));
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
  // 题库 v9：同 template 最多 2 道；本课题不够时逐级放宽到 3、再到不限，保证题数（不会出不了关）
  const all: T[] = []; const seen = new Set<string>();
  for (const q of [...qs, ...candidates]) if (!seen.has(q.key)) { seen.add(q.key); all.push(q); }
  let keep: T[] = [];
  for (const cap of [2, 3, Infinity]) {
    const cnt = new Map<string, number>(); keep = [];
    for (const q of all) { if (keep.length >= qs.length) break; const n = cnt.get(tk(q)) ?? 0; if (n < cap) { keep.push(q); cnt.set(tk(q), n + 1); } }
    if (keep.length >= qs.length) break;
  }
  // 不相邻：贪心挑与上一题模板不同的
  const out: T[] = []; const rest = keep.slice();
  while (rest.length) { const i = rest.findIndex(q => !out.length || tk(q) !== tk(out[out.length - 1])); out.push(rest.splice(i < 0 ? 0 : i, 1)[0]); }
  return out;
}

/** r15 策划：错题复习——前 2 题不出；之后穿插，每 4 题最多 1 道（多出的复习题这局不出） */
export function spaceReviews<T>(list: T[], isRev: (x: T) => boolean): T[] {
  const non = list.filter(x => !isRev(x)), rev = list.filter(isRev), out: T[] = [];
  let next = 2;
  while (non.length || rev.length) {
    if (rev.length && out.length >= next) { out.push(rev.shift()!); next = out.length + 3; }
    else if (non.length) out.push(non.shift()!);
    else break;
  }
  return out;
}
/** r15 回合制取题闸门：现在能不能出复习题（已出 shown 道，最近一道复习题在第 lastRev 道，-1 = 还没出过） */
export const reviewAllowed = (shown: number, lastRev: number) => shown >= 2 && (lastRev < 0 || shown - lastRev >= 4);
/** r15 策划（幼儿园–二年级）：允许重复，但同一道题不连着出（中间至少隔 1 道）；只有 1 道题的关除外 */
/* r15 小萌新：按题干比（同一题干的不同变体，如「数一数，有几个草莓？」，也不能连着出） */
/* r15.1：去掉表情（数量变体）、数字、空白和标点后再比 */
export const stemOf = (x: { key: string; question?: string }) => (x.question ?? '').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\p{N}\s\p{P}\p{S}]/gu, '') || x.key;
export function noAdjacent<T extends { key: string; question?: string }>(list: T[], prev?: T): T[] {
  /* 贪心重排：尽量保持原顺序；某题干剩余过半时必须先放它，避免最后卡死。prev = 已出的最后一题（续题时用） */
  const rest = [...list]; const out: T[] = [];
  while (rest.length) {
    const cnt = new Map<string, number>(); for (const x of rest) cnt.set(stemOf(x), (cnt.get(stemOf(x)) ?? 0) + 1);
    const last = out.length ? stemOf(out[out.length - 1]) : prev ? stemOf(prev) : undefined;
    let must: string | undefined; for (const [k, n] of cnt) if (k !== last && n > (rest.length) / 2) must = k;
    let idx = rest.findIndex(x => must ? stemOf(x) === must : stemOf(x) !== last);
    if (idx < 0) idx = 0;   // 只剩同一题干：没办法
    out.push(rest.splice(idx, 1)[0]);
  }
  return out;
}
