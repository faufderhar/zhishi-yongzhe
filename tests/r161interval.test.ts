// r16.1 (r) 较真家长 P2：高二 M11-001 选项 A「$[0,\pi)$」B「$[0,\pi]$」据报显示成一样的「[0,π]」。
// 排查：题库数据正确；Tex（KaTeX）对两者输出不同（SSR + 真浏览器 e2e scripts/r161-interval.mjs 都是「[0,π)」/「[0,π]」）。这里守住：
// 四个选项 + M11-009 的半开区间渲染正确；全题库：同一题里源文字不同的选项，渲染结果（HTML）也不同；没有 KaTeX 报错块
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Tex } from '../src/Tex';
import { parseCSV } from '../src/game/csv';
import { loadBank, choicesOf, type Question } from '../src/game/questions';
const R = (t: string) => renderToStaticMarkup(createElement(Tex, { text: t }));
const ann = (h: string) => [...h.matchAll(/<annotation encoding="application\/x-tex">([^<]*)<\/annotation>/g)].map(m => m[1].replace(/&amp;/g, '&')).join(' ');
const vis = (h: string) => h.replace(/<span class="katex-mathml">[\s\S]*?<\/math><\/span>/g, '').replace(/<[^>]+>/g, '').replace(/\u200b/g, '');
describe('r16.1 半开区间渲染', () => {
  it('M11-001 四个选项', () => {
    const o = ['$[0,\\pi)$', '$[0,\\pi]$', '$(0,\\pi)$', '$[0,\\frac{\\pi}{2}]$'].map(R);
    expect(o.map(ann)).toEqual(['[0,\\pi)', '[0,\\pi]', '(0,\\pi)', '[0,\\frac{\\pi}{2}]']);
    expect(vis(o[0])).toMatch(/^\[0,π\)$/); expect(vis(o[1])).toMatch(/^\[0,π\]$/); expect(vis(o[2])).toMatch(/^\(0,π\)$/);
    expect(new Set(o).size).toBe(4); expect(new Set(o.map(vis)).size).toBe(4);
  });
  it('M11-009 B 「…∪[3π/4,π)」以「)」结尾', () => {
    const h = R('$[0,\\frac{\\pi}{4}]\\cup[\\frac{3\\pi}{4},\\pi)$'); expect(ann(h)).toBe('[0,\\frac{\\pi}{4}]\\cup[\\frac{3\\pi}{4},\\pi)'); expect(vis(h)).toMatch(/∪\[.*π\)$/);
  });
  it('React.memo 不会把只差一个括号的两个选项当成同一个', () => {
    const h = renderToStaticMarkup(createElement('div', null, createElement(Tex, { key: 'A', text: '$[0,\\pi)$' }), createElement(Tex, { key: 'B', text: '$[0,\\pi]$' })));
    expect(h).toContain('[0,\\pi)'); expect(h).toContain('[0,\\pi]');
  });
  it('全题库：源文字不同 → 渲染不同；没有 KaTeX 报错', () => {
    const bad: string[] = []; let n = 0;
    for (const f of readdirSync('public/banks').filter(f => /^bank_.*\.json$/.test(f))) {
      for (const q of loadBank(JSON.parse(readFileSync('public/banks/' + f, 'utf8')), f).all) { if (q.type !== '选择' && q.type !== '多选') continue;
        const os = choicesOf(q).filter(o => o.text.includes('$')); if (!os.length) continue; n++;
        const rs = choicesOf(q).map(o => ({ t: o.text, h: R(o.text) }));
        for (const r of rs) if (/katex-error/.test(r.h)) bad.push(`${q.id} KaTeX 报错 ${r.t}`);
        for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (rs[i].t !== rs[j].t && (rs[i].h === rs[j].h || vis(rs[i].h) === vis(rs[j].h) && ann(rs[i].h) === ann(rs[j].h))) bad.push(`${q.id} ${rs[i].t} ≡ ${rs[j].t}`);
      } }
    expect(n).toBeGreaterThan(500); expect(bad).toEqual([]);
  });
});
// 题库 v48 的回归清单（tests/fixtures/half_open_v48.csv = 题库审核 半开区间渲染回归清单_v48.csv 原样拷贝）：72 处公式，渲染后每个半开区间原样出现（KaTeX annotation 原文 + 可见文字的左右括号）
describe('半开区间回归清单 v48（72 处，其中 45 处 v48 还在）', () => {
  const rows = parseCSV(readFileSync('tests/fixtures/half_open_v48.csv', 'utf8').replace(/^\uFEFF/, '')).slice(1).filter(r => r[0]);
  const all = new Map<string, Question>(); for (const f of readdirSync('public/banks').filter(f => /^bank_.*\.json$/.test(f))) for (const q of loadBank(JSON.parse(readFileSync('public/banks/' + f, 'utf8')), f).all) all.set(q.id, q);
  it('72 行，45 行标「v48 还在」', () => { expect(rows.length).toBe(72); expect(rows.filter(r => !/已改写/.test(r[7] ?? '')).length).toBe(45); });
  it('每个公式渲染出来：annotation = 原文、没有 KaTeX 报错、每个半开区间的右括号原样在', () => {
    const bad: string[] = [];
    for (const r of rows) { const tex = r[5]; const h = R(tex); if (/katex-error/.test(h)) bad.push(`${r[0]} 报错`);
      if (ann(h) !== tex.replace(/^\$|\$$/g, '')) bad.push(`${r[0]} annotation ${ann(h)} ≠ ${tex}`);
      const v = vis(h).replace(/\s/g, ''); for (const iv of r[6].split('、')) { const close = iv.trim().slice(-1); const open = iv.trim()[0]; if (!v.includes(close) || !v.includes(open)) bad.push(`${r[0]} ${iv}`); } }
    expect(bad).toEqual([]);
  });
  it('「v48 还在」的 45 处真的在当前题库对应位置里，且那道题渲染无误', () => {
    const miss: string[] = [];
    for (const r of rows.filter(r => !/已改写/.test(r[7] ?? ''))) { const q = all.get(r[0]); if (!q) { if (r[3] === 'True' && /^(高一|高二|初[一二]|[1-6]年级)/.test(r[1])) miss.push(`${r[0]} 不在题库`); continue; }
      const m = r[4].match(/^选项([A-F])$/); const src = m ? q.options.find(o => o.key === m[1])?.text ?? '' : r[4] === '题干' ? q.question : q.explanation;
      if (!src.includes(r[5])) miss.push(`${r[0]} ${r[4]} 没有 ${r[5]}`); else if (/katex-error/.test(R(src))) miss.push(`${r[0]} 报错`); }
    expect(miss).toEqual([]);
  });
  it('M11-001 v48 改成不等式写法后四个选项仍各不相同', () => {
    const q = all.get('M11-001')!; const o = q.options.map(x => vis(R(x.text))); expect(new Set(o).size).toBe(4); expect(q.answer).toEqual(['A']);
  });
});
