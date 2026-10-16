import { describe, it, expect } from 'vitest';
import { drawNext } from '../src/game/draw';
import { newTier } from '../src/game/consolidate';
import { pickWithMulti } from '../src/game/multi';
const Q = (key: string, difficulty: number, type = '选择') => ({ key, question: 'q' + key, difficulty, type });
describe('r13 学霸：取题先看难度再看分组', () => {
  const ctxM = { band: 'J' as const, side: 'M' as const, turn: 2, used: 0, poolHas: false };
  it('精选组只剩难度 1 时，闪避题仍按当前档（3）出', () => {
    const pool = [Q('a', 1), Q('b', 3), Q('c', 2)];
    const r = drawNext(pool, [], { pred: () => true, curated: new Set(['a']), tier: newTier(3), multi: (xs, pk) => pickWithMulti(xs, ctxM, pk) });
    expect(r.q!.difficulty).toBe(3);
  });
  it('同一档里优先关外没见过的', () => {
    const pool = [Q('a', 3), Q('b', 3)];
    const r = drawNext(pool, [], { pred: () => true, curated: new Set(['a']), seen: new Set(['a']), tier: newTier(3), multi: (xs, pk) => pickWithMulti(xs, ctxM, pk) });
    expect(r.q!.key).toBe('b');
  });
  it('必须出多选的回合：最近一档没有多选也照样出多选', () => {
    const pool = [Q('a', 3), Q('m', 1, '多选')];
    const r = drawNext(pool, [], { pred: () => true, curated: new Set(), tier: newTier(3), multi: (xs, pk) => pickWithMulti(xs, { band: 'J', side: 'P', turn: 4, used: 0, poolHas: true }, pk) });
    expect(r.q!.key).toBe('m');
  });
});
import { nextLock24, resumeLong, lockLeft } from '../src/game/pin';
import { newPending, tickPending, resumePending, pendingLeftMs } from '../src/game/pinVault';
describe('r13 技术QA：锁定 / 延时重设防调时钟', () => {
  it('R12-2：24 小时锁关掉后调快 24 小时再打开，只算 8 小时', () => {
    let s = { fails: 0, level: 0, until: 0 } as Parameters<typeof nextLock24>[0]; const t0 = 1e12;
    for (let i = 0; i < 5; i++) s = nextLock24(s, false, t0);
    const r = resumeLong(s, t0 + 24 * 3600e3); expect(r.remain).toBe(24 * 3600e3);   // r14 策划：关闭期间完全不计
  });
  it('R12-1：运行中按观察到的时间累计；跳变取消', () => {
    let p = newPending(1e12); const left0 = pendingLeftMs(p);
    for (let i = 0; i < 120; i++) { const n = tickPending(p, 30e3, 30e3, 1e12 + i * 30e3); if (n === 'cancel') throw 0; p = n; }
    expect(left0 - pendingLeftMs(p)).toBe(3600e3);
    expect(tickPending(p, 30e3, 30e3 + 86400e3, 2e12)).toBe('cancel');
    expect(pendingLeftMs(resumePending(p, 1e12 + 3600e3 + 86400e3 * 3))).toBe(left0 - 3600e3);
  });
});
import { normAnswer, HINT_QUESTIONS } from '../src/game/pin';
describe('r13 策划：找回问题', () => {
  it('答案不分大小写、空格、全角半角', () => { expect(normAnswer('Ｗａｎｇ Ｌｉ')).toBe(normAnswer('wangli')); });
  it('5 个预设，不含孩子知道的问题', () => { expect(HINT_QUESTIONS).toHaveLength(5); expect(HINT_QUESTIONS.join()).not.toMatch(/小名|生日|宠物/); });
});
import { readFileSync, existsSync } from 'node:fs';
import { loadBank, playable, isBossOnly } from '../src/game/questions';
import { buildChapters, levelsOfUnit } from '../src/game/levels';
import { refill, normStem } from '../src/game/draw';
import { isMultiSel } from '../src/game/multi';
// r12b 的不重复测试只用了「题数 ≥ 回合数」的合成题池，没覆盖真实的小题池（如高一物理第 13 关只有 4 道）——这里用真实题库每一关跑满 18 回合
describe.skipIf(!existsSync('public/banks/bank_7.json'))('r13 技术QA R12-3：真实题池整局不重复', () => {
  for (const g of ['1', '2', '3', '4', '5', '6', '7', '10']) it(`年级 ${g}：本关 + 前面已学小节都出完之前不重复（r14 全年级）`, () => {
    const all = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all; const qs = playable(all, false); const by = new Map(qs.map(q => [q.key, q]));
    let bad = 0, levels = 0, adjUsed = 0;
    for (const ch of buildChapters(qs, null, all)) for (const l of ch.levels) {
      if (l.kind !== 'normal' || l.redirect) continue; levels++;
      const lesson = l.pool.map(k => by.get(k)!).filter(q => q && !isMultiSel(q));
      const noCross = ['语文', '诗词'].includes(ch.subject); const idx = ch.levels.indexOf(l); const lk = new Set(l.pool);
      const ls = levelsOfUnit(ch.levels, l).filter(x => x.kind === 'normal' && x.id !== l.id && !x.redirect);
      const adj = noCross ? [] : [...ls.filter(x => ch.levels.indexOf(x) < idx).reverse()].map(x => x.pool.map(k => by.get(k)!).filter(q => q && !isBossOnly(q) && !lk.has(q.key) && !isMultiSel(q))).filter(x => x.length);
      const distinct = new Set([...lesson, ...adj.flat()].map(normStem)).size;
      let pool = [...lesson], used: typeof lesson = []; const seen: string[] = [];
      for (let t = 0; t < 18; t++) {
        if (!pool.length) { const r = refill(used, lesson, adj); pool = r.pool; used = r.used; if (r.kind === 'adj') adjUsed++; }
        const q = pool.find(x => !used.some(u => normStem(u) === normStem(x))) ?? pool[0]; if (!q) break;
        pool = pool.filter(x => x !== q); used.push(q);
        if (seen.includes(normStem(q)) && seen.length < distinct) bad++; seen.push(normStem(q));
      }
    }
    expect(levels).toBeGreaterThan(5); expect(bad).toBe(0);
  });
});
import { splitLesson } from '../src/game/levels';
describe('r13 策划：小节平均分关', () => {
  it('12 → 6+6，20 → 7+7+6，13 → 7+6，8 → 8', () => {
    const sz = (n: number) => splitLesson(Array.from({ length: n }, (_, i) => i)).map(x => x.length);
    expect(sz(12)).toEqual([6, 6]); expect(sz(20)).toEqual([7, 7, 6]); expect(sz(13)).toEqual([7, 6]); expect(sz(8)).toEqual([8]);
  });
  for (const g of ['K1', '1', '3', '7', '10']) it(`年级 ${g}：小节 ≥6 题时没有少于 6 题的普通关；旧星星按「小节 + 第几关」继承`, () => {
    const all = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all; const qs = playable(all, false); const by = new Map(qs.map(q => [q.key, q]));
    const chs = buildChapters(qs, null, all);
    for (const ch of chs) { const byLesson = new Map<string, number>(); for (const l of ch.levels) if (l.kind === 'normal' && l.lesson) byLesson.set(l.lesson, (byLesson.get(l.lesson) ?? 0) + l.pool.filter(k => !isMultiSel(by.get(k)!)).length);
      for (const l of ch.levels) if (l.kind === 'normal' && l.lesson && !l.parts && (byLesson.get(l.lesson) ?? 0) >= 6) expect(l.pool.filter(k => !isMultiSel(by.get(k)!)).length, `${ch.subject} ${l.name}`).toBeGreaterThanOrEqual(6); }
  });
  it('迁移：旧规则下第 k 关的星星记到新第 k 关（只升不降）', () => {
    const all = loadBank(JSON.parse(readFileSync('public/banks/bank_10.json', 'utf8')), '').all; const qs = playable(all, false);
    const lv = buildChapters(qs, null, all).flatMap(c => c.levels); const moved = lv.filter(l => (l.aliases ?? []).some(a => a.includes('|N|') || a.includes('|E|')) && l.lesson);
    expect(moved.length).toBeGreaterThan(0);
    const l = moved[0]; const old = l.aliases!.find(a => a.includes(l.kind === 'elite' ? '|E|' : '|N|'))!;
    expect(starOf(l, { [old]: 2 })).toBe(2); expect(starOf(l, { [old]: 2, [l.id]: 3 })).toBe(3);
    const nx = migrateStars(lv, { [old]: 2, [l.id]: 1 }); expect(nx?.[l.id]).toBe(2);
  });
});
import { starOf, migrateStars } from '../src/game/levels';
import { elitePool } from '../src/game/levels';
describe('r14 策划：精英关补题顺序', () => {
  it('没见过的不够 → 以前答错的 → 以前见过的', () => {
    const P = ['u1', 'u2', 's1', 'w1', 's2', 'w2'].map(key => ({ key }));
    const r = elitePool(P, [], new Set(['s1', 'w1', 's2', 'w2']), new Set(['w1', 'w2']), 5).map(q => q.key);
    expect(r).toEqual(['u1', 'u2', 'w1', 'w2', 's1']);
  });
  it('没见过的够 6 道就只出没见过的', () => {
    const P = Array.from({ length: 8 }, (_, i) => ({ key: 'u' + i })).concat([{ key: 'w' }]);
    expect(elitePool(P, [], new Set(['w']), new Set(['w']), 6).map(q => q.key)).not.toContain('w');
  });
});

