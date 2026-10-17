/* r15.4 华为平板没声音：系统朗读不可用时走录音（题干 / 选项分开，插停顿），都没有就发提示事件 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
const played: { url: string; t: number }[] = []; const events: string[] = [];
beforeAll(() => {
  (globalThis as any).window = globalThis; (globalThis as any).document = { baseURI: 'http://x/app/', visibilityState: 'visible', addEventListener() {} };
  (globalThis as any).addEventListener = () => {}; (globalThis as any).dispatchEvent = (e: any) => { events.push(e.detail); return true; };
  (globalThis as any).CustomEvent = class { type: string; detail: unknown; constructor(t: string, o: any) { this.type = t; this.detail = o?.detail; } };
  (globalThis as any).fetch = vi.fn(async () => ({ ok: true, json: async () => ({ items: { 'K1-001#stem': 'k/K1-001_s.mp3', 'K1-001#opt0': 'k/K1-001_0.mp3', 'K1-001#opt1': 'k/K1-001_1.mp3', 'p:retry': 'p/retry.mp3' } }) }));
  (globalThis as any).Audio = class { src: string; volume = 1; onended?: () => void; onerror?: () => void; constructor(u: string) { this.src = u; } play() { played.push({ url: this.src, t: Date.now() }); setTimeout(() => this.onended?.(), 5); return Promise.resolve(); } pause() {} };
});
describe('r15.4 录音退路', () => {
  it('没有 speechSynthesis：按题干 → 选项播录音，停顿 200 / 100 ms（文件自带头尾静音）', async () => {
    const t = await import('../src/tts');
    expect(t.ttsStatus()).toBe('none');
    const ok = await t.playRecorded([t.voiceKey('K1-001', 'stem'), t.voiceKey('K1-001', 'opt0'), t.voiceKey('K1-001', 'opt1')]);
    expect(ok).toBe(true); expect(played.map(p => p.url)).toEqual(['http://x/app/voice/k/K1-001_s.mp3', 'http://x/app/voice/k/K1-001_0.mp3', 'http://x/app/voice/k/K1-001_1.mp3']);
    expect(played[1].t - played[0].t).toBeGreaterThanOrEqual(195); expect(played[2].t - played[1].t).toBeGreaterThanOrEqual(95); expect(played[2].t - played[1].t).toBeLessThan(195);
  });
  it('分段文件数组：分段之间 120 ms；manifest 没有 / 为空时返回 false', async () => {
    const t = await import('../src/tts'); played.length = 0;
    expect(await t.playRecorded(['nope#stem'])).toBe(false);
  });
  it('共用提示语按文字找录音；没有录音 → 发「不能朗读」提示', async () => {
    const t = await import('../src/tts'); t.registerPrompts({ '再试试～': 'retry' }); played.length = 0;
    t.speak('再试试～'); await new Promise(r => setTimeout(r, 50)); expect(played.map(p => p.url)).toEqual(['http://x/app/voice/p/retry.mp3']);
    t.speak('没有录音的一句'); await new Promise(r => setTimeout(r, 50)); expect(events).toContain('unavailable');
  });
  it('提示语表：小班常用句都登记了 id', async () => {
    const { VOICE_PROMPTS } = await import('../src/game/voicePrompts');
    for (const s of ['再试试～', '嗯～再想想', '真棒！', '答对啦！', '对', '错']) expect(Object.values(VOICE_PROMPTS)).toContain(s);
  });
});
