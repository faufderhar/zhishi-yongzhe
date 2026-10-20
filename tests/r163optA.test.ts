/* r16.3 总管方案 A：答对后只读表扬（+ 技能名），上限 3.5 / 4 s，读技能名时放宽到「读完 + margin」（技能名不被切）；
   结算页「开心值一共 m 个」排在「变成好朋友」后面读，和别的朗读 / 🔊 重播不会同时响 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
const G = globalThis as any;
const man = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8'));
const durOfFile: Record<string, number> = {}; for (const [k, f] of Object.entries(man.items)) if (typeof f === 'string' && man.meta[k]?.duration) durOfFile[f] = man.meta[k].duration;
type Ev = { f: string; on: number; off?: number };
let tl: Ev[] = []; let now = () => 0;
function env(synth?: any) {
  vi.resetModules(); tl = [];
  G.__TEST_HOOKS__ = false; G.window = globalThis;
  G.document = { baseURI: 'http://x/app/', visibilityState: 'visible', addEventListener() {}, documentElement: { classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, style: {} } };
  G.addEventListener = () => {}; G.dispatchEvent = () => true;
  G.CustomEvent = class { type: string; detail: unknown; constructor(t: string, o: any) { this.type = t; this.detail = o?.detail; } };
  G.fetch = vi.fn(async () => ({ ok: true, json: async () => man }));
  if (synth) G.speechSynthesis = synth; else delete G.speechSynthesis;
  G.SpeechSynthesisUtterance = class { text: string; lang = ''; rate = 1; volume = 1; voice: unknown; onstart?: () => void; onend?: () => void; onerror?: () => void; constructor(t: string) { this.text = t; } };
  /* 假 <audio>：按 manifest 片长准时结束；记下每段真正在响的时间（被下一句打断 = pause） */
  G.Audio = class { src: string; volume = 1; duration: number; currentTime = 0; onplaying?: () => void; onended?: () => void; onerror?: () => void; ev?: Ev; t?: ReturnType<typeof setTimeout>;
    constructor(u: string) { this.src = u; this.duration = durOfFile[u.split('/').pop()!] ?? 1; }
    play() { setTimeout(() => { this.ev = { f: this.src.split('/').pop()!, on: now() }; tl.push(this.ev); this.onplaying?.(); this.t = setTimeout(() => { if (this.ev && this.ev.off === undefined) this.ev.off = now(); this.onended?.(); }, this.duration * 1000); }, 5); return Promise.resolve(); }
    pause() { clearTimeout(this.t); if (this.ev && this.ev.off === undefined) this.ev.off = now(); } load() {} };
}
const fileOf = (k: string) => man.items[k] as string;
const maxOverlap = () => { let m = 1; for (const a of tl) m = Math.max(m, tl.filter(b => b.on < (a.off ?? Infinity) && a.on < (b.off ?? Infinity)).length); return m; };
beforeEach(() => { vi.useFakeTimers(); now = () => Date.now(); });
afterEach(() => { vi.useRealTimers(); });
async function load() { const t = await import('../src/tts'); const { PROMPT_BY_TEXT } = await import('../src/game/voicePrompts'); t.registerPrompts(PROMPT_BY_TEXT); return t; }
const longestSkill = () => Object.keys(man.meta).filter(k => k.startsWith('p:sk_k_')).sort((a, b) => man.meta[b].duration - man.meta[a].duration)[0];

describe('kWaitCap：上限 = max(基础, 这句话时长 + margin)', () => {
  it('纯函数', async () => {
    const { kWaitCap, K_WAIT } = await import('../src/ui/Battle');
    expect(K_WAIT.nextCap).toBe(3500); expect(K_WAIT.endCap).toBe(4000);
    expect(kWaitCap(3500, 0)).toBe(3500); expect(kWaitCap(3500, 1200)).toBe(3500); expect(kWaitCap(4000, 2568)).toBe(4000);
    expect(kWaitCap(3500, 3820)).toBe(3820 + K_WAIT.margin); expect(kWaitCap(4000, 5000)).toBe(5000 + K_WAIT.margin);
  });
});

describe('speechMs：按录音片长算（没有系统朗读）/ 按字数估（系统朗读）', () => {
  it('表扬 + 最长的技能名 = 两段片长 + 段间停顿；只有表扬 → 上限仍 3.5 s', async () => {
    env(); const t = await load(); const { kWaitCap, K_WAIT } = await import('../src/ui/Battle');
    const sk = longestSkill(); const skText = man.meta[sk].text as string;
    const p = t.speechMs('太厉害了！' + skText); await vi.advanceTimersByTimeAsync(10);
    expect(await p).toBe(Math.round(man.meta['p:praise2'].duration * 1000 + t.VOICE_GAP_OPT_MS + man.meta[sk].duration * 1000));
    const p2 = t.speechMs('太厉害了！'); await vi.advanceTimersByTimeAsync(10);
    expect(kWaitCap(K_WAIT.nextCap, await p2)).toBe(3500);
    const p3 = t.speechMs('小乌云变成你的好朋友啦！'); await vi.advanceTimersByTimeAsync(10);
    expect(kWaitCap(K_WAIT.endCap, await p3)).toBe(4000);   // 最后一题没技能名：4 s
  });
  it('系统朗读：按 sysEstimateMs', async () => {
    const synth = { speaking: false, getVoices: () => [{ lang: 'zh-CN', name: 'zh', localService: true }], speak() {}, cancel() {}, resume() {}, addEventListener() {} };
    env(synth); const t = await load();
    expect(await t.speechMs('真棒！算算的积木城堡！')).toBe(t.sysEstimateMs('真棒！算算的积木城堡！', t.sysRate()));
  });
});

