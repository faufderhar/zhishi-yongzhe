// r16 第 6 步（小萌新）：结算页按钮带图标、第 3 次不加星有图和原因、「自己答对 N 题」画成星星、新句都登记了录音提示
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ResultScreen } from '../src/ui/Screens';
import { BANDS } from '../src/game/grades';
import { PUPS } from '../src/game/characters';
import { VOICE_PROMPTS, PROMPT_BY_TEXT } from '../src/game/voicePrompts';
import { K_NOSTAR_WHY, K_FIRST_LINE } from '../src/game/playtime';

const base = { cfg: BANDS.K, c: PUPS[0], win: true, stars: 2, correct: 3, total: 4, newlyMastered: 0, timeUp: false, onAgain() {}, onMap() {} };
const html = (p: object) => renderToStaticMarkup(createElement(ResultScreen, { ...base, ...p } as never));

describe('r16 小萌新 结算页', () => {
  it('按钮带图标，放在 result-actions 里', () => {
    const h = html({ kinder: { first: 2, retry: 1, demo: 0 } });
    expect(h).toContain('data-testid="result-actions"');
    expect(h).toMatch(/class="bicon"[^>]*>🔁<\/span>再玩一次/);
    expect(h).toMatch(/class="bicon"[^>]*>🗺️<\/span>回地图/);
  });
  it('「自己答对 N 题」画成 N 颗星，可点朗读', () => {
    const h = html({ kinder: { first: 3, retry: 0, demo: 1 } });
    const m = h.match(/data-testid="result-k-first"[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(m).toContain('⭐⭐⭐'); expect(m).not.toContain('⭐⭐⭐⭐'); expect(m).toContain(K_FIRST_LINE(3));
    expect(html({ kinder: { first: 0, retry: 2, demo: 0 } })).not.toContain('result-k-first');
  });
  it('第 3 次不加星：有 1 2 3 ➜ 🌙 ➜ ⭐ 的图和原因（无障碍文字）', () => {
    const h = html({ capped: true, playN: 3, stars: 0, kinder: { first: 2, retry: 0, demo: 0 } });
    expect(h).toContain('data-testid="result-k-why"'); expect(h).toContain(`aria-label="${K_NOSTAR_WHY}"`);
    expect(h).not.toContain('result-capped');
  });
  it('新句都登记为提示语（录音 key 可查）', () => {
    expect(VOICE_PROMPTS.res_k_why).toBe(K_NOSTAR_WHY);
    for (let n = 1; n <= 10; n++) expect(PROMPT_BY_TEXT[K_FIRST_LINE(n)]).toBe(`res_k_first_${n}`);
  });
  it('锁住的关：给要先打的那关加 lock-target + 👆（代码存在，样式存在）', () => {
    const src = readFileSync('src/ui/Screens.tsx', 'utf8'), css = readFileSync('src/app.css', 'utf8');
    expect(src).toMatch(/setLockHint\(miss\[0\]\.id\)/); expect(src).toContain('data-testid="lock-hint"');
    expect(css).toContain('.level.lock-target'); expect(css).toMatch(/\.result-actions\{position:sticky/);
  });
});
