/* r10：题库 v19 统一册别写法（questions/README v19 节）。家长存的「已学册别」从旧写法迁到新写法，不用重新勾选 */
import type { GradeKey } from './questions';
export const VOLUME_V19: Partial<Record<GradeKey, Record<string, string[]>>> = {
  '7': { '七年级上册(7A)': ['七年级上册'], '七年级下册(7B)': ['七年级下册'], '': ['拓展复习（不分册）'] },
  '10': { '纲要上': ['必修上册'], '必修上': ['必修上册'], '必修1 中国特色社会主义': ['必修第一册'], '必修2 经济与社会': ['必修第二册'], '必修1 分子与细胞': ['必修第一册'],
    '': ['必修下册', '拓展复习（不分册）'] },
};
export function migrateVolumes(grade: GradeKey, vols: string[] | null): string[] | null {
  if (!vols) return vols; const m = VOLUME_V19[grade]; if (!m) return vols;
  return [...new Set(vols.flatMap(v => m[v] ?? [v]))];
}
