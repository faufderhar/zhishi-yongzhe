/* r17 D：小班期末庆祝关（上学期 = 大乌云，下学期 = 彩虹云）。纯逻辑，可单测。
   - 题库里小班只有一个册别「小班」，没有上 / 下学期字段：每个学科章按地图顺序的单元，前一半（向上取整）= 上学期，其余 = 下学期（待策划确认）。
   - 位置：小班地图最后一个章节「🌈 期末庆祝」里两关（上学期、下学期），各是那学期主线的最后一关。
   - 解锁：这学期的每个单元都至少打过一关（有星）时打开（各单元第一关本来就开着，所以按「打过」算）；测试构建的全解锁照常生效。
   - 出题：题数 = 普通关；从这学期打过的关里取（不够时再加这学期已解锁的关），各学科轮流挑，按难度从易到难排。
   - 温和规则：不扣分、不失败、不计时、没有复活页；血条换成一排爱心；结尾不出现「打败 / 胜利」，读结尾语再颁学期奖章。 */
import type { Chapter, Level } from './levels';
import { isUnlocked, starOf } from './levels';
import type { Question } from './questions';
import { shuffle } from './questions';
export type TermNo = 1 | 2;
export const TERM_CHAPTER = '期末庆祝';
export const TERM_GRADE = 'K1';
export const termLevelId = (t: TermNo) => `K1:term${t}`;
/** 朗读文字（与录音包 p:k_term* 的文字一致，见 voicePrompts.ts） */
export const TERM_TEXT = {
  intro: { 1: '哎呀，大乌云有点不开心，我们一起答题逗它笑吧！', 2: '彩虹云来找你玩啦，答对题目它就会变出彩虹哦！' },
  end: { 1: '大乌云被你逗笑啦！', 2: '彩虹云笑得好开心，变出了一道大彩虹！' },
  medal: { 1: '你得到了上学期小勇士奖章！真棒！', 2: '你得到了下学期彩虹奖章！你长大啦！' },
  heart: '点亮一颗爱心！', retry: '没关系，我们再想一想～',
} as const;
export const TERM_KEYS = { intro: { 1: 'p:k_term1_intro', 2: 'p:k_term2_intro' }, end: { 1: 'p:k_term1_end', 2: 'p:k_term2_end' }, medal: { 1: 'p:k_term1_medal', 2: 'p:k_term2_medal' }, heart: 'p:k_term_heart', retry: 'p:k_term_retry' } as const;
export const TERM_NAME: Record<TermNo, string> = { 1: '上学期 · 逗笑大乌云', 2: '下学期 · 彩虹云来玩' };
export const TERM_MEDAL_NAME: Record<TermNo, string> = { 1: '上学期小勇士奖章', 2: '下学期彩虹奖章' };
export const TERM_MON_NAME: Record<TermNo, string> = { 1: '大乌云', 2: '彩虹云' };
/** 图（public/images/k1_boss/，copy-kinder-art.mjs 拷贝） */
export const TERM_IMG = {
  intro2: 'images/k1_boss/mon_k1_rainbow_cloud_boss_intro.webp', end2: 'images/k1_boss/mon_k1_rainbow_cloud_boss_end.webp',
  overlay1: 'images/k1_boss/fx_rainbow_overlay.webp',
  heartEmpty: 'images/k1_boss/ui_heart_empty.webp', heartLit: 'images/k1_boss/ui_heart_lit.webp',
  medal: { 1: 'images/k1_boss/medal_term1_sun_cloud.webp', 2: 'images/k1_boss/medal_term2_rainbow.webp' } as Record<TermNo, string>,
};
/** 期末关的显示文字（测试：都不含「打败 / 胜利」） */
/** 庆祝乐句（public/sfx/，音量 ×0.5；主版进 SW 预缓存，离线第一次玩也有；运行时缓存 zy-sfx-term 作后备） */
export const TERM_SFX = 'sfx_k_term_celebrate.mp3';
export const TERM_BANNED = /打败|胜利/;
export const termStrings = () => [...Object.values(TERM_TEXT.intro), ...Object.values(TERM_TEXT.end), ...Object.values(TERM_TEXT.medal), TERM_TEXT.heart, TERM_TEXT.retry, ...Object.values(TERM_NAME), ...Object.values(TERM_MEDAL_NAME), ...Object.values(TERM_MON_NAME), TERM_CHAPTER];

