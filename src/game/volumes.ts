/* r11（较真家长）：已学册别选择的状态定义
   - null = 全部册别（每册都亮）；[] = 一册都没选（保存时提示至少选一册，不会悄悄变回全部）
   - 点某一册：亮 → 灭，灭 → 亮；全部都亮了就记成 null
   - 〔全部册别〕：全亮时 → 全灭；否则 → 全亮
   - 「已学 X 册」不算「通用」和「拓展复习（不分册）」这类不分册的题 */
export type Vols = string[] | null;
export function toggleVol(cur: Vols, v: string, all: string[]): Vols {
  const base = cur ?? all; const nx = base.includes(v) ? base.filter(x => x !== v) : [...base, v];
  return all.every(x => nx.includes(x)) ? null : nx;
}
export const toggleAllVols = (cur: Vols): Vols => (cur === null ? [] : null);
export const isRealVolume = (v: string) => !/通用/.test(v) && !/拓展复习|不分册/.test(v) && v.trim() !== '';
export const learnedCount = (cur: Vols) => (cur ?? []).filter(isRealVolume).length;
export const volsValid = (cur: Vols) => cur === null || cur.length > 0;

/* r15.4.4（总管）：题库新增册别后，已经保存过「已学册别」的档案看不到新册别（例如 v32 的政治必修3 =「必修第三册」）。
   保存勾选时记下当时题库里这个年级的全部册别（volsKnown）；之后题库里多出来的册别，给这个档案自动勾上一次，家长页提示一次（家长可以再去掉）。
   没有 volsKnown 的旧档案 / 旧备份：当作「VOL_ADDED 里的册别出现之前」保存的。没保存过勾选（null = 全部册别）的档案不受影响。 */
import type { GradeKey } from './questions';
export const VOL_ADDED: Partial<Record<GradeKey, string[]>> = { '10': ['必修第三册'] };   // 题库 v32：政治必修3
export interface VolSync { volumes: string[] | null; volsKnown?: string[]; added: string[] }
export function syncNewVolumes(p: { grade: GradeKey; volumes: string[] | null; volsKnown?: string[] }, gradeVols: string[]): VolSync | null {
  if (!gradeVols.length) return null;   // 题库还没载入
  if (p.volumes === null) return p.volsKnown ? { volumes: null, volsKnown: undefined, added: [] } : null;
  const known = p.volsKnown ?? gradeVols.filter(v => !(VOL_ADDED[p.grade] ?? []).includes(v));
  const added = gradeVols.filter(v => !known.includes(v) && !p.volumes!.includes(v));
  const same = !!p.volsKnown && p.volsKnown.length === gradeVols.length && gradeVols.every(v => p.volsKnown!.includes(v));
  if (!added.length && same) return null;
  return { volumes: [...p.volumes, ...added], volsKnown: [...gradeVols], added };
}
/** 提示里的写法：「政治 必修第三册」（同一册别有几科新题就都写上） */
export const volLabel = (v: string, subjects: string[]) => subjects.length ? `${subjects.join('、')} ${v}` : v;
