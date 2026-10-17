import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { dynamicPrompts } from '../src/game/voiceLines';
import { VOICE_PROMPTS } from '../src/game/voicePrompts';
describe('r15.4 小班带变量句子的录音清单', () => {
  it('展开后 id 唯一、文字非空；VOICE_PROMPTS 已含全部', () => {
    const P = dynamicPrompts();
    expect(Object.keys(P).length).toBeGreaterThan(60);
    for (const [k, t] of Object.entries(P)) { expect(t.trim(), k).not.toBe(''); expect(VOICE_PROMPTS[k], k).toBe(t); }
    if (process.env.VOICE_LIST) writeFileSync(process.env.VOICE_LIST, JSON.stringify(P, null, 1));
  });
});
