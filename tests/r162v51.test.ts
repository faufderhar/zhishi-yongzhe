// r16.2：题库 v50 → v51（总管：同样的条件——线上可见关卡 id 不变；高二物理 / 初三 / 高三不可见；测试 + 预缓存大小 OK）。
//  v51 不增删题、不改关卡 id；已导入年级 626 题 qRev 变了（选项偏差校正、17 道数字键盘题…）；小学英语 399 题 knowledge_point 加了册号；
//  幼儿园改过文字的题，录音包同步换成音频设计的 v51 包（K1 v51 · K2 v51 · K3 v51）。
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { loadBank, playable, qRev, editRev, type Question } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
import { computeVisibility, isHiddenBy } from '../src/game/visibility';
import { onWrong, wrongStale } from '../src/game/wrongbook';
import { REV_CHANGED_SINCE_R16 } from '../src/game/revChanged';
import { mergeImported, BUILTIN_GRADES } from '../src/bankStore';
import { speakable } from '../src/tts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tex } from '../src/Tex';
import { fillKind, kindProblems, numTypeable, sciOf } from '../src/game/inputKind';
import { judge } from '../src/game/questions';
import { addNumKey } from '../src/game/keypad';
const raw = (g: string) => JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8'));
const B = (g: string) => loadBank(raw(g), `bank_${g}.json`);
const all: Question[] = BUILTIN_GRADES.flatMap(g => B(g).all); const vis = computeVisibility(all); const byId = new Map(all.map(q => [q.id, q]));
const V50 = JSON.parse(readFileSync('tests/fixtures/r162_v50_revs_of_v51changed.json', 'utf8')) as Record<string, { grade: string; rev50: string }>;
const man = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8'));
describe('r16.2 题库 v51', () => {
  it('发布号 v51；题量 18344 不变；初三 / 大班 / 高三没导入；高二物理全部隐藏；自动规则不藏任何册', () => {
    for (const g of BUILTIN_GRADES) expect(raw(g).version, g).toBe('v57');   // r17：v56 → v57（同 id、同关卡；tests/r17v56）   // r16.2：v52 只改 4–6 年级 636 题（下面 v52 一节）
    expect(all.length).toBe(18344); expect(readdirSync('public/banks').filter(f => /bank_(9|12|K3)\.json/.test(f))).toEqual([]);
    expect(all.filter(q => q.grade === '11' && q.subject === '物理').every(q => isHiddenBy(vis, q))).toBe(true);
    expect(vis.rows.map(r => `${r.grade}|${r.subject}|${r.volume}|${r.why}`)).toEqual(['11|物理|必修第三册|force', '11|物理|选择性必修第一册|force', '11|物理|选择性必修第二册|force']);
  });
  it('可见关卡 2387 个，和线上 eefc5aa 快照比一关不少（新关只有 v50 的六下《学弈》）', () => {
    const fx = JSON.parse(readFileSync('tests/fixtures/r162_levels_eefc5aa.json', 'utf8')) as { names: Record<string, [string, string]> };
    const ids = new Set<string>(); let n = 0;
    for (const g of BUILTIN_GRADES) { const a = B(g).all; for (const ch of buildChapters(playable(a, false).filter(q => !isHiddenBy(vis, q)), null, a)) for (const l of ch.levels) { ids.add(l.id); n++; } }
    expect(n).toBe(2387); expect(Object.keys(fx.names).filter(k => !ids.has(k))).toEqual([]); expect([...ids].filter(k => !(k in fx.names))).toEqual(['语文|N|6:Y6-014']);
  });
  it('626 题 qRev 变了，全在 REV_CHANGED_SINCE_R16 里；没在名单里的题（含只改 knowledge_point 的）qRev 和 v50 一样由 r16bankv46 指纹保证', () => {
    const ids = Object.keys(V50); expect(ids.length).toBe(626);
    for (const id of ids) { expect(qRev(byId.get(id)!), id).not.toBe(V50[id].rev50); expect(REV_CHANGED_SINCE_R16.has(id), id).toBe(true); }
  });
  it('错题本：v50 时记的（带旧 rev）→「这题后来更新过」；没 rev 的旧记录也一样；v51 下新记的照常显示', () => {
    for (const id of Object.keys(V50)) { const q = byId.get(id)!;
      const e = onWrong(undefined, { profileId: 'p', qkey: q.key, subject: q.subject, rev: V50[id].rev50 }, 'A');
      expect(wrongStale(e, q), id).toBe(true); expect(wrongStale({ lastAnswer: 'A' }, q), id).toBe(true); expect(wrongStale({ ...e, rev: qRev(q) }, q), id).toBe(false); }
  });
  it('家长改题：基于 v50（base_rev = v50 rev）改过的题 → 内置题已更新，按新版', () => {
    const id = Object.keys(V50).find(i => /^E/.test(i))!; const q = byId.get(id)!; const by = new Map<string, Question>([[q.key, q]]);
    const r = mergeImported(by, [{ ...q, explanation: '家长写的解析', base_rev: V50[id].rev50 } as never]); expect(r.superseded).toBe(1); expect(by.get(q.key)).toBe(q);
  });
  it('knowledge_point（小学英语加了册号「5B Unit 2 …」）不进 qRev、不参与关卡 / 错题本分组：只改 kp 的题 qRev 不变', () => {
    const e = all.filter(q => /^E[3-6]-/.test(q.id) && q.knowledge_point && /^[3-6][AB] Unit /.test(q.knowledge_point));
    expect(e.length).toBeGreaterThanOrEqual(389);
    const q = e.find(x => !V50[x.id])!; expect(qRev({ ...q, knowledge_point: 'Unit 1 x' } as Question)).toBe(qRev(q));
    expect(editRev({ ...q, knowledge_point: 'Unit 1 x' } as Question)).not.toBe(editRev(q));   // 家长导入「和内置一样」的判断仍看 kp（只影响家长自己的改题）
    for (const f of ['src/game/levels.ts', 'src/game/wrongbook.ts', 'src/ui/Parent.tsx', 'src/game/report.ts'].filter(f => { try { statSync(f); return true; } catch { return false; } }))
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/knowledge_point/);
  });
  it('录音包 v51：小班 / 中班每道开放题的题干和能朗读的文字选项都有录音，文字和题库一致（缺 0）', () => {
    expect(man.banks.K1.version).toBe('v57'); expect(man.banks.K2.version).toBe('v57');   // r17：音频设计按 v57 重录了 28 个改字的选项（K1 4 / K2 14 / K3 10）
    const norm = (s: string) => s.replace(/[\u200d\ufe0f]/g, '').trim(); const miss: string[] = [], diff: string[] = [];
    for (const g of ['K1', 'K2']) { const r = raw(g); const play = new Set(playable(loadBank(r, '').all, false).map(q => q.id));
      for (const q of r.questions) { if (!play.has(q.id)) continue;
        const chk = (k: string, s: string, t: string) => { if (!man.items[k]) { miss.push(k); return; } const mt = man.meta?.[k]?.text; if (mt && norm(mt) !== norm(s) && norm(mt) !== norm(t)) diff.push(`${k}「${mt}」≠「${t}」`); };
        const t = q.tts_text === '-' ? '' : (q.tts_text || q.question); if (t && speakable(t)) chk(q.id + '#stem', speakable(t), t);
        if (q.type === '选择') (q.options || []).forEach((o: { text?: string }, i: number) => { const s = speakable(o.text || ''); if (s) chk(`${q.id}#opt${i}`, s, o.text || ''); }); } }
    // r17：v56 / v57 改了字的选项录音还没补（音频设计在重录）——这里会如实报出来，不豁免；等整包到了再导入
    expect(miss).toEqual([]); expect(diff).toEqual([]);
  });
  it('17 道数字键盘修正里进游戏的 16 道（C9-108 是初三，没导入）：每个答案都按得出来、按完判对；百分数题 % 在题干里', () => {
    const ids = ['B8-305', 'B10-276', 'B10-375', 'B11-341', 'C11-070', 'C11-092', 'B8-293', ...['325', '387', '470', '471', '474', '480', '484', '516', '526'].map(n => 'P8-' + n)];
    for (const id of ids) { const q = byId.get(id)!; const sci = sciOf(q.grade); expect(fillKind(q, sci), id).toBe('num'); expect(kindProblems(q, 'num', sci), id).toEqual([]);
      for (const a of q.answer) { expect(numTypeable(a, sci), `${id} ${a}`).toBe(true); expect(judge(q, [...a].reduce(addNumKey, '')), `${id} ${a}`).toBe('full'); } }
    for (const id of ids.slice(0, 6)) expect(byId.get(id)!.question, id).toMatch(/_+%/);
    expect(byId.has('C9-108')).toBe(false);
  });
  it('v52：4–6 年级 636 题 qRev 变了（答案字母不变），全在 REV_CHANGED_SINCE_R16 里；v51 时记的错题 / 家长改题按「已更新」', () => {
    const V51 = JSON.parse(readFileSync('tests/fixtures/r162_v51_revs_of_v52changed.json', 'utf8')) as Record<string, { grade: string; rev51: string }>;
    const ids = Object.keys(V51); expect(ids.length).toBe(636); expect(new Set(ids.map(i => V51[i].grade))).toEqual(new Set(['4', '5', '6']));
    for (const id of ids) { const q = byId.get(id)!; expect(qRev(q), id).not.toBe(V51[id].rev51); expect(REV_CHANGED_SINCE_R16.has(id), id).toBe(true);
      const e = onWrong(undefined, { profileId: 'p', qkey: q.key, subject: q.subject, rev: V51[id].rev51 }, 'A');
      expect(wrongStale(e, q), id).toBe(true); expect(wrongStale({ lastAnswer: 'A' }, q), id).toBe(true); expect(wrongStale({ ...e, rev: qRev(q) }, q), id).toBe(false); }
    const id = ids[0]; const q = byId.get(id)!; const by = new Map<string, Question>([[q.key, q]]);
    expect(mergeImported(by, [{ ...q, explanation: '家长写的解析', base_rev: V51[id].rev51 } as never]).superseded).toBe(1);
  });
  it('v52 改过的 636 题：题干 / 选项都能渲染（没有 KaTeX 报错），同一题的选项渲染后互不相同；判断题答案仍是 对 / 错；选择题答案字母在选项里', () => {
    const V51 = JSON.parse(readFileSync('tests/fixtures/r162_v51_revs_of_v52changed.json', 'utf8')) as Record<string, unknown>;
    const html = (t: string) => renderToStaticMarkup(createElement(Tex, { text: t })); const bad: string[] = [];
    for (const id of Object.keys(V51)) { const q = byId.get(id)!;
      if (/katex-error/.test(html(q.question))) bad.push(id + ' 题干');
      const os = q.options.map(o => html(o.text)); if (os.some(h => /katex-error/.test(h))) bad.push(id + ' 选项'); if (new Set(os).size !== os.length) bad.push(id + ' 选项重复');
      if (q.type === '判断') { if (!['对', '错'].includes(q.answer[0])) bad.push(id + ' 判断答案'); }
      else if (q.type === '选择' || q.type === '多选') { if (!q.answer.every(a => q.options.some(o => o.key === a))) bad.push(id + ' 答案字母'); }
      if (q.type === '选择' && q.options.some(o => !o.text.trim() && !o.image)) bad.push(id + ' 空选项'); }
    expect(bad).toEqual([]);
  });
  it('离线预缓存：每个题库文件 < 5 MiB（上限 6 MiB）', () => {
    expect(readdirSync('public/banks').filter(f => f.endsWith('.json') && statSync('public/banks/' + f).size >= 5 * 1024 * 1024)).toEqual([]);
  });
});
