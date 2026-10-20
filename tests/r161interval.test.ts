// r16.1 (r) 较真家长 P2：高二 M11-001 选项 A「$[0,\pi)$」B「$[0,\pi]$」据报显示成一样的「[0,π]」。
// 排查：题库数据正确；Tex（KaTeX）对两者输出不同（SSR + 真浏览器 e2e scripts/r161-interval.mjs 都是「[0,π)」/「[0,π]」）。这里守住：
// 四个选项 + M11-009 的半开区间渲染正确；全题库：同一题里源文字不同的选项，渲染结果（HTML）也不同；没有 KaTeX 报错块
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Tex } from '../src/Tex';
import { loadBank, choicesOf } from '../src/game/questions';
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
