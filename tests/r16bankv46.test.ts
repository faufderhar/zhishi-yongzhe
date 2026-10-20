/* r16：题库 v46（/workspace/questions/给程序的配合说明_v46.md）。导入的年级里题目内容（qRev）和 v45 完全一样，
   只改 高中 textbook_note 措辞；高二地理 D11-241～252（选必2·第二章第三节）放进游戏，高二可玩 2772 → 2784。
   所以 v45 时记下的错题 / 存档按 id + rev 读，v46 下都照常显示；新 12 题让高二地理选必二不再被自动规则藏掉。
   样本 = tests/fixtures/r16_v45_revs.json（v45 提交的 bank 文件里每个年级 sorted「id:rev」的 sha256 前 16 位，脚本生成） */
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadBank, qRev, playable } from '../src/game/questions';
import { onWrong, wrongStale } from '../src/game/wrongbook';
import { computeVisibility } from '../src/game/visibility';
// r16.1：指纹换成题库 v48 的（v46→v47 逐题对比 0 处 rev 变化；v47→v48 只有 REV48 里的 130 题变了——对比结果见 STATUS.md）；v45 的指纹留在 r16_v45_revs.json
const fx = JSON.parse(readFileSync('tests/fixtures/r161_v48_revs.json', 'utf8')) as Record<string, { n: number; digest: string }>;
const fx45 = JSON.parse(readFileSync('tests/fixtures/r16_v45_revs.json', 'utf8')) as Record<string, { n: number; digest: string }>;
const bank = (g: string) => loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`);
const NEW = Array.from({ length: 12 }, (_, i) => `D11-${241 + i}`);
/** r16.1 题库 v47 新进游戏的题（纯新增：v46 已有的题 id / rev / 全部字段都没变） */
const NEW47 = new Set(['E5-031', 'E5-032', 'E5-033', 'E5-154', 'E5-155', 'Y5-169', 'E6-028', 'E6-029', 'E6-030', 'E6-043', 'E6-044', 'E6-060', 'E6-157', 'Y6-014', 'Y6-026']);
const isNew47 = (q: { id: string; grade: string; subject: string }) => NEW47.has(q.id) || (q.grade === '8' && (q.subject === '生物' || q.subject === '地理'));
/** r16.1 题库 v48：有意改了题面的 130 题（判断题绝对词 98、数学「或」/ 区间选项 32 里属于已导入年级的；中班 4 题加 question_image）——rev 变是预期的（错题本里这些题按新版重新算），其余全不变 */
const REV48 = new Set(JSON.parse(readFileSync('tests/fixtures/r161_v48_revchanged.json', 'utf8')) as string[]);
it('内置题库是 v46（r16.1：v47）', () => { for (const g of Object.keys(fx)) expect(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')).version, g).toMatch(/^v4[678]$/); });
it('v45 已有的题：id 和 rev 全部不变（错题本 / 存档照常读）；高二只多了 D11-241～252', () => {
  for (const [g, f] of Object.entries(fx)) {
    const all = bank(g).all.filter(q => !(g === '11' && NEW.includes(q.id)) && !isNew47(q));
    const lines = all.map(q => `${q.id}:${qRev(q)}`).sort();
    expect(lines.length, g).toBe(f.n); expect(createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 16), g).toBe(f.digest);
  }
  expect(Object.keys(fx).sort()).toEqual(Object.keys(fx45).sort()); for (const g of Object.keys(fx)) expect(fx[g].n, g).toBe(fx45[g].n);   // 题数和 v45 一样（没有删题）
  expect(REV48.size).toBe(130); const ids = new Set(Object.keys(fx).flatMap(g => bank(g).all.map(q => q.id))); expect([...REV48].filter(i => !ids.has(i))).toEqual([]);
  const b11 = bank('11').all; expect(b11.filter(q => NEW.includes(q.id)).map(q => q.id)).toEqual(NEW);
  expect(playable(b11.filter(q => q.subject === '地理'), false).length).toBe(334);
});
it('v45 时答错记下（带 rev）的题，v46 下照常显示当时的答案', () => {
  for (const g of ['10', '11']) for (const q of bank(g).all.slice(0, 40)) {
    const e = onWrong(undefined, { profileId: 'p', qkey: q.key, subject: q.subject, rev: qRev(q) }, q.type === '判断' ? (q.answer[0] === '对' ? '错' : '对') : 'Z');
    expect(wrongStale(e, q)).toBe(false);
  }
});
it('新 12 题补上第三节后，高二地理选必二不再被题量规则藏掉（v46 自动规则在已开放年级不藏任何册）', () => {
  const v = computeVisibility(['K1', 'K2', '1', '2', '3', '4', '5', '6', '7', '8', '10', '11'].flatMap(g => bank(g).all));
  expect(v.rows.filter(r => r.why === 'auto')).toEqual([]);
});
