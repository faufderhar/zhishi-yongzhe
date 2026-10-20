/* r16.1 [HIGH] 高二选科（江苏 3+1+2，需求 R-11 的档案部分）：
   - 「还没选科（全科）」= { all: true }：所有科目都能玩，Boss 两阶段都没有弱点加成（R-13）。高二及以上新档案默认就是它。
   - 已选科 = { first: 物理 / 历史, second: 化学 / 生物 / 地理 / 政治 里两门（按勾选顺序）}。
   - 旧档案没有 electives（r16 没有选科界面）= 全科。
   - 选了科也不藏科目（R-11 的「没勾选的科目在地图上折叠」以后做）。 */
export const ELECTIVE_FIRST = ['物理', '历史'] as const;
export const ELECTIVE_SECOND = ['化学', '生物', '地理', '政治'] as const;
export interface Electives { all?: true; first?: string /* 首选：物理 / 历史 */; second?: string[] /* 再选：按勾选顺序 */ }
export const ALL_SUBJECTS: Electives = { all: true };
export const needsElectives = (grade: string | undefined) => { const g = Number(grade); return Number.isFinite(g) && g >= 11; };
export const isAllSubjects = (e: Electives | null | undefined) => !e || e.all === true || (!e.first && !(e.second?.length));
/** 已选科时要首选一门 + 再选两门才能保存；全科总是可以 */
export const electivesValid = (e: Electives | null | undefined) => !e || e.all === true
  || (!!e.first && (ELECTIVE_FIRST as readonly string[]).includes(e.first) && Array.isArray(e.second) && e.second.length === 2 && new Set(e.second).size === 2 && e.second.every(s => (ELECTIVE_SECOND as readonly string[]).includes(s)));
/** 备份 / 存档读入时清洗：只留合法的首选 / 再选（再选去重、最多 2 门）；什么都不剩 = 全科；不是对象 = 没有（全科） */
export function cleanElectives(v: unknown): Electives | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>; if (o.all === true) return { all: true };
  const first = typeof o.first === 'string' && (ELECTIVE_FIRST as readonly string[]).includes(o.first) ? o.first : undefined;
  const second = Array.isArray(o.second) ? [...new Set(o.second.filter((s): s is string => typeof s === 'string' && (ELECTIVE_SECOND as readonly string[]).includes(s)))].slice(0, 2) : [];
  if (!first && !second.length) return { all: true };
  return { ...(first ? { first } : {}), ...(second.length ? { second } : {}) };
}
export const electivesLabel = (e: Electives | null | undefined) => isAllSubjects(e) ? '还没选科（全科）' : [e!.first, ...(e!.second ?? [])].filter(Boolean).join(' + ');
