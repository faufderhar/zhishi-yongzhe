/* 错题本盒子法（GDD §7.3）：1 号盒→第 2 天；2 号盒→3 天后；3 号盒→7 天后；3 号盒答对→已掌握 */
export interface WrongEntry {
  id: string;            // profileId + '|' + questionKey
  profileId: string; qkey: string; subject: string;
  box: 1 | 2 | 3; due: string; wrongCount: number; lastAnswer: string; addedAt: number; updatedAt: number;
}
export const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function addDays(day: string, n: number) { const [y, m, d] = day.split('-').map(Number); return dayStr(new Date(y, m - 1, d + n)); }
export const INTERVAL = { 1: 1, 2: 3, 3: 7 } as const;

export function onWrong(prev: WrongEntry | undefined, base: { profileId: string; qkey: string; subject: string }, answer: string, today = dayStr(), now = Date.now()): WrongEntry {
  return { id: `${base.profileId}|${base.qkey}`, ...base, box: 1, due: addDays(today, 1), wrongCount: (prev?.wrongCount ?? 0) + 1, lastAnswer: answer, addedAt: prev?.addedAt ?? now, updatedAt: now };
}
/** 复习答对：盒子 +1；3 号盒答对 → null（已掌握，移出错题本，+1 星） */
export function onReviewRight(e: WrongEntry, today = dayStr(), now = Date.now()): WrongEntry | null {
  if (e.box === 3) return null;
  const box = (e.box + 1) as 2 | 3;
  return { ...e, box, due: addDays(today, INTERVAL[box]), updatedAt: now };
}
export const isDue = (e: WrongEntry, today = dayStr()) => e.due <= today;
