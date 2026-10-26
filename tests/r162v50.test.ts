// r16.2（总管有条件批准）：题库 v48 → v50。条件：线上可见年级的关卡 id 不变（或有别名）；高二物理 / 初三 / 高三都不可见；
// 全套测试通过、离线预缓存文件留够余量。v50 改了题面的 6 题（E5-129 选项、高二 5 道填空答案）旧错题本 / 家长改题不崩、不显示错的内容。
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { loadBank, playable, qRev, type Question } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
import { computeVisibility, isHiddenBy, AUTO_EXEMPT, FORCE_HIDDEN, MIN_SECTION_QS } from '../src/game/visibility';
import { onWrong, wrongStale } from '../src/game/wrongbook';
import { REV_CHANGED_SINCE_R16 } from '../src/game/revChanged';
import { mergeImported } from '../src/bankStore';
import { R16_GRADES } from './helpers/r16grades';   // r17.1：快照只看 r16–r17 的 12 个年级
const B = (g: string) => loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`);
const all: Question[] = R16_GRADES.flatMap(g => B(g).all); const vis = computeVisibility(all);
const byId = new Map(all.map(q => [q.id, q]));
const OLD6 = JSON.parse(readFileSync('tests/fixtures/r162_v48_old6.json', 'utf8')) as Record<string, { grade: string; q: Record<string, unknown> }>;
const old = (id: string) => loadBank({ questions: [OLD6[id].q] }, `bank_${OLD6[id].grade}.json`).all[0];
const CHANGED = ['E5-129', 'H11-123', 'H11-151', 'D11-026', 'Z11-353', 'Z11-382'];

describe('r16.2 题库 v50', () => {
  it('发布号 v50；初三 / 大班 / 高三没导入；高二物理强制隐藏', () => {
    for (const g of R16_GRADES) expect(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')).version, g).toBe('v57');   // r17 v56 → v57；r16.2：v50 → v51 → v52（同 id / 同关卡；tests/r162v51）
    expect(readdirSync('public/banks').filter(f => /bank_(9|12|K3)\.json/.test(f))).toEqual(['bank_12.json', 'bank_9.json', 'bank_K3.json']);   // r17.1 导入
    expect(all.some(q => /^(C9|P12|D12)-/.test(q.id))).toBe(false);
    expect(FORCE_HIDDEN['11']).toEqual(['物理']);
    const phy = all.filter(q => q.grade === '11' && q.subject === '物理'); expect(phy.length).toBeGreaterThan(0);
    expect(phy.every(q => isHiddenBy(vis, q))).toBe(true); expect(vis.hiddenSubj.has('11|物理')).toBe(true);
  });
  it('线上可见的关卡（eefc5aa / v48 快照）一关不少、id 不变；新关只有六下《学弈》', () => {
    const fx = JSON.parse(readFileSync('tests/fixtures/r162_levels_eefc5aa.json', 'utf8')) as { names: Record<string, [string, string]> };
    const ids = new Set<string>(); const aliases = new Set<string>();
    for (const g of R16_GRADES) { const a = B(g).all; const vq = playable(a, false).filter(q => !isHiddenBy(vis, q));
      for (const ch of buildChapters(vq, null, a)) for (const l of ch.levels) { ids.add(l.id); for (const x of l.aliases ?? []) aliases.add(x); } }
    expect(Object.keys(fx.names).filter(k => !ids.has(k) && !aliases.has(k))).toEqual([]);
    expect([...ids].filter(k => !(k in fx.names))).toEqual(['语文|N|6:Y6-014']);
  });
  it('AUTO_EXEMPT 删掉以后，5B / 6B / 六下语文每个小节 ≥ 10 题，三册都可见；自动规则在可见年级不藏任何册', () => {
    expect([...AUTO_EXEMPT]).toEqual([]);
    expect(vis.rows.filter(r => r.why === 'auto')).toEqual([]);
    for (const [g, s, v, unit] of [['5', '英语', '五年级下册', '5B Unit 1 Cinderella'], ['6', '英语', '六年级下册', '6B Unit 1 The lion and the mouse'], ['6', '语文', '六年级下册', '六下·文言文 学弈']]) {
      const qs = playable(all.filter(q => q.grade === g && q.subject === s && q.volume === v), false);
      expect(qs.filter(q => q.unit === unit).length, unit).toBeGreaterThanOrEqual(MIN_SECTION_QS);
      expect(qs.every(q => !isHiddenBy(vis, q)), v).toBe(true);
    }
  });
  it('E5-129 只剩一个正确选项（C「in a」→「in」）', () => {
    const q = byId.get('E5-129')!; expect(q.answer).toEqual(old('E5-129').answer);
    expect(q.options.map(o => o.text)).not.toContain('in a'); expect(q.options.map(o => o.text)).toContain('in');
    expect(new Set(q.options.map(o => o.text)).size).toBe(q.options.length);
  });
  it('只有这 6 题 qRev 变了（REV_CHANGED_SINCE_R16 里都有）；高二 5 题改成数字键盘', () => {
    for (const id of CHANGED) { expect(qRev(byId.get(id)!), id).not.toBe(qRev(old(id))); expect(REV_CHANGED_SINCE_R16.has(id), id).toBe(true); }
    for (const id of CHANGED.slice(1)) expect(byId.get(id)!.input_type, id).toBe('numeric');
    const v48 = JSON.parse(readFileSync('tests/fixtures/r161_v48_revchanged.json', 'utf8')) as string[];
    const v51 = Object.keys(JSON.parse(readFileSync('tests/fixtures/r162_v50_revs_of_v51changed.json', 'utf8')));   // r16.2：v51 又改了 626 题（tests/r162v51）
    const v52 = Object.keys(JSON.parse(readFileSync('tests/fixtures/r162_v51_revs_of_v52changed.json', 'utf8')));   // r16.2：v52 又改了 4–6 年级 636 题（tests/r162v51）
    const v56 = Object.keys(JSON.parse(readFileSync('tests/fixtures/r17_v52_revs_of_v56changed.json', 'utf8')));   // r17：v56 改了 2825 题（tests/r17v56）
    expect([...REV_CHANGED_SINCE_R16].sort()).toEqual([...new Set([...v48, ...CHANGED, ...v51, ...v52, ...v56])].sort());
  });
  it('错题本：v48 时记下的（带旧 rev）→ 显示「这题后来更新过」，不把旧答案字母对到新选项上；r16 前的旧记录（没有 rev）也一样', () => {
    for (const id of CHANGED) { const q = byId.get(id)!, o = old(id);
      const e = onWrong(undefined, { profileId: 'p', qkey: q.key, subject: q.subject, rev: qRev(o) }, q.type === '选择' ? 'C' : '二十四');
      expect(wrongStale(e, q), id).toBe(true);
      expect(wrongStale({ lastAnswer: e.lastAnswer }, q), id).toBe(true);
      expect(wrongStale({ ...e, rev: qRev(q) }, q), id).toBe(false);   // v50 下新记的照常显示
    }
    const q = byId.get('E5-001') ?? all.find(x => x.grade === '5' && x.type === '选择')!;   // 没改过的题：旧逻辑不变
    expect(wrongStale({ lastAnswer: 'Z' }, q)).toBe(false);
  });
  it('家长改题：基于 v48 版本（base_rev）改过这 6 题 → 内置题已更新，按新版（superseded），不崩', () => {
    for (const id of CHANGED) { const q = byId.get(id)!, o = old(id);
      const by = new Map<string, Question>([[q.key, q]]);
      const r = mergeImported(by, [{ ...OLD6[id].q, grade: OLD6[id].grade, key: q.key, explanation: '家长写的解析', base_rev: qRev(o) }]);
      expect(r.superseded, id).toBe(1); expect(by.get(q.key), id).toBe(q);
    }
  });
  it('离线预缓存：每个题库文件 < 5 MiB（上限 6 MiB，留 ≥ 1 MiB）', () => {
    const big = readdirSync('public/banks').filter(f => f.endsWith('.json')).map(f => [f, statSync('public/banks/' + f).size] as const).filter(([, n]) => n >= 5 * 1024 * 1024);
    expect(big).toEqual([]);
  });
});
