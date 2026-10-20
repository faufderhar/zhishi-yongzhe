// r16.1 (a)：结算页在 600 / 610 / 700 / 800 高放得下（e2e：scripts/r161-reslayout.mjs）；这里守住 CSS 规则不被删
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
it('结算页矮屏收紧规则在', () => {
  const c = readFileSync('src/app.css', 'utf8');
  expect(c).toMatch(/@media \(min-height:481px\) and \(max-height:720px\)\{\.result-screen\{gap:8px/);
  expect(c).toMatch(/@media \(min-height:721px\) and \(max-height:860px\)\{\.result-screen\{gap:14px/);
  expect(c).toMatch(/\.result-actions\{position:sticky/); expect(readFileSync('src/ui/Screens.tsx', 'utf8')).toMatch(/className="center-screen result-screen"/);
});
