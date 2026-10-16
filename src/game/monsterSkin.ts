/* 按科目的怪物池（策划 r6 裁定 3）。数值仍来自 MONSTERS / ROUND（不变），这里只换名字和外观。
   名字 / 序列帧来自美术 manifest（/workspace/art/monsters/manifest.json → src/game/monsters.manifest.json，24 只 = 8 池 × 普通/精英/Boss）。
   序列帧加载失败时回退到旧的静态立绘（img）+ 程序动画。 */
import type { LevelKind } from './grades';
import MANIFEST from './monsters.manifest.json';
export type MonTheme = 'number' | 'ink' | 'letter' | 'flask' | 'gear' | 'plant' | 'fossil' | 'mist';
export type MonAnim = 'idle' | 'attack' | 'hit' | 'defeat';
export interface MonArt { id: string; name: string; theme: MonTheme; tier: LevelKind; pool_cn: string[]; dir: string; anims: Record<MonAnim, { json: string; soft: string; hit_frame?: number | null }> }
export interface MonSkin { id: string; name: string; img: 'k' | 'j' | 'jb' | 'h' | 'hb'; art: MonArt }
const ART = Object.entries(MANIFEST as unknown as Record<string, Omit<MonArt, 'id'>>).map(([id, v]) => ({ id, ...v })) as MonArt[];
export const THEME_OF: Record<string, MonTheme> = Object.fromEntries(ART.flatMap(a => a.pool_cn.map(s => [s, a.theme])));
/** 静态回退立绘（序列帧没加载出来时） */
const FALLBACK: Record<MonTheme, MonSkin['img']> = { number: 'j', ink: 'jb', letter: 'j', flask: 'jb', gear: 'h', plant: 'jb', fossil: 'hb', mist: 'h' };
export const SKINS = Object.fromEntries((['number', 'ink', 'letter', 'flask', 'gear', 'plant', 'fossil', 'mist'] as MonTheme[]).map(t => [t,
  Object.fromEntries((['normal', 'elite', 'boss'] as LevelKind[]).map(k => { const a = ART.find(x => x.theme === t && x.tier === k)!; return [k, { id: a.id, name: a.name, img: FALLBACK[t], art: a }]; }))])) as Record<MonTheme, Record<LevelKind, MonSkin>>;
export function skinFor(subject: string | undefined, kind: LevelKind): MonSkin | null {
  const t = subject ? THEME_OF[subject] : undefined; if (!t) return null;
  const sk = SKINS[t][kind];
  // r8：多个学科共用一个怪物池时，Boss 显示名加学科前缀（如「历史·化石地球仪巨人」/「地理·化石地球仪巨人」）
  if (kind === 'boss' && sk && sharedPool(t)) return { ...sk, name: `${subject}·${sk.name}` };
  return sk;
}
export const sharedPool = (t: MonTheme) => new Set(ART.filter(a => a.theme === t).flatMap(a => a.pool_cn)).size > 1;
/** 小班 / 低年级用柔和版（*_soft） */
export const softFor = (band: string) => band === 'K' || band === 'G1';
