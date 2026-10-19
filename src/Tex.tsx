import katex from 'katex';
import 'katex/contrib/mhchem';
import 'katex/dist/katex.min.css';
import { memo } from 'react';
/** 渲染含 $…$ 的文本（KaTeX + mhchem） */
export const Tex = memo(function Tex({ text }: { text: string }) {
  if (!text.includes('$')) return <>{text}</>;
  // \$ = 字面美元符号（技术QA P3-5）；单个落单的 $ 也按普通文字显示
  const esc = text.replace(/\\\$/g, '\u0001');
  const parts = esc.split(/(\$[^$]+\$)/g).map(p => p.replace(/\u0001/g, p.startsWith('$') && p.endsWith('$') && p.length > 2 ? '\\$' : '$'));
  return <>{parts.map((p, i) => p.startsWith('$') && p.endsWith('$') && p.length > 2
    ? mathChunks(p.slice(1, -1)).map((c, j, a) => a.length === 1 ? <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(c, { throwOnError: false }) }} />
      : <span key={i + '.' + j} className="tex-chunk" dangerouslySetInnerHTML={{ __html: katex.renderToString(c, { throwOnError: false }) }} />).flatMap((el, j, a) => j < a.length - 1 ? [el, '\u200b'] : [el])
    : <span key={i}>{p}</span>)}</>;
});
/* r15.4.4 技术QA P2-1：mhchem 方程式（\ce{…}）是一整块 KaTeX，没有断点，平板两列选项里被截断。
   整段只有一个 \ce{…} 时，在顶层的「 + 」「 = 」「 -> 」等运算符后面切开，每段单独渲染成不换行的小块（.tex-chunk），块之间可以换行；
   离子列表「\ce{K+},\ \ce{Na+},…」在顶层「,\ 」后面切开。其他公式不变（KaTeX 自己会在 = / + 后换行） */
const CE_OPS = /^(\+|=|->|<-|<=>|<->|<=>>|<<=>|->\[.*\]|<=>\[.*\]|<-\[.*\])$/;
const CE_ATTACH = /^(v|\^)$/;   // 沉淀 ↓ / 气体 ↑ 跟着前面的物质
const topSplit = (s: string, sep: RegExp) => { const out: string[] = []; let d = 0, cur = '';
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '{' || c === '[' || c === '(') d++; else if (c === '}' || c === ']' || c === ')') d--;
    if (d === 0) { const m = s.slice(i).match(sep); if (m && m.index === 0) { out.push(cur + m[0]); cur = ''; i += m[0].length - 1; continue; } } cur += c; }
  if (cur) out.push(cur); return out; };
export function mathChunks(m: string): string[] {
  const t = m.trim(); const ce = t.match(/^\\ce\{([\s\S]*)\}$/);
  if (ce && !/\\ce\{/.test(ce[1])) {
    const tok = topSplit(ce[1], / +/).map(x => x.trim()).filter(Boolean); const out: string[] = []; let cur: string[] = [];
    for (const k of tok) { if (CE_OPS.test(k)) { cur.push(k); out.push(cur.join(' ')); cur = []; } else if (CE_ATTACH.test(k) && cur.length) cur.push(k); else cur.push(k); }
    if (cur.length) out.push(cur.join(' '));
    return out.length > 1 ? out.map(x => `\\ce{${x}}`) : [m];
  }
  if (/,\\ /.test(t)) { const out = topSplit(t, /,\\ /).map(x => x.replace(/\\ $/, '')); return out.length > 1 ? out : [m]; }
  return [m];
}
