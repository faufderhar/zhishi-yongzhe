// r15.4.2 小萌新复测
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
const rd = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* 录音播放用假的 <audio>：play() 后 dur 毫秒触发 onended，记录开始 / 被停 */
const played: { url: string; ev: string; t: number }[] = [];
class FakeAudio { src: string; volume = 1; onended: (() => void) | null = null; onerror: (() => void) | null = null; private id = 0; private live = false;
  constructor(u: string) { this.src = u; }
  play() { this.live = true; played.push({ url: this.src, ev: 'start', t: Date.now() }); const d = /grace/.test(this.src) ? 2000 : 500; this.id = setTimeout(() => { this.live = false; played.push({ url: this.src, ev: 'end', t: Date.now() }); this.onended?.(); }, d) as unknown as number; return Promise.resolve(); }
  pause() { clearTimeout(this.id); if (this.live) played.push({ url: this.src, ev: 'stop', t: Date.now() }); this.live = false; } }
(globalThis as any).__TEST_HOOKS__ = false;
(globalThis as any).Audio = FakeAudio;
(globalThis as any).fetch = vi.fn(async () => ({ ok: true, json: async () => ({ items: { 'p:grace': 'p_grace.mp3', 'p:praise1': 'p_praise1.mp3', 'K-1#stem': 'K1_stem.mp3', 'K-2#stem': 'K2_stem.mp3' } }) }));

