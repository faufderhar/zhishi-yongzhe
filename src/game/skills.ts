/* 角色技能：随机释放判定（规格 v0.3.7 §2）。数据来自自动生成的 skills.data.ts */
/* r17-13：效果 F1（清心 / 催化剂）规格写的「解除 1 个负面状态」——当前没有负面状态来源（rounds.ts 里 debuffs / silenced 只清不加），实际效果只有专注 +1；不改逻辑。 */
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
/** r16.1 (y) Boss补测裁定_r17 §3：这次答对如果触发技能，是哪种触发——能量满 / 保底（连续 N 次没触发）/ 运气（20%）。
 *  roll 的必定触发条件就用这个函数（同一处，不会说的和做的不一样）。energy 为本次答对加完之后的能量 */
export function triggerWhy(r0: SkillRoll, seg: SkillSeg, energy?: number): 'energy' | 'pity' | 'luck' {
  const vis = isVisualSeg(seg);
  if (!vis && (energy ?? 0) >= ENERGY_CAP) return 'energy';
  if (r0.dry >= SKILL.pity[vis ? 'visual' : 'battle']) return 'pity';
  return 'luck';
}
/** r17-4（学霸裁定 §1 / §3）：能量环弹窗和技能详情共用的触发规则行；高中另加冷却行 */
export const SKILL_TRIGGER_TEXT = '技能只在答对时放。每次答对有 20% 机会；答对后能量到 5 点，这道题一定放；连续 4 次答对没放，第 5 次一定放。放完能量清零。同一边的两个技能轮流出。答错、超时、漏选不会放。';
export const SKILL_COOLDOWN_TEXT = '冷却：放过的技能，接下来 3 个回合（控制、恢复、清心类 4 个回合；双方回合都算）不会再出；这一边的技能都在冷却时，「一定放」顺延到下一次答对。';
export const TRIGGER_TAG = { energy: '能量满', pity: '保底触发', luck: '幸运触发' } as const;
/** r16.1 (y)：角色卡上的技能说明（目前只有数字风暴，文案见 Boss补测裁定_r17 §3）；cd > 0 时加「冷却 N 回合」 */
export const STORM_CARD = '数字风暴：答对时有 20% 机会触发，本题伤害 ×1.4。能量攒满 5 点或连续 4 次答对没触发，下一次答对必定触发；触发后能量清零。';
export function skillCardLine(seg: SkillSeg, major: string, charId: string): string | null {
  const k = skillsFor(seg, major).find(x => x.charId === charId && x.name === '数字风暴');
  return k ? STORM_CARD + (k.cd ? `冷却 ${k.cd} 回合。` : '') : null;
}
/** 答对后判定；返回 [新判定状态, 触发的技能或 null]。energy 为本次答对加完之后的能量 */
export function roll(r0: SkillRoll, o: { seg: SkillSeg; major: string; side: 'P' | 'M'; correct: boolean; energy?: number; silenced?: boolean; rng: () => number }): [SkillRoll, SkillDef | null] {
  if (!o.correct || o.silenced) return [r0, null];
  const vis = isVisualSeg(o.seg);
  const poolKey = vis ? 'v' : o.side === 'P' ? 'atk' : 'guard';
  const pool = skillsFor(o.seg, o.major).filter(k => vis ? true : o.side === 'P' ? k.type === 'atk' : k.type !== 'atk').filter(k => !(r0.cd[k.id] > 0));
  const must = triggerWhy(r0, o.seg, o.energy) !== 'luck';
  if (!pool.length || !(must || o.rng() < SKILL.rate[vis ? 'visual' : 'battle'])) return [{ ...r0, dry: r0.dry + 1 }, null];
  const cands = pool.length > 1 ? pool.filter(k => k.id !== r0.last[poolKey]) : pool;
  const k = weighted(cands, o.rng);
  return [{ dry: 0, last: { ...r0.last, [poolKey]: k.id }, cd: k.cd ? { ...r0.cd, [k.id]: k.cd } : r0.cd }, k];
}
