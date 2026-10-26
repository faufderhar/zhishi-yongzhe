// r17.1 学霸 r17-12：节名里的中文引号（v50 高三物理 5.5「5 “基本”粒子」）回归
//   已知限制：splitDot 不做引号配对（引号不成对时会吞掉后面所有分段，风险更大），所以「·」放在中文引号里会被拆开——
//   现在全题库没有这种节名；将来出现时这里的构造样例提醒（按现规则会拆）。
import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { boxPath, missing } from './boxSrc';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters, splitDot, shortUnit } from '../src/game/levels';

const bank = (f: string) => loadBank(JSON.parse(readFileSync(`public/banks/${f}`, 'utf8')), '');

it('高三物理「5 “基本”粒子」：关名完整、id 物理|N|12:P12-269 不变、章名「第五章 原子核」', () => {
  const b = bank('bank_12.json'); const chs = buildChapters(playable(b.all, false), null, b.all);
  const ls = chs.flatMap(c => c.levels).filter(l => /[“”]/.test(l.name + l.unit));
  expect(ls.map(l => [l.id, l.name, l.unit, l.volume, l.kind])).toEqual([['物理|N|12:P12-269', '5 “基本”粒子', '第五章 原子核', '选择性必修第三册', 'normal']]);
  expect(shortUnit('选择性必修三·第五章 原子核·5 “基本”粒子')).toBe('5 “基本”粒子');
});
it('关卡对照_v50 第 86 行能对上（box 上才有）', () => {
  const f = boxPath('questions/关卡对照_v50.csv'); if (missing(f).length) return;
  const r = readFileSync(f, 'utf8').split('\n')[85].split(',');
  expect([r[0], r[3], r[4], r[5], r[7]]).toEqual(['高三', '选择性必修第三册', '第五章 原子核', '5 “基本”粒子', '物理|N|P12-269']);
});
it('全题库：unit 里带中文引号的节，关名 / 显示名都保留完整引号段（不被截断）', () => {
  let n = 0;
  for (const f of readdirSync('public/banks').filter(f => /^bank_.*\.json$/.test(f))) {
    for (const u of new Set(bank(f).all.map(q => q.unit).filter((u): u is string => !!u && /[“”]/.test(u)))) {
      n++; const last = u.split('·').pop()!;
      expect(last.split('“').length, u).toBe(last.split('”').length);   // 引号在最后一段里成对，没有「·」在引号里
      expect(shortUnit(u), u).toContain(last.replace(/^第[一二三四五六七八九十\d]+(?:单元|[章课节])\s*/, ''));
    }
  }
  expect(n).toBeGreaterThanOrEqual(9);
});
it('已知限制（构造样例）：「·」在中文引号里 → splitDot 按现规则会拆', () => {
  expect(splitDot('选择性必修三·第一章 测试·1 “甲·乙”粒子')).toEqual(['选择性必修三', '第一章 测试', '1 “甲', '乙”粒子']);
  // 显示名 shortUnit 目前碰巧不受影响：r16.2 起把最后一个层级段之后的各段用「·」接回去
  expect(shortUnit('选择性必修三·第一章 测试·1 “甲·乙”粒子')).toBe('1 “甲·乙”粒子');
});
