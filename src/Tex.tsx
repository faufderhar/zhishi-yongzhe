import katex from 'katex';
import 'katex/contrib/mhchem';
import 'katex/dist/katex.min.css';
import { memo } from 'react';
/** 渲染含 $…$ 的文本（KaTeX + mhchem） */
export const Tex = memo(function Tex({ text }: { text: string }) {
  if (!text.includes('$')) return <>{text}</>;
  const parts = text.split(/(\$[^$]+\$)/g);
  return <>{parts.map((p, i) => p.startsWith('$') && p.endsWith('$') && p.length > 2
    ? <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(p.slice(1, -1), { throwOnError: false }) }} />
    : <span key={i}>{p}</span>)}</>;
});
