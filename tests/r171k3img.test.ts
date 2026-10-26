/* r17.1 B4：大班配图——/workspace/art/k3/{objects,stems}/*.webp 整目录拷到 public/images/k3/（copy-kinder-art.mjs 第 4 段，题库 v43 配合说明 §1）；
   K3C-022 / K3C-023 题图用内置形状键（红圆 / 蓝方，v43 §2），走 QImage → shapes.ts SVG，不找文件 */
import { it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QImage } from '../src/ui/QImage';
import { parseImage, COLORS } from '../src/game/shapes';
import { boxPath, missing } from './boxSrc';
type Q = { id: string; question_image?: string; options?: { image?: string }[] };
const K3: Q[] = JSON.parse(readFileSync('public/banks/bank_K3.json', 'utf8')).questions;
const refs = K3.flatMap(q => [q.question_image, ...(q.options ?? []).map(o => o.image)].filter((x): x is string => !!x).map(r => ({ id: q.id, r })));
it('大班题库里的每张图片路径在 public/ 下都有文件（不是形状键的都是 images/k3/{objects,stems}/*.webp）', () => {
  const paths = refs.filter(x => !x.r.startsWith('image:'));
  expect(paths.length).toBeGreaterThan(200);
  const bad = paths.filter(x => !/^images\/k3\/(objects|stems)\/[^/]+\.webp$/.test(x.r) || !existsSync('public/' + x.r)).map(x => `${x.id} ${x.r}`);
  expect(bad).toEqual([]);
  for (const d of ['objects', 'stems']) for (const f of readdirSync(`public/images/k3/${d}`)) { expect(f).toMatch(/\.webp$/); expect(readFileSync(`public/images/k3/${d}/${f}`).subarray(8, 12).toString(), f).toBe('WEBP'); }
});
it('大班形状键都是 shapes.ts 认得的形状 + 颜色（不会画成灰色问号）', () => {
  const keys = [...new Set(refs.filter(x => x.r.startsWith('image:')).map(x => x.r))];
  expect(keys.length).toBeGreaterThanOrEqual(13);
  for (const k of keys) { const p = parseImage(k); expect(p.kind === 'shape' && p.known, k).toBe(true); }
});
it('K3C-022 题图 = 红色圆、K3C-023 题图 = 蓝色正方形，按战斗气泡的写法（cls=q-img，无兜底）渲染成内置 SVG', () => {
  const want: Record<string, [string, string, RegExp]> = { 'K3C-022': ['image:shape_circle?color=red', COLORS.red, /<circle /], 'K3C-023': ['image:shape_square?color=blue', COLORS.blue, /<rect /] };
  for (const [id, [key, fill, el]] of Object.entries(want)) {
    const q = K3.find(x => x.id === id)!; expect(q.question_image).toBe(key);
    const html = renderToStaticMarkup(createElement(QImage, { image: q.question_image, cls: 'q-img', fallback: null }));
    expect(html).toMatch(/class="q-img shape-img"/); expect(html).toMatch(el); expect(html).toContain(`fill="${fill}"`); expect(html).not.toMatch(/<img/);
  }
});
it('开发机：public/images/k3 和 art/k3 一一对应（新拷、没有多余旧图）；拷贝脚本再跑一次 = 都已一样', ({ skip }) => {
  skip(missing(boxPath('art/k3/objects'), boxPath('art/k3/stems')).length > 0, '开发机美术源不在（CI）');
  for (const d of ['objects', 'stems']) {
    const src = readdirSync(boxPath(`art/k3/${d}`)).filter(f => f.endsWith('.webp')).sort(); expect(readdirSync(`public/images/k3/${d}`).sort()).toEqual(src);
    for (const f of src) expect(readFileSync(`public/images/k3/${d}/${f}`).equals(readFileSync(boxPath(`art/k3/${d}/${f}`))), f).toBe(true);
  }
  expect(execFileSync('node', ['scripts/copy-kinder-art.mjs', '--dry'], { encoding: 'utf8' })).toMatch(/拷贝 0 个/);
});
it('拷贝脚本：大班源目录不在（CI）→ WARN、拷贝 0 个', () => {
  const so = execFileSync('node', ['scripts/copy-kinder-art.mjs', '--dry'], { env: { ...process.env, ZY_BOX_ROOT: '/nonexistent-box' }, encoding: 'utf8' });
  expect(so).toMatch(/WARN 大班配图源目录不在/); expect(so).toMatch(/拷贝 0 个/);
});
