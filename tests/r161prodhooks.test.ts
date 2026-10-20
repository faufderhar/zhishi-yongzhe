// r16.1 (j)(k)：CI 在部署前查生产包里的测试钩子名；__zyAdj / __zyRepeats / __zyLastSkill 只在测试包
import { it, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-expect-error 纯 JS 脚本
import { HOOKS, scan } from '../scripts/check-prod-hooks.mjs';
it('名单完整', () => {
  for (const h of ['__zyForceQ', '__zyTest', '__zyUnlockAll', '__zyRecLog', '__zyMissLog', '__zyGraceMs', '__zyAudioLog', '__zyPrio', '__zyTestMonHp', '__zyBossLog', '__zyAdj', '__zyRepeats', '__zyLastSkill']) expect(HOOKS).toContain(h);
});
it('扫描：有钩子名报出来；没有就空', () => {
  const d = mkdtempSync(join(tmpdir(), 'zyhooks-')); mkdirSync(join(d, 'assets')); writeFileSync(join(d, 'assets', 'a.js'), 'x=1;window.__zyAdj=2;window.__zyTestBetPop=1'); writeFileSync(join(d, 'b.png'), '__zyTest');
  const h = scan(d); expect(h.length).toBe(1); expect(h[0][1].sort()).toEqual(['__zyAdj', '__zyTest']);
  writeFileSync(join(d, 'assets', 'a.js'), 'x=1;window.__zyPaused=1'); expect(scan(d)).toEqual([]);
});
it('CI：npm test 用 UTC；构建后跑 check-prod-hooks', () => {
  const y = readFileSync('.github/workflows/deploy.yml', 'utf8');
  expect(y).toMatch(/- run: npm test\n\s+env:\n\s+TZ: UTC/); expect(y).toMatch(/- run: npm run build\n(?:\s*#.*\n)?\s+- run: node scripts\/check-prod-hooks\.mjs dist/);
});
it('源码：三个钩子都在 __TEST_HOOKS__ 后面', () => {
  const rb = readFileSync('src/ui/RoundBattle.tsx', 'utf8'), b = readFileSync('src/ui/Battle.tsx', 'utf8');
  expect(rb).toMatch(/if \(__TEST_HOOKS__\) w\.__zyAdj =/); expect(rb).toMatch(/if \(__TEST_HOOKS__\) w\.__zyRepeats =/); expect(b).toMatch(/if \(__TEST_HOOKS__\) \(window as unknown as \{ __zyLastSkill/);
});
