import { qRev, type Question } from './questions';
/* 错题本盒子法（GDD §7.3）：1 号盒→第 2 天；2 号盒→3 天后；3 号盒→7 天后；3 号盒答对→已掌握 */
export interface WrongEntry {
  id: string;            // profileId + '|' + questionKey
  profileId: string; qkey: string; subject: string;
  box: 1 | 2 | 3; due: string; wrongCount: number; lastAnswer: string; addedAt: number; updatedAt: number;
  /** r16：答错时题目的内容版本（questions.qRev）；题库后来改了这题，就不再把旧答案字母对到新选项上 */ rev?: string;
}
export const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function addDays(day: string, n: number) { const [y, m, d] = day.split('-').map(Number); return dayStr(new Date(y, m - 1, d + n)); }
export const INTERVAL = { 1: 1, 2: 3, 3: 7 } as const;

export function onWrong(prev: WrongEntry | undefined, base: { profileId: string; qkey: string; subject: string; rev?: string }, answer: string, today = dayStr(), now = Date.now()): WrongEntry {
  return { id: `${base.profileId}|${base.qkey}`, ...base, box: 1, due: addDays(today, 1), wrongCount: (prev?.wrongCount ?? 0) + 1, lastAnswer: answer, addedAt: prev?.addedAt ?? now, updatedAt: now };
}
/** 复习答对：盒子 +1；3 号盒答对 → null（已掌握，移出错题本，+1 星） */
export function onReviewRight(e: WrongEntry, today = dayStr(), now = Date.now()): WrongEntry | null {
  if (e.box === 3) return null;
  const box = (e.box + 1) as 2 | 3;
  return { ...e, box, due: addDays(today, INTERVAL[box]), updatedAt: now };
}
export const isDue = (e: WrongEntry, today = dayStr()) => e.due <= today;

/** r16（题库 v43）：错题本里「你的答案」还能不能对到现在的题上。题目总是按 id 从当前题库读；
    记过 rev → 和当前版本比；旧记录没有 rev → 记下的「答错的答案」现在恰好是正确答案，说明题改过（如判断题对→错） */
export function wrongStale(e: Pick<WrongEntry, 'rev' | 'lastAnswer'>, q: Question): boolean {
  if (e.rev) return e.rev !== qRev(q);
  if (!e.lastAnswer) return false;
  const a = e.lastAnswer.trim();
  return q.type === '填空' ? q.answer.some(x => x.trim() === a) : [...a].sort().join('') === [...q.answer].sort().join('');
}
