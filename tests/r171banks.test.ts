// r17.1 B：大班 K3 / 初三 9 / 高三 12 的题库用 scripts/import-bank.py 导入（v57，不手改）；需家长确认的题不进游戏
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const raw = (g: string) => JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')) as { version: string; questions: { id: string; status: string }[] };
describe('r17.1 新年级题库', () => {
  it('v57；题量 大班 335 / 初三 2073 / 高三 2703；没有需家长确认的题', () => {
    for (const [g, n] of [['K3', 335], ['9', 2073], ['12', 2703]] as const) {
      const b = raw(g); expect(b.version, g).toBe('v57'); expect(b.questions.length, g).toBe(n);
      expect(b.questions.filter(q => q.status === '需家长确认').map(q => q.id), g).toEqual([]);
    }
  });
  it('K3C-007（镜像 / 左右，待家长确认）、K3C-013、P12-215/216 不进游戏；M9-407～430 在 v47 已解除确认，照常导入', () => {
    const ids = (g: string) => new Set(raw(g).questions.map(q => q.id));
    for (const i of ['K3C-007', 'K3C-013']) expect(ids('K3').has(i), i).toBe(false);
    for (const i of ['P12-215', 'P12-216']) expect(ids('12').has(i), i).toBe(false);
    const m9 = Array.from({ length: 24 }, (_, k) => `M9-${407 + k}`);
    expect(m9.filter(i => !ids('9').has(i))).toEqual([]);
    expect(raw('9').questions.filter(q => m9.includes(q.id)).every(q => q.status === 'AI初审通过')).toBe(true);
  });
});
