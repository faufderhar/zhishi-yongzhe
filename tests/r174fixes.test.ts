// r17.4 本地小修：HUD 回合语义 / 安装提示与翻译条 / 找回问题全角？ / 题卡「减 ×0.9」/ 练习关 Q 版小乌云 / 庆祝关结尾布局
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { negText } from '../src/game/dmgText';
import { hintQText, HINT_QUESTIONS } from '../src/game/pin';
const rd = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
describe('1A HUD：「第 x 回合（最多 y）」，不再写成「第 x/y」像进度', () => {
  const rb = rd('src/ui/RoundBattle.tsx');
  it('HUD 文案', () => {
    expect(rb).toMatch(/第 \{curTurn\} 回合/); expect(rb).toMatch(/（最多 \{bs\.cap\}）/); expect(rb).toMatch(/aria-label=\{`第 \$\{curTurn\} 回合，最多 \$\{Math\.min\(bs\.cap, maxTurns\)\} 回合`\}/);
    expect(rb).not.toMatch(/第 \{curTurn\}\/\{/);
  });
});
describe('1B 安装提示和浏览器翻译条', () => {
  it('index.html 声明不翻译（Chrome 不再弹翻译条盖住右上角安装提示，也不改 React 文字）', () => {
    const h = rd('index.html'); expect(h).toMatch(/<html lang="zh-CN" translate="no" class="notranslate">/); expect(h).toMatch(/<meta name="google" content="notranslate"/);
  });
});
describe('1C 找回问题全角「？」', () => {
  it('hintQText', () => {
    for (const q of HINT_QUESTIONS) expect(hintQText(q)).toBe(q);
    expect(hintQText(' 我家狗叫什么? ')).toBe('我家狗叫什么？'); expect(hintQText('我家狗叫什么??')).toBe('我家狗叫什么？'); expect(hintQText('我家狗叫什么？?')).toBe('我家狗叫什么？');
    expect(hintQText('我家狗的名字')).toBe('我家狗的名字');
  });
  it('保存 / 显示都过 hintQText', () => {
    const p = rd('src/ui/Parent.tsx'); expect(p).not.toMatch(/q: hq\.trim\(\)/); expect((p.match(/hintQText\(/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
describe('2 题卡底部减益：卡自己的名字不重复 →「减 ×0.9」', () => {
  const neg = [{ name: '轻击卡', m: 0.9 }] as Parameters<typeof negText>[0];
  it('negText', () => {
    expect(negText(neg)).toBe('减：轻击卡 ×0.9'); expect(negText(neg, '轻击卡')).toBe('减 ×0.9');
    const two = [...neg, { name: '虚弱', m: 0.8 }] as Parameters<typeof negText>[0];
    expect(negText(two, '轻击卡')).toBe('减：×0.9 · 虚弱 ×0.8'); expect(negText([], '轻击卡')).toBe('');
  });
  it('卡上的 DmgSum 传 onCard；窄卡上减益行可以换行（不截断）', () => {
    expect(rd('src/ui/RoundBattle.tsx')).toMatch(/<DmgSum[^>]*onCard/); expect(rd('src/ui/DmgSum.tsx')).toMatch(/negText\(s\.neg, onCard \? d\.card\?\.name : undefined\)/);
    expect(rd('src/app.css')).toMatch(/\.card-pick \.qcard \.dmg-sum-line\{white-space:normal;overflow:visible/);
  });
});
describe('4 练习关小乌云 = Q 版（和正式题一样）', () => {
  it('Tutorial / 地图瞌睡提示不再用旧扁平 MONSTER_IMG.kinder', () => {
    const t = rd('src/ui/Tutorial.tsx'); expect(t).not.toMatch(/import \{[^}]*MONSTER_IMG/); expect(t).not.toMatch(/MONSTER_IMG\.kinder\}/); expect(t).toMatch(/qbanUrl\(QBAN_CLOUD/);
    expect(rd('src/ui/Screens.tsx')).not.toMatch(/MONSTER_IMG\.kinder/);
  });
});
describe('5 庆祝关结尾布局', () => {
  it('结尾时题干气泡淡出（data-term-end，不改 kbattle 的 class，免得冲掉 ktight）', () => {
    expect(rd('src/ui/Battle.tsx')).toMatch(/className="kbattle" data-term-end=\{term && ended \? '1' : undefined\}/);
    const c = rd('src/app.css'); expect(c).toMatch(/\.kbattle\[data-term-end\] \.ktop>\.kbubble\{opacity:0;visibility:hidden/);
    expect(c).toMatch(/\.result-screen:has\(>p\.warn\) \.row\.friends\.kterm-res img\.kterm-res-medal/);
  });
});
