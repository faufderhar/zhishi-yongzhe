// r16.1 (o)（总管批准）：题库 v47 进 r16.1——初二生物 / 地理解除隐藏；高二物理仍强制隐藏；初三仍不导入（r17）；
// 5B / 6B 本册 Boss 换 id（E5-034→E5-031、E6-031→E6-028）旧 id 当别名；小学下册三册豁免自动隐藏（r16 线上就有）
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { loadBank, playable, cleanExplanation, type Question } from '../src/game/questions';
import { buildChapters, starOf } from '../src/game/levels';
import { computeVisibility, isHiddenBy, FORCE_HIDDEN, AUTO_EXEMPT, MIN_SECTION_QS } from '../src/game/visibility';
import { chapterBoss } from '../src/game/monsterSkin';
import { BUILTIN_GRADES } from '../src/bankStore';
const B = (g: string) => loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`).all;
const all: Question[] = BUILTIN_GRADES.flatMap(g => B(g)); const vis = computeVisibility(all);
const lv = (g: string, s: string) => { const a = B(g).filter(q => q.subject === s); return buildChapters(playable(a, false), null, a).flatMap(c => c.levels); };
describe('r16.1 题库 v47', () => {
  it('发布号 v47；初三 / 大班 / 高三没有导入', () => {
    expect(JSON.parse(readFileSync('public/banks/release.json', 'utf8')).release).toBe('v56');   // r17：v56；r16.1：v47 → v48（关卡结构相同）；r16.2：v50（tests/r162v50）
    for (const g of BUILTIN_GRADES) expect(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')).version, g).toBe('v56');   // r17：v56
    expect(BUILTIN_GRADES).not.toContain('9'); expect(existsSync('public/banks/bank_9.json')).toBe(false);
    expect(readdirSync('public/banks').filter(f => /bank_(9|12|K3)\.json/.test(f))).toEqual([]);
    expect(all.some(q => /^C9-/.test(q.id))).toBe(false);   // C9-156→C9-360、删掉的 C9-060/109/146 不影响 r16.1
  });
  it('初二生物 532 / 地理 524 题，每个小节 ≥ 10 道可玩题，可见；高二物理仍强制隐藏', () => {
    expect(FORCE_HIDDEN['8']).toBeUndefined(); expect(FORCE_HIDDEN['11']).toEqual(['物理']);
    for (const [s, n] of [['生物', 532], ['地理', 524]] as const) {
      const qs = playable(all.filter(q => q.grade === '8' && q.subject === s), false); expect(qs.length, s).toBe(n);
      const sec = new Map<string, number>(); for (const q of qs) sec.set(q.volume + '|' + q.unit, (sec.get(q.volume + '|' + q.unit) ?? 0) + 1);
      expect([...sec].filter(([, c]) => c < MIN_SECTION_QS), s).toEqual([]);
      expect(qs.every(q => !isHiddenBy(vis, q)), s).toBe(true); expect(vis.hiddenSubj.has('8|' + s)).toBe(false);
    }
    expect(isHiddenBy(vis, { grade: '11', subject: '物理', volume: '必修第三册' })).toBe(true);
  });
  it('初二生物 14 / 地理 16 个章 Boss，名字都对得上（没有回退成通用名）', () => {
    for (const [s, n] of [['生物', 14], ['地理', 16]] as const) {
      const bs = lv('8', s).filter(l => l.kind === 'boss'); expect(bs.length, s).toBe(n);
      expect(bs.filter(l => !chapterBoss(undefined, s, l.unit, { grade: '8' })).map(l => l.unit), s).toEqual([]);
    }
  });
  it('5B / 6B 本册 Boss：新 id + 旧 id 别名，旧存档的星星还在', () => {
    for (const [g, nid, oid] of [['5', '英语|VB|5:E5-031', '英语|VB|5:E5-034'], ['6', '英语|VB|6:E6-028', '英语|VB|6:E6-031']]) {
      const l = lv(g, '英语').find(x => x.id === nid); expect(l, nid).toBeTruthy(); expect(l!.aliases).toContain(oid);
      expect(starOf(l!, { [oid]: 3 })).toBe(3);
    }
  });
  it('小学下册三册（r16 线上就有）不被自动规则藏掉（r16.2 题库 v50 补够 10 题，豁免删掉了）', () => {
    expect([...AUTO_EXEMPT]).toEqual([]);
    for (const k of ['5|英语|五年级下册', '6|英语|六年级下册', '6|语文|六年级下册']) { expect(vis.hiddenVol.has(k), k).toBe(false); const [g, s, v] = k.split('|'); expect(all.filter(q => q.grade === g && q.subject === s && q.volume === v && !isHiddenBy(vis, q)).length, k).toBeGreaterThan(60); }
    // r16.2 v50：高二物理有 3 个册（必修第三册 / 选必一 / 选必二），都是强制隐藏；自动规则不藏任何册
    expect(vis.rows.map(r => `${r.grade}|${r.subject}|${r.why}`)).toEqual(vis.rows.map(() => '11|物理|force')); expect(vis.rows.length).toBe(new Set(all.filter(q => q.grade === '11' && q.subject === '物理').map(q => q.volume)).size);
  });
  it('教材版本字段带年份（人教版2024 / 苏教版2024）：解析里的版本注记照样去掉', () => {
    expect(new Set(all.filter(q => q.grade === '8' && q.subject === '地理').map(q => q.textbook))).toEqual(new Set(['人教版2024']));
    expect(new Set(all.filter(q => q.grade === '8' && q.subject === '生物').map(q => q.textbook))).toEqual(new Set(['苏教版2024']));
    expect(cleanExplanation('答案是 A。（📘 人教版2024：本题库按人教版2024 默认）')).toBe('答案是 A。');
    expect(all.some(q => JSON.stringify(q).includes('部分学校用'))).toBe(false);
  });
});
