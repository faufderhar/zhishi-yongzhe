/* 角色技能：随机释放判定（规格 v0.3.7 §2）。数据来自自动生成的 skills.data.ts */
import { SKILL_DATA, type SkillDef, type SkillSeg } from './skills.data';
import { SKILL, ENERGY_CAP } from './balance';
import type { Band } from './grades';
export type { SkillDef, SkillSeg } from './skills.data';
export const segOf = (band: Band): SkillSeg => band === 'K' ? 'K' : band === 'G1' ? 'P12' : band === 'G2' || band === 'G3' ? 'P36' : band === 'J' ? 'J' : 'H';
export const isVisualSeg = (seg: SkillSeg) => seg === 'K' || seg === 'P12';
export const skillsFor = (seg: SkillSeg, major: string) => SKILL_DATA.filter(k => k.seg === seg && k.major === major);
export const skillById = (id: string) => SKILL_DATA.find(k => k.id === id);
/** 技能判定状态（随战斗状态保存） */
export interface SkillRoll { dry: number; last: Record<string, string | undefined>; cd: Record<string, number> }
export const newRoll = (): SkillRoll => ({ dry: 0, last: {}, cd: {} });
/** 每个回合结束：冷却减 1 */
export const tickCd = (r: SkillRoll): SkillRoll => ({ ...r, cd: Object.fromEntries(Object.entries(r.cd).map(([k, v]) => [k, Math.max(0, v - 1)]).filter(([, v]) => (v as number) > 0)) });
function weighted(c: SkillDef[], rng: () => number) {
  const tot = c.reduce((a, k) => a + SKILL.weight[k.type], 0); let x = rng() * tot;
  for (const k of c) { x -= SKILL.weight[k.type]; if (x < 0) return k; }
  return c[c.length - 1];
}
/** 答对后判定；返回 [新判定状态, 触发的技能或 null]。energy 为本次答对加完之后的能量 */
export function roll(r0: SkillRoll, o: { seg: SkillSeg; major: string; side: 'P' | 'M'; correct: boolean; energy?: number; silenced?: boolean; rng: () => number }): [SkillRoll, SkillDef | null] {
  if (!o.correct || o.silenced) return [r0, null];
  const vis = isVisualSeg(o.seg);
  const poolKey = vis ? 'v' : o.side === 'P' ? 'atk' : 'guard';
  const pool = skillsFor(o.seg, o.major).filter(k => vis ? true : o.side === 'P' ? k.type === 'atk' : k.type !== 'atk').filter(k => !(r0.cd[k.id] > 0));
  const must = (!vis && (o.energy ?? 0) >= ENERGY_CAP) || r0.dry >= SKILL.pity[vis ? 'visual' : 'battle'];
  if (!pool.length || !(must || o.rng() < SKILL.rate[vis ? 'visual' : 'battle'])) return [{ ...r0, dry: r0.dry + 1 }, null];
  const cands = pool.length > 1 ? pool.filter(k => k.id !== r0.last[poolKey]) : pool;
  const k = weighted(cands, o.rng);
  return [{ dry: 0, last: { ...r0.last, [poolKey]: k.id }, cd: k.cd ? { ...r0.cd, [k.id]: k.cd } : r0.cd }, k];
}
