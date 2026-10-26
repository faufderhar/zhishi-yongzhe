// r16 3：中班录音包（音频设计 2026-10-19，语速 1.2，2004 键 / 1162 mp3；r16 换成整包 3253 键 / 1862 mp3，含大班（隐藏中）、K2E-016 选项、p:retry/p:think 新录音）——每道开放的中班题题干、每个能朗读的文字选项都有录音
import { it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { speakable } from '../src/tts';
import { loadBank, playable } from '../src/game/questions';
const man = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8'));
// 录音包按题库 v36 生成；v41 起 K2E-016 三个选项由纯 emoji（不朗读）改成「火车 / 风筝 / 气球」——等音频设计补键（同文字录音已有：K2C-038_opt0 / KL-029_opt1 / K2C-055_opt0）
const PENDING: string[] = [];   // r16：整包已补 K2E-016#opt0–2
const norm = (s: string) => s.replace(/[\u200d\ufe0f]/g, '').trim();
it('包的规模：3284 键 / 1929 个 mp3，文件都在（r16.2：v51 包，106 键换了录音；r17：+15 句提示语 + 8 句期末庆祝关 1.1 倍速 + K3C-071；v57 包 28 个选项重录；r17.1：+2 睡觉句 + 3 个年级名 大班 / 初三 / 高三）', () => {
  expect(Object.keys(man.items).length).toBe(3284);
  const files = new Set(Object.values(man.items).flatMap(v => [v].flat()) as string[]);
  expect(files.size).toBe(1929);
  for (const f of files) expect(existsSync('public/voice/' + f), f).toBe(true);
  expect(readdirSync('public/voice').filter(f => f.endsWith('.mp3')).length).toBe(1929);
});
it('中班开放题：题干和可朗读文字选项都有录音、文字一致', () => {
  const raw = JSON.parse(readFileSync('public/banks/bank_K2.json', 'utf8'));
  const play = new Set(playable(loadBank(raw, '').all, false).map(q => q.id)); expect(play.size).toBe(324);
  const miss: string[] = [], diff: string[] = [];
  const chk = (k: string, s: string, t: string) => { if (!man.items[k]) { miss.push(k); return; } const mt = man.meta?.[k]?.text; if (mt && norm(mt) !== norm(s) && norm(mt) !== norm(t)) diff.push(`${k} 录音「${mt}」题库「${t}」`); };
  for (const q of raw.questions) {
    if (!play.has(q.id)) continue;
    const t = q.tts_text === '-' ? '' : (q.tts_text || q.question); if (t && speakable(t)) chk(q.id + '#stem', speakable(t), t);
    if (q.type === '选择') (q.options || []).forEach((o: { text?: string }, i: number) => { const s = speakable(o.text || ''); if (s) chk(`${q.id}#opt${i}`, s, o.text || ''); });
  }
  expect(miss).toEqual(PENDING); expect(diff).toEqual([]);   // r17：v56 / v57 改字的选项等音频设计重录，在那之前这里如实失败（不豁免）
});
