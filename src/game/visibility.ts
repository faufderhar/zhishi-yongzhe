/* r16 第 10 步（策划 + 总管）：哪些「年级 + 科目 + 册别」进游戏。
   最终可见 = 没有被总管强制隐藏（FORCE_HIDDEN） 且 通过题量门槛（自动规则）。
   自动规则（加载内置题库时算，只看内置题、只算可玩题）：某个「年级 + 科目 + 册别」里只要有一个小节（unit）可玩题少于 MIN_SECTION_QS，
   整个「科目 + 册别」都藏起来；一个科目的册别全藏了 → 整个科目藏起来。
   - 幼儿园（K1–K3）不用这条：幼儿园关卡按小节固定 5 题一关、小节本来就小（r16 报告里 K1/K2 也没有不足 10 题的小节），见 AUTO_EXEMPT_GRADES。
   - AUTO_EXEMPT：r15.4.4 已上线、但会被规则藏掉的条目在这里豁免（v45 / v46 报告：没有这样的条目，见 STATUS.md）。
   取消隐藏 = 改 FORCE_HIDDEN 一行（或补够题量），不用改别处。 */
import type { GradeKey, Question } from './questions';
import { playable } from './questions';

export const MIN_SECTION_QS = 10;
/** 总管强制隐藏：'科目'（整科）或 '科目|册别'。r16：初二生物 / 地理、高二物理（教材版本已定，但 r16 先不开） */
// r16.1（总管，题库 v47）：初二生物 532 题 / 地理 524 题，80 个小节都 ≥ 10 题 → 解除强制隐藏，交给自动规则；高二物理仍强制隐藏
export const FORCE_HIDDEN: Partial<Record<GradeKey, string[]>> = { '11': ['物理'] };
export const AUTO_EXEMPT_GRADES = new Set<GradeKey>(['K1', 'K2', 'K3']);
/** 自动规则豁免：'年级|科目|册别' */
/* r16.1（题库 v47）：小学下册新放进游戏的小节只有 5 题（5B / 6B Unit 1）和 2 题（六下《学弈》）——按规则整册会被藏掉，
   但这三册 r16 线上就有（五下英语 69 题、六下英语 / 语文 271 题），藏掉 = 线上内容消失；豁免，见 STATUS.md（待总管确认） */
// r16.2（总管，题库 v50）：5B / 6B Unit 1 补到 10 题、六下《学弈》补到 10 题 → 三条豁免删掉，规则下这三册照样可见（tests/r162v50.test.ts）
export const AUTO_EXEMPT = new Set<string>([]);

export interface HideRow { grade: GradeKey; subject: string; volume: string; why: 'force' | 'auto'; unit?: string; n?: number }
export interface Visibility { hiddenVol: Set<string>; hiddenSubj: Set<string>; rows: HideRow[] }
const vk = (g: string, s: string, v: string) => `${g}|${s}|${v}`;

/** 自动规则：返回会被藏掉的「年级 + 科目 + 册别」（带最小的那个小节） */
export function autoHidden(qs: Question[]): HideRow[] {
  const sec = new Map<string, number>();
  for (const q of playable(qs, false)) { if (AUTO_EXEMPT_GRADES.has(q.grade)) continue; const k = vk(q.grade, q.subject, q.volume) + '|' + (q.unit ?? ''); sec.set(k, (sec.get(k) ?? 0) + 1); }
  const worst = new Map<string, HideRow>();
  for (const [k, n] of sec) { if (n >= MIN_SECTION_QS) continue; const [grade, subject, volume, ...u] = k.split('|'); const key = vk(grade, subject, volume); if (AUTO_EXEMPT.has(key)) continue;
    const cur = worst.get(key); if (!cur || n < cur.n!) worst.set(key, { grade: grade as GradeKey, subject, volume, why: 'auto', unit: u.join('|'), n }); }
  return [...worst.values()];
}
export function computeVisibility(qs: Question[]): Visibility {
  const rows: HideRow[] = [], hiddenVol = new Set<string>(), hiddenSubj = new Set<string>();
  const vols = new Map<string, Set<string>>();   // 'g|s' → 册别
  for (const q of playable(qs, false)) { const k = `${q.grade}|${q.subject}`; (vols.get(k) ?? vols.set(k, new Set()).get(k)!).add(q.volume); }
  for (const [gs, vs] of vols) { const [g, s] = gs.split('|'); const f = FORCE_HIDDEN[g as GradeKey] ?? [];
    for (const v of vs) if (f.includes(s) || f.includes(`${s}|${v}`)) { hiddenVol.add(vk(g, s, v)); rows.push({ grade: g as GradeKey, subject: s, volume: v, why: 'force' }); } }
  for (const r of autoHidden(qs)) { const k = vk(r.grade, r.subject, r.volume); if (hiddenVol.has(k)) { rows.find(x => vk(x.grade, x.subject, x.volume) === k)!.n = r.n; continue; } hiddenVol.add(k); rows.push(r); }
  for (const [gs, vs] of vols) if ([...vs].every(v => hiddenVol.has(`${gs}|${v}`))) hiddenSubj.add(gs);
  return { hiddenVol, hiddenSubj, rows };
}
/** 这道题所在的「年级 + 科目 + 册别」是否藏起来（家长导入的新科目 / 新册别不在内置题里 → 不受自动规则影响，只受 FORCE_HIDDEN） */
export const isHiddenBy = (vis: Visibility, q: { grade: GradeKey; subject: string; volume: string }) => {
  const f = FORCE_HIDDEN[q.grade] ?? [];
  return vis.hiddenSubj.has(`${q.grade}|${q.subject}`) || vis.hiddenVol.has(vk(q.grade, q.subject, q.volume)) || f.includes(q.subject) || f.includes(`${q.subject}|${q.volume}`);
};
