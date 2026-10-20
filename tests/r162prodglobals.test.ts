// r16.2 技术QA B3：window.__zyPaused / __zyRestoring（还有 __zyRotate / __zyInactive）改成模块内变量；CI 查生产包里任何 window.__zy* 全局
import { it, expect } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-expect-error 纯 JS 脚本
import { scanGlobals } from '../scripts/check-prod-globals.mjs';
import * as RF from '../src/runtimeFlags';
const walk = (d: string): string[] => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []; });
it('扫描：赋值 / 方括号 / defineProperty / 只是读取都报；干净的包不报', () => {
  const d = mkdtempSync(join(tmpdir(), 'zyglob-')); mkdirSync(join(d, 'assets'));
  const f = join(d, 'assets', 'a.js');
  for (const [src, assigns] of [['x=1;window.__zyPaused=1', ['__zyPaused']], ['window["__zyRestoring"]=!0', ['__zyRestoring']], ['Object.defineProperty(window,"__zyFoo",{get(){}})', ['__zyFoo']], ['globalThis.__zyBar+=1', ['__zyBar']], ['if(window.__zyRotate)f()', []]] as const) {
    writeFileSync(f, src); const h = scanGlobals(d); expect(h.length, src).toBe(1); expect(h[0].assigns, src).toEqual(assigns); expect(h[0].names.length, src).toBeGreaterThan(0);
  }
  writeFileSync(f, 'const zyVoice="zy-voice";window.zyTab=1;var __z=1;caches.match("./__zy_pin__")'); expect(scanGlobals(d)).toEqual([]);   // Cache Storage 键不是全局
  writeFileSync(f, 'window.__zy_x=1'); expect(scanGlobals(d)[0]?.assigns).toEqual(['__zy_x']); writeFileSync(f, 'x=1');
  writeFileSync(join(d, 'x.png'), '__zyPaused'); expect(scanGlobals(d)).toEqual([]);   // 只看代码文件
});
it('CI：check-prod-hooks 之后跑 check-prod-globals', () => {
  const y = readFileSync('.github/workflows/deploy.yml', 'utf8');
  expect(y).toMatch(/- run: node scripts\/check-prod-hooks\.mjs dist\n(?:\s*#.*\n)?\s+- run: node scripts\/check-prod-globals\.mjs dist\n/);
  expect(y.indexOf('check-prod-globals')).toBeLessThan(y.indexOf('upload-pages-artifact'));
});
it('源码：没有 __zyPaused / __zyRestoring / __zyRotate / __zyInactive 读写（注释除外）；其他 window.__zy* 是否只在测试构建，由生产包检查守着（下面 + CI）', () => {
  const bad: string[] = [];
  for (const p of walk('src')) { const code = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (/__zy(Paused|Restoring|Rotate|Inactive)\b/.test(code)) bad.push(p); }
  expect(bad).toEqual([]);
});
it('runtimeFlags：开关是模块变量；恢复期 15 秒后自动结束', async () => {
  const { vi } = await import('vitest'); vi.useFakeTimers();
  RF.setBattlePaused(true); expect(RF.battlePaused()).toBe(true); RF.setBattlePaused(false); expect(RF.battlePaused()).toBe(false);
  RF.setRotateLock(true); expect(RF.rotateLock()).toBe(true); RF.setRotateLock(false);
  RF.beginRestoring(15e3); expect(RF.isRestoring()).toBe(true); vi.advanceTimersByTime(14_999); expect(RF.isRestoring()).toBe(true); vi.advanceTimersByTime(2); expect(RF.isRestoring()).toBe(false);
  expect((globalThis as any).__zyPaused).toBeUndefined(); expect((globalThis as any).__zyRestoring).toBeUndefined();
  vi.useRealTimers();
});
