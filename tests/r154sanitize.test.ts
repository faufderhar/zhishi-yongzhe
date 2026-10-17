import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { sanitizeData, cleanKv } from '../src/game/sanitize';
import { mergeBackup, type MergeIn } from '../src/game/merge';
import { repairProfile, effLimit } from '../src/state';
const BAD = [1e308, -5, 'NaN', null, 2e5] as const;
const bk = (b: unknown): MergeIn => ({
  kv: [['profiles', [{ id: 'kid-7', name: 'a', avatar: '🧒', grade: '7', volumes: null, limit: { weekday: b, weekend: b } }, { id: 'kid-new', name: 'n', avatar: '🧒', grade: '7', volumes: null, limit: { weekday: b, weekend: b } }]],
    ['progress:kid-7', { stars: { L1: 2 }, plays: { L1: { day: '2026-10-16', count: b } }, xp: 1, masteredStars: 0 }],
    ['progress:kid-new', { stars: { L1: 1 }, plays: { L1: { day: '2026-10-16', count: b } }, xp: b, masteredStars: b }],
    ['usage:kid-new', { '2026-10-15': { used: b, bonus: b } }], ['skills:kid-new', { 数学: { level: b, right: b, wrong: b } }]] as [string, unknown][],
  answers: [[1, { profileId: 'kid-7', questionId: 'q1', at: b, correct: true }]] as MergeIn['answers'],
  wrong: [{ id: 'kid-7|q1', profileId: 'kid-7', qkey: 'q1', box: b, wrongCount: b, addedAt: b, updatedAt: b, due: '2026-10-17' }] as unknown as MergeIn['wrong'], bank: [] });
const cur: MergeIn = { kv: [['profiles', [{ id: 'kid-7', name: 'a', avatar: '🧒', grade: '7', volumes: null, limit: { weekday: 40, weekend: 60 } }]], ['progress:kid-7', { stars: { L1: 1 }, plays: { L1: { day: '2026-10-16', count: 1e308 } } }]], answers: [], wrong: [], bank: [] };
const fin = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
describe('r15.4 技术QA P2-1 合并也清洗（与覆盖恢复共用 sanitizeData）', () => {
  for (const b of BAD) it(`坏值 ${String(b)}`, () => {
    const out = sanitizeData(mergeBackup(cur, sanitizeData(bk(b)), '2026-10-17').out);
    const kv = new Map(out.kv as [string, any][]);
    for (const id of ['kid-7', 'kid-new']) { const c = kv.get('progress:' + id).plays?.L1?.count; if (c !== undefined) { expect(fin(c)).toBe(true); expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(999); } }
    const pn = kv.get('progress:kid-new'); expect(pn.xp).toBeLessThanOrEqual(1e7); expect(pn.xp).toBeGreaterThanOrEqual(0);
    for (const v of Object.values(kv.get('usage:kid-new') ?? {}) as any[]) { expect(fin(v.used) && v.used >= 0 && v.used <= 86400).toBe(true); expect(fin(v.bonus) && v.bonus <= 86400).toBe(true); }
    for (const v of Object.values(kv.get('skills:kid-new') ?? {}) as any[]) { expect(v.level >= 1 && v.level <= 5).toBe(true); expect(v.right <= 1000 && v.right >= 0 && v.wrong <= 1000 && v.wrong >= 0).toBe(true); }
    for (const w of out.wrong as any[]) { expect(w.box >= 1 && w.box <= 3).toBe(true); expect(fin(w.wrongCount) && w.wrongCount >= 0 && w.wrongCount <= 1e4).toBe(true); expect(fin(w.addedAt) && fin(w.updatedAt) && w.updatedAt <= 4102444800000).toBe(true); }
    for (const [, a] of out.answers as [unknown, any][]) expect(fin(a.at) && a.at <= 4102444800000 && a.at >= 0).toBe(true);
    for (const p of kv.get('profiles')) { const r = repairProfile(p)!; const e = effLimit(r); for (const k of ['weekday', 'weekend'] as const) { expect(e[k]).toBeGreaterThanOrEqual(5); expect(e[k]).toBeLessThanOrEqual(240); } }
  });
  it('db.ts：覆盖恢复和合并都调用 sanitizeData', () => {
    const s = readFileSync('src/db.ts', 'utf8');
    expect(s.match(/sanitizeData\(/g)!.length).toBeGreaterThanOrEqual(2);
    expect(s).toMatch(/mergeBackup\(await readAllRaw\(\), cleanIn\(/); expect(s).toMatch(/const out = cleanIn\(out0\)/);
  });
});
describe('r15.4 技术QA P2-2 每日时长上限夹到家长页范围', () => {
  it('cleanKv profiles：1e308/2e5→240，3→5，0 保留（旧版不限），坏值删掉', () => {
    const p = cleanKv('profiles', [{ id: 'a', limit: { weekday: 1e308, weekend: 2e5 } }, { id: 'b', limit: { weekday: 3, weekend: 0 } }, { id: 'c', limit: { weekday: 'NaN', weekend: null } }]) as any[];
    expect(p[0].limit).toEqual({ weekday: 240, weekend: 240 }); expect(p[1].limit).toEqual({ weekday: 5, weekend: 0 }); expect(p[2].limit).toEqual({});
  });
  it('repairProfile：读的时候也夹（库里已有的脏值），坏值用年级默认', () => {
    expect(effLimit(repairProfile({ id: 'a', grade: '7', limit: { weekday: 1e308, weekend: Infinity } })!)).toEqual({ weekday: 240, weekend: 60 });
    expect(effLimit(repairProfile({ id: 'a', grade: '7', limit: { weekday: 'NaN', weekend: -5 } })!)).toEqual({ weekday: 40, weekend: 60 });
    expect(effLimit(repairProfile({ id: 'a', grade: '7', limit: { weekday: 90, weekend: 60 } })!)).toEqual({ weekday: 90, weekend: 60 });
  });
});
