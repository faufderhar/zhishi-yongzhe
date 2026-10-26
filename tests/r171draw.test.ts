// r17.1 学霸 r16.1 裁定 §5.3（r17-8 / r17-9 / r17-10）：轮流回合关取题 R1–R5
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { drawNext, bossTiered } from '../src/game/draw';
import { newTier, nextTier, tierCap, type Tier } from '../src/game/consolidate';
import { loadBank, playable, shuffle, type Question } from '../src/game/questions';
import { buildChapters, bossPool, levelsOfUnit, capMulti } from '../src/game/levels';
import { selectQuestions, spreadTemplates } from '../src/game/adaptive';
import { withBossFirst } from '../src/game/bossUsage';

type Q = { key: string; question: string; difficulty: number; usage?: string };
const mk = (key: string, difficulty: number, usage?: string): Q => ({ key, question: `题 ${key}`, difficulty, usage });
const T = (base: number, tier = base): Tier => ({ ...newTier(base), tier });
const plain = (xs: Q[], pk: (ys: Q[]) => Q | undefined) => pk(xs);
const draw = (pool: Q[], o: { tier: Tier; seen?: Set<string>; used?: Q[]; boss?: { wrong: Set<string>; fresh3Left: number }; curated?: Set<string> }) =>
  drawNext(pool, o.used ?? [], { pred: () => true, curated: o.curated ?? new Set(), seen: o.seen, tier: o.tier, multi: plain, boss: o.boss });

describe('r17-8 R1：普通题 ≤ tierCap，同样近取低档', () => {
  it('档 3、只剩难度 2 和 4 → 出 2', () => {
    expect(draw([mk('a', 4), mk('b', 2)], { tier: T(3) }).q?.key).toBe('b');
    expect(draw([mk('a', 4), mk('b', 2)], { tier: T(3), boss: { wrong: new Set(), fresh3Left: 9 } }).q?.key).toBe('b');
  });
  it('有没见过的难度 4 和见过的难度 3 → 出 3', () => {
    const r = draw([mk('n4', 4), mk('s3', 3)], { tier: T(3), seen: new Set(['s3']) });
    expect(r.q?.key).toBe('s3'); expect(r.over).toBeFalsy();
    expect(draw([mk('n4', 4), mk('s3', 3)], { tier: T(3), seen: new Set(['s3']), boss: { wrong: new Set(), fresh3Left: 9 } }).q?.key).toBe('s3');
  });
  it('base 2 → cap 3：没见过的难度 4 不出，≤3 都出过了才出（over）', () => {
    expect(tierCap(2)).toBe(3);
    const pool = [mk('d4', 4), mk('d3', 3)];
    expect(draw(pool, { tier: T(2), seen: new Set(['d3']) }).q?.key).toBe('d3');
    const r = draw([mk('d4', 4)], { tier: T(2), used: [mk('d3', 3)] });
    expect(r.q?.key).toBe('d4'); expect(r.over).toBe(true);
  });
  it('正常取到 ≤ 当前档的题不算 over', () => {
    expect(draw([mk('a', 2), mk('b', 3)], { tier: T(2) }).over).toBeFalsy();
  });
  it('挑战题 / 重击卡不走 drawNext（pickHarder / anyHarder 照旧可以给 4）', () => {
    const src = readFileSync('src/ui/RoundBattle.tsx', 'utf8');
    expect(src).toMatch(/pickHarder/); expect(src).toMatch(/anyHarder/);
  });
});

