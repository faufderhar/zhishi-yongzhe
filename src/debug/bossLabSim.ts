/** r17.1 Boss测试解锁_r17 §4.2：BossLab 面板的数据部分（只被 src/debug/BossLab.tsx 引用；那个模块只在 __TEST_HOOKS__ 为真时动态加载，正式版整块不生成）。
 *  - listBosses：按 年级 → 科目 → 册别 → 章 列出全部 Boss（名字用 skinFor，和游戏里一致；题池 = 整章 + Boss 专用题；血量 / 阶段取 newRound）
 *  - simBoss：不开界面跑一场——取题走 drawNext（R1–R5 同 RoundBattle），伤害走 resolveRound / logRound / summarize（不另算），同一种子结果完全相同
 *  - batch：种子 1..N 各跑一场，汇总「答对几题击杀」的均值 / 中位数 / 最大 / 最小 */
import { buildChapters, levelsOfUnit, type Chapter, type Level } from '../game/levels';
import { playable, type Question, type GradeKey } from '../game/questions';
import { bandConfig, bandOf } from '../game/grades';
import { newRound, resolveRound, reviveRound, roundModeOf, bossWeak, type RState, type CardKind } from '../game/rounds';
import { REVIVE } from '../game/balance';
import { skinFor } from '../game/monsterSkin';
import { drawNext } from '../game/draw';
import { selectQuestions, spreadTemplates } from '../game/adaptive';
import { withBossFirst } from '../game/bossUsage';
import { bossPool, capMulti } from '../game/levels';
import { shuffle } from '../game/questions';
import { newTier, nextTier } from '../game/consolidate';
import { PUPS, SCIFI, type Character } from '../game/characters';
import { logRound, summarize, type BossLog, type BossLogRound } from '../game/bossLog';
import type { Electives } from '../game/electives';

