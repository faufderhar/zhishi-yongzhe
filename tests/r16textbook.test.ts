// r16 第 10 步：教材版本变更（/workspace/playtest/教材版本变更_程序改动.md）——77 个章 Boss、册别排序、VOL_ADDED
import { it, expect, describe } from 'vitest';
import { chapterBoss, CHAPTER_BOSS } from '../src/game/monsterSkin';
import { VOL_ADDED } from '../src/game/volumes';
import { volRank, buildChapters } from '../src/game/levels';
import { loadBank, playable } from '../src/game/questions';
import { readFileSync, existsSync } from 'node:fs';

const NEW = CHAPTER_BOSS.filter(r => r[6] === undefined && ['8', '9', '11', '12'].includes(r[0]));
describe('77 个新章 Boss', () => {
  it('条数按年级 / 科目', () => {
    const c: Record<string, number> = {}; for (const r of NEW) c[`${r[0]}|${r[1]}`] = (c[`${r[0]}|${r[1]}`] ?? 0) + 1;
    expect(NEW.length).toBe(77);
    expect(c).toEqual({ '8|生物': 14, '8|地理': 16, '9|化学': 14, '11|物理': 14, '12|物理': 11, '12|生物': 4, '12|地理': 4 });
  });
  it('名字不重复，也不和已有 Boss 重名（同年级）', () => {
    for (const g of ['8', '9', '11', '12']) { const n = CHAPTER_BOSS.filter(r => r[0] === g).map(r => r[4]); expect(n.filter((x, i) => n.indexOf(x) !== i), g).toEqual([]); }
  });
  it('不用 v40 沪教化学章名（人教版）', () => {
    expect(NEW.filter(r => r[1] === '化学').map(r => r[3])).toContain('走进化学世界');
    expect(NEW.some(r => /开启化学之门|身边的化学物质/.test(r[3]))).toBe(false);
  });
  it('章节路径能找到 Boss（§2 的单元写法）', () => {
    const b = (g: string, s: string, u: string) => chapterBoss(undefined, s, u, { grade: g })?.name;
    expect(b('8', '生物', '八上·第12章 消化系统·第1节 食物中的营养物质')).toBe('营养餐盘熊');
    expect(b('8', '生物', '学考复习·第1单元 生物体的结构层次·第1章 认识细胞')).toBe('细胞积木屋');
    expect(b('8', '地理', '八上·第一章 从世界看中国·第一节 疆域')).toBe('雄鸡地图仙');
    expect(b('8', '地理', '学考复习·第五单元 西半球与极地')).toBe('极地企鹅君');
    expect(b('9', '化学', '九上·第一单元 走进化学世界·课题1 物质的变化和性质')).toBe('化学大门钥');
    expect(b('9', '化学', '中考复习·专题2 元素与物质')).toBe('元素家族谱');
    expect(b('11', '物理', '必修三·第九章 静电场及其应用·第1节 电荷')).toBe('库仑电荷球');
    expect(b('11', '物理', '选必一·第一章 动量守恒定律·第1节 动量')).toBe('碰碰台球侠');
    expect(b('11', '物理', '选必二·第一章 安培力与洛伦兹力·第1节')).toBe('回旋粒子环');   // 同号「第一章」靠章名区分
    expect(b('12', '物理', '选必三·第五章 原子核')).toBe('核聚变小星');
    expect(b('12', '地理', '选必三·第四章 保障国家安全的资源、环境战略与行动')).toBe('生态文明树');
    expect(b('12', '生物', '选必三·第3章 基因工程')).toBe('基因剪刀手');
    // 文档 §2 原样的 unit 写法
    expect(b('9', '化学', '九上·第一单元 走进化学世界·绪言 化学使世界变得更加绚丽多彩')).toBe('化学大门钥');
    expect(b('9', '化学', '九下·第十一单元 化学与社会·课题1 化学与人体健康')).toBe('化学生活桥');
    expect(b('9', '化学', '中考复习·化学·专题1 化学概念·化学用语')).toBe('化学概念舱');
    expect(b('11', '物理', '必修三·第九章 静电场及其应用·2 库仑定律')).toBe('库仑电荷球');
    expect(b('12', '物理', '选择性必修三·第五章 原子核·2 放射性元素的衰变')).toBe('核聚变小星');
    expect(b('12', '物理', '一轮复习·物理·专题3 电场与磁场·静电场')).toBe('电磁场营');
    expect(b('12', '地理', '选择性必修3·第四章 保障国家安全的资源、环境战略与行动·第一节 走向生态文明')).toBe('生态文明树');
    expect(b('7', '生物', '八上·第12章 消化系统')).toBeUndefined();   // 按年级，不串到初一
  });
});
it('高二物理册别顺序：必修第三册 → 选必第一册 → 选必第二册；高一政治 一 → 二 → 三 不变', () => {
  const sort = (v: string[]) => [...v].sort((a, b) => volRank(a) - volRank(b));
  expect(sort(['选择性必修第二册', '选择性必修第一册', '必修第三册'])).toEqual(['必修第三册', '选择性必修第一册', '选择性必修第二册']);
  expect(sort(['必修第三册', '必修第二册', '必修第一册'])).toEqual(['必修第一册', '必修第二册', '必修第三册']);
  expect(sort(['选择性必修下册', '选择性必修中册', '选择性必修上册', '必修第四册'])).toEqual(['必修第四册', '选择性必修上册', '选择性必修中册', '选择性必修下册']);
});
it('VOL_ADDED：初二学考复习（七年级）、初三九年级下册、高二必修第三册；高一政治必修3 仍在', () => {
  expect(VOL_ADDED).toEqual({ '10': ['必修第三册'], '8': ['学考复习（七年级）'], '9': ['九年级下册'], '11': ['必修第三册'] });
});
const extBank = (n: string, g: string) => { const f = `/workspace/questions/题库_游戏可用_${n}.json`; return existsSync(f) ? loadBank(JSON.parse(readFileSync(f, 'utf8')), `bank_${g}.json`) : undefined; };
const bossNames = (b: NonNullable<ReturnType<typeof extBank>>, g: string, s: string) => { const all = b.all.filter(q => q.subject === s);
  return buildChapters(playable(all, false), null, all).flatMap(c => c.levels).filter(l => l.kind === 'boss').map(l => `${l.unit}→${chapterBoss(undefined, s, l.unit, { grade: g })?.name ?? '∅'}`); };
