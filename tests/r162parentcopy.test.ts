// r16.2 较真家长 文案（便宜的几条）：verify 不数次数；上限写成时长；加时取消后首页 / 地图写「加时已取消」；名字 8 字计数；F5 提示不重复
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fmtDur, cancelLeftLine, cancelBonus, addBonus } from '../src/game/playtime';
const P = readFileSync('src/ui/Parent.tsx', 'utf8'), A = readFileSync('src/App.tsx', 'utf8'), S = readFileSync('src/ui/Screens.tsx', 'utf8');
it('「这一步输错不计次数」的确认页不再显示「（第 N 次）」（首次设置 + 修改密码两处）', () => {
  expect(P.match(/hint="确认记住了（这一步输错不计次数）"/g)?.length).toBe(2);
  expect(P).not.toMatch(/（第 \$\{vTry\.current\} 次）/); expect(P.match(/可以再试一次，或点「重新设置」。`\); \}\}/g)?.length).toBe(2);
});
it('时长写成「9 分 16 秒」而不是像钟点的「9:16」', () => {
  expect([0, 7, 60, 556, 900, 3600, 3900, 5400 + 59].map(fmtDur)).toEqual(['0 秒', '7 秒', '1 分钟', '9 分 16 秒', '15 分钟', '1 小时', '1 小时 5 分', '1 小时 30 分']);
  const D = '2026-10-19'; const c = cancelBonus({ [D]: { used: 829, bonus: 600 } } as never, D, 300);
  const t = cancelLeftLine(c[D], 300, 0)!; expect(t).not.toMatch(/\d:\d\d/); expect(t).not.toMatch(/按今天上限/); expect(t).toMatch(/今天的上限是 \d+ 分/);
  expect(P).toMatch(/今天上限 \{cancelled \? fmtDur\(m \* 60\) : fmtDur\(base\)\}/);
});
it('在家长设置里 F5：提示不再说两遍「页面被重新加载了」', () => {
  expect(A).toMatch(/if \(inParent\) setExitNote\(parentReloadNote\(cause0\.kind\)\)/);
  const tpl = A.match(/const parentReloadNote = \(kind: string\) => `([^`]*)`/)![1];
  const reload = A.match(/reload: '([^']*)'/)![1];
  const note = tpl.replace(/\$\{CAUSE_TEXT\[kind\] \?\? '页面被重新加载了'\}/, reload);
  expect(note).toBe('刚才在家长设置里：页面被重新加载了（下拉刷新或浏览器重载）。请重新进入家长设置。');
  expect(note.split('重新加载').length - 1).toBe(1);
});
