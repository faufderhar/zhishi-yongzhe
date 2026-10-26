// r15.3 学霸 / 小萌新：连续重开同一关——整个小节没见过的题先出（规则 C），同名次随机；题全见过后每局也不一样；上一局最后一题不和下一局第一题同题干；复习标签只给到期错题
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBank, playable, type Question } from '../src/game/questions';
import { buildChapters, elitePool, lessonRank, type Level } from '../src/game/levels';
import { selectQuestions, noAdjacent, stemOf, spaceReviews } from '../src/game/adaptive';
import { drawNext } from '../src/game/draw';
import { newTier } from '../src/game/consolidate';

const load = (f: string, pending = false) => { const all = loadBank(JSON.parse(readFileSync(`public/banks/${f}`, 'utf8')), '').all; const qs = playable(all, pending); return { qs, chs: buildChapters(qs, null, all), by: new Map(qs.map(q => [q.key, q])) }; };
/** 同 App.startLevel 的普通关开局：整个小节候选 + lessonRank */
function startRun(chLevels: Level[], level: Level, by: Map<string, Question>, seen: Set<string>, wrong: Set<string>, n: number) {
  const pool = level.pool.map(k => by.get(k)!).filter(Boolean); const lk = new Set(level.pool);
  const others = [...new Set(chLevels.filter(l => l.lesson === level.lesson && l.id !== level.id && l.kind !== 'boss' && !l.redirect).flatMap(l => l.pool))].filter(k => !lk.has(k)).map(k => by.get(k)!).filter(Boolean);
  const lessonPool = [...pool, ...others]; const rank = lessonRank(lk, seen, wrong);
  const qs = selectQuestions({ pool: lessonPool, fallback: [], rank, n, target: 2, kind: 'normal' });
  const extra = selectQuestions({ pool: lessonPool, fallback: [], rank, n: Math.max(n * 2, 30), target: 2, kind: 'normal' });
  return { qs, extra, lessonPool };
}
/** 同 RoundBattle 取题：questions + extra（见过的排后），drawNext 一道一道取 */
function playRun(qs: Question[], extra: Question[], seen: Set<string>, n: number) {
  const ks = new Set<string>(); const pool: Question[] = [];
  for (const q of [...qs, ...[...extra].sort((a, b) => +seen.has(a.key) - +seen.has(b.key))]) if (!ks.has(q.key)) { ks.add(q.key); pool.push(q); }
  let unused = pool; const used: Question[] = []; const tier = newTier(2);
  for (let i = 0; i < n; i++) { const r = drawNext(unused, used, { pred: () => true, curated: new Set(qs.map(q => q.key)), seen, tier, multi: (xs, pk) => pk(xs.filter(x => x.type !== '多选')) ?? pk(xs) }); if (!r.q || r.repeat) break; used.push(r.q); unused = unused.filter(x => x.key !== r.q!.key); }
  return used;
}