describe('r15.4.2 #1 收尾提示 prio：同一刻的表扬 / 下一题题干不再切掉它', () => {
  beforeEach(() => { played.length = 0; vi.useFakeTimers(); });
  it('prio 播放中别的朗读排队，只留最后一句；prio 完整播完后再播', async () => {
    const tts = await import('../src/tts');
    tts.registerPrompts({ '时间到啦，打完这关就休息哦': 'grace', '真棒': 'praise1' });
    tts.speak('时间到啦，打完这关就休息哦', 'zh-CN', { prio: true });
    await vi.advanceTimersByTimeAsync(50);
    tts.speak('真棒');                                  // 同一刻点了答案：表扬
    tts.speak('题目一', 'zh-CN', { id: 'K-1' });         // 下一题题干
    tts.speak('题目二', 'zh-CN', { id: 'K-2' });         // 又换了一题：只留最后一句
    expect(tts.prioState()).toEqual({ busy: true, pending: true });
    await vi.advanceTimersByTimeAsync(3000);
    const seq = played.map(p => `${p.ev}:${p.url.split('/').pop()}`);
    expect(seq.filter(x => x.startsWith('stop:p_grace'))).toEqual([]);           // 没被停
    expect(seq.indexOf('end:p_grace.mp3')).toBeGreaterThan(-1);
    expect(seq.indexOf('start:K2_stem.mp3')).toBeGreaterThan(seq.indexOf('end:p_grace.mp3'));
    expect(seq.some(x => /praise1|K1_stem/.test(x))).toBe(false);
    expect(tts.prioState().busy).toBe(false);
  });
  it('普通朗读照旧互相打断（没加 prio 的行为不变）', async () => {
    const tts = await import('../src/tts'); await vi.advanceTimersByTimeAsync(3000); played.length = 0;
    tts.speak('题目一', 'zh-CN', { id: 'K-1' }); await vi.advanceTimersByTimeAsync(50);
    tts.speak('题目二', 'zh-CN', { id: 'K-2' }); await vi.advanceTimersByTimeAsync(1000);
    const seq = played.map(p => `${p.ev}:${p.url.split('/').pop()}`);
    expect(seq.slice(0, 3)).toEqual(['start:K1_stem.mp3', 'stop:K1_stem.mp3', 'start:K2_stem.mp3']);
  });
  it('兜底：prio 最多挡 8 秒（录音卡住也不会让后面的朗读永远不放）', async () => {
    const tts = await import('../src/tts');
    (globalThis as any).Audio = class extends FakeAudio { play() { played.push({ url: this.src, ev: 'start', t: Date.now() }); return Promise.resolve(); } };   // 永远不结束
    tts.speak('时间到啦，打完这关就休息哦', 'zh-CN', { prio: true }); await vi.advanceTimersByTimeAsync(50);
    tts.speak('题目一', 'zh-CN', { id: 'K-1' }); await vi.advanceTimersByTimeAsync(7000);
    expect(played.some(p => /K1_stem/.test(p.url))).toBe(false);
    await vi.advanceTimersByTimeAsync(1500);
    expect(played.some(p => /K1_stem/.test(p.url))).toBe(true);
    (globalThis as any).Audio = FakeAudio;
  });
  it('App：小班进入收尾时 prio 朗读 + 大卡片同一刻出现', () => {
    const s = rd('src/App.tsx');
    expect(s).toMatch(/speak\(GRACE_VOICE, 'zh-CN', \{ prio: true \}\); setGraceCard\(true\)/);
    expect(s).toMatch(/data-testid="grace-pop"/);
    expect(rd('src/app.css')).toMatch(/\.grace-pop\{[^}]*pointer-events:none/);
  });
});
describe('r15.4.2 #3 / #4', () => {
  it('小班普通结算页不显示「这次…没有超过最佳」', () => { expect(rd('src/ui/Screens.tsx')).toMatch(/cfg\.band !== 'K' && !capped && prevBest !== undefined && prevBest > 0 && stars <= prevBest && <p className="sub" data-testid="result-nonew">/); });
  it('伙伴说话气泡显示时不叠「在说话」提示；技能横幅在上、提示排到下面；说话气泡出现时横幅收起', () => {
    expect(rd('src/ui/Battle.tsx')).toMatch(/\{busy && !say && <div key=\{nudge\} className=\{`kbusy/);
    const css = rd('src/app.css'); expect(css).toMatch(/\.kstage:has\(>\.skill-banner\.kinder\)>\.kbusy\{top:96px\}/); expect(css).toMatch(/\.kstage:has\(\.ksay\)>\.skill-banner\.kinder\{opacity:0!important/);
  });
});
import { newRound, resolveRound, estimateDealt, calcParts } from '../src/game/rounds';
import { skillById } from '../src/game/skills';
import { PUPS } from '../src/game/characters';
describe('r15.4.2 学霸 F：初一护盾「预计 ≈16（挡掉 10，没有护盾是 26）」实际 -23', () => {
  const c = PUPS.find(x => x.id === 'suansuan')!;
  const s0 = { ...newRound('j', 'normal'), shield: 10, monsterHp: 999 };
  const inp = { subject: '数学', difficulty: 2 };   // 算算（数学主修）· 数学 2 级：没有护盾 26（和截图一致）
  it('数学没错：没触发技能时实际伤害 = 预计（挡掉的点数也一致）', () => {
    const est = estimateDealt(s0, c, inp), raw = estimateDealt({ ...s0, shield: 0 }, c, inp);
    const [, o] = resolveRound(s0, c, { ...inp, correct: true, noSkill: true });
    expect(o.dealt).toBe(est); expect(o.absorbed).toBe(raw - est); expect(o.absorbed).toBe(10);
  });
  it('-23 = 触发了「数轴突刺」（答对伤害 ×1.25）：26×1.25≈33，护盾挡 10 → 23；预计伤害不含技能', () => {
    const k = skillById('j1_suansuan_2')!; expect(k.effect).toBe('A125C');
    const s = { ...s0 }; const { outer, inner } = calcParts({ ...s, combo: 1 }, c, { ...inp, correct: true });
    const raw = Math.round(outer * Math.min(1.8, inner)); expect(raw).toBe(26);
    const [, o] = resolveRound(s, c, { ...inp, correct: true, forceSkill: k });
    expect(o.skill?.name).toBe('数轴突刺'); expect(o.dealt).toBe(23); expect(o.absorbed).toBe(10);
  });
  it('界面：技能伤害飘字带技能名；命中时飘「护盾挡掉 n」（打死怪物也飘）', () => {
    const s = rd('src/ui/RoundBattle.tsx');
    expect(s).toMatch(/d\.float\(d\.r\.monster, `✨\$\{k\.name\} `/); expect(s).toMatch(/护盾挡掉 \$\{o\.absorbed\}/);
    expect((s.match(/shieldFloat\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
import { addNumKey as ak, toggleMinus, minusOk as mok, press as kpress } from '../src/game/keypad';
describe('r15.4.2 学霸 G：输了数字再按「-」= 切换正负（r15.3 规则 1：- 只在数的开头）', () => {
  const typ = (keys: string) => [...keys].reduce((v, k) => ak(v, k), '');
  it('整数 / 小数：放到开头、再按拿掉', () => { expect(typ('12-')).toBe('-12'); expect(typ('12--')).toBe('12'); expect(typ('3.5-')).toBe('-3.5'); expect(typ('-12')).toBe('-12'); expect(typ('-12-')).toBe('12'); });
  it('分数：切换整个分数（放最前面）；/ 后面空着时按 - 仍是分母的负号', () => { expect(typ('3/4-')).toBe('-3/4'); expect(typ('-3/4-')).toBe('3/4'); expect(typ('3/-4')).toBe('3/-4'); });
  it('×10ⁿ：切换指数（最后输入的数）；e 后面空着时按 - 照旧', () => { expect(typ('15e3-')).toBe('15e-3'); expect(typ('15e-3-')).toBe('15e3'); expect(typ('15e-3')).toBe('15e-3'); });
  it('结果里的「-」永远只在一个数的开头', () => { for (const k of ['1-2-3', '3/4-5', '1e2-3-', '-', '--', '0.5-/2-']) { const v = typ(k); expect(v).toMatch(/^-?[0-9.]*(\/-?[0-9.]*)?(e-?[0-9.]*)?$/); } expect(toggleMinus('')).toBe('-'); expect(mok('7/')).toBe(true); });
  it('多指同时按：按时间戳重排后再切换（规则 2 不变）', () => { let b = kpress(null, '', 10, 100, v => ak(v, '5')); b = kpress(b, b.cur, 12, 110, v => ak(v, '-')); expect(b.cur).toBe('-5'); b = kpress(null, '', 20, 200, v => ak(v, '-')); b = kpress(b, b.cur, 15, 205, v => ak(v, '5')); expect(b.cur).toBe('-5'); });
});
