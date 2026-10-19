// r15.4.4：题库 v32 导入（需家长确认的题不进游戏题库）；高一新章节 Boss 用通用名、不抢已有名字；题库新增册别自动勾上
import 'fake-indexeddb/auto';
const mem = new Map<string, string>(); (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() };
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
import { chapterBoss } from '../src/game/monsterSkin';
import { syncNewVolumes, VOL_ADDED } from '../src/game/volumes';
import { repairProfile, loadProfiles } from '../src/state';
import { importAll, exportAll, setKV } from '../src/db';
const G = ['K1', '1', '2', '3', '4', '5', '6', '7', '10'];
const raw = (g: string) => JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8'));
const LIST = '/workspace/questions/需家长确认清单_v34.csv';   // v34：v32 的 44 题 + 曹冲称象 Y6-070 / Y6-128 / Y6-131 = 47
describe('题库 v32 / v33 / v34 导入', () => {
  it('r16：中班 K2 / 初二 8 / 高二 11 进游戏题库；大班 K3 / 初三 9 / 高三 12 不进（r17）', () => {
    for (const g of ['K2', '8', '11']) expect(existsSync(`public/banks/bank_${g}.json`), g).toBe(true);
    for (const g of ['K3', '9', '12']) expect(existsSync(`public/banks/bank_${g}.json`), g).toBe(false);
    for (const g of G) expect(raw(g).questions.filter((q: { id: string }) => /^K[23][NCDLGEZ]-/.test(q.id)).length, g).toBe(0);
  });
  it('r15.4.3 正式版（题库 v30）的每个关卡 id 在现在的题库里都还在，或者是某关的别名（星星不丢；v34 曹冲称象首题 Y6-070 改需家长确认 → 别名）', () => {
    const old: string[] = JSON.parse(readFileSync('tests/fixtures/level_ids_r1543.json', 'utf8'));
    const cov = new Set<string>();
    for (const g of G) { const b = loadBank(raw(g), ''); for (const c of buildChapters(playable(b.all, false), null, b.all)) for (const l of c.levels) { cov.add(l.id); (l.aliases ?? []).forEach(a => cov.add(a)); (l.parts ?? []).forEach(a => cov.add(a)); } }
    expect(old.length).toBe(1165); expect(old.filter(i => !cov.has(i))).toEqual([]);
  });
  it('其他年级没有 usage 字段 → 普通 / Boss 关不受 v34 新列影响', () => {
    for (const g of G) expect(raw(g).questions.filter((q: { usage?: string }) => q.usage != null).length, g).toBe(0);
  });
  it('游戏题库里没有一道「需家长确认」的题', () => {
    for (const g of G) expect(raw(g).questions.filter((q: { status: string }) => q.status === '需家长确认').map((q: { id: string }) => q.id), g).toEqual([]);
  });
  it.skipIf(!existsSync(LIST))('需家长确认清单 v34 的 47 题一道都不在游戏题库里', () => {
    const ids = readFileSync(LIST, 'utf8').split('\n').slice(1).map(l => l.split(',')[0].replace(/^\uFEFF/, '').trim()).filter(Boolean);
    expect(ids.length).toBe(47);
    const all = new Set(G.flatMap(g => raw(g).questions.map((q: { id: string }) => q.id)));
    expect(ids.filter(i => all.has(i))).toEqual([]);
  });
  it('高一：v32 30 个 + v33 2 个新章节 Boss 用通用名，已有 39 个章节 Boss 名字不变、不重名', () => {
    const b = loadBank(raw('10'), 'bank_10.json');
    const boss = buildChapters(playable(b.all, false), null, b.all).flatMap(c => c.levels.filter(l => l.kind === 'boss').map(l => ({ s: c.subject, v: l.volume, u: l.unit, n: chapterBoss('H', c.subject, l.unit)?.name })));
    expect(boss.length).toBe(88);   // v32 86 + v33 纲要上第六、第八单元（够 12 题，第一次有章节 Boss，通用名）
    expect(boss.filter(x => !x.n).length).toBe(49);   // 没有章节专属名：v32 47（含 17 个本来就沿用学段默认名的）+ v33 2
    const named = boss.filter(x => x.n).map(x => x.n);
    expect(named).toEqual(["橘子洲诗龙", "劝学师说翁", "荷塘月色仙", "华夏一统王", "盛唐交融使", "晚清觉醒狮", "宇宙星轨使", "大气环流精", "水循环精灵", "地貌雕刻师", "森林沃土王", "防灾预警官", "空想科学使", "星火燎原使", "改革开放舵手", "复兴梦想舟", "公有制基石", "市场调控师", "高质量引擎", "分配保障官", "位移速度侠", "匀变速飞车", "三力平衡师", "牛顿惯性王", "抛物线射手", "向心力陀螺", "摩尔计量师", "过滤蒸馏师", "海盐氯钠龙", "硫黄酸雨精", "元素周期表王", "原电池火花", "固氮循环王", "显微探秘者", "分子拼图后", "细胞城堡主", "细胞膜门卫", "能量工坊魔", "分裂镜像女王"]);
    // 生物必修2 的「第1章」不能拿到必修1 第1章的名字
    expect(boss.filter(x => x.s === '生物' && x.v === '必修第二册').every(x => !x.n)).toBe(true);
    expect(new Set(named).size).toBe(named.length);
  });
});
describe('题库新增册别：已保存勾选的档案自动勾上一次', () => {
  const vols10 = ['必修上册', '必修第一册', '必修第二册', '必修第三册', '必修下册'];
  it('旧档案（没有 volsKnown）：VOL_ADDED 里的新册别自动勾上，记下已知册别；再同步一次不变', () => {
    expect(VOL_ADDED['10']).toContain('必修第三册');
    const r = syncNewVolumes({ grade: '10', volumes: ['必修第一册', '必修第二册'] }, vols10)!;
    expect(r.added).toEqual(['必修第三册']); expect(r.volumes).toEqual(['必修第一册', '必修第二册', '必修第三册']); expect(r.volsKnown).toEqual(vols10);
    expect(syncNewVolumes({ grade: '10', volumes: r.volumes, volsKnown: r.volsKnown }, vols10)).toBeNull();
  });
  it('家长看到提示后去掉了新册别：不会再被勾回来', () => {
    expect(syncNewVolumes({ grade: '10', volumes: ['必修第一册'], volsKnown: vols10 }, vols10)).toBeNull();
  });
  it('以后的题库又多了一册：只勾这一册', () => {
    const r = syncNewVolumes({ grade: '10', volumes: ['必修第一册'], volsKnown: vols10 }, [...vols10, '选择性必修1'])!;
    expect(r.added).toEqual(['选择性必修1']); expect(r.volumes).toEqual(['必修第一册', '选择性必修1']);
  });
  it('没保存过勾选（全部册别 null）：不变、不提示；其他年级没有新册别：只补记已知册别、不提示', () => {
    expect(syncNewVolumes({ grade: '10', volumes: null }, vols10)).toBeNull();
    const r = syncNewVolumes({ grade: '7', volumes: ['七年级上册'] }, ['七年级上册', '七年级下册'])!; expect(r.added).toEqual([]); expect(r.volumes).toEqual(['七年级上册']);
  });
  it('repairProfile 保留 volsKnown / volNotice；volumes 为 null 时丢掉 volsKnown', () => {
    const base = { id: 'a', name: '小明', avatar: '🧒', grade: '10', limit: { weekday: 30, weekend: 60 } };
    expect(repairProfile({ ...base, volumes: ['必修第一册'], volsKnown: vols10, volNotice: ['政治 必修第三册'] })).toMatchObject({ volsKnown: vols10, volNotice: ['政治 必修第三册'] });
    expect(repairProfile({ ...base, volumes: null, volsKnown: vols10 })!.volsKnown).toBeUndefined();
  });
  it('旧备份（档案里没有 volsKnown）恢复后：读出来的档案按旧档案处理，新册别会被勾上', async () => {
    await setKV('settings', { includePending: false }); await setKV('profiles', [{ id: 'a', name: '小明', avatar: '🧒', grade: '10', volumes: ['必修第一册', '必修第二册'], limit: { weekday: 30, weekend: 60 } }]);
    const bk = await exportAll();
    await setKV('profiles', [{ id: 'a', name: '小明', avatar: '🧒', grade: '10', volumes: ['必修第一册'], volsKnown: vols10, limit: { weekday: 30, weekend: 60 } }]);
    await importAll(bk);
    const p = (await loadProfiles()).find(x => x.id === 'a')!;
    expect(p.volsKnown).toBeUndefined(); expect(p.volumes).toEqual(['必修第一册', '必修第二册']);
    const r = syncNewVolumes(p, vols10)!; expect(r.added).toEqual(['必修第三册']);
  });
});
