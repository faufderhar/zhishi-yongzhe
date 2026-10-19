/* 按科目的怪物池（策划 r6 裁定 3）。数值仍来自 MONSTERS / ROUND（不变），这里只换名字和外观。
   名字 / 序列帧来自美术 manifest（/workspace/art/monsters/manifest.json → src/game/monsters.manifest.json，24 只 = 8 池 × 普通/精英/Boss）。
   序列帧加载失败时回退到旧的静态立绘（img）+ 程序动画。 */
import type { LevelKind } from './grades';
import MANIFEST from './monsters.manifest.json';
import GEN from './chapterBoss.gen.json';
import { chapterOf, splitDot } from './levels';
export type MonTheme = 'number' | 'ink' | 'letter' | 'flask' | 'gear' | 'plant' | 'fossil' | 'mist';
export type MonAnim = 'idle' | 'attack' | 'hit' | 'defeat';
export interface MonArt { id: string; name: string; theme: MonTheme; tier: LevelKind; pool_cn: string[]; dir: string; anims: Record<MonAnim, { json: string; soft: string; hit_frame?: number | null }> }
export interface MonSkin { hue?: number /* r15.1：同美术不同章节 Boss 的主色区分（hue-rotate 度数） */; id: string; name: string; img: 'k' | 'j' | 'jb' | 'h' | 'hb'; art: MonArt }
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
/* r15.1 策划：高一数学各章 Boss 原来都叫「函数魔方帝」——按章改名，美术不变、换主色；Boss id、星星不变 */
const H_MATH_BOSS: [string, string, number][] = [['指数与对数', '对数巨塔主', 40], ['函数概念与性质', '奇偶双面王', 140], ['幂函数、指数函数和对数函数', '指对双生龙', 200], ['三角函数', '周期轮回将', 260], ['函数应用', '零点潜行者', 310],
  /* r15.1 策划：其余 10 章也各用不同名字（苏教版章名），同一美术换主色 */
  ['集合', '交并迷雾主', 24], ['常用逻辑用语', '充要辩论王', 72], ['不等式', '均值天平守', 96], ['平面向量', '向量风暴骑', 168], ['三角恒等变换', '变形角度师', 216],
  ['解三角形', '正余弦三角将', 240], ['复数', '虚数幻影帝', 288], ['立体几何初步', '棱柱巨像', 336], ['统计', '样本收集者', 120], ['概率', '骰子命运师', 352]];
export function hMathBoss(unit: string | undefined): { name: string; hue: number } | undefined {
  if (!unit) return undefined; const ch = unit.split('·').find(x => /^第\d+章/.test(x))?.replace(/^第\d+章\s*/, '') ?? unit;
  const m = H_MATH_BOSS.find(([c]) => ch === c); return m ? { name: m[1], hue: m[2] } : undefined;
}
/* r15.3 策划：初一 / 高一各科多章共用一个 Boss 名——按章改名（72 个，来源 /workspace/playtest/Boss重名清单.csv「新名」列），
   同一美术每章换一个主色（hue-rotate）；共用怪物池的科目仍加「科目·」前缀；Boss id、星星不变。
   [学段, 科目, 章号, 章名, 新名, 主色] —— 章号 + 章名匹配章节路径里的那一段（七上 / 七下同号单元靠章名区分） */
/* r16 R-5（新年级关卡设计 §5.2）：初一和初二同属 J 段、都有「第1章」——key 改成 (年级, 科目, 章号, 章名[, 册别])，不再只看学段。
   [年级, 科目, 章号, 章名, 新名, 主色, 册别?]；初一 = '7'、高一 = '10'；新年级的行由 scripts/import-boss-names.py 从题库审核的 Boss 名对照表生成（chapterBoss.gen.json）。 */
