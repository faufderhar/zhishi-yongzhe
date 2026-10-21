/* r17 B：录音包导入（+15 句提示语），K_FIRST_LINE 2 →「两」，题库改字后录音没跟上的选项不放（tts.ts staleFilter） */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
const man = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8'));
const STALE: string[] = JSON.parse(readFileSync('tests/fixtures/r17_voice_stale_v56.json', 'utf8')).keys;
const raw = (g: string) => JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8'));
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
  it('v56 改了字的 18 个选项：登记了题库文字就判为过期；文字一致的照常', async () => {
    const t = await import('../src/tts');
    const opt = (k: string) => { const [id, o] = k.split('#'); const g = id.startsWith('K2') ? 'K2' : 'K1'; const q = raw(g).questions.find((x: any) => x.id === id); return q.options[+o.slice(3)].text as string; };
    expect(STALE.length).toBe(18);
    for (const k of STALE) { expect(t.voiceTextStale(k, man.meta), k + ' 没登记').toBe(false); t.expectVoiceText(k, opt(k)); expect(t.voiceTextStale(k, man.meta), k).toBe(true); }
    // 文字一致（标点 / 表情 / 零宽字符不算）→ 不过期
    t.expectVoiceText('K-050#opt1', opt('K-050#opt1')); expect(t.voiceTextStale('K-050#opt1', man.meta)).toBe(false);
    t.expectVoiceText('K2G-003#opt0', opt('K2G-003#opt0')); expect(t.voiceTextStale('K2G-003#opt0', man.meta)).toBe(false);
  });
  it('playRecorded：过期的那段跳过（题干 + 其他选项照常）；只有过期的一段 → false（不读错的数）', async () => {
    const t = await import('../src/tts');
    const keys = ['K-050#stem', 'K-050#opt0', 'K-050#opt1', 'K-050#opt2'].filter(k => man.items[k]);
    played.length = 0; expect(await t.playRecorded(keys)).toBe(true);
    expect(played).toEqual(keys.filter(k => k !== 'K-050#opt0').map(k => man.items[k]));
    played.length = 0; expect(await t.playRecorded(['K-050#opt0'])).toBe(false); expect(played).toEqual([]);
    played.length = 0; expect(await t.playRecorded(['p:demo_pre', 'K-050#opt0', 'p:demo_post'], true)).toBe(false);   // 演示句缺段 → 改用「是这个哦」
  });
});