it('初三化学（题库 v46 人教版2024，298 题）：构建完整读入，11 个章 Boss 全按人教单元名对上（题库在 /workspace/questions，没有就跳过）', () => {
  const b = extBank('初三', '9'); if (!b) return; const all = b.all.filter(q => q.subject === '化学');
  expect(all.length).toBe(298); expect(playable(all, false).length).toBe(298); expect(b.bad.length).toBe(0);
  expect(bossNames(b, '9', '化学')).toEqual(['第一单元 走进化学世界→化学大门钥', '第二单元 空气和氧气→氧气气泡仙', '第三单元 物质构成的奥秘→原子分子球', '第四单元 自然界的水→水分子精灵',
    '第五单元 化学反应的定量关系→方程式天平', '第六单元 碳和碳的氧化物→二氧化碳泡', '第七单元 能源的合理利用与开发→燃料火苗仙', '第八单元 金属和金属材料→金属熔炉熊',
    '专题1 化学概念→化学概念舱', '专题2 元素与物质→元素家族谱', '专题3 实验与计算→实验计算台']);
  expect(all.filter(q => q.volume === '九年级下册').length).toBe(34);
});
it('高三地理（v46 选必3 重标 4 章）：构建完整读入；开了 Boss 的第二、三章对上「资源安全盾」「环境安全伞」（第一、四章 v47 才开）', () => {
  const b = extBank('高三', '12'); if (!b) return; expect(b.bad.length).toBe(0);
  const n = bossNames(b, '12', '地理'); expect(n).toContain('第二章 资源安全与国家安全→资源安全盾'); expect(n).toContain('第三章 环境安全与国家安全→环境安全伞');
});