// r14
import { resolveRound as rr14, newRound as nr14 } from '../src/game/rounds';
import { refill as rf14 } from '../src/game/draw';
import { nextTier as nt14, newTier as nw14 } from '../src/game/consolidate';
import { PUPS as CH14 } from '../src/game/characters';
describe('r14', () => {
  it('墨墨回血只在语文题', () => {
    const momo = CH14.find(c => c.id === 'momo')!;
    const mk = () => ({ ...nr14('j', 'normal'), playerHp: 50, playerMax: 100, side: 'P' }) as never;
    const [, oz] = rr14(mk(), momo, { correct: true, subject: '语文', difficulty: 2, rng: () => 0.99 });
    const [, om] = rr14(mk(), momo, { correct: true, subject: '数学', difficulty: 2, rng: () => 0.99 });
    expect(oz.healed).toBeGreaterThanOrEqual(3); expect(om.healed).toBe(0);
  });
  it('重复时不拿本局挑战题', () => {
    const a = { key: 'a', difficulty: 4, question: 'x' } as never, b = { key: 'b', difficulty: 2, question: 'y' } as never;
    expect(rf14([a, b], [], [], new Set(['a']), new Set(['a'])).pool[0]).toBe(b);
    expect(rf14([a], [], [], new Set(), new Set(['a'])).kind).toBe('none');
  });
  it('难度轨迹：连对 2 升、连错 2 降、上限 min(base+1,3)', () => {
    let t = nw14(1); const tr: number[] = [];
    for (const ok of [true, true, true, true, true, true, false, false]) { t = nt14(t, ok); tr.push(t.tier); }
    expect(tr).toEqual([1, 2, 2, 2, 2, 2, 2, 1]);
  });
});
import { addBonus as ab14, remainingSec as rs14 } from '../src/game/playtime';
describe('r14 加时', () => {
  it('超出上限后 +20 分钟：剩余变成 20 分钟', () => {
    const lim = { weekday: 60, weekend: 60 } as never; const d = new Date('2026-10-14T10:00:00');
    let u = { '2026-10-14': { used: 94 * 60, bonus: 0 } } as never;
    u = ab14(u, '2026-10-14', 600, 3600); u = ab14(u, '2026-10-14', 600, 3600);
    expect(rs14(lim, u, '2026-10-14', d)).toBe(1200);
  });
});
