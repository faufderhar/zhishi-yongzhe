// r16 2f：中班题库引用的图片都在 public/images/k2/（objects + shapes 从 /workspace/art/k2 复制）；image:shape_* 键都能渲染
import { it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { loadBank, playable } from '../src/game/questions';
import { parseImage } from '../src/game/shapes';
it('K2 可玩题的题图 / 选项图都存在或是已知形状', () => {
  const all = loadBank(JSON.parse(readFileSync('public/banks/bank_K2.json', 'utf8')), '').all;
  const refs = playable(all, false).flatMap(q => [q.question_image, ...q.options.map(o => o.image)]).filter(Boolean) as string[];
  expect(refs.length).toBeGreaterThan(100);
  for (const r of refs) {
    const p = parseImage(r);
    if (p.kind === 'shape') expect(p.known, r).toBe(true);
    else if (p.kind === 'path') expect(existsSync('public/' + p.src.replace(/^\.\//, '')), r).toBe(true);
  }
});
