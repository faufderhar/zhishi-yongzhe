// r17：大班（还没导入，题库只在开发机 /workspace/questions）——游戏可用题的题干和能朗读的文字选项都有录音、文字和题库一致。CI 上没有题库源 → 跳过
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { speakable } from '../src/tts';
import { boxPath, missing } from './boxSrc';
const SRC = boxPath('questions/题库_游戏可用_幼儿园大班.json');
const norm = (s: string) => s.replace(/[\u200d\ufe0f]/g, '').trim();
it('大班：题干 / 文字选项都有录音、文字一致（v57 改字的选项等音频设计重录，在那之前如实报出来）', ({ skip }) => {
  skip(missing(SRC).length > 0, `题库源不在（CI）：${SRC}`);
  const man = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8')); const b = JSON.parse(readFileSync(SRC, 'utf8'));
  const miss: string[] = [], diff: string[] = [];
  const chk = (k: string, s: string, t: string) => { if (!man.items[k]) { miss.push(k); return; } const mt = man.meta?.[k]?.text; if (mt && norm(mt) !== norm(s) && norm(mt) !== norm(t)) diff.push(`${k} 录音「${mt}」题库「${t}」`); };
  for (const q of b.questions) { const t = q.tts_text === '-' ? '' : (q.tts_text || q.question); if (t && speakable(t)) chk(q.id + '#stem', speakable(t), t);
    if (q.type === '选择') (q.options || []).forEach((o: { text?: string }, i: number) => { const s = speakable(o.text || ''); if (s) chk(`${q.id}#opt${i}`, s, o.text || ''); }); }
  expect(miss).toEqual([]); expect(diff).toEqual([]);
});
