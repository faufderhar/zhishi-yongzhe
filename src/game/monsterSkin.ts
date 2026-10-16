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
/** r10：不同学段的 Boss 用不同名字（同一套美术）：小学用原名，初一 / 高一各有自己的名字 */
export const BOSS_NAME: Record<'J' | 'H', Record<MonTheme, string>> = {
  J: { number: '有理数大将', ink: '墨韵书生王', letter: '单词迷宫王', flask: '实验怪博士', gear: '齿轮守卫长', plant: '森林巨木王', fossil: '史册守护者', mist: '迷雾大法官' },
  H: { number: '函数魔方帝', ink: '文言墨龙', letter: '语法巨像', flask: '元素炼金王', gear: '力学钢铁兽', plant: '基因藤蔓女王', fossil: '时空化石巨人', mist: '哲思迷雾王' },
};
export function skinFor(subject: string | undefined, kind: LevelKind, band?: string): MonSkin | null {
  const t = subject ? THEME_OF[subject] : undefined; if (!t) return null;
  const sk0 = SKINS[t][kind]; const bn = kind === 'boss' && (band === 'J' || band === 'H') ? BOSS_NAME[band][t] : undefined;
  const sk = sk0 && bn ? { ...sk0, name: bn } : sk0;
  // r8：多个学科共用一个怪物池时，Boss 显示名加学科前缀（如「历史·化石地球仪巨人」/「地理·化石地球仪巨人」）
  if (kind === 'boss' && sk && sharedPool(t)) return { ...sk, name: `${subject}·${sk.name}` };
  return sk;
}
export const sharedPool = (t: MonTheme) => new Set(ART.filter(a => a.theme === t).flatMap(a => a.pool_cn)).size > 1;
/** 小班 / 低年级用柔和版（*_soft） */
export const softFor = (band: string) => band === 'K' || band === 'G1';
/** r11：幼儿园温和战斗的怪兽——从学科怪物的柔和版（*_soft）里挑最圆、最不吓人的普通级（只有普通级标了 kinder 学段）。
    选用：小七（数学）、泡泡烧瓶（科学）、菊石宝宝（史地）、小芽芽（生物）、字母小 B（英语）。
    不用：墨团团（通体黑色、高光强，偏暗不符合护眼）、迷雾糯（表情是难过）、齿轮仔（齿轮边是尖角）。 */
export const KINDER_MON: Record<string, string> = { 数数: 'mon_math_normal', 颜色形状: 'mon_chem_normal', 认识动物: 'mon_histgeo_normal', 生活常识: 'mon_bio_normal', 儿歌古诗: 'mon_bio_normal', 英语: 'mon_english_normal' };
export function kinderSkin(subject: string | undefined): MonSkin | null {
  const id = subject ? KINDER_MON[subject] : undefined; const a = id ? ART.find(x => x.id === id) : undefined;
  return a ? { id: a.id, name: a.name, img: 'k', art: a } : null;
}