describe('技能名不被切：答对后按上限等，等到时最后一段已经读完', () => {
  for (const last of [false, true]) it(last ? '最后一题：最长技能名 +「变成好朋友」' : '普通题：最长表扬 + 最长技能名', async () => {
    env(); const t = await load(); const { kWaitCap, K_WAIT } = await import('../src/ui/Battle');
    const sk = longestSkill(); const text = (last ? '' : '太厉害了！') + man.meta[sk].text + (last ? '小乌云变成你的好朋友啦！' : '');
    const t0 = now(); t.speak(text); const capP = t.speechMs(text); await vi.advanceTimersByTimeAsync(1);
    const cap = kWaitCap(last ? K_WAIT.endCap : K_WAIT.nextCap, await capP);
    expect(cap).toBeGreaterThan(last ? 4000 : 3500);
    let doneAt = 0; void t.afterVoice(0, Math.max(0, cap - (now() - t0))).then(() => { doneAt = now(); });
    await vi.advanceTimersByTimeAsync(cap + 200);
    expect(doneAt).toBeGreaterThan(0); expect(doneAt - t0).toBeLessThanOrEqual(cap + 120);
    const endF = fileOf(last ? 'p:cloud_friend' : sk); const endEv = tl.find(e => e.f === endF)!;
    expect(endEv).toBeTruthy(); expect(endEv.off! - endEv.on).toBeGreaterThanOrEqual(Math.round(man.meta[last ? 'p:cloud_friend' : sk].duration * 1000) - 1);   // 读完整段，没被切
    expect(doneAt).toBeGreaterThanOrEqual(endEv.off!);
  });
});

describe('结算页：「开心值一共 m 个」接在「变成好朋友」后面，不重叠', () => {
  it('kResultAuto：顺序 + 录音键（总数没录 → 用 p:happy_m_m）', async () => {
    env(); const { kResultAuto } = await import('../src/ui/Screens');
    const parts = [{ text: '太厉害啦！', key: 'p:x1' }, { text: '自己答对 3 题', key: 'p:x2' }];
    const a = kResultAuto(3, parts, k => k === 'p:happy_3_3');
    expect(a.text).toBe('开心值一共3个。太厉害啦！。自己答对 3 题'); expect(a.keys).toEqual(['p:happy_3_3', 'p:x1', 'p:x2']);
    expect(kResultAuto(2, parts, () => true).keys?.[0]).toBe('p:happy_total_2'); expect(kResultAuto(2, parts, () => true).text.startsWith('开心值一共两个')).toBe(true);
    expect(kResultAuto(0, parts, () => true).keys).toEqual(['p:x1', 'p:x2']);
    expect(kResultAuto(3, [{ text: '没登记的话' }], () => true).keys).toBeUndefined();
  });
  it('「好朋友」还在读时结算页的自动朗读排队；中途按 🔊 重播也不会两句同时响', async () => {
    env(); const t = await load(); const { kResultAuto, K_RESULT_AUTO } = await import('../src/ui/Screens');
    t.speak('小乌云变成你的好朋友啦！'); await vi.advanceTimersByTimeAsync(300);   // 战斗最后一句还在读（比如上限到了它还没完）
    const a = kResultAuto(3, [{ text: '太厉害啦！', key: 'p:res_k2' }], k => !!man.items[k]);
    let autoAt = 0; t.afterVoiceThen(K_RESULT_AUTO.minMs, K_RESULT_AUTO.maxMs, () => { autoAt = now(); t.speak(a.text, 'zh-CN', a.keys ? { keys: a.keys } : {}); });
    await vi.advanceTimersByTimeAsync(10000);
    const fr = tl.find(e => e.f === fileOf('p:cloud_friend'))!; const hp = tl.find(e => e.f === fileOf('p:happy_3_3'))!;
    expect(fr.off! - fr.on).toBeGreaterThanOrEqual(Math.round(man.meta['p:cloud_friend'].duration * 1000) - 1);   // 「好朋友」读完整句
    expect(autoAt).toBeGreaterThanOrEqual(fr.off!); expect(hp.on).toBeGreaterThan(fr.off!); expect(maxOverlap()).toBe(1);
    // 🔊 重播：自动朗读排在重播后面
    env(); const t2 = await load(); t2.speak('小乌云变成你的好朋友啦！'); await vi.advanceTimersByTimeAsync(3000);
    let at2 = 0; t2.afterVoiceThen(K_RESULT_AUTO.minMs, K_RESULT_AUTO.maxMs, () => { at2 = now(); t2.speak(a.text, 'zh-CN', a.keys ? { keys: a.keys } : {}); });
    await vi.advanceTimersByTimeAsync(300); t2.speak('太厉害啦！');   // 孩子点了 🔊
    await vi.advanceTimersByTimeAsync(10000);
    const rp = tl.find(e => e.f === fileOf('p:res_k2'))!; expect(rp.off! - rp.on).toBeGreaterThanOrEqual(Math.round(man.meta['p:res_k2'].duration * 1000) - 1);
    expect(at2).toBeGreaterThanOrEqual(rp.off!); expect(maxOverlap()).toBe(1);
  });
});