const unitOf = (l: Level) => `${l.volume}|${l.unit}`;
/** 一个学科章里每关属于哪个学期：按地图顺序的单元，前 ⌈n/2⌉ 个单元 = 上学期 */
export function termOfChapter(ch: Chapter): Map<string, TermNo> {
  const units: string[] = []; for (const l of ch.levels) if (!units.includes(unitOf(l))) units.push(unitOf(l));
  const cut = Math.ceil(units.length / 2);
  return new Map(ch.levels.map(l => [l.id, (units.indexOf(unitOf(l)) < cut ? 1 : 2) as TermNo]));
}
/** 这个学期的关（每章：关 + 它在本章的序号） */
export function termMembers(chapters: Chapter[], t: TermNo): { ch: Chapter; l: Level; i: number }[] {
  return chapters.filter(c => c.subject !== TERM_CHAPTER).flatMap(ch => { const m = termOfChapter(ch); return ch.levels.map((l, i) => ({ ch, l, i })).filter(x => m.get(x.l.id) === t && !x.l.redirect); });
}
/** 期末关的「章」：小班才有；两关（上学期、下学期） */
export function termChapter(chapters: Chapter[]): Chapter | null {
  const subj = chapters.filter(c => c.subject !== TERM_CHAPTER);
  if (!subj.length) return null;
  const mk = (t: TermNo): Level => ({ id: termLevelId(t), chapter: TERM_CHAPTER, index: t - 1, kind: 'normal', name: TERM_NAME[t], volume: '小班', unit: t === 1 ? '上学期' : '下学期',
    pool: [...new Set(termMembers(subj, t).flatMap(x => x.l.pool))], term: t });
  const levels = ([1, 2] as TermNo[]).map(mk).filter(l => l.pool.length);
  return levels.length ? { subject: TERM_CHAPTER, name: TERM_CHAPTER, icon: '🌈', levels, volumes: ['小班'], count: new Set(levels.flatMap(l => l.pool)).size } : null;
}
/** 小班：学科章后面接上「期末庆祝」章（其它年级原样返回） */
export function withTermChapter(chapters: Chapter[], grade: string): Chapter[] {
  if (grade !== TERM_GRADE) return chapters; const t = termChapter(chapters); return t ? [...chapters, t] : chapters;
}
/** 这学期的单元（章 + 单元）→ 本单元的关 */
function termUnits(chapters: Chapter[], t: TermNo) { const m = new Map<string, Level[]>(); for (const x of termMembers(chapters, t)) { const k = x.ch.subject + '|' + unitOf(x.l); m.set(k, [...(m.get(k) ?? []), x.l]); } return m; }
/** 期末关开没开：这学期每个单元都至少打过一关 */
export function termOpen(chapters: Chapter[], t: TermNo, stars: Record<string, number>): boolean {
  const us = [...termUnits(chapters, t).values()]; return us.length > 0 && us.every(ls => ls.some(l => starOf(l, stars) > 0));
}
/** 还没打过的单元的第一关（地图上提示「先打这一关」） */
export function termBlocker(chapters: Chapter[], t: TermNo, stars: Record<string, number>): Level | undefined {
  return [...termUnits(chapters, t).values()].find(ls => !ls.some(l => starOf(l, stars) > 0))?.[0];
}
/** 出题：这学期打过的关的题（不够 n 道时用这学期已解锁的关）；各学科轮流挑（每科先随机），取 n 道，再按难度从易到难（同难度保持挑选顺序） */
export function termQuestions(chapters: Chapter[], t: TermNo, stars: Record<string, number>, byKey: Map<string, Question>, ok: (q: Question) => boolean, n: number, rnd = Math.random): Question[] {
  const bySubj = new Map<string, Question[]>(); const seen = new Set<string>();
  const ms = termMembers(chapters, t), done = ms.filter(x => starOf(x.l, stars) > 0);
  const cnt = new Set(done.flatMap(x => x.l.pool)).size;
  for (const x of cnt >= n ? done : ms.filter(x => isUnlocked(x.ch.levels, x.i, stars))) {
    for (const k of x.l.pool) { const q = byKey.get(k); if (!q || seen.has(k) || !ok(q)) continue; seen.add(k); const a = bySubj.get(x.ch.subject) ?? []; a.push(q); bySubj.set(x.ch.subject, a); } }
  const lists = shuffle([...bySubj.values()].map(a => shuffle(a, rnd)), rnd); const out: Question[] = [];
  for (let r = 0; out.length < n && lists.some(a => a.length > r); r++) for (const a of lists) { if (out.length >= n) break; if (a[r]) out.push(a[r]); }
  return out.map((q, i) => ({ q, i })).sort((a, b) => (a.q.difficulty ?? 1) - (b.q.difficulty ?? 1) || a.i - b.i).map(x => x.q);
}
