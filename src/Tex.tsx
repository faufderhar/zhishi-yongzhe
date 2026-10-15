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
    ? <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(p.slice(1, -1), { throwOnError: false }) }} />
    : <span key={i}>{p}</span>)}</>;
});
