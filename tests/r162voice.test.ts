/* r16.2 小萌新 #1：没有声卡 / 静音 / 蓝牙断开 / AudioContext 卡住 / 收不到 ended —— 朗读不能把答题流程卡 8–10 秒 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const G = globalThis as any;
const events: string[] = [];
function env(synth?: any) {
  vi.resetModules();
  G.__TEST_HOOKS__ = false; G.window = globalThis;
  G.document = { baseURI: 'http://x/app/', visibilityState: 'visible', addEventListener() {} };
  G.addEventListener = () => {}; G.dispatchEvent = (e: any) => { events.push(e.detail); return true; };
  G.CustomEvent = class { type: string; detail: unknown; constructor(t: string, o: any) { this.type = t; this.detail = o?.detail; } };
  G.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ items: { 'K1-001#stem': 'k/s.mp3', 'p:retry': 'p/retry.mp3' } }) }));
  if (synth) G.speechSynthesis = synth; else delete G.speechSynthesis;
  G.SpeechSynthesisUtterance = class { text: string; lang = ''; rate = 1; volume = 1; voice: unknown; onstart?: () => void; onend?: () => void; onerror?: () => void; constructor(t: string) { this.text = t; } };
}
/** 假 <audio>：mode 决定 play() 后发生什么 */
function fakeAudio(mode: 'ok' | 'error' | 'reject' | 'never' | 'pending', dur = 0.8) {
  return class { src: string; volume = 1; duration = dur; currentTime = 0; onplaying?: () => void; onended?: () => void; onerror?: () => void; paused = false;
    constructor(u: string) { this.src = u; }
    play() { if (mode === 'reject') return Promise.reject(new Error('NotAllowedError'));
      if (mode === 'pending') return new Promise<void>(() => {});
      if (mode === 'error') { setTimeout(() => this.onerror?.(), 10); return new Promise<void>(() => {}); }
      setTimeout(() => this.onplaying?.(), 5); if (mode === 'ok') setTimeout(() => this.onended?.(), dur * 1000); return Promise.resolve(); }
    pause() { this.paused = true; } };
}
beforeEach(() => { vi.useFakeTimers(); events.length = 0; });
afterEach(() => { vi.useRealTimers(); });

describe('watchMedia：每段录音都有看门狗', () => {
  it('正常：ended 到了就结束（true）', async () => {
    env(); const { watchMedia } = await import('../src/tts'); const A = fakeAudio('ok', 0.8);
    let r: boolean | undefined; void watchMedia(new A('x') as any).then(v => { r = v; });
    await vi.advanceTimersByTimeAsync(790); expect(r).toBeUndefined(); await vi.advanceTimersByTimeAsync(30); expect(r).toBe(true);
  });
  it('出错（error 事件）→ 马上 false', async () => {
    env(); const { watchMedia } = await import('../src/tts'); const A = fakeAudio('error');
    let r: boolean | undefined; void watchMedia(new A('x') as any).then(v => { r = v; });
    await vi.advanceTimersByTimeAsync(20); expect(r).toBe(false);
  });
  it('play() 被拒（自动播放限制 / 没有输出设备）→ 马上 false', async () => {
    env(); const { watchMedia } = await import('../src/tts'); const A = fakeAudio('reject');
    let r: boolean | undefined; void watchMedia(new A('x') as any).then(v => { r = v; });
    await vi.advanceTimersByTimeAsync(1); expect(r).toBe(false);
  });
  it('play() 一直不兑现、也没有 playing → VOICE_START_MS（1.2 s）后 false，并停掉', async () => {
    env(); const { watchMedia, VOICE_START_MS } = await import('../src/tts'); const A = fakeAudio('pending'); const el = new A('x');
    let r: boolean | undefined; void watchMedia(el as any).then(v => { r = v; });
    await vi.advanceTimersByTimeAsync(VOICE_START_MS - 10); expect(r).toBeUndefined();
    await vi.advanceTimersByTimeAsync(20); expect(r).toBe(false); expect(el.paused).toBe(true);
  });
  it('开始了但永远收不到 ended → 片长 + 300 ms 结束（true）', async () => {
    env(); const { watchMedia } = await import('../src/tts'); const A = fakeAudio('never', 2.5);
    let r: boolean | undefined; void watchMedia(new A('x') as any).then(v => { r = v; });
    await vi.advanceTimersByTimeAsync(2700); expect(r).toBeUndefined(); await vi.advanceTimersByTimeAsync(150); expect(r).toBe(true);
  });
  it('片长未知（NaN / Infinity）→ 约 1.5 s 结束；片长很长也不超过 VOICE_CAP_MS', async () => {
    env(); const { watchMedia, VOICE_CAP_MS } = await import('../src/tts');
    let r: boolean | undefined; void watchMedia(new (fakeAudio('never', NaN))('x') as any).then(v => { r = v; });
    await vi.advanceTimersByTimeAsync(1520); expect(r).toBe(true);
    let r2: boolean | undefined; void watchMedia(new (fakeAudio('never', 600))('x') as any).then(v => { r2 = v; });
    await vi.advanceTimersByTimeAsync(VOICE_CAP_MS + 20); expect(r2).toBe(true);
  });
});

