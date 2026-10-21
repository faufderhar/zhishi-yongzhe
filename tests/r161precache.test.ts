// r16.1：题库文件都要进 PWA 预缓存（离线能玩）。v48 的 bank_8.json 4.3MB 超过了原来的 4MB 上限 → npm run build 失败。
// 以后导入题库变大时，这里先报错（而不是发版构建时才发现）
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const cfg = readFileSync('vite.config.ts', 'utf8');
const m = cfg.match(/maximumFileSizeToCacheInBytes: (\d+) \* 1024 \* 1024/);
const LIMIT = Number(m?.[1]) * 1024 * 1024;
describe('r16.1 题库预缓存上限', () => {
  it('上限是 6MB，题库没被 globIgnores 排除', () => {
    expect(LIMIT).toBe(6 * 1024 * 1024);
    expect(cfg).toMatch(/globPatterns: \['\*\*\/\*\.\{[^}]*json[^}]*\}'(, '[^']+')*\]/);   // r17：后面多了一个单独的 mp3（期末庆祝乐句）
    expect(cfg.match(/globIgnores: \[([^\]]*)\]/)?.[1]).not.toMatch(/banks/);
  });
  it('每个 public/banks 文件都小于上限（留 15% 余量）', () => {
    const big = readdirSync('public/banks').filter(f => f.endsWith('.json')).map(f => [f, statSync('public/banks/' + f).size] as const).filter(([, n]) => n > LIMIT * 0.85);
    expect(big).toEqual([]);
  });
});