describe('r17-9 R3 / R4：Boss 同档降级 + 新难题配额', () => {
  const boss = (wrong: string[] = [], left = 9) => ({ wrong: new Set(wrong), fresh3Left: left });
  it('同档：没见过 → 以前答错 → 见过', () => {
    const xs = [mk('s', 3), mk('w', 3), mk('u', 3)];
    expect(bossTiered(xs, { seen: new Set(['s', 'w']), curated: new Set(), tier: T(3), boss: boss(['w']) })?.q.key).toBe('u');
    expect(bossTiered(xs.slice(0, 2), { seen: new Set(['s', 'w']), curated: new Set(), tier: T(3), boss: boss(['w']) })?.q.key).toBe('w');
  });
  it('本档全出过 → 降一档（不升）', () => {
    const r = bossTiered([mk('x', 2), mk('y', 4)], { seen: new Set(), curated: new Set(), tier: T(3), boss: boss() });
    expect(r?.q.key).toBe('x'); expect(r?.over).toBe(false);
  });
  it('配额用完：同档改用见过 / 答错的，不降档', () => {
    const xs = [mk('u3', 3), mk('s3', 3), mk('u2', 2)];
    expect(bossTiered(xs, { seen: new Set(['s3']), curated: new Set(), tier: T(3), boss: boss([], 0) })?.q.key).toBe('s3');
    // 同档只剩没见过的：还是出（不降档、不重复）
    expect(bossTiered([mk('u3', 3), mk('u2', 2)], { seen: new Set(), curated: new Set(), tier: T(3), boss: boss([], 0) })?.q.key).toBe('u3');
    // 难度 ≤2 不受配额限制
    expect(bossTiered([mk('u2', 2), mk('s2', 2)], { seen: new Set(['s2']), curated: new Set(), tier: T(2), boss: boss([], 0) })?.q.key).toBe('u2');
  });
  it('整章 ≤ 当前档都出过了才升到最低的更难档（over）', () => {
    const r = bossTiered([mk('a5', 5), mk('a4', 4)], { seen: new Set(), curated: new Set(), tier: T(3), boss: boss() });
    expect(r?.q.key).toBe('a4'); expect(r?.over).toBe(true);
  });
  it('Boss 专用题（usage=boss）先出', () => {
    const r = bossTiered([mk('n', 2), mk('b', 3, 'boss')], { seen: new Set(), curated: new Set(), tier: T(2), boss: boss() });
    expect(r?.q.key).toBe('b');
  });
  it('drawNext 走 boss 分支并带回 over', () => {
    const r = draw([mk('a4', 4)], { tier: T(3), used: [mk('a3', 3)], boss: boss() });
    expect(r.q?.key).toBe('a4'); expect(r.over).toBe(true);
  });
});

