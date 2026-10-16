/* r10：时长把关覆盖所有答题入口（较真家长 SEVERE）；幼儿园解锁规则不变 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isUnlocked } from '../src/game/levels';
import type { Level } from '../src/game/levels';
const app = readFileSync('src/App.tsx', 'utf8');

describe('时长限制：所有答题入口', () => {
  const answerScreens = JSON.parse(app.match(/const ANSWER_SCREENS = (\[[^\]]*\])/)![1].replace(/'/g, '"')) as string[];
  // 渲染答题组件的界面（关卡战斗三种 + 复习/错题练习）
  const rendering = new Set<string>();
  for (const m of app.matchAll(/<(KinderBattle|RoundBattle|Battle|ReviewSession)\b/g)) { const before = app.slice(0, m.index); const all = [...before.matchAll(/screen\.s === '([a-z-]+)'/g)]; rendering.add(all[all.length - 1][1]); }
  it('入口清单：battle（地图关卡 / 再玩一次 / 中断恢复 / 深链）、review（今日复习 / 错题本「练习这些」「复习到期」）', () => {
    expect([...rendering].sort()).toEqual(['battle', 'review']);
    for (const s of rendering) expect(answerScreens).toContain(s);
  });
  it('进入答题界面统一检查剩余时间，用完回地图并提示', () => {
    expect(app).toMatch(/ANSWER_SCREENS\.includes\(screen\.s\) && myRemaining <= 0[^\n]*setScreen\(\{ s: 'map' \}\)/);
  });
  it('错题本 / 今日复习走 startReview，也先检查时间', () => {
    expect(app).toMatch(/const startReview = [^\n]*myRemaining <= 0/);
    expect((app.match(/onReview=\{[^\n]*startReview/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
  it('局中到时：3 分钟收尾后强制结算', () => { expect(app).toMatch(/FORCE_END\)\), 3 \* 60e3/); });
});

describe('幼儿园解锁规则（不变）', () => {
  const L = (id: string, unit: string, kind: Level['kind'] = 'normal') => ({ id, unit, volume: '小班', kind } as unknown as Level);
  const lv = [L('a1', '数到5'), L('a2', '数到5'), L('a3', '数到5', 'elite'), L('b1', '数到10'), L('b2', '数到10')];
  it('每课第 1 关开放，课内按顺序解锁', () => {
    expect(isUnlocked(lv, 0, {})).toBe(true); expect(isUnlocked(lv, 3, {})).toBe(true);
    expect(isUnlocked(lv, 1, {})).toBe(false); expect(isUnlocked(lv, 1, { a1: 1 })).toBe(true);
    expect(isUnlocked(lv, 2, { a1: 1 })).toBe(false); expect(isUnlocked(lv, 2, { a1: 1, a2: 1 })).toBe(true);
  });
});
