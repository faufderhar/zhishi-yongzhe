// r17：题库 v52 → v56（= v53 + v54 + v55.1；import-bank.py）。不增删题、不改关卡 id、答案都不变；已导入年级 2825 题 qRev 变了
//  （选项偏差校正、判断题题干、M8-096 判断题干、M7-421 / M7-197 / Z11-287 / B10-323 / B10-358 / P10-002 …）。
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { loadBank, playable, qRev, type Question } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
import { computeVisibility, isHiddenBy } from '../src/game/visibility';
import { onWrong, wrongStale } from '../src/game/wrongbook';
import { REV_CHANGED_SINCE_R16 } from '../src/game/revChanged';
import { R16_GRADES } from './helpers/r16grades';   // r17.1：快照只看 r16–r17 的 12 个年级
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tex } from '../src/Tex';
const raw = (g: string) => JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8'));
const all: Question[] = R16_GRADES.flatMap(g => loadBank(raw(g), `bank_${g}.json`).all); const vis = computeVisibility(all); const byId = new Map(all.map(q => [q.id, q]));
const V52 = JSON.parse(readFileSync('tests/fixtures/r17_v52_revs_of_v56changed.json', 'utf8')) as Record<string, { grade: string; rev52: string }>;
describe('r17 题库 v56', () => {
  it('发布号 v56；题量 18344 / 可玩 18281 不变；初三 / 大班 / 高三还没导入；高二物理强制隐藏，自动规则不藏别的', () => {
    for (const g of R16_GRADES) expect(raw(g).version, g).toBe('v58');   // r17.2：v58 只补初三   // r17：v57 只改大班（K3C-071 新增、K3C-013 需家长确认），已导入年级逐题和 v56 相同
    expect(JSON.parse(readFileSync('public/banks/release.json', 'utf8'))).toEqual({ release: 'v58', playable: 23470 });   // r17.1：+大班 335 / 初三 2073 / 高三 2703；r17.2 v58：初三 +78
    expect(all.length).toBe(18344); expect(readdirSync('public/banks').filter(f => /bank_(9|12|K3)\.json/.test(f))).toEqual(['bank_12.json', 'bank_9.json', 'bank_K3.json']);   // r17.1 导入
    expect(vis.rows.map(r => `${r.grade}|${r.subject}|${r.volume}|${r.why}`)).toEqual(['11|物理|必修第三册|force', '11|物理|选择性必修第一册|force', '11|物理|选择性必修第二册|force']);
  });
  it('可见关卡 2387 个，和 r16.2 快照（eefc5aa）一关不少', () => {
    const fx = JSON.parse(readFileSync('tests/fixtures/r162_levels_eefc5aa.json', 'utf8')) as { names: Record<string, [string, string]> };
    const ids = new Set<string>(); for (const g of R16_GRADES) { const a = all.filter(q => q.grade === g); for (const ch of buildChapters(playable(a, false).filter(q => !isHiddenBy(vis, q)), null, a)) for (const l of ch.levels) ids.add(l.id); }
    expect(ids.size).toBe(2387); expect(Object.keys(fx.names).filter(k => !ids.has(k))).toEqual([]);
  });
  it('2825 题 qRev 变了（含点名的 7 题），全在 REV_CHANGED_SINCE_R16；v52 时记的错题按「已更新」', () => {
    const ids = Object.keys(V52); expect(ids.length).toBe(2825);
    for (const i of ['M8-096', 'M7-421', 'M7-197', 'Z11-287', 'B10-323', 'B10-358', 'P10-002']) expect(V52[i], i).toBeTruthy();
    for (const id of ids) { const q = byId.get(id)!; expect(qRev(q), id).not.toBe(V52[id].rev52); expect(REV_CHANGED_SINCE_R16.has(id), id).toBe(true);
      const e = onWrong(undefined, { profileId: 'p', qkey: q.key, subject: q.subject, rev: V52[id].rev52 }, 'A');
      expect(wrongStale(e, q), id).toBe(true); expect(wrongStale({ ...e, rev: qRev(q) }, q), id).toBe(false); }
  });
  it('改过的题：题干 / 选项渲染没有 KaTeX 报错、选项互不相同；判断题答案仍是 对 / 错；选择题答案在选项里', () => {
    const html = (t: string) => renderToStaticMarkup(createElement(Tex, { text: t })); const bad: string[] = [];
    for (const id of Object.keys(V52)) { const q = byId.get(id)!;
      if (/katex-error/.test(html(q.question))) bad.push(id + ' 题干');
      const os = q.options.map(o => html(o.text)); if (os.some(h => /katex-error/.test(h))) bad.push(id + ' 选项'); if (os.length && new Set(os).size !== os.length) bad.push(id + ' 选项重复');
      if (q.type === '判断' && !['对', '错'].includes(q.answer[0])) bad.push(id + ' 判断答案');
      if ((q.type === '选择' || q.type === '多选') && !q.answer.every(a => /^[A-F]$/.test(a) && 'ABCDEF'.indexOf(a) < q.options.length)) bad.push(id + ' 答案字母'); }
    expect(bad).toEqual([]);
  });
});
