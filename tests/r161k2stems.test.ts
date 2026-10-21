// r16.1（游戏美术）：中班 4 张题干配图 public/images/k2/stems/；题库审核会把这 4 题的 question_image 填成 images/k2/stems/<文件>（不手改题库）
import { it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadBank, validateQuestion } from '../src/game/questions';
import { parseImage } from '../src/game/shapes';
const STEMS: Record<string, string> = { 'K2N-011': 'K2N-011_stem_train_before9.webp', 'K2N-010': 'K2N-010_stem_train_after7.webp', 'K2N-012': 'K2N-012_stem_train_1to10.webp', 'K2N-014': 'K2N-014_stem_kids_count_off.webp' };
const raw = JSON.parse(readFileSync('public/banks/bank_K2.json', 'utf8'));
/** WebP 宽高（VP8 / VP8L / VP8X 三种头） */
function webpSize(b: Buffer): [number, number] {
  const t = b.subarray(12, 16).toString();
  if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (t === 'VP8L') { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}
it('4 张图在 public/images/k2/stems/（构建会原样拷进 dist，离线包从 dist 打）；r17 新版：1024 宽横图 WebP（高宽比 0.3–0.6）', () => {
  for (const f of Object.values(STEMS)) { const p = `public/images/k2/stems/${f}`; expect(existsSync(p), p).toBe(true); const b = readFileSync(p);
    expect(b.subarray(0, 4).toString()).toBe('RIFF'); expect(b.subarray(8, 12).toString()).toBe('WEBP');
    const [w, h] = webpSize(b); expect(w, f).toBe(1024); expect(h / w, f).toBeGreaterThan(0.3); expect(h / w, f).toBeLessThan(0.6); }
});
it('r17 C5：可重跑的拷贝脚本管这 4 张（K2N-014 用当前版，不是 alt）', () => {
  const s = readFileSync('scripts/copy-kinder-art.mjs', 'utf8');
  for (const f of Object.values(STEMS)) expect(s).toContain(`'${f}'`);
  expect(s).not.toMatch(/K2N-014[^'\n]*alt[^'\n]*\.webp'/);
});
it('r17 C5：题干配图放宽到约气泡宽 60%（只管 images/k2/stems/，其它题干图仍是 22vh 上限）', () => {
  const css = readFileSync('src/app.css', 'utf8');
  expect(css).toContain('.q-img{display:block;max-height:22vh;');
  expect(css).toMatch(/\.kbubble \.q-img\[src\*="k2\/stems\/"\]\{max-width:76%;max-height:28dvh/);
  expect(css).toMatch(/\.kbubble \.kq:has\(>\.q-img\[src\*="k2\/stems\/"\]\)\{flex:1 1 auto/);
});
it('离线：Service Worker 预缓存包含 images/k2/（webp 在 globPatterns，images/k2 不在 globIgnores）', () => {
  const v = readFileSync('vite.config.ts', 'utf8'); expect(v).toMatch(/globPatterns: \['\*\*\/\*\.\{[^}]*webp/); expect(v).not.toMatch(/globIgnores:[^\]]*images\/k2/);
});
it('题库填上 question_image 后：合法、路径能找到（「缺图」检查同 r16k2images 的规则）', () => {
  const qs = raw.questions.map((q: any) => STEMS[q.id] ? { ...q, question_image: `images/k2/stems/${STEMS[q.id]}` } : q);
  const hit = qs.filter((q: any) => STEMS[q.id]); expect(hit.map((q: any) => q.id).sort()).toEqual(Object.keys(STEMS).sort());
  for (const q of hit) expect(validateQuestion(q, 'K2'), q.id).toEqual([]);
  const all = loadBank({ ...raw, questions: qs }, 'bank_K2.json').all.filter(q => STEMS[q.id]);
  for (const q of all) { const p = parseImage(q.question_image!); expect(p.kind, q.id).toBe('path'); if (p.kind === 'path') expect(existsSync('public/' + p.src.replace(/^\.\//, '')), q.id).toBe(true); }
});
it('中班题干渲染：有 question_image 时画出图片', async () => {
  const { QImage } = await import('../src/ui/QImage');
  const h = renderToStaticMarkup(createElement(QImage, { image: 'images/k2/stems/K2N-014_stem_kids_count_off.webp', cls: 'q-img', fallback: null }));
  expect(h).toMatch(/<img[^>]+K2N-014_stem_kids_count_off\.webp/);
});
it('题库 v48 已填好：4 题的 question_image 正是 public/images/k2/stems/ 里的文件', () => {
  const got = Object.fromEntries(raw.questions.filter((q: any) => STEMS[q.id]).map((q: any) => [q.id, q.question_image]));
  expect(got).toEqual(Object.fromEntries(Object.entries(STEMS).map(([id, f]) => [id, `images/k2/stems/${f}`])));
  for (const p of Object.values(got) as string[]) expect(existsSync('public/' + p), p).toBe(true);
});
