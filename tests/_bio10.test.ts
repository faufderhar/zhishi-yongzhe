import { test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadBank, playable, isBossOnly } from '../src/game/questions';
import { buildChapters, levelsOfUnit } from '../src/game/levels';
import { isMultiSel } from '../src/game/multi';
/** r15.4：高一生物各小节各难度题量（题库 v30）→ /workspace/questions/高一生物各小节各难度题量_v30.csv（BIO10=1 时才跑） */
test.skipIf(!process.env.BIO10)('bio10 counts', () => {
  const rel = JSON.parse(readFileSync('public/banks/release.json', 'utf8')).release;
  const all = loadBank(JSON.parse(readFileSync('public/banks/bank_10.json', 'utf8')), '').all; const qs = playable(all, false); const by = new Map(qs.map(q => [q.key, q]));
  const ch = buildChapters(qs, null, all).find(c => c.subject === '生物')!;
  const lessons = new Map<string, { lv: number; keys: Set<string>; unit: string; vol: string; names: string[]; first?: (typeof ch.levels)[number] }>();
  for (const l of ch.levels) { if (l.kind === 'boss' || !l.lesson || l.redirect) continue;
    const e = lessons.get(l.lesson) ?? { lv: 0, keys: new Set<string>(), unit: '', vol: l.lesson.split('|')[0], names: [] }; e.lv++; if (l.kind === 'normal') { e.names.push(l.name); e.first ??= l; }
    for (const k of l.pool) e.keys.add(k); lessons.set(l.lesson, e); }
  const rows: string[][] = [['年级', '科目', '册别', '小节', '关卡数(普通+精英)', '难度1', '难度2', '难度3', '难度4', '难度5', '合计', '其中多选', '普通题可用(非多选)', '不足6题的难度(1-3档)', '难度4-5', '同单元前面小节可补(普通题)', 'Boss专用题(同章)', '14题一局要不要重复', '说明']];
  const units = (s: string) => s.split('|')[1] ?? s;
  for (const [ls, e] of lessons) {
    const q = [...e.keys].map(k => by.get(k)!).filter(x => x && !isBossOnly(x)); const nm = q.filter(x => !isMultiSel(x));
    const d = [1, 2, 3, 4, 5].map(i => q.filter(x => x.difficulty === i).length);
    const low = d.slice(0, 3).map((n, i) => n < 6 ? `难度${i + 1}(${n})` : '').filter(Boolean).join('；');
    /* 题池用完先补「同单元、前面已学的小节」（App.startLevel 的 adjGroups：只取前面的，不取后面的），再不够才重复 */
    const all0 = ch.levels, idx = e.first ? all0.indexOf(e.first) : -1;
    const sib = e.first ? new Set(levelsOfUnit(all0, e.first).filter(l => l.kind === 'normal' && l.lesson !== ls && !l.redirect && all0.indexOf(l) < idx).flatMap(l => l.pool)).size === 0 ? 0
      : [...new Set(levelsOfUnit(all0, e.first).filter(l => l.kind === 'normal' && l.lesson !== ls && !l.redirect && all0.indexOf(l) < idx).flatMap(l => l.pool))].map(k => by.get(k)!).filter(x => x && !isBossOnly(x) && !isMultiSel(x) && !e.keys.has(x.key)).length : 0;
    const unitKeys = new Set(units(ls).split('+').map(u => u.split('·').slice(0, 2).join('·')));
    const boss = qs.filter(x => isBossOnly(x) && x.subject === '生物' && [...unitKeys].some(u => x.unit.startsWith(u))).length;
    const enough = nm.length >= 14 ? '不用：本小节就有 ≥14 道' : nm.length + sib >= 14 ? `本小节只有 ${nm.length} 道，出完后从同单元前面的小节补（还有 ${sib} 道），一般不用重复；答错的题仍会按规则重出` : `要重复：本小节 ${nm.length} 道 + 同单元前面小节 ${sib} 道 = ${nm.length + sib} < 14`;
    const notes = [`关卡：${e.names.join('、')}`, d[0] < 6 ? `难度1只有 ${d[0]} 道：开局在难度1时很快出完，之后出别的难度或重复答错的题` : '', d[3] + d[4] === 0 ? '没有难度4-5：重击卡只能用难度3/同档题' : ''].filter(Boolean).join('；');
    rows.push(['高一', '生物', e.vol, units(ls), String(e.lv), ...d.map(String), String(q.length), String(q.length - nm.length), String(nm.length), low || '无', String(d[3] + d[4]), String(sib), String(boss), enough, notes]);
  }
  const esc = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const out = process.env.BIO10_OUT ?? `/workspace/questions/高一生物各小节各难度题量_${rel}.csv`;
  writeFileSync(out, '\ufeff' + rows.map(r => r.map(esc).join(',')).join('\r\n') + '\r\n');
  console.log(out, rows.length - 1, 'lessons');
});