describe('r15.3 连续重开：整个小节没见过的先出', () => {
  for (const [file, subj, n] of [['bank_10.json', '生物', 8], ['bank_7.json', '数学', 6], ['bank_7.json', '历史', 6]] as const) it(`${file} ${subj}`, () => {
    const { chs, by } = load(file); const ch = chs.find(c => c.subject === subj)!; expect(ch).toBeTruthy();
    let checked = 0;
    for (const level of ch.levels.filter(l => l.kind === 'normal' && !l.redirect && l.lesson).slice(0, 8)) {
      const seen = new Set<string>(); let prevRun: Question[] = [];
      for (let run = 0; run < 4; run++) {
        const { qs, extra, lessonPool } = startRun(ch.levels, level, by, seen, new Set(), n);
        const got = playRun(qs, extra, seen, n);
        const unseenBefore = lessonPool.filter(q => !seen.has(q.key)).length;
        const repeats = got.filter(q => seen.has(q.key)).length;
        /* r17.1 学霸 r17-8 R1：普通题难度 ≤ tierCap（这里 base 2 → 3）。没见过的只剩难度 4+ 时，先出见过的 ≤3 档题（裁定：有没见过的 4 和见过的 3 → 出 3），
           所以只对 ≤3 档要求「没见过的先」；小节里没有超档的没见过题时和 r15.3 完全一样 */
        const unseenCap = lessonPool.filter(q => !seen.has(q.key) && q.difficulty <= 3).length;
        if (unseenCap === unseenBefore) expect(repeats, `${level.name} 第 ${run + 1} 局：小节还有 ${unseenBefore} 道没见过，却重复了 ${repeats} 道`).toBe(Math.max(0, got.length - unseenBefore));
        else expect(repeats, `${level.name} 第 ${run + 1} 局：小节还有 ${unseenCap} 道 ≤3 档没见过，却重复了 ${repeats} 道`).toBeLessThanOrEqual(Math.max(0, got.length - unseenCap));
        expect(got.filter(q => !seen.has(q.key) && q.difficulty <= 3).length, `${level.name} 第 ${run + 1} 局 ≤3 档没见过的题都先用上`).toBe(Math.min(unseenCap, got.filter(q => q.difficulty <= 3).length));
        if (run > 0 && unseenCap >= 2) expect(got.slice(0, 2).some(q => prevRun.slice(0, 2).some(x => x.key === q.key)), `${level.name} 第 ${run + 1} 局开头又是上一局开头的题`).toBe(false);
        got.forEach(q => seen.add(q.key)); prevRun = got; checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('高一生物 必修1 第1章（学霸报告）：第 2 局不重复第 1 局', () => {
    const { chs, by } = load('bank_10.json'); const ch = chs.find(c => c.subject === '生物')!;
    const level = ch.levels.find(l => l.kind === 'normal' && /走近细胞/.test(l.unit))!;
    const seen = new Set<string>();
    const r1 = playRun(...(Object.values(startRun(ch.levels, level, by, seen, new Set(), 8)).slice(0, 2) as [Question[], Question[]]), seen, 8); r1.forEach(q => seen.add(q.key));
    const s2 = startRun(ch.levels, level, by, seen, new Set(), 8); const r2 = playRun(s2.qs, s2.extra, seen, 8);
    const unseen = s2.lessonPool.filter(q => !seen.has(q.key)).length;
    expect(r2.filter(q => seen.has(q.key)).length).toBe(Math.max(0, r2.length - unseen));
  });
});

describe('r15.3 小萌新：题全见过后每局也随机', () => {
  it('幼儿园 数到5 第 3 关连打 20 局，题目 / 顺序不全一样', () => {
    const { chs, by } = load('bank_K1.json', true); const ch = chs.find(c => c.subject === '数数')!;
    const level = ch.levels.find(l => l.name === '数到5 3')!; expect(level).toBeTruthy();
    const seen = new Set(ch.levels.flatMap(l => l.pool)); const seqs = new Set<string>(); const sets = new Set<string>();
    for (let i = 0; i < 20; i++) { const { qs } = startRun(ch.levels, level, by, seen, new Set(), 3); const o = noAdjacent(qs); seqs.add(o.map(q => q.key).join()); sets.add(o.map(q => q.key).sort().join()); }
    expect(seqs.size).toBeGreaterThan(8); expect(sets.size).toBeGreaterThan(5);
  });
  it('精英关：见过的题传 rnd 时随机，不再总是题池前几道', () => {
    const P = Array.from({ length: 12 }, (_, i) => ({ key: 's' + i })); const seen = new Set(P.map(q => q.key));
    const firsts = new Set(Array.from({ length: 30 }, () => elitePool(P, [], seen, new Set(), 5, new Set(), Math.random).map(q => q.key).join()));
    expect(firsts.size).toBeGreaterThan(5);
    expect(elitePool(P, [], seen, new Set(), 5).map(q => q.key)).toEqual(['s0', 's1', 's2', 's3', 's4']);   // 不传 rnd 行为不变
  });
  it('lessonRank：本关没见过 < 同小节没见过 < 答错 < 见过', () => {
    const r = lessonRank(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'y', 'z']), new Set(['b', 'y']));
    expect(['a', 'x', 'b', 'y', 'c', 'z'].map(key => r({ key }))).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('r15.3 上一局最后一题 / 下一局第一题不同题干', () => {
  it('noAdjacent 传入上一局最后一题', () => {
    const mk = (key: string, question: string) => ({ key, question });
    const prev = mk('p', '数一数，有几个气球？🎈');
    for (let i = 0; i < 20; i++) {
      const list = [mk('a', '数一数，有几个气球？🎈🎈'), mk('b', '数一数，有几只小鸡？🐤'), mk('c', '数一数，有几个草莓？🍓')].sort(() => Math.random() - 0.5);
      expect(stemOf(noAdjacent(list, prev)[0])).not.toBe(stemOf(prev));
    }
  });
});

describe('r15.3 标签准确', () => {
  it('复习标签只给到期错题、前 2 题不出、每 4 题最多 1 道', () => {
    const list = Array.from({ length: 12 }, (_, i) => ({ key: (i % 3 === 0 ? 'r' : 'n') + i }));
    const out = spaceReviews(list, x => x.key.startsWith('r'));
    expect(out.slice(0, 2).every(x => x.key.startsWith('n'))).toBe(true);
    for (let i = 0; i + 4 <= out.length; i++) expect(out.slice(i, i + 4).filter(x => x.key.startsWith('r')).length).toBeLessThanOrEqual(1);
  });
});

import { anyHarder } from '../src/game/harder';
describe('r15.3 策划 A：挑战按钮——只要还有更难的题（含出过的）就能点', () => {
  const mk = (key: string, difficulty: number) => ({ key, difficulty, question: key, subject: '数学', type: '选择' });
  it('当前档 3（上限）：本课有出过的难度 4 → 仍给挑战题，不灰', () => {
    expect(anyHarder([mk('a', 3), mk('b', 4)], 3, { baseKey: 'a', seen: new Set(['b']) })?.key).toBe('b');
  });
  it('顺序：本局答错 → 没见过 → 以前答错 → 见过；取最低的更难一档', () => {
    const c = [mk('s', 4), mk('w', 4), mk('u', 4), mk('r', 4), mk('x', 5)];
    const o = { baseKey: 'base', seen: new Set(['s', 'w', 'r']), wrongHist: new Set(['w']), wrongRun: new Set(['r']) };
    expect(anyHarder(c, 3, o)?.key).toBe('r');
    expect(anyHarder(c, 3, { ...o, wrongRun: new Set() })?.key).toBe('u');
    expect(anyHarder(c.filter(x => x.key !== 'u'), 3, { ...o, wrongRun: new Set() })?.key).toBe('w');
  });
  it('一道更难的都没有才返回空（按钮才灰）', () => {
    expect(anyHarder([mk('a', 3), mk('b', 2)], 3, { baseKey: 'a' })).toBeUndefined();
    expect(anyHarder([mk('a', 5)], 5, { baseKey: 'x' })).toBeUndefined();
  });
});

import { reviewGate, reviewAllowed } from '../src/game/adaptive';
describe('r15.3 技术QA R152-1：错题几乎覆盖整关时复习题也不挤在前面', () => {
  it('14 道题里 10 道是复习题：前 2 题不出复习、每 4 题最多 1 道，直到只剩复习题', () => {
    for (let run = 0; run < 50; run++) {
      const all = Array.from({ length: 14 }, (_, i) => ({ key: 'q' + i, question: '题' + i, difficulty: 2 + (i % 3) }));
      const rev = new Set(all.slice(0, 10).map(q => q.key).sort(() => Math.random() - 0.5));
      const reserve = Array.from({ length: 3 }, (_, i) => ({ key: 'r' + i, question: '备' + i, difficulty: 3 }));
      let pool = [...all].sort(() => Math.random() - 0.5); const used: typeof all = []; let lastRev = -1;
      for (let shown = 0; shown < 17; shown++) {
        const g = reviewGate(pool, x => rev.has(x.key), reviewAllowed(shown, lastRev), reserve.filter(x => !used.includes(x)));
        if (g.borrowed) pool = [...pool, g.borrowed];
        const q = drawNext(g.list, used, { pred: () => true, curated: new Set(), tier: newTier(3), multi: (xs, pk) => pk(xs) }).q!;
        const nonRevLeft = pool.some(x => !rev.has(x.key)) || reserve.some(x => !used.includes(x));
        if (rev.has(q.key)) { if (nonRevLeft) { expect(shown, '前 2 题出了复习题').toBeGreaterThanOrEqual(2); if (lastRev >= 0) expect(shown - lastRev, '4 题内出了 2 道复习').toBeGreaterThanOrEqual(4); } lastRev = shown; }
        used.push(q); pool = pool.filter(x => x.key !== q.key); if (!pool.length) break;
      }
    }
  });
  it('reviewGate：允许时原样；不允许时去掉复习；都是复习先借一道；借不到才放宽', () => {
    const isR = (x: string) => x.startsWith('r');
    expect(reviewGate(['r1', 'n1'], isR, true).list).toEqual(['r1', 'n1']);
    expect(reviewGate(['r1', 'n1'], isR, false).list).toEqual(['n1']);
    expect(reviewGate(['r1'], isR, false, ['r2', 'n9'])).toEqual({ list: ['n9'], borrowed: 'n9' });
    expect(reviewGate(['r1'], isR, false, ['r2']).list).toEqual(['r1']);
  });
});

describe('r15.3 多选保底不被「没见过的先」压掉', () => {
  it('多选题都见过、普通题没见过：必出多选的回合仍出多选', () => {
    const mk = (key: string, type: string, d = 2) => ({ key, question: key + ' 题干', difficulty: d, type });
    const pool = [mk('a', '单选'), mk('b', '单选'), mk('m1', '多选'), mk('m2', '多选')];
    const seen = new Set(['m1', 'm2']);
    const multi = (xs: typeof pool, pk: (ys: typeof pool) => (typeof pool)[number] | undefined) => { const m = xs.filter(x => x.type === '多选'); return m.length ? pk(m) ?? m[0] : pk(xs); };
    const r = drawNext(pool, [], { pred: () => true, curated: new Set(), seen, tier: newTier(2), multi, force: x => x.type === '多选' });
    expect(r.q?.type).toBe('多选');
    const r2 = drawNext(pool, [], { pred: () => true, curated: new Set(), seen, tier: newTier(2), multi: (xs, pk) => pk(xs.filter(x => x.type !== '多选')) ?? pk(xs) });
    expect(seen.has(r2.q!.key)).toBe(false);   // 不必出多选时仍是没见过的先
  });
});
