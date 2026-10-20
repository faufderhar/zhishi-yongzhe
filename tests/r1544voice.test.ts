// r15.4.4 小班录音：题库 v31 新题有录音；题库审核 读音复查 v2 的改动（两个 / 敬请期待 / ▭）
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { speakable, setKinderSpeech, sysRate, K_VOICE_SPEED } from '../src/tts';
import { HAPPY_LINE, SOON_LINE, dynamicPrompts } from '../src/game/voiceLines';
import { VOICE_PROMPTS, PROMPT_BY_TEXT } from '../src/game/voicePrompts';
import { KINDER_BOSS } from '../src/game/monsterSkin';
const man = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8'));
const bank = JSON.parse(readFileSync('public/banks/bank_K1.json', 'utf8'));
describe('r15.4.4 小班录音', () => {
  it('开心值：量词前的 2 写「两」，其余数字不变；朗读文字能查到录音', () => {
    expect(HAPPY_LINE(2, 3)).toBe('开心值两个，一共3个。'); expect(HAPPY_LINE(1, 2)).toBe('开心值1个，一共两个。'); expect(HAPPY_LINE(3, 5)).toBe('开心值3个，一共5个。');
    for (let m = 1; m <= 5; m++) for (let n = 1; n <= m; n++) { const id = PROMPT_BY_TEXT[HAPPY_LINE(n, m)]; expect(id).toBe(`happy_${n}_${m}`); expect(man.items['p:' + id]).toMatch(/\.mp3$/); expect(man.meta['p:' + id].text).toBe(HAPPY_LINE(n, m)); }
    expect(Object.values(VOICE_PROMPTS).some(t => /开心值2个|一共2个/.test(t))).toBe(false);
  });
  it('没开放的年级：朗读「快要来啦，等一等哦」，不再说「敬请期待」', () => {
    expect(SOON_LINE('初二')).toBe('初二还在准备中，快要来啦，等一等哦');
    expect(Object.values(dynamicPrompts()).some(t => t.includes('敬请期待'))).toBe(false);
    for (const k of ['p:soon_8', 'p:soon_9', 'p:soon_11', 'p:soon_12']) expect(man.meta[k].text).toMatch(/快要来啦，等一等哦$/);
  });
  it('只有几何符号的选项（KC-028「▭」）和 🔺⚪ 一样不朗读、没有录音；带文字的不受影响', () => {
    expect(speakable('▭')).toBe(''); expect(speakable(' ▭ ')).toBe(''); expect(speakable('🔺')).toBe('');
    expect(speakable('4 ○ 2，○ 里填什么？')).toBe('4 ○ 2，○ 里填什么？ '.trim()); expect(speakable('长方形')).toBe('长方形');
    expect(man.items['KC-028#opt0']).toBeUndefined();
  });
  it('题库 v31 / v32：小班每道题的题干、每个能朗读的选项都有录音，文件都在；K-038 读「两个苹果」', () => {
    expect(['v31', 'v32', 'v33', 'v34', 'v42', 'v43', 'v44', 'v45', 'v46']).toContain(bank.version);   // v32 的小班题和 v31 相同（录音按 v31 生成）
    const miss: string[] = [];
    for (const q of bank.questions) {
      const t = q.tts_text === '-' ? '' : (q.tts_text || q.question); if (t && speakable(t) && !man.items[q.id + '#stem']) miss.push(q.id + '#stem');
      if (q.type === '选择') (q.options || []).forEach((o: { text?: string }, i: number) => { if (speakable(o.text || '') && !man.items[`${q.id}#opt${i}`]) miss.push(`${q.id}#opt${i}`); });
    }
    expect(miss).toEqual([]);
    for (const f of new Set(Object.values(man.items) as string[])) expect(existsSync('public/voice/' + f), f).toBe(true);
    expect(man.meta['K-038#stem'].text).toBe('哪一组是两个苹果？');
    for (const id of ['KG-036', 'KD-041', 'KE-041', 'KE-050']) expect(man.items[id + '#stem']).toMatch(/\.mp3$/);
  });
  it('小班系统朗读退路语速跟着放慢：0.9 × 1.2 / 1.5 = 0.72；其他年级 0.9', () => {
    expect(K_VOICE_SPEED).toBe(1.2);
    setKinderSpeech(true); expect(sysRate()).toBeCloseTo(0.72, 9); setKinderSpeech(false); expect(sysRate()).toBe(0.9);
  });
  it('每句登记过的提示语都有录音（含新句 p:res_k_again）', () => {
    // r16：新开的三个年级名（年级选择里朗读）等录音——列在 /workspace/playtest/r16dev/new_voice_lines.md，录好后这里改回 []
    // r16 新句（/workspace/playtest/r16dev/new_voice_lines.md），等音频设计录：年级名 + 中班 23 只 Boss 的「回家 / 笑啦」
    const PENDING = ['grade_k2', 'grade_8', 'grade_11', 'res_k_why', ...Array.from({ length: 10 }, (_, i) => `res_k_first_${i + 1}`), ...KINDER_BOSS.flatMap(b => { const id = b.id.replace(/^mon_/, '').replace(/_boss$/, ''); return ['home_' + id, 'laugh_' + id]; })];
    const miss = Object.keys(VOICE_PROMPTS).filter(id => !man.items['p:' + id]); expect(miss.sort()).toEqual(PENDING.sort());
  });
});

import { K_WAIT } from '../src/ui/Battle';
describe('r15.4.4 afterVoice 预算盖得住表扬+技能+开心值', () => {
  it('nextMax / endMax ≥ 最长录音链（语速 1.2）', () => {
    // p:praise4 1.18 + gap + p:sk_k_abei_1 2.54 + gap + p:happy_3_3 2.42 ≈ 6.3 s；从答对起算还要含 correctMs 动画
    expect(K_WAIT.nextMax).toBeGreaterThanOrEqual(8000);
    expect(K_WAIT.endMax).toBeGreaterThanOrEqual(10000);
  });
});