/* r17-9 验收：按 /workspace/playtest/sim/draw_boss_r17.test.ts「提案」列对照（同样的开局题单 + 整章候选 + 配额） */
function mul(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function simBoss(g: string, runs = 60, only?: (subj: string, unit: string) => boolean) {
  const b = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`);
  const qs = playable(b.all, false); const by = new Map(b.all.map(q => [q.key, q]));
  const rows: { subj: string; unit: string; acc: number; sc: string; d4: number; over: number; q3max: number; bossFirst: boolean }[] = [];
  for (const ch of buildChapters(qs, null, b.all)) for (const l of ch.levels) if (l.kind === 'boss' && (!only || only(ch.subject, l.unit ?? ''))) {
    const pool = l.pool.map(k => by.get(k)!).filter(Boolean);
    const sameUnit = [...new Set([...levelsOfUnit(ch.levels, l).flatMap(x => x.pool), ...l.pool])].map(k => by.get(k)!).filter(Boolean);
    const bossOnly = (l.bossPool ?? []).map(k => by.get(k)!).filter(Boolean);
    for (const sc of ['new', 'flow']) for (const acc of [1.0, 0.73]) {
      let d4 = 0, over = 0, q3max = 0, bossFirst = true;
      for (let run = 0; run < runs; run++) {
        const rnd = mul(run * 7919 + +g * 31 + l.id.length); const empty = new Set<string>(), seen = new Set<string>();
        if (sc === 'flow') for (const q of sameUnit) if (q.usage !== 'boss' && q.difficulty <= 3 && rnd() < 0.7) seen.add(q.key);
        const fallback = bossPool(sameUnit, seen, empty, 10);
        const pref = bossPool(pool, seen, empty, 10, new Set(levelsOfUnit(ch.levels, l).flatMap(x => x.fresh ?? [])));
        const qs0 = capMulti(spreadTemplates(selectQuestions({ pool: pref, fallback, n: 10, target: 2, kind: 'boss', rnd, maxDifficulty: 5 }), shuffle(pool, rnd)), pool);
        const start = bossOnly.length ? withBossFirst(bossPool(bossOnly, seen, empty, 10), qs0, 10) : qs0;
        const extra = selectQuestions({ pool, fallback, n: 30, target: 2, kind: 'boss', rnd });
        // 同 RoundBattle：pool = 开局题单 + 后备 + 整章（Boss）
        const ks = new Set<string>(); const pc: Question[] = []; for (const q of [...start, ...extra, ...sameUnit, ...bossOnly]) if (!ks.has(q.key)) { ks.add(q.key); pc.push(q); }
        const quota = Math.max(2, Math.floor(pc.filter(x => x.difficulty >= 3 && !seen.has(x.key)).length / 2));
        let unused = pc; const used: Question[] = []; let t = newTier(Math.round(start.reduce((a, q) => a + q.difficulty, 0) / Math.max(1, start.length)) || 2);
        const N = acc === 1 ? 10 : 15;
        for (let i = 0; i < N; i++) {
          const left = quota - used.filter(x => x.difficulty >= 3 && !seen.has(x.key)).length;
          const r = drawNext(unused, used, { pred: () => true, curated: new Set(start.map(x => x.key)), seen, tier: t, multi: (xs, pk) => pk(xs), first: i === 0, rnd, boss: { wrong: empty, fresh3Left: left } });
          if (!r.q || r.repeat) break;
          if (i < bossOnly.filter(x => x.difficulty <= tierCap(t.base)).length && r.q.usage !== 'boss') bossFirst = false;
          used.push(r.q); unused = unused.filter(x => x.key !== r.q!.key);
          if (r.q.difficulty >= 4) d4++; if (r.over) over++;
          t = nextTier(t, rnd() < acc);
        }
        q3max = Math.max(q3max, used.filter(x => x.difficulty >= 3 && !seen.has(x.key)).length - quota);
      }
      rows.push({ subj: ch.subject, unit: l.unit ?? '', acc, sc, d4: d4 / runs, over: over / runs, q3max, bossFirst });
    }
  }
  return rows;
}
describe('r17-9 / r17-10 验收：题库模拟（同 sim「提案」列）', () => {
  for (const g of ['7', '8', '10', '11']) it(`bank_${g} Boss：难度 ≥4 每局平均 ≤0.1（只剩整章 ≤3 档确实出完的小章节）；Boss 专用题先出`, () => {
    const rows = simBoss(g);
    expect(rows.length).toBeGreaterThan(0);
    for (const sc of ['new', 'flow']) for (const acc of [1, 0.73]) {
      const rs = rows.filter(r => r.sc === sc && r.acc === acc); const avg = rs.reduce((a, r) => a + r.d4, 0) / rs.length;
      expect(avg, `${sc} ${acc}`).toBeLessThanOrEqual(0.1);
      // r17-10：全对（10 题）的正常 Boss 局不出「都出过了」；73%（15 题）只在小章节出
      if (acc === 1) expect(rs.filter(r => r.over > 0), `${sc} 全对`).toEqual([]);
    }
    // 出难度 4 的章都是 ≤3 档题出完了（over 同时发生）
    expect(rows.filter(r => r.d4 > 0.1 && r.over < r.d4 * 0.5)).toEqual([]);
    expect(rows.filter(r => !r.bossFirst).map(r => `${r.subj}${r.unit}`)).toEqual([]);
    console.log(`bank_${g}`, rows.filter(r => r.d4 > 0.1).map(r => `${r.subj}${r.unit.slice(0, 8)} ${r.sc} d4=${r.d4.toFixed(2)}`).join('; '));
  }, 120000);
  it('初二数学第 8 章：新档 73% 不再出难度 4', () => {
    const rows = simBoss('8', 100, (s, u) => s === '数学' && /8|八/.test(u)).filter(r => r.sc === 'new' && r.acc === 0.73);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.d4, `${r.subj}${r.unit}`).toBe(0);
  }, 60000);
});
