// r15.4.3 小萌新：小班没加星的结算页只说一句「今天玩得真棒，明天再来吧」——录音已登记、在语音包里（离线下载清单按 manifest 来）
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { VOICE_PROMPTS, PROMPT_BY_TEXT } from '../src/game/voicePrompts';
import { K_NOSTAR_TEXT } from '../src/game/playtime';
import { voiceFiles } from '../src/offlineCache';
it('p:res_k_done = zf_003@1.0（r17.5 幼儿园语音），文件在 public/voice，离线清单里有', () => {
  expect(K_NOSTAR_TEXT).toBe('今天玩得真棒，明天再来吧'); expect(VOICE_PROMPTS.res_k_done).toBe(K_NOSTAR_TEXT); expect(PROMPT_BY_TEXT[K_NOSTAR_TEXT]).toBe('res_k_done');
  const m = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8')); const f = m.items['p:res_k_done']; expect(f).toMatch(/^p_res_k_done\.[0-9a-f]{10}\.mp3$/);
  expect(m.meta['p:res_k_done']).toMatchObject({ voice: 'zf_003', speed: 1.0, text: K_NOSTAR_TEXT }); expect(readFileSync('public/voice/' + f).length).toBeGreaterThan(5000);
  expect(voiceFiles(m.items)).toContain(f);
});
