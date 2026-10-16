/* 题库 v9.1 图片键：image:shape_<形状>?color=<颜色>（SVG 渲染），或 public/ 下的相对路径（懒加载，缺图回退 emoji 文字） */
export const SHAPES = ['circle', 'square', 'rect', 'triangle', 'star', 'heart'] as const;
export const COLORS: Record<string, string> = { red: '#e53935', orange: '#fb8c00', yellow: '#fdd835', green: '#43a047', blue: '#1e88e5', purple: '#8e24aa', pink: '#ec407a', white: '#ffffff', black: '#212121', brown: '#795548', gray: '#9e9e9e' };
export type ImgRef = { kind: 'shape'; shape: string; color: string; known: boolean } | { kind: 'path'; src: string } | { kind: 'none' };
export function parseImage(v?: string): ImgRef {
  const s = (v ?? '').trim(); if (!s) return { kind: 'none' };
  const m = s.match(/^image:shape_([a-z]+)(?:\?color=([a-z]+))?$/i);
  if (m) { const shape = m[1].toLowerCase(), c = (m[2] ?? 'gray').toLowerCase(); return { kind: 'shape', shape, color: COLORS[c] ?? COLORS.gray, known: (SHAPES as readonly string[]).includes(shape) && !!COLORS[c] }; }
  if (/^image:/i.test(s)) return { kind: 'shape', shape: s, color: COLORS.gray, known: false };
  return { kind: 'path', src: /^(https?:|data:|\/)/.test(s) ? s : './' + s.replace(/^\.\//, '') };
}
/** SVG 路径（viewBox 0 0 100 100）；白色加深色描边 */
export function shapeSvg(shape: string, fill: string): string {
  const stroke = fill.toLowerCase() === '#ffffff' ? '#333' : 'rgba(0,0,0,.25)';
  const a = `fill="${fill}" stroke="${stroke}" stroke-width="${stroke === '#333' ? 5 : 2}" stroke-linejoin="round"`;
  const body: Record<string, string> = {
    circle: `<circle cx="50" cy="50" r="40" ${a}/>`,
    square: `<rect x="12" y="12" width="76" height="76" rx="4" ${a}/>`,
    rect: `<rect x="6" y="26" width="88" height="48" rx="4" ${a}/>`,
    triangle: `<polygon points="50,10 92,86 8,86" ${a}/>`,
    star: `<polygon points="50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38" ${a}/>`,
    heart: `<path d="M50 88 C10 60 4 34 22 20 C36 10 48 18 50 30 C52 18 64 10 78 20 C96 34 90 60 50 88Z" ${a}/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body[shape] ?? '<rect x="10" y="10" width="80" height="80" rx="12" fill="#ddd" stroke="#999" stroke-width="3" stroke-dasharray="8 6"/><text x="50" y="62" font-size="36" text-anchor="middle" fill="#888">?</text>'}</svg>`;
}