export type BossRow = [string, string, string, string, string, number, string?];
export const CHAPTER_BOSS: BossRow[] = [
  ["7", "数学", "第1章", "数学与我们同行", "数学旅行家", 0],
  ["7", "数学", "第2章", "有理数", "正负数轴王", 0],
  ["7", "数学", "第3章", "代数式", "字母代数师", 0],
  ["7", "数学", "第4章", "一元一次方程", "方程天平侠", 0],
  ["7", "数学", "第5章", "走进几何世界", "几何积木王", 0],
  ["7", "数学", "第6章", "平面图形的初步认识", "直线射线仙", 0],
  ["7", "数学", "第7章", "幂的运算", "幂次火箭王", 0],
  ["7", "数学", "第8章", "整式乘法", "乘法公式匠", 0],
  ["7", "数学", "第9章", "图形的变换", "平移旋转师", 0],
  ["7", "数学", "第10章", "二元一次方程组", "消元双子星", 0],
  ["7", "数学", "第11章", "一元一次不等式", "不等号骑士", 0],
  ["7", "数学", "第12章", "定义 命题 证明", "命题推理官", 0],
  ["7", "语文", "第一单元", "第一单元", "四季画卷仙", 0],
  ["7", "语文", "第二单元", "第二单元", "亲情暖灯使", 0],
  ["7", "语文", "第三单元", "第三单元", "百草园书童", 0],
  ["7", "英语", "7A Unit 1", "This is me!", "自我介绍星", 0],
  ["7", "英语", "7A Unit 2", "Hobbies", "爱好百宝熊", 0],
  ["7", "英语", "7A Unit 3", "Welcome to our school!", "校园导游龙", 0],
  ["7", "英语", "7A Unit 4", "School days", "校园日程官", 0],
  ["7", "诗词", "第一单元", "第一单元", "沧海秋思客", 0],
  ["7", "诗词", "第三单元", "第三单元", "峨眉山月仙", 0],
  ["7", "诗词", "—", "拓展（非七上课文）", "山寺摘星客", 0],
  ["7", "历史", "第一单元", "史前时期：原始社会与中华文明的起源", "远古取火王", 0],
  ["7", "历史", "第二单元", "夏商周时期：奴隶制王朝的更替和向封建社会的过渡", "青铜鼎王", 0],
  ["7", "历史", "第三单元", "秦汉时期：统一多民族封建国家的建立和巩固", "秦汉长城将", 0],
  ["7", "道德与法治", "第一单元", "少年有梦", "追梦少年星", 0],
  ["7", "道德与法治", "第二单元", "成长的时空", "时空成长树", 0],
  ["7", "道德与法治", "第三单元", "珍爱我们的生命", "生命守护灵", 0],
  ["7", "道德与法治", "第四单元", "追求美好人生", "美好人生师", 0],
  ["7", "道德与法治", "第一单元", "珍惜青春时光", "青春沙漏仙", 0],
  ["7", "道德与法治", "第二单元", "焕发青春活力", "活力青春鸟", 0],
  ["7", "道德与法治", "第三单元", "传承中华优秀传统文化", "文化传承龙", 0],
  ["7", "道德与法治", "第四单元", "生活在法治社会", "法治天秤官", 0],
  ["10", "语文", "第一单元", "第一单元", "橘子洲诗龙", 0],
  ["10", "语文", "第六单元", "第六单元", "劝学师说翁", 0],
  ["10", "语文", "第七单元", "第七单元", "荷塘月色仙", 0],
  ["10", "历史", "第一单元", "从中华文明起源到秦汉大一统", "华夏一统王", 0],
  ["10", "历史", "第二单元", "三国两晋南北朝的民族交融与隋唐统一多民族封建国家的发展", "盛唐交融使", 0],
  ["10", "历史", "第五单元", "晚清时期的内忧外患与救亡图存", "晚清觉醒狮", 0],
  ["10", "地理", "第一章", "宇宙中的地球", "宇宙星轨使", 0],
  ["10", "地理", "第二章", "地球上的大气", "大气环流精", 0],
  ["10", "地理", "第三章", "地球上的水", "水循环精灵", 0],
  ["10", "地理", "第四章", "地貌", "地貌雕刻师", 0],
  ["10", "地理", "第五章", "植被与土壤", "森林沃土王", 0],
  ["10", "地理", "第六章", "自然灾害", "防灾预警官", 0],
  ["10", "政治", "第一课", "社会主义从空想到科学、从理论到实践的发展", "空想科学使", 0],
  ["10", "政治", "第二课", "只有社会主义才能救中国", "星火燎原使", 0],
  ["10", "政治", "第三课", "只有中国特色社会主义才能发展中国", "改革开放舵手", 0],
  ["10", "政治", "第四课", "只有坚持和发展中国特色社会主义才能实现中华民族伟大复兴", "复兴梦想舟", 0],
  ["10", "政治", "第一课", "我国的生产资料所有制", "公有制基石", 0],
  ["10", "政治", "第二课", "我国的社会主义市场经济体制", "市场调控师", 0],
  ["10", "政治", "第三课", "我国的经济发展", "高质量引擎", 0],
  ["10", "政治", "第四课", "我国的个人收入分配与社会保障", "分配保障官", 0],
  ["10", "物理", "第一章", "运动的描述", "位移速度侠", 0],
  ["10", "物理", "第二章", "匀变速直线运动的研究", "匀变速飞车", 0],
  ["10", "物理", "第三章", "相互作用——力", "三力平衡师", 0],
  ["10", "物理", "第四章", "运动和力的关系", "牛顿惯性王", 0],
  ["10", "物理", "第五章", "抛体运动", "抛物线射手", 0],
  ["10", "物理", "第六章", "圆周运动", "向心力陀螺", 0],
  ["10", "化学", "专题1", "物质的分类及计量", "摩尔计量师", 0],
  ["10", "化学", "专题2", "研究物质的基本方法", "过滤蒸馏师", 0],
  ["10", "化学", "专题3", "从海水中获得的化学物质", "海盐氯钠龙", 0],
  ["10", "化学", "专题4", "硫与环境保护", "硫黄酸雨精", 0],
  ["10", "化学", "专题5", "微观结构与物质的多样性", "元素周期表王", 0],
  ["10", "化学", "专题6", "化学反应与能量变化", "原电池火花", 0],
  ["10", "化学", "专题7", "氮与社会可持续发展", "固氮循环王", 0],
  ["10", "生物", "第1章", "走近细胞", "显微探秘者", 0],
  ["10", "生物", "第2章", "组成细胞的分子", "分子拼图后", 0],
  ["10", "生物", "第3章", "细胞的基本结构", "细胞城堡主", 0],
  ["10", "生物", "第4章", "细胞的物质输入和输出", "细胞膜门卫", 0],
  ["10", "生物", "第5章", "细胞的能量供应和利用", "能量工坊魔", 0],
  ["10", "生物", "第6章", "细胞的生命历程", "分裂镜像女王", 0],
];
// 主色：同一学段、同一美术（同一怪物池，如语文和诗词共用墨韵）里的各章均匀分开，0 = 原色不用
CHAPTER_BOSS.push(...(GEN as unknown as BossRow[]));
/** 学段 → 没传年级时默认的年级（旧调用 / 旧测试：J = 初一，H = 高一） */
const BAND_GRADE: Record<string, string> = { J: '7', H: '10' };
const BAND_OF_GRADE: Record<string, string> = { '7': 'J', '8': 'J', '9': 'J', '10': 'H', '11': 'H', '12': 'H', K1: 'K', K2: 'K', K3: 'K' };
export interface BossCtx { grade?: string; volume?: string }
{ const g = new Map<string, number[]>(); CHAPTER_BOSS.forEach((r, i) => { const k = (BAND_OF_GRADE[r[0]] ?? r[0]) + (THEME_OF[r[1]] ?? r[1]); g.set(k, [...(g.get(k) ?? []), i]); });
  for (const ix of g.values()) ix.forEach((i, j) => { CHAPTER_BOSS[i][5] = Math.round(360 * (j + 1) / (ix.length + 1)); }); }