/** 可复现的伪随机（LCG，同 tests/r15sim） */
export function seeded(seed: number): () => number { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

export interface BossRow { grade: GradeKey; subject: string; volume: string; unit: string; id: string; name: string; pool: number; bossOnly: number; hp: number; phases: number[]; cap: number; level: Level; chapter: Chapter }

/** 本年级全部 Boss（不看档案册别：测试档案 = 全部册别；选科按传入的 electives，默认全科） */
export function listBosses(grade: GradeKey, gradeQs: Question[], electives?: Electives | null, includePending = false): BossRow[] {
  const cfg = bandConfig(grade); const mode = roundModeOf(cfg.band);
  const qs = playable(gradeQs, includePending); const by = new Map(qs.map(q => [q.key, q]));
  const out: BossRow[] = [];
  for (const ch of buildChapters(qs, null, gradeQs)) for (const l of ch.levels) {
    if (l.kind !== 'boss' || l.redirect) continue;
    const unitKeys = new Set([...levelsOfUnit(ch.levels, l).flatMap(x => x.pool), ...l.pool, ...(l.bossPool ?? [])].filter(k => by.has(k)));
    const q0 = by.get(l.pool[0]);
    const skin = skinFor(ch.subject, 'boss', cfg.band, l.unit ?? q0?.unit, { grade, volume: l.volume });
    const s0 = mode ? newRound(mode, 'boss', { grade, weak: bossWeak(grade, ch.subject, electives), noDeath: !cfg.canFail }) : null;
    out.push({ grade, subject: ch.subject, volume: l.volume, unit: l.unit, id: l.id, name: skin?.name ?? l.name, pool: unitKeys.size, bossOnly: (l.bossPool ?? []).filter(k => by.has(k)).length,
      hp: s0?.monsterMax ?? 0, phases: s0?.def.phases?.map(p => p.hp) ?? [], cap: s0?.cap ?? 0, level: l, chapter: ch });
  }
  return out;
}

/** 这场 Boss 的题（同 App.startLevel + RoundBattle）：开局题单 = selectQuestions(n=boss 题数) 并把 Boss 专用题排前；题池 = 开局 + 后备 30 + 整章 + Boss 专用，按题号去重 */
export function bossQuestions(row: Pick<BossRow, 'grade' | 'level' | 'chapter'>, gradeQs: Question[], rnd: () => number = seeded(1), seen: Set<string> = new Set(), includePending = false): { start: Question[]; pool: Question[] } {
  const by = new Map(playable(gradeQs, includePending).map(q => [q.key, q])), get = (ks: string[]) => ks.map(k => by.get(k)).filter((x): x is Question => !!x);
  const l = row.level, n = bandConfig(row.grade).questions.boss, empty = new Set<string>();
  const pool = get(l.pool), sameUnit = get([...new Set([...levelsOfUnit(row.chapter.levels, l).flatMap(x => x.pool), ...l.pool])]), bossOnly = get(l.bossPool ?? []);
  const fallback = bossPool(sameUnit, seen, empty, n);
  const pref = bossPool(pool, seen, empty, n, new Set(levelsOfUnit(row.chapter.levels, l).flatMap(x => x.fresh ?? [])));
  const qs0 = capMulti(spreadTemplates(selectQuestions({ pool: pref, fallback, n, target: 2, kind: 'boss', rnd, maxDifficulty: 5 }), shuffle(pool, rnd)), pool);
  const start = bossOnly.length ? withBossFirst(bossPool(bossOnly, seen, empty, n), qs0, n) : qs0;
  const extra = selectQuestions({ pool, fallback, n: 30, target: 2, kind: 'boss', rnd });
  const ks = new Set<string>(), all: Question[] = []; for (const q of [...start, ...extra, ...sameUnit, ...bossOnly]) if (!ks.has(q.key)) { ks.add(q.key); all.push(q); }
  return { start, pool: all };
}

export type CardPlan = 'std' | 'heavy';
export interface SimOpts { charId?: string; major?: string; card?: CardPlan; wager?: boolean; p?: number; seed?: number; fast?: boolean; electives?: Electives | null; seen?: Set<string> }
export const charsFor = (g: GradeKey): Character[] => bandConfig(g).chars === 'scifi' ? SCIFI : PUPS;

/** 跑一场（不写任何存档）。p = 每题答对概率（1 = 自动全对）；答题对错用种子流 A，伤害 / 闪避 / 技能用种子流 B（resolveRound 的 rng） */
export function simBoss(row: Pick<BossRow, 'grade' | 'subject' | 'level' | 'chapter'>, gradeQs: Question[], o: SimOpts = {}): BossLog {
  const g = row.grade, cfg = bandConfig(g), mode = roundModeOf(cfg.band); if (!mode) throw new Error(`${g} 年级不是回合制`);
  const hs = mode === 'h', cs = charsFor(g), c0 = cs.find(x => x.id === o.charId) ?? cs[0]; const c = o.major ? { ...c0, major: o.major } : c0;
  const seed = o.seed ?? 1, pa = seeded(seed * 2 + 1), pe = seeded(seed * 2 + 2), p = o.p ?? 1, seen = o.seen ?? new Set<string>();
  const { start, pool: all } = bossQuestions(row, gradeQs, pe, seen);
  let s: RState = newRound(mode, 'boss', { grade: g, weak: bossWeak(g, row.subject, o.electives), noDeath: !cfg.canFail, lowGrade: g === '3' || g === '4' });
  let unused = [...all]; const used: Question[] = []; const rounds: BossLogRound[] = [];
  const fresh3 = Math.max(2, Math.floor(all.filter(x => x.difficulty >= 3 && !seen.has(x.key)).length / 2));
  let t = newTier(Math.round(start.reduce((a, q) => a + q.difficulty, 0) / Math.max(1, start.length)) || 2);
  const curated = new Set(start.map(x => x.key)), wrong = new Set<string>();
  for (let guard = 0; !s.over && guard < 200; guard++) {
    const P = s.side === 'P';
    const left = fresh3 - used.filter(x => x.difficulty >= 3 && !seen.has(x.key)).length;
    const r = drawNext(unused, used, { pred: () => true, curated, seen, tier: t, multi: (xs, pk) => pk(xs), first: !used.length, rnd: pe, boss: { wrong, fresh3Left: left } });
    let q = r.q; if (!q) break;
    const heavy = hs && P && o.card === 'heavy';
    if (heavy) { const h = unused.filter(x => x.key !== q!.key && x.difficulty === q!.difficulty + 1)[0]; if (h) q = h; }
    used.push(q); unused = unused.filter(x => x.key !== q!.key);
    const ok = pa() < p; if (!ok) wrong.add(q.key);
    const card: CardKind = hs && P ? (heavy ? 'heavy' : 'std') : 'std'; const wager = !!(hs && P && o.wager);
    if (!heavy) t = nextTier(t, ok); else if (ok) t = { ...t, wrong: 0 };
    const [ns, out] = resolveRound(s, c, { correct: ok, subject: q.subject, difficulty: q.difficulty, fast: o.fast ?? true, card, wager, rng: pe });
    rounds.push(logRound(s, ns, out, q, { card, wager, challenge: false, grade: ok ? 'full' : 'wrong' })); s = ns;
    if (s.over === 'lose' && cfg.canFail && !s.revived) {   // 复活：4 次机会答对 2 道（同 RoundBattle）
      let right = 0; for (let i = 0; i < REVIVE.tries && right < REVIVE.need && REVIVE.tries - i >= REVIVE.need - right; i++) if (pa() < p) right++;
      if (right >= REVIVE.need) s = reviveRound(s);
    }
  }
  return { summary: summarize(rounds, s, { level: row.level.id, monster: row.level.name, seconds: 0 }), rounds };
}

export interface BatchStat { n: number; kills: number; mean: number | null; median: number | null; max: number | null; min: number | null; perSeed: { seed: number; result: string; correctToKill: number | null; turns: number }[] }
export function batch(row: Pick<BossRow, 'grade' | 'subject' | 'level' | 'chapter'>, gradeQs: Question[], n: number, o: Omit<SimOpts, 'seed'> = {}): BatchStat {
  const perSeed = Array.from({ length: n }, (_, i) => { const L = simBoss(row, gradeQs, { ...o, seed: i + 1 }); return { seed: i + 1, result: L.summary.result, correctToKill: L.summary.correctToKill, turns: L.summary.turns }; });
  const ks = perSeed.map(x => x.correctToKill).filter((x): x is number => x != null).sort((a, b) => a - b);
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return { n, kills: ks.length, mean: ks.length ? r2(ks.reduce((a, b) => a + b, 0) / ks.length) : null, median: ks.length ? (ks.length % 2 ? ks[(ks.length - 1) / 2] : r2((ks[ks.length / 2 - 1] + ks[ks.length / 2]) / 2)) : null,
    max: ks.length ? ks[ks.length - 1] : null, min: ks.length ? ks[0] : null, perSeed };
}
export function batchCSV(b: BatchStat): string {
  return ['种子,结果,答对几题击杀,回合数', ...b.perSeed.map(x => `${x.seed},${x.result},${x.correctToKill ?? ''},${x.turns}`), '', `场数,${b.n}`, `击杀,${b.kills}`, `均值,${b.mean ?? ''}`, `中位数,${b.median ?? ''}`, `最大,${b.max ?? ''}`, `最小,${b.min ?? ''}`].join('\n') + '\n';
}
export { bandOf };
