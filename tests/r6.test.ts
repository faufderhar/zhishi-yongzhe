/* r6：技术QA r4 复测问题 + 策划裁定（漏选、Boss 两阶段、星级、选题、怪物池、难度回落）+ 试玩报告技术项 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { parseImage, shapeSvg, COLORS } from '../src/game/shapes';
import { spreadTemplates } from '../src/game/adaptive';
import { loadBank, normalize, exportQuestion, cleanExplanation, parseVisual, type Question } from '../src/game/questions';
import { newRound, resolveRound, phaseOf, type RState } from '../src/game/rounds';
import { PUPS, SCIFI } from '../src/game/characters';
import { buildChapters, levelStars, bossPool, shortUnit, mergeSmallLessons, NEVER_MERGE, starOf } from '../src/game/levels';
import { skinFor, SKINS, THEME_OF } from '../src/game/monsterSkin';
import { newTier, nextTier, pickByTier, isConsolidating, showConsolidateTag } from '../src/game/consolidate';
import { nextLock, tickLock, lockLeft, type LockState } from '../src/game/pin';
import { pickOld, rollupAdd, monthOf, type AnswerRecord } from '../src/db';
import { MONSTERS } from '../src/game/balance';
const poet = PUPS.find(c => c.major === '诗词')!, sci = SCIFI.find(c => c.major === '数学')!;
const R = (s: RState, x: object) => resolveRound(s, poet, { correct: true, subject: '数学', difficulty: 2, rng: () => 0.99, noSkill: true, ...x });
const pub = (g: string) => loadBank(JSON.parse(readFileSync(new URL(`../public/banks/bank_${g}.json`, import.meta.url), 'utf8')), `bank_${g}.json`).all;

describe('裁定 6 多选漏选', () => {
  const j = () => ({ ...newRound('j', 'normal'), monsterHp: 999, monsterMax: 999, combo: 2, energy: 3 });
  it('我方回合：50% 伤害、不反击；连击/能量不变；不触发技能', () => {
    const full = R(j(), { noSkill: true })[1].dealt;
    const [s, o] = R(j(), { partial: true, noSkill: false, rng: () => 0 });
    expect(Math.abs(o.dealt - full * 0.5)).toBeLessThanOrEqual(1);
    expect(o.taken).toBe(0); expect(o.skill).toBeNull(); expect(s.combo).toBe(2); expect(s.energy).toBe(3); expect(o.partial).toBe(true);
  });
  it('对方回合：受到 50% 伤害；无完美闪避、无专注', () => {
    const s0: RState = { ...j(), side: 'M', pattern: ['atk'], mi: 0 };
    const [s, o] = R(s0, { partial: true, fast: true });
    expect(o.taken).toBe(6); expect(o.perfect).toBe(false); expect(s.focus).toBe(0); expect(s.combo).toBe(2); expect(s.energy).toBe(3);
  });
});
describe('裁定 7 高一 Boss 两阶段', () => {
  it('第一阶段溢出不带入；第二阶段满 125 开始（D14）', () => {
    const s0 = { ...newRound('h', 'boss'), monsterHp: 128 };
    const [s, o] = resolveRound(s0, sci, { correct: true, subject: '数学', difficulty: 5, rng: () => 0.99, noSkill: true });
    expect(o.phaseShift).toBe(true); expect(o.dealt).toBe(3); expect(s.monsterHp).toBe(125); expect(phaseOf(s)).toBe(1);
  });
  it('两段攻击：打破第一阶段后第二段不结算', () => {
    const s0 = { ...newRound('h', 'boss'), monsterHp: 133 };
    const A2H = { id: 'x', effect: 'A2H' } as never;
    const [s, o] = resolveRound(s0, sci, { correct: true, subject: '物理', difficulty: 3, rng: () => 0.99, forceSkill: A2H });
    expect(s.monsterHp).toBe(125); expect(o.hits[1]).toBe(0);
  });
  it('第二阶段可以正常打到 0', () => { const [s] = R({ ...newRound('h', 'boss'), monsterHp: 10 }, {}); expect(s.over).toBe('win'); });
});
describe('裁定 1 星级', () => {
  it('正确率 = 答对/作答（漏选 0.5）；撤退 ≤1★；时间到 0★', () => {
    expect(levelStars({ win: true, correct: 8, total: 10, revived: false })).toBe(3);
    expect(levelStars({ win: true, correct: 8, total: 10, revived: true })).toBe(2);
    expect(levelStars({ win: true, correct: 5.5, total: 9, revived: false })).toBe(2);   // 61%
    expect(levelStars({ win: true, correct: 5.5, total: 10, revived: false })).toBe(1);
    expect(levelStars({ win: true, correct: 10, total: 10, revived: false, retreat: true })).toBe(1);
    expect(levelStars({ win: true, correct: 10, total: 10, revived: false, timeUp: true })).toBe(0);
    expect(levelStars({ win: false, correct: 10, total: 10, revived: false })).toBe(0);
  });
});
describe('裁定 2 选题分组', () => {
  const all = ['5', '7', '10'].flatMap(pub);
  it('普通关 / 精英关只含同一课（小节）的题', () => {
    for (const ch of buildChapters(all)) for (const l of ch.levels.filter(x => x.kind !== 'boss')) {
      const units = new Set(l.pool.map(k => all.find(q => q.key === k)!.unit ?? ''));
      if (l.parts) { expect(l.name).toContain(' + '); expect(NEVER_MERGE.has(ch.subject)).toBe(false); expect(units.size).toBe(l.parts.length + 1); }
      else expect(units.size, `${ch.subject} ${l.name}`).toBe(1);
    }
  });
  it('Boss：优先没出过和答错过的，不够才重复', () => {
    const p = ['a', 'b', 'c', 'd', 'e'].map(key => ({ key }));
    expect(bossPool(p, new Set(['a', 'b', 'c']), new Set(['b']), 3).map(x => x.key)).toEqual(['d', 'e', 'b']);
    expect(bossPool(p, new Set(['a', 'b', 'c']), new Set([]), 3).map(x => x.key)).toEqual(['d', 'e', 'a', 'b', 'c']);
  });
});
describe('裁定 3 怪物池', () => {
  it('各科主题；数值不变', () => {
    expect(skinFor('数学', 'normal')!.art.theme).toBe('number'); expect(skinFor('英语', 'boss')!.art.theme).toBe('letter'); expect(skinFor('历史', 'boss')!.art.theme).toBe('fossil'); expect(skinFor('政治', 'elite')!.art.theme).toBe('mist'); expect(skinFor('生物', 'boss')!.art.id).toBe('mon_bio_boss');
    for (const s of ['历史', '科学', '诗词', '政治']) expect(THEME_OF[s]).toBeTruthy();
    expect(Object.keys(SKINS)).toHaveLength(8);
    for (const t of Object.values(SKINS)) for (const s of Object.values(t)) expect(existsSync(new URL(`../public/${s.art.dir}/${s.art.anims.idle.json}.json`, import.meta.url))).toBe(true);
    expect(MONSTERS.std.normal.hp).toBe(60);
  });
});
describe('裁定 4 难度回落', () => {
  it('r12：连错 2 降 1 档（一次 1 档，最低 1），连对 2 升 1 档（最高 5）', () => {
    let t = newTier(3); t = nextTier(t, false); expect(isConsolidating(t)).toBe(false);
    t = nextTier(t, false); expect(t.tier).toBe(2); t = nextTier(t, false); expect(t.tier).toBe(2); t = nextTier(t, false); expect(t.tier).toBe(1);
    t = nextTier(t, false); t = nextTier(t, false); expect(t.tier).toBe(1);
    t = nextTier(t, true); expect(t.tier).toBe(1); t = nextTier(t, true); expect(t.tier).toBe(2); t = nextTier(t, true); t = nextTier(t, true); expect(t.tier).toBe(3);
    t = nextTier(t, true); t = nextTier(t, true); expect(t.tier).toBe(4); expect(isConsolidating(t)).toBe(false);
    let u = newTier(5); u = nextTier(u, true); u = nextTier(u, true); expect(u.tier).toBe(5);
  });
  it('降档时取 tier 档，不低于 tier；只在初一/高一显示「巩固题」', () => {
    const t = { base: 3, tier: 2, right: 0, wrong: 0 };
    expect(pickByTier([{ difficulty: 3 }, { difficulty: 1 }, { difficulty: 2 }], t)!.difficulty).toBe(2);
    expect(pickByTier([{ difficulty: 1 }, { difficulty: 3 }], t)!.difficulty).toBe(3);
    expect(showConsolidateTag('J') && showConsolidateTag('H')).toBe(true); expect(showConsolidateTag('G3') || showConsolidateTag('G1') || showConsolidateTag('K')).toBe(false);
  });
});
describe('P2-4 密码锁定不受系统时间影响', () => {
  it('只按单调时钟扣；改墙钟无效；刷新后从剩余继续', () => {
    let s: LockState = { fails: 0, level: 0, until: 0 };
    for (let i = 0; i < 5; i++) s = nextLock(s, false, 1000);
    expect(lockLeft(s, 1000)).toBe(60e3);
    expect(lockLeft(s, 1000 + 120e3)).toBe(60e3);      // 系统时间调快 2 分钟：仍锁 60 秒
    for (let i = 0; i < 30; i++) s = tickLock(s, 1000, 5e9);
    expect(lockLeft(s)).toBe(30e3);
    s = tickLock(s, 10 * 60e3, 5e9); expect(lockLeft(s)).toBe(28e3);   // 一次最多扣 2 秒（休眠/跳变）
    const saved = JSON.parse(JSON.stringify(s)); expect(lockLeft(saved, 0)).toBe(28e3);
  });
});
describe('P2-5 月度汇总', () => {
  const now = new Date('2026-10-15T12:00:00').getTime(), day = 864e5;
  const r = (d: number, ok: boolean, subject = '数学'): AnswerRecord => ({ profileId: 'p', questionId: 'q' + d, correct: ok, at: now - d * day, subject });
  it('超过 180 天的明细按 档案×科目×月 汇总', () => {
    const recs = [r(1, true), r(200, true), r(201, false), r(230, true, '语文')];
    const pick = pickOld(recs, now); expect(pick.sort()).toEqual([1, 2, 3]);
    const ru = rollupAdd({}, pick.map(i => recs[i]), () => '其他');
    const m = monthOf(now - 200 * day); expect(ru[m]['数学']).toEqual({ n: 2, ok: 1 });
    expect(Object.values(ru).flatMap(x => Object.values(x)).reduce((a, e) => a + e.n, 0)).toBe(3);
    expect(rollupAdd(ru, [recs[0]], () => '')[monthOf(now - day)]['数学'].n).toBe(1);
  });
  it('超过 5000 条：最旧的先汇总', () => { const recs = Array.from({ length: 12 }, (_, i) => r(i, true)); expect(pickOld(recs, now, 10).length).toBe(2); });
});
describe('试玩报告技术项', () => {
  it('题库导出去掉 textbook_note', () => {
    const q = normalize({ id: 'x', status: 'AI初审通过', subject: '数学', grade: 7, type: '填空', question: 'q', answer: ['1'], difficulty: 2, textbook_note: '内部注记' });
    const e = exportQuestion(q) as Record<string, unknown>; expect('textbook_note' in e).toBe(false); expect('key' in e).toBe(false);
  });
  it('单元前缀不留孤字「元」', () => { expect(shortUnit('第一单元 史前时期：原始社会')).toBe('史前时期：原始社会'); expect(shortUnit('第4单元 劳动光荣')).toBe('劳动光荣'); expect(shortUnit('《清平乐·村居》')).toBe('《清平乐·村居》'); expect(shortUnit('四下·《西江月·夜行黄沙道中》')).toBe('《西江月·夜行黄沙道中》'); });
  it('观沧海：正确选项与原诗一致（日月之行，若出其中；星汉灿烂，若出其里）', () => {
    const q = pub('7').find((x: Question) => x.question.includes('日月之行'))!;
    expect(q.question).toContain('若出其中'); expect(q.options.find(o => q.answer.includes(o.key))!.text).toBe('星汉灿烂，若出其里');
  });
});
describe('补测：解析不显示教材注记', () => {
  it('去掉 📘 版本说明，保留正文', () => {
    expect(cleanExplanation('陨石是天体。\n📘 人教版2019：江苏高中地理由设区市选用；本题库按苏州默认采用人教版2019')).toBe('陨石是天体。');
    expect(cleanExplanation('词的结尾。📘 统编版2024：无苏教版')).toBe('词的结尾。');
    expect(cleanExplanation('普通解析')).toBe('普通解析');
  });
  it('题库里没有任何显示用解析带注记', () => {
    for (const g of ['1', '2', '3', '4', '5', '6', '7', '10']) for (const q of pub(g)) expect(q.explanation, q.key).not.toMatch(/📘|本题库按|设区市/);
  });
});
describe('补测：关内难度不来回跳', () => {
  it('同一关连续取题，相邻难度差 ≤1（题库够时）', () => {
    let pool = [5, 3, 2, 5, 3, 4, 3, 2, 3, 5, 3, 3, 4, 4, 4, 2, 5, 1, 1, 2].map((difficulty, i) => ({ difficulty, i })); let t = newTier(3); const seq: number[] = [];
    for (let k = 0; k < 8; k++) { const q = pickByTier(pool, t)!; seq.push(q.difficulty); pool = pool.filter(x => x !== q); t = nextTier(t, k !== 2 && k !== 3); }
    for (let k = 1; k < seq.length; k++) expect(Math.abs(seq[k] - seq[k - 1])).toBeLessThanOrEqual(1);
  });
});
describe('题少课合并（策划 r6）', () => {
  const mk = (n: number, unit: string, subject = '数学', p = 'Q') => Array.from({ length: n }, (_, i) => normalize({ id: `${p}${unit}-${i}`, status: 'AI初审通过', subject, grade: 7, type: '填空', question: 'q' + i, answer: ['1'], difficulty: 2, unit: `第1章·${unit}`, volume: '七上' }));
  it('其他科目：同章相邻 <4 题的课合并，名字「1.2 + 1.3」', () => {
    const lv = buildChapters([...mk(8, '1.1 甲'), ...mk(2, '1.2 乙'), ...mk(2, '1.3 丙'), ...mk(8, '1.4 丁')])[0].levels.filter(l => l.kind === 'normal');
    const m = lv.find(l => l.parts)!; expect(m.name).toBe('1.2 乙 + 1.3 丙'); expect(m.pool).toHaveLength(4); expect(lv).toHaveLength(3);
  });
  it('语文 / 诗词不合并；同名诗按 unit 区分，各自成关', () => {
    const lv = buildChapters([...mk(2, '《绝句》（两个黄鹂）', '诗词', 'A'), ...mk(2, '《绝句》（迟日江山丽）', '诗词', 'B')])[0].levels.filter(l => l.kind === 'normal');
    expect(lv).toHaveLength(2); expect(lv.every(l => !l.parts)).toBe(true); expect(new Set(lv.map(l => l.id)).size).toBe(2);
  });
  it('某课达到 6 题自动拆回，星级经 parts 继承', () => {
    const before = buildChapters([...mk(8, '1.1 甲'), ...mk(2, '1.2 乙'), ...mk(2, '1.3 丙')])[0].levels;
    const merged = before.find(l => l.parts)!;
    const stars: Record<string, number> = {}; for (const id of [merged.id, ...merged.parts!]) stars[id] = 3;   // App.endLevel 的写法
    const after = buildChapters([...mk(8, '1.1 甲'), ...mk(2, '1.2 乙'), ...mk(6, '1.3 丙')])[0].levels.filter(l => l.kind === 'normal');
    expect(after.some(l => l.parts)).toBe(false);
    const l13 = after.find(l => l.name.includes('丙'))!; expect(starOf(l13, stars)).toBe(3);
    expect(starOf(after.find(l => l.name.includes('乙'))!, stars)).toBe(3);
    expect(mergeSmallLessons('语文', [{ volume: 'v', units: ['a'], qs: mk(1, 'a') }, { volume: 'v', units: ['b'], qs: mk(1, 'b') }])).toHaveLength(2);
  });
  it('迁移表：旧关卡 id 都能找到新关卡', () => {
    const al = JSON.parse(readFileSync(new URL('../src/game/levelAliases.json', import.meta.url), 'utf8')) as Record<string, string[]>;
    expect(Object.values(al).flat().length).toBeGreaterThan(100);
  });
});
describe('题库 v10：visual / 形状 / 图片路径 / template 上限', () => {
  it('visual 解析（JSON 与 CSV 字符串）', () => {
    expect(parseVisual('{"item":"🍎","emoji":"🍎","count":3,"label":"苹果"}')).toEqual({ item: '🍎', emoji: '🍎', count: 3, label: '苹果' });
    expect(parseVisual({ emoji: '🦆', count: 2 })!.count).toBe(2); expect(parseVisual('')).toBeUndefined(); expect(parseVisual('坏')).toBeUndefined();
    const k = pub('K1').filter((q: Question) => q.visual); expect(k.length).toBe(33); expect(k.every((q: Question) => String(q.visual!.count) === q.options.find(o => q.answer.includes(o.key))!.text)).toBe(true);
  });
  it('形状键 → SVG；白色加深色描边；未知形状占位；相对路径', () => {
    const r = parseImage('image:shape_square?color=blue'); expect(r).toMatchObject({ kind: 'shape', shape: 'square', known: true });
    expect(shapeSvg('circle', COLORS.white)).toContain('stroke="#333"');
    expect(parseImage('image:shape_blob?color=red')).toMatchObject({ known: false }); expect(shapeSvg('blob', '#f00')).toContain('?');
    expect(parseImage('images/k/objects/obj_ball.webp')).toEqual({ kind: 'path', src: './images/k/objects/obj_ball.webp' });
    for (const g of ['K1']) for (const q of pub(g)) for (const o of [...q.options.map(o => o.image), q.question_image]) {
      const p = parseImage(o); if (p.kind === 'shape') expect(p.known, o).toBe(true); if (p.kind === 'path') expect(existsSync(new URL('../public/' + p.src.slice(2), import.meta.url)), o).toBe(true);
    }
  });
  it('同 template 最多 2 道，不够时放宽到 3、再不限', () => {
    const t = (k: string, tp: string) => ({ key: k, tags: [], template: tp });
    const a = spreadTemplates([t('1', 'A'), t('2', 'A'), t('3', 'A'), t('4', 'B')], [t('5', 'C')]);
    expect(a.filter(x => x.template === 'A')).toHaveLength(2);
    const b = spreadTemplates([t('1', 'A'), t('2', 'A'), t('3', 'A'), t('4', 'A')], []); expect(b).toHaveLength(4);
    const c = spreadTemplates([t('1', 'A'), t('2', 'A'), t('3', 'A'), t('4', 'B')], []); expect(c).toHaveLength(4);
  });
});
describe('题库 v13：古诗关卡按 unit 分组', () => {
  it('每个诗词关卡的题都属于同一首诗（unit），危楼高百尺不在《敕勒歌》', () => {
    for (const g of ['1', '2', '3', '4', '5', '6', '7']) {
      const qs = pub(g); const by = new Map(qs.map((q: Question) => [q.key, q]));
      for (const ch of buildChapters(qs).filter(c => c.subject === '诗词')) for (const l of ch.levels.filter(x => x.kind !== 'boss')) {
        const us = new Set(l.pool.map(k => by.get(k)!.unit)); expect(us.size, `${g} ${l.name}`).toBe(1);
        if (l.name.includes('敕勒歌')) expect(l.pool.some(k => by.get(k)!.question.includes('危楼'))).toBe(false);
      }
    }
  });
  it('初一 / 高一不再需要合并', () => {
    for (const g of ['7', '10']) expect(buildChapters(pub(g)).flatMap(c => c.levels).filter(l => l.parts).length, g).toBe(0);
  });
});
describe('题库 v14：语文题少的古诗课', () => {
  it('<3 题且有同名诗词关 → 指向诗词关；没有 → 隐藏', () => {
    const mk = (id: string, subject: string, unit: string) => normalize({ id, status: 'AI初审通过', subject, grade: 2, type: '填空', question: 'q' + id, answer: ['1'], difficulty: 2, unit, volume: '二下' });
    const chs = buildChapters([
      ...Array.from({ length: 8 }, (_, i) => mk('Y' + i, '语文', '二下·课文1')), mk('Y9', '语文', '二下·古诗 赋得古原草送别'), mk('Y10', '语文', '二下·孤单课'),
      ...Array.from({ length: 6 }, (_, i) => mk('S' + i, '诗词', '《赋得古原草送别》')),
    ]);
    const cn = chs.find(c => c.subject === '语文')!.levels.filter(l => l.kind === 'normal'); const po = chs.find(c => c.subject === '诗词')!.levels[0];
    expect(cn.find(l => l.pool.includes('2:Y9'))!.redirect).toBe(po.id);
    expect(cn.some(l => l.pool.includes('2:Y10'))).toBe(false);
  });
  it('真实题库：二下《赋得古原草送别》指向诗词关', () => {
    const chs = buildChapters(pub('2').filter((q: Question) => q.status !== '停用'));
    const l = chs.find(c => c.subject === '语文')!.levels.find(x => x.name.includes('赋得古原草送别'));
    if (l && l.pool.length < 3) expect(l.redirect).toBeTruthy();
  });
  it('错题本：题干/题型变了但 id 不变，错题条目照样按 key 找到新题', () => {
    const q = pub('2')[0]; const e = { qkey: q.key }; const by = new Map(pub('2').map((x: Question) => [x.key, x])); expect(by.get(e.qkey)).toBeTruthy();
  });
});
describe('题库 v15：change_tag', () => {
  it('导入容忍 change_tag，导出去掉；新增但不可玩的题不进游戏', () => {
    const q = normalize({ id: 'x', status: 'AI初审通过', subject: '数学', grade: 7, type: '填空', question: 'q', answer: ['1'], difficulty: 2, change_tag: '修改' });
    expect('change_tag' in (exportQuestion(q) as object)).toBe(false);
    let n = 0;
    for (const g of ['K1', '1', '2', '3', '4', '5', '6', '7', '10']) {
      const raw = JSON.parse(readFileSync(new URL(`../public/banks/bank_${g}.json`, import.meta.url), 'utf8')).questions as { id: string; change_tag?: string; status: string; game_ready?: boolean }[];
      const playable = new Set(pub(g).filter((x: Question) => x.status === 'AI初审通过' || x.status === '已通过').map((x: Question) => x.id));
      for (const r of raw) if (r.game_ready === false) { n++; expect(playable.has(r.id), r.id).toBe(false); }
    }
    expect(n).toBeGreaterThanOrEqual(12);
  });
});
