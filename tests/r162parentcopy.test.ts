// r16.2 较真家长 文案（便宜的几条）：verify 不数次数；上限写成时长；加时取消后首页 / 地图写「加时已取消」；名字 8 字计数；F5 提示不重复
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const P = readFileSync('src/ui/Parent.tsx', 'utf8'), A = readFileSync('src/App.tsx', 'utf8'), S = readFileSync('src/ui/Screens.tsx', 'utf8');
it('「这一步输错不计次数」的确认页不再显示「（第 N 次）」（首次设置 + 修改密码两处）', () => {
  expect(P.match(/hint="确认记住了（这一步输错不计次数）"/g)?.length).toBe(2);
  expect(P).not.toMatch(/（第 \$\{vTry\.current\} 次）/); expect(P.match(/可以再试一次，或点「重新设置」。`\); \}\}/g)?.length).toBe(2);
});
