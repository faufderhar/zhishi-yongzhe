/* r17 B：录音包导入（+15 句提示语），K_FIRST_LINE 2 →「两」，题库改字后录音没跟上的选项不放（tts.ts staleFilter） */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
const man = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8'));
const played: string[] = [];
beforeAll(() => {
  (globalThis as any).window = globalThis; (globalThis as any).document = { baseURI: 'http://x/app/', visibilityState: 'visible', addEventListener() {} };
  (globalThis as any).addEventListener = () => {}; (globalThis as any).dispatchEvent = () => true;
  (globalThis as any).CustomEvent = class { type: string; detail: unknown; constructor(t: string, o: any) { this.type = t; this.detail = o?.detail; } };
  (globalThis as any).fetch = vi.fn(async () => ({ ok: true, json: async () => man }));
  (globalThis as any).Audio = class { src: string; volume = 1; onended?: () => void; constructor(u: string) { this.src = u; } play() { played.push(this.src.replace(/^.*\/voice\//, '')); setTimeout(() => this.onended?.(), 5); return Promise.resolve(); } pause() {} };
});
describe('r17 录音', () => {
  it('15 句新提示语的录音文字 = 程序里的句子；K_FIRST_LINE(2) =「自己答对两题」', async () => {
    const { K_FIRST_LINE } = await import('../src/game/playtime'); const { HAPPY_TOTAL_LINE } = await import('../src/game/voiceLines');
    expect(K_FIRST_LINE(2)).toBe('自己答对两题'); expect(K_FIRST_LINE(1)).toBe('自己答对1题'); expect(K_FIRST_LINE(3)).toBe('自己答对3题');
    for (let n = 1; n <= 10; n++) expect(man.meta['p:res_k_first_' + n].text, String(n)).toBe(K_FIRST_LINE(n));
    for (let m = 1; m <= 5; m++) expect(man.meta['p:happy_total_' + m].text, String(m)).toBe(HAPPY_TOTAL_LINE(m));
  });
  it('期末庆祝关 10 句（r17.1 +睡觉句 2）（k_term*）：包里登记的例外语速 1.1，其他键都是 1.2；共 3284 键（r17.1 +年级名 3，1.2）', () => {
    const term = man.deploy.r17_term; expect(term.speed).toBe(1.1); expect(term.keys.length).toBe(10);
    for (const k of term.keys) { expect(man.items[k], k).toBeTruthy(); expect(man.meta[k].speed, k).toBe(1.1); }
    const other = Object.entries(man.meta as Record<string, { speed?: number }>).filter(([k, m]) => !term.keys.includes(k) && typeof m?.speed === 'number' && m.speed !== 1.2).map(([k]) => k);
    expect(other).toEqual([]); expect(Object.keys(man.items).length).toBe(3284);
    expect(man.meta['p:k_term1_end'].text).toBe('大乌云被你逗笑啦！');
  });
  it('录音文字过期判断（用假的 meta，不依赖当前包）：登记了期望文字且对不上 → 过期；一致（标点 / 表情 / 零宽字符不算）→ 不过期；没登记 / 包里没文字 → 不过期', async () => {
    const t = await import('../src/tts');
    const meta = { 'Z-1#opt0': { text: '8' }, 'Z-1#opt1': { text: '‍ 老师！' }, 'Z-1#opt2': {}, 'Z-2#opt0': { text: '爬树' } };
    t.expectVoiceText('Z-1#opt0', '11'); expect(t.voiceTextStale('Z-1#opt0', meta)).toBe(true);
    t.expectVoiceText('Z-1#opt1', '👩‍🏫 老师'); expect(t.voiceTextStale('Z-1#opt1', meta)).toBe(false);
    t.expectVoiceText('Z-1#opt2', '随便'); expect(t.voiceTextStale('Z-1#opt2', meta)).toBe(false);
    expect(t.voiceTextStale('Z-2#opt0', meta)).toBe(false);
  });
  it('playRecorded：过期的那段跳过（题干 + 其他选项照常）；只有过期的一段 → false（不读错的数）', async () => {
    const t = await import('../src/tts');
    const id = 'K-050'; const keys = [`${id}#stem`, `${id}#opt0`, `${id}#opt1`].filter(k => man.items[k]); const bad = `${id}#opt0`;
    t.expectVoiceText(bad, '这不是录音里的字');   // 人为登记一个对不上的文字
    played.length = 0; expect(await t.playRecorded(keys)).toBe(true);
    expect(played).toEqual(keys.filter(k => k !== bad).map(k => man.items[k]));
    played.length = 0; expect(await t.playRecorded([bad])).toBe(false); expect(played).toEqual([]);
    played.length = 0; expect(await t.playRecorded(['p:demo_pre', bad, 'p:demo_post'], true)).toBe(false);   // 演示句缺段 → 改用「是这个哦」
  });
});
