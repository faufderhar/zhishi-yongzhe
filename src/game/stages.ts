/* r8b：两级关卡入口（学段 → 年级）。没有题库的年级显示「敬请期待」，不能进 */
import type { GradeKey } from './questions';
export type StageId = 'K' | 'P' | 'J' | 'H';
export interface GradeItem { key: string; label: string; grade?: GradeKey /* 有题库才有 */; icon?: string /* r9：小班不识字，配图 */ }
export interface Stage { id: StageId; label: string; icon: string; grades: GradeItem[] }
export const STAGES: Stage[] = [
  { id: 'K', label: '幼儿园', icon: '🧸', grades: [{ key: 'K1', label: '小班', grade: 'K1', icon: '🐰' }, { key: 'K2', label: '中班', grade: 'K2', icon: '🐻' }] },
  { id: 'P', label: '小学', icon: '🎒', grades: (['1', '2', '3', '4', '5', '6'] as GradeKey[]).map((g, i) => ({ key: g, label: '一二三四五六'[i] + '年级', grade: g })) },
  { id: 'J', label: '初中', icon: '📘', grades: [{ key: '7', label: '初一', grade: '7' }, { key: '8', label: '初二', grade: '8' }, { key: '9', label: '初三' }] },
  { id: 'H', label: '高中', icon: '🔬', grades: [{ key: '10', label: '高一', grade: '10' }, { key: '11', label: '高二', grade: '11' }, { key: '12', label: '高三' }] },
];
export const stageOf = (g: string): StageId => g.startsWith('K') ? 'K' : +g <= 6 ? 'P' : +g <= 9 ? 'J' : 'H';
/** 只有档案年级可以直接进；其他（有题库的）年级要家长确认 */
export const needsGate = (profileGrade: string, g: string) => g !== profileGrade;
/** 默认选中：上次选的（且仍有题库）→ 档案年级 */
export function defaultPick(profileGrade: GradeKey, last?: string): GradeKey {
  const ok = STAGES.flatMap(s => s.grades).find(x => x.key === last && x.grade);
  return (ok?.grade ?? profileGrade);
}
