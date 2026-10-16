import { useState, type ReactNode } from 'react';
import { parseImage, shapeSvg } from '../game/shapes';
/** 选项 / 题干图片：形状键 → SVG；相对路径 → 懒加载 img，加载失败回退文字（emoji）；未知形状：有文字用文字，否则占位 */
export function QImage({ image, fallback, cls }: { image?: string; fallback: ReactNode; cls: string }) {
  const r = parseImage(image); const [bad, setBad] = useState(false);
  if (r.kind === 'none') return <>{fallback}</>;
  if (r.kind === 'shape') {
    if (!r.known && fallback) return <>{fallback}</>;
    return <span className={`${cls} shape-img`} data-testid="shape-img" data-shape={r.shape} role="img" aria-label={String(typeof fallback === 'string' ? fallback : '')} dangerouslySetInnerHTML={{ __html: shapeSvg(r.known ? r.shape : '?', r.color) }} />;
  }
  if (bad) return <>{fallback}</>;
  return <img className={cls} src={r.src} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />;
}
/** 数一数：visual {emoji,count} → count 个 emoji，不显示数字或任何答案提示 */
export function CountVisual({ v }: { v?: { emoji?: string; item?: string; count?: number; label?: string } }) {
  if (!v || !(Number(v.count) > 0)) return null; const e = v.emoji || v.item || '⭐'; const n = Math.min(20, Number(v.count));
  return <div className={`kitems visual ${n > 5 ? 'two' : ''}`} data-testid="visual" aria-label={v.label ? `数一数${v.label}` : '数一数'}>{Array.from({ length: n }, (_, i) => <span key={i} className="kitem" aria-hidden>{e}</span>)}</div>;
}
