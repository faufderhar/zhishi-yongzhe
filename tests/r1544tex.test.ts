// r15.4.4 技术QA P2-1：高一化学方程式选项按运算符切块（块之间可换行），不再一整块被截断
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import 'katex/contrib/mhchem';
import { readFileSync } from 'node:fs';
import { mathChunks } from '../src/Tex';
describe('mathChunks', () => {
  it('方程式在 + / = / -> 后面切开，沉淀 / 气体符号跟着前面的物质', () => {
    expect(mathChunks('\\ce{Ba^2+ + 2OH- + 2H+ + SO4^2- = BaSO4 v + 2H2O}')).toEqual(['\\ce{Ba^2+ +}', '\\ce{2OH- +}', '\\ce{2H+ +}', '\\ce{SO4^2- =}', '\\ce{BaSO4 v +}', '\\ce{2H2O}']);
    expect(mathChunks('\\ce{MnO2 + 4HCl(浓) ->[\\Delta] MnCl2 + Cl2 ^ + 2H2O}')).toEqual(['\\ce{MnO2 +}', '\\ce{4HCl(浓) ->[\\Delta]}', '\\ce{MnCl2 +}', '\\ce{Cl2 ^ +}', '\\ce{2H2O}']);
  });
  it('离子列表在「,\\ 」后面切开', () => {
    expect(mathChunks('\\ce{K+},\\ \\ce{Na+},\\ \\ce{SO4^2-},\\ \\ce{NO3-}')).toEqual(['\\ce{K+},', '\\ce{Na+},', '\\ce{SO4^2-},', '\\ce{NO3-}']);
  });
  it('单个物质 / 普通公式不切', () => {
    for (const m of ['\\ce{Ba(OH)2}', '\\ce{H2O}', 'x^2 - 4 = 0', '\\frac{1}{2}', '\\ce{K+}']) expect(mathChunks(m)).toEqual([m]);
  });
  it('高一题库里所有公式切块后都能渲染（不抛错），块拼起来和原文一致', () => {
    const qs = JSON.parse(readFileSync('public/banks/bank_10.json', 'utf8')).questions as { options?: { text?: string }[]; question: string }[];
    let n = 0;
    for (const q of qs) for (const t of [q.question, ...(q.options ?? []).map(o => o.text ?? '')]) for (const m of t.match(/\$[^$]+\$/g) ?? []) {
      const cs = mathChunks(m.slice(1, -1)); if (cs.length > 1) n++;
      for (const c of cs) expect(() => katex.renderToString(c, { throwOnError: true, strict: 'ignore' }), c).not.toThrow();
      if (cs.length > 1 && cs[0].startsWith('\\ce{') && !m.includes(',\\ ')) expect(cs.map(c => c.slice(4, -1)).join(' ').replace(/\s+/g, ' ')).toBe(m.slice(5, -2).trim().replace(/\s+/g, ' '));
    }
    expect(n).toBeGreaterThan(10);
  });
});
