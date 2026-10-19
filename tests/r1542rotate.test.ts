// r15.4.2 技术QA P1-1：手机竖屏「请把手机横过来」
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isPhonePortrait } from '../src/ui/Rotate';
import { VOICE_PROMPTS } from '../src/game/voicePrompts';
import { ROTATE_K_TEXT } from '../src/game/playtime';
describe('r15.4.2 竖屏', () => {
  it('手机竖屏（短边 < 600 且竖着）才盖；平板竖屏 / 横屏不盖', () => {
    expect(isPhonePortrait(360, 640)).toBe(true); expect(isPhonePortrait(390, 844)).toBe(true); expect(isPhonePortrait(599, 900)).toBe(true);
    expect(isPhonePortrait(640, 360)).toBe(false); expect(isPhonePortrait(768, 1024)).toBe(false); expect(isPhonePortrait(800, 1280)).toBe(false); expect(isPhonePortrait(600, 960)).toBe(false);
  });
  it('小班录音：提示语已登记，manifest 有 p:rotate_k（zf_002，1.5 倍速），文件在 public/voice（离线下载清单按 manifest 来）', () => {
    expect(VOICE_PROMPTS.rotate_k).toBe(ROTATE_K_TEXT);
    const m = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8')); const f = m.items['p:rotate_k']; expect(f).toMatch(/^p_rotate_k\.[0-9a-f]{10}\.mp3$/);
    expect(m.meta['p:rotate_k']).toMatchObject({ voice: 'zf_002', speed: 1.5, text: ROTATE_K_TEXT }); expect(readFileSync('public/voice/' + f).length).toBeGreaterThan(5000);
  });
  it('盖层期间：战斗暂停（usePauseOnHide 竖屏 → setPaused，横回自动继续）、App 每日计时不走（__zyRotate）', () => {
    const b = readFileSync('src/ui/Battle.tsx', 'utf8'); expect(b).toMatch(/const portrait = usePhonePortrait\(\)/); expect(b).toMatch(/byRot\.current = true; setPaused\(true\)/); expect(b).toMatch(/byRot\.current = false; setPaused\(false\)/);
    expect(b.match(/usePauseOnHide\(setPaused, paused\)/g)!.length).toBe(2); expect(readFileSync('src/ui/RoundBattle.tsx', 'utf8')).toMatch(/usePauseOnHide\(setPaused, paused\)/);
    const a = readFileSync('src/App.tsx', 'utf8'); expect(a).toMatch(/__zyRotate\?: boolean \}\)\.__zyRotate;/); expect(a).toMatch(/phonePortrait && \(screen\.s === 'battle' \|\| screen\.s === 'review'\) && <RotateOverlay/);
  });
});
describe('r15.4.2 最终回归：竖屏提示条不挡点按', () => {
  it('portrait-tip：pointer-events:none；7 秒兜底移除；手机竖屏战斗（有「横过来」盖层）时不出', () => {
    const css = readFileSync('src/app.css', 'utf8'); expect(css).toMatch(/\.portrait-tip\{pointer-events:none;/);
    const a = readFileSync('src/App.tsx', 'utf8'); expect(a).toMatch(/setTimeout\(\(\) => setTipGone\(true\), 7000\)/);
    expect(a).toMatch(/portrait && !tipGone && !\(phonePortrait && \(screen\.s === 'battle' \|\| screen\.s === 'review'\)\) && <div className="portrait-tip"/);
  });
  it('手机横屏（高 ≤ 500）有专门的紧凑排版（键盘 / 选项 / 小班顶栏）', () => {
    const css = readFileSync('src/app.css', 'utf8'); expect(css.match(/@media \(orientation:landscape\) and \(max-height:500px\)\{/g)!.length).toBeGreaterThanOrEqual(3);
    expect(css).toMatch(/\.ktop\{grid-template-columns:auto minmax\(0,1fr\) auto/);
  });
});
