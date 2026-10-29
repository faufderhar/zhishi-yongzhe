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
  it('r17.5 幼儿园 zf_003@1.0（k_zf003_s10）：3268 键 zf_003@1.0（含期末庆祝关 10 句，原 r17_term 1.1 已不适用）+ 17 个小学/初高年级名仍 zf_002@1.2（= scripts/voice/r175_keep_1.2.txt）；共 3285 键', () => {
    const term = man.deploy.r17_term; expect(term.keys.length).toBe(10);   // 旧批次登记原样保留（speed 1.1），但本包这些键已是 1.0
    for (const k of term.keys) { expect(man.items[k], k).toBeTruthy(); expect(man.meta[k], k).toMatchObject({ voice: 'zf_003', speed: 1.0 }); }
    const keep = ['p:grade_1', 'p:grade_2', 'p:grade_3', 'p:grade_4', 'p:grade_5', 'p:grade_6', 'p:grade_7', 'p:grade_9', 'p:grade_10', 'p:grade_12', 'p:stage_p', 'p:stage_j', 'p:stage_h', 'p:soon_8', 'p:soon_9', 'p:soon_11', 'p:soon_12'];
    expect(readFileSync('scripts/voice/r175_keep_1.2.txt', 'utf8').split(/\s+/).filter(Boolean).sort()).toEqual([...keep].sort());
    const metas = Object.entries(man.meta as Record<string, { speed?: number; voice?: string }>);
    expect(metas.filter(([, m]) => m.voice === 'zf_002' && m.speed === 1.2).map(([k]) => k).sort()).toEqual([...keep].sort());
    expect(metas.filter(([k, m]) => !keep.includes(k) && !(m.voice === 'zf_003' && m.speed === 1.0)).map(([k]) => k)).toEqual([]);
    expect(metas.length - keep.length).toBe(3268); expect(Object.keys(man.items).length).toBe(3285);
    expect(man.deploy.k_zf003_s10).toMatchObject({ voice: 'zf_003', speed: 1.0, keys: 3268 }); expect([...man.deploy.k_zf003_s10.unchanged_zf002_keys].sort()).toEqual([...keep].sort());
    expect(man.voice).toBe('zf_003'); expect(man.speeds).toEqual({ questions: 1.0, prompts: 1.0, en: 1.0 });
    expect(String(man.deploy.k_zf003_s10.status)).not.toMatch(/DRAFT|staging|未进主包/i);
    expect(man.bank_version).toMatch(/k_zf003_s10/); expect(man.bank_version).not.toMatch(/staging/);
    expect(man.meta['p:grade_k2']).toMatchObject({ text: '中班', voice: 'zf_003', speed: 1.0 });
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