describe('playBuf：AudioContext 播放', () => {
  const ctxOf = (state: string, advance: boolean) => { const c: any = { state, currentTime: 0, destination: {}, createGain: () => ({ gain: { value: 1 }, connect: (x: any) => x }),
    createBufferSource: () => { const s: any = { buffer: null, onended: null, stopped: false, connect: (x: any) => x, start() { if (advance) setInterval(() => { c.currentTime += 0.1; }, 100); }, stop() { s.stopped = true; } }; c.src = s; return s; } }; return c; };
  it('context 挂起 / 没有输出（currentTime 不走）→ 很快 false', async () => {
    env(); const { playBuf } = await import('../src/tts'); const c = ctxOf('suspended', false);
    let r: boolean | undefined; void playBuf(c, { duration: 3 }).then(v => { r = v; });
    await vi.advanceTimersByTimeAsync(1210); expect(r).toBe(false); expect(c.src.stopped).toBe(true);
  });
  it('在跑但收不到 onended → 片长 + 300 ms 结束（true）', async () => {
    env(); const { playBuf } = await import('../src/tts'); const c = ctxOf('running', true);
    let r: boolean | undefined; void playBuf(c, { duration: 2 }).then(v => { r = v; });
    await vi.advanceTimersByTimeAsync(2250); expect(r).toBeUndefined(); await vi.advanceTimersByTimeAsync(100); expect(r).toBe(true);
  });
});

describe('playRecorded / voiceBusy', () => {
  it('没有 speechSynthesis + 录音放不出来：不再一直「在说话」，1.3 s 内 voiceBusy 变 false', async () => {
    env(); G.Audio = fakeAudio('pending'); const t = await import('../src/tts');
    expect(t.ttsStatus()).toBe('none');
    t.speak('题目', 'zh-CN', { id: 'K1-001' }); await vi.advanceTimersByTimeAsync(20); expect(t.voiceBusy()).toBe(true);
    await vi.advanceTimersByTimeAsync(1300); expect(t.voiceBusy()).toBe(false); expect(t.isSpeaking()).toBe(false);
  });
  it('清单（manifest）一直取不回 → 1.2 s 后放弃', async () => {
    env(); G.fetch = vi.fn(() => new Promise(() => {})); G.Audio = fakeAudio('ok'); const t = await import('../src/tts');
    let r: boolean | undefined; void t.playRecorded(['K1-001#stem']).then(v => { r = v; });
    await vi.advanceTimersByTimeAsync(1250); expect(r).toBe(false); expect(t.voiceBusy()).toBe(false);
  });
  it('系统朗读 speak() 后既不 onstart 也不 onend、speaking 卡在 true（没有声卡）→ 1.5 s 后不算在说话', async () => {
    const synth = { speaking: false, getVoices: () => [{ lang: 'zh-CN', name: 'zh', localService: true }], speak() { synth.speaking = true; }, cancel() {}, resume() {}, addEventListener() {} };
    env(synth); G.Audio = fakeAudio('pending'); const t = await import('../src/tts');
    t.speak('题目', 'zh-CN'); await vi.advanceTimersByTimeAsync(50); expect(t.voiceBusy()).toBe(true);
    await vi.advanceTimersByTimeAsync(1500); expect(synth.speaking).toBe(true);
    expect(t.voiceBusy()).toBe(false); expect(t.isSpeaking()).toBe(false);
    await vi.advanceTimersByTimeAsync(1300); expect(t.voiceBusy()).toBe(false);   // 退路录音也放不出来 → 照样不挡
  });
  it('系统朗读开始了但 onend 永远不来 → 按预计时长（字数）结束', async () => {
    let last: any; const synth = { speaking: false, getVoices: () => [{ lang: 'zh-CN', name: 'zh', localService: true }], speak(u: any) { last = u; synth.speaking = true; setTimeout(() => u.onstart?.(), 30); }, cancel() {}, resume() {}, addEventListener() {} };
    env(synth); const t = await import('../src/tts');
    const text = '小明有三个苹果，又买了两个，现在一共有几个？';
    t.speak(text, 'zh-CN'); expect(last.text).toBe(text);
    const est = t.sysEstimateMs(text, last.rate); expect(est).toBeLessThan(8000);
    await vi.advanceTimersByTimeAsync(est - 70); expect(t.voiceBusy()).toBe(true);
    await vi.advanceTimersByTimeAsync(200); expect(t.voiceBusy()).toBe(false); expect(synth.speaking).toBe(true);
  });
  it('afterVoice：说话结束得早 → 不等到上限', async () => {
    env(); G.Audio = fakeAudio('reject'); const t = await import('../src/tts');
    t.speak('题目', 'zh-CN', { id: 'K1-001' });
    let done = false; void t.afterVoice(300, 10000).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(800); expect(done).toBe(true);
  });
});
