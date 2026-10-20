/* r16.1 [HIGH] 填空用哪种键盘（以前：英语或答案里有 e 以外的拉丁字母 → 字母键盘，其余一律数字键盘——
   高二诗词「补全诗句：天生我材必有用，____。」答案是汉字，却给了数字键盘，打不出来）。
   规则：
   - num     所有可接受答案都是「纯数」（数字、正负号、小数、分数 / 带分数、百分数、×10ⁿ 科学计数），且至少一个能直接用数字键盘按出来
   - letters 所有可接受答案都能用自带字母键盘按出来（a–z、空格、' -），且是英语或答案里有字母（保持 r15 的英语体验）
   - ime     其余（任何一个答案不是纯数、也不全是字母键盘能打的：汉字、化学式 H2O、带标点…）→ 系统输入法（普通文本框，inputmode=text）
   判分统一走 questions.ts judge（全角 / 半角、空白已归一）。 */
import type { Question } from './questions';
export type FillKind = 'num' | 'letters' | 'ime';
/** 纯数：去掉空白后是 整数 / 小数 / 分数 / 带分数（1又1/2、1 1/2）/ 百分数 / 科学计数（e 或 ×10^） */
export function isPureNumber(a: string): boolean {
  const t = a.normalize('NFKC').trim().replace(/[−–]/g, '-').replace(/^\+/, '');
  if (/^-?\d+(?:又|\s+)\d+\/\d+$/.test(t)) return true;
  const u = t.replace(/\s+/g, '').replace(/×10\^?/g, 'e');
  return /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?%?$/i.test(u) || /^-?\d+(\.\d+)?\/-?\d+(\.\d+)?$/.test(u);
}
/** 数字键盘能直接按出来（7 8 9 4 5 6 1 2 3 - 0 . / 和高中的 ×10ⁿ） */
export const numTypeable = (a: string, sci: boolean) => { const u = a.normalize('NFKC').trim().replace(/\s+/g, '').replace(/×10\^?/g, 'e').replace(/[−–]/g, '-');
  return (sci ? /^[0-9.\-/e]+$/ : /^[0-9.\-/]+$/).test(u) && !/^[e]|e$/.test(u); };
/** 字母键盘能直接按出来（a–z 不分大小写、空格、' -；弯撇号 / 各种连字符判分时归一） */
export const lettersTypeable = (a: string) => /^[a-z '\-]+$/.test(a.normalize('NFKC').toLowerCase().replace(/[’‘ʼ′`]/g, "'").replace(/[‐‑‒–—−]/g, '-').trim().replace(/\s+/g, ' '));
/* r16.1（题库 v48 input_type）：唯一的键盘决定点。
   - 题目带 input_type：numeric → 数字键盘（高中照旧有 ×10ⁿ）；text → 不出数字键盘，在字母键盘 / 系统输入法里按下面同一条字母规则选：
       答案都能用字母键盘打（a–z、空格、' -），且是英语题或答案里有字母 → 字母键盘；否则 → 系统输入法。
   - 不带字段（家长自己出的题、旧备份）→ 按答案自动判断（下面 num / letters / ime 三条）。
   题库的标注规则和这里的自动判断逐字相同（v48 说明 §1），所以带不带字段结果一样；字段只是让题库能明确指定。 */
export function fillKind(q: Pick<Question, 'subject' | 'answer'> & { input_type?: 'numeric' | 'text' }, sci = false): FillKind {
  const ans = q.answer.filter(a => a.trim() !== '');
  if (q.input_type === 'numeric') return 'num';
  if (q.input_type !== 'text' && ans.length && ans.every(isPureNumber) && ans.some(a => numTypeable(a, sci))) return 'num';
  if (ans.length && ans.every(lettersTypeable) && (q.subject === '英语' || ans.some(a => /[a-z]/i.test(a)))) return 'letters';
  return 'ime';
}
/** 审计 / 测试用：在分配到的键盘上，至少有一个可接受答案能打出来；数字键盘只给纯数答案 */
export function kindProblems(q: Pick<Question, 'subject' | 'answer'>, kind: FillKind, sci = false): string[] {
  const ans = q.answer.filter(a => a.trim() !== ''); const p: string[] = [];
  if (!ans.length) p.push('没有答案');
  if (kind === 'num') { const bad = ans.filter(a => !isPureNumber(a)); if (bad.length) p.push(`数字键盘但答案不是纯数：${bad.join(' / ')}`); if (!ans.some(a => numTypeable(a, sci))) p.push('数字键盘打不出任何一个答案'); }
  if (kind === 'letters' && !ans.some(lettersTypeable)) p.push('字母键盘打不出任何一个答案');
  return p;
}
/** 高中（10–12 年级）的数字键盘有 ×10ⁿ 键 */
export const sciOf = (grade: string | undefined) => grade === '10' || grade === '11' || grade === '12';
