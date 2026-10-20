// r16.1 (h)：章 / 关显示名不能在括号里的「·」处截断（地图曾显示「病句）」「毛泽东诗词）」）；关卡 id 不变
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters, shortUnit } from '../src/game/levels';
const bal = (s?: string) => { if (!s) return true; let d = 0; for (const c of s) { if (c === '（' || c === '(') d++; if (c === '）' || c === ')') { d--; if (d < 0) return false; } } return d === 0; };
describe('r16.1 章节标题不截断', () => {
  it('shortUnit 不拆括号里的「·」', () => {
    expect(shortUnit('七上·基础积累（字词·病句）')).toBe('基础积累（字词·病句）');
    expect(shortUnit('高一·拓展（课外·毛泽东诗词）')).toBe('拓展（课外·毛泽东诗词）');
    expect(shortUnit('六下·古诗《清平乐·村居》')).toBe('古诗《清平乐·村居》');
    expect(shortUnit('七上·第2章 有理数·2.2 数轴')).toBe('2.2 数轴');
  });
  const files = readdirSync('public/banks').filter(f => /^bank_.*\.json$/.test(f));
  it('全题库：章名 / 关名 / 单元括号配对', () => {
    expect(files.length).toBeGreaterThan(5);
    const bad: string[] = []; let n = 0;
    for (const f of files) { const all = loadBank(JSON.parse(readFileSync('public/banks/' + f, 'utf8')), f).all;
      for (const c of buildChapters(playable(all, false), null, all)) { if (!bal(c.name)) bad.push(`${f} 章 ${c.name}`);
        for (const l of c.levels) { n++; for (const v of [l.name, l.unit]) if (!bal(v)) bad.push(`${f} ${l.id} ${v}`); } } }
    expect(n).toBeGreaterThan(100); expect(bad).toEqual([]);
  });
  it('关卡 id 不变（初一 / 高一这两关）', () => {
    for (const [f, id, nm] of [['bank_7.json', '语文|N|7:Y7-003', '基础积累（字词·病句）'], ['bank_10.json', '语文|N|10:Y10-025', '拓展（课外·毛泽东诗词）']]) {
      const all = loadBank(JSON.parse(readFileSync('public/banks/' + f, 'utf8')), f).all;
      const lv = buildChapters(playable(all, false), null, all).flatMap(c => c.levels).find(l => l.id === id);
      expect(lv?.name).toBe(nm);
    }
  });
});