const segMatch = (seg: string, no: string, name: string) => (no === '—' ? seg === name : seg.startsWith(no) && (name === no || seg.includes(name)) && !/^\d/.test(seg.slice(no.length)));
/* 册别行（对照表）：章/单元原文 = 章节路径开头的若干段（如「八上·第一单元」「第1章 遗传因子的发现」）；章号 no 为空 */
/** 无章号的章比最后一段（splitDot：书名号 / 括号里的「·」不拆），去掉空白和 r16 同名章的册别标记（「（选必上）」） */
const bare = (s: string) => (splitDot(s, true).pop() ?? '').replace(/\s+/g, '').replace(/（选必[^）]*）$/, '');
/* 关卡的 unit 是章标题（如「第三单元」「8A Unit 3 …」「古诗词诵读（选必上）」），对照表是章节路径（「八上·第三单元」）：
   原文前缀相同；或两边都有章号（第N单元 / 第N章 / 第N课 / Unit N / 专题N）时章号相同；都没有章号时去掉册别后文字相同（册别另由 ctx.volume 限定） */
const volMatch = (unit: string, ch: string, byKey: boolean) => {
  const u = unit.replace(/\s+/g, ''), c = ch.replace(/\s+/g, '');
  if (u === c || u.startsWith(c + '·') || (u.startsWith(c) && !/^[\d\u4e00-\u9fa5A-Za-z]/.test(u.slice(c.length)))) return true;
  if (!byKey) return false;   // 没传册别时只认原文前缀（章号在不同册会重复）
  const ku = chapterOf(unit)?.key, kc = chapterOf(ch)?.key;
  return ku && kc ? ku === kc : !ku && !kc && bare(unit) === bare(ch);
};
export function chapterBoss(band: string | undefined, subject: string | undefined, unit: string | undefined, ctx: BossCtx = {}): { name: string; hue: number } | undefined {
  const grade = ctx.grade ?? (band ? BAND_GRADE[band] : undefined);
  if (!unit || !subject || !grade) return undefined; const segs = [unit, ...unit.split('·')];
  const m = CHAPTER_BOSS.find(r => r[0] === grade && r[1] === subject && (r[6] !== undefined ? (!ctx.volume || ctx.volume === r[6]) && volMatch(unit, r[3], !!ctx.volume) : segs.some(x => segMatch(x.trim(), r[2], r[3]))));
  return m ? { name: m[4], hue: m[5] } : undefined;
}
export function skinFor(subject: string | undefined, kind: LevelKind, band?: string, unit?: string, ctx: BossCtx = {}): MonSkin | null {
  const t = subject ? THEME_OF[subject] : undefined; if (!t) return null;
  const sk0 = SKINS[t][kind]; const bn = kind === 'boss' && (band === 'J' || band === 'H') ? BOSS_NAME[band][t] : undefined;
  const g = ctx.grade ?? (band ? BAND_GRADE[band] : undefined);
  const hb = kind !== 'boss' ? undefined : band === 'H' && t === 'number' && g === '10' ? hMathBoss(unit) : chapterBoss(band, subject, unit, ctx);
  const sk = sk0 && hb ? { ...sk0, name: hb.name, hue: hb.hue } : sk0 && bn ? { ...sk0, name: bn } : sk0;
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
