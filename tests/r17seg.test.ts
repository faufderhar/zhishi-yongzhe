/* r17 C4：朗读「每段开始」回调（结算页动画按语音分段卡拍子） */
import { describe, it, expect, vi, beforeAll } from 'vitest';
const played: { url: string; t: number }[] = []; const segs: { i: number; t: number }[] = [];
beforeAll(() => {
  (globalThis as any).window = globalThis; (globalThis as any).document = { baseURI: 'http://x/app/', visibilityState: 'visible', addEventListener() {} };
  (globalThis as any).addEventListener = () => {}; (globalThis as any).dispatchEvent = () => true;
  (globalThis as any).CustomEvent = class { type: string; detail: unknown; constructor(t: string, o: any) { this.type = t; this.detail = o?.detail; } };
  (globalThis as any).fetch = vi.fn(async () => ({ ok: true, json: async () => ({ items: { 'p:a': 'p/a.mp3', 'p:b': 'p/b.mp3', 'p:c': ['p/c1.mp3', 'p/c2.mp3'] } }) }));
  (globalThis as any).Audio = class { src: string; volume = 1; duration = 0.05; currentTime = 0; onended?: () => void; constructor(u: string) { this.src = u; } play() { played.push({ url: this.src.replace(/^.*voice\//, ''), t: Date.now() }); setTimeout(() => this.onended?.(), 40); return Promise.resolve(); } pause() {} };
});
describe('onSeg', () => {
  it('录音：每个键的第一段文件开始播时回调它在 keys 里的序号；缺的键不回调；分段文件只回调一次；顺序和播放一致', async () => {
    const t = await import('../src/tts');
    const ok = await t.playRecorded(['p:a', 'p:missing', 'p:c', 'p:b'], false, i => segs.push({ i, t: Date.now() }));
    expect(ok).toBe(true);
    expect(played.map(p => p.url)).toEqual(['p/a.mp3', 'p/c1.mp3', 'p/c2.mp3', 'p/b.mp3']);
    expect(segs.map(s => s.i)).toEqual([0, 2, 3]);
    // 回调时刻 = 那段开始播放的时刻（不早于它，也不晚很多）
    const at = (u: string) => played.find(p => p.url === u)!.t;
    expect(Math.abs(segs[0].t - at('p/a.mp3'))).toBeLessThan(15); expect(Math.abs(segs[1].t - at('p/c1.mp3'))).toBeLessThan(15); expect(Math.abs(segs[2].t - at('p/b.mp3'))).toBeLessThan(15);
    expect(segs[1].t).toBeGreaterThan(segs[0].t + 40);
  });
  it('没有任何录音 → false，不回调', async () => {
    const t = await import('../src/tts'); segs.length = 0;
    expect(await t.playRecorded(['p:none'], false, i => segs.push({ i, t: 0 }))).toBe(false); expect(segs).toEqual([]);
  });
  it('speak(…, { keys, onSeg })：系统朗读不可用时走录音，照样逐段回调', async () => {
    const t = await import('../src/tts'); segs.length = 0; played.length = 0;
    t.speak('一。二', 'zh-CN', { keys: ['p:a', 'p:b'], onSeg: i => segs.push({ i, t: Date.now() }) });
    await new Promise(r => setTimeout(r, 400));
    expect(segs.map(s => s.i)).toEqual([0, 1]); expect(played.map(p => p.url)).toEqual(['p/a.mp3', 'p/b.mp3']);
  });
  it('segOffsets：系统朗读按字数估每段开始的时刻（第 0 段 = 0，段间 100 ms）', async () => {
    const t = await import('../src/tts');
    const o = t.segOffsets(['开心值一共3个', '太厉害啦', '自己答对3题'], 1);
    expect(o[0]).toBe(0); expect(o[1]).toBe(Math.round((6 / 4 + 1 / 2.5) * 1000) + 100);   // 6 个汉字 + 数字 3 expect(o[2]).toBe(o[1] + Math.round(4 / 4 * 1000) + 100);
    expect(t.segOffsets(['开心值'], 0.5)).toEqual([0]);
  });
});
