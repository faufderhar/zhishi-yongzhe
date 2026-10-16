import { canPlay } from '../src/game/questions';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBank, normalize, type Question } from '../src/game/questions';
import { buildChapters, starsFor, isUnlocked, CHUNK } from '../src/game/levels';
import { bandOf, BANDS, timeLimitFor } from '../src/game/grades';
import { updateSkill, selectQuestions } from '../src/game/adaptive';
import { onWrong, onReviewRight, isDue, addDays } from '../src/game/wrongbook';
import { remainingSec, addUsage, addBonus, hashPin, validPin } from '../src/game/playtime';
import { newBattle, resolveCorrect, resolveWrong, autoAction, revive } from '../src/game/battle';
import { PUPS } from '../src/game/characters';
const pub = (g: string) => loadBank(JSON.parse(readFileSync(new URL(`../public/banks/bank_${g}.json`, import.meta.url), 'utf8')), `bank_${g}.json`).all;
const mk = (o: Partial<Question> & { id: string }) => normalize({ status: 'AI初审通过', subject: '数学', grade: 5, type: '填空', question: 'q', answer: ['1'], difficulty: 2, ...o });

describe('年级段', () => {
  it('K1→K，1-2→G1，3-4→G2，5-6→G3，7→J，10→H', () => {
    expect(['K1', '1', '2', '3', '4', '5', '6', '7', '10'].map(g => bandOf(g as any))).toEqual(['K', 'G1', 'G1', 'G2', 'G2', 'G3', 'G3', 'J', 'H']);
    expect(BANDS.G1.battle).toBe('simple'); expect(BANDS.G1.canFail).toBe(false); expect(BANDS.G1.autoTTS).toBe(true);
  });
  it('时限：G1 30 / G2 25 / G3 20，阅读 40，计算 45；题目 time 优先；幼儿园不限', () => {
    expect(timeLimitFor(mk({ id: 'a', type: '选择', subject: '诗词', options: [{ text: '1' }, { text: '2' }] as any, answer: 'A' as any }), 'G1')).toBe(30);
    expect(timeLimitFor(mk({ id: 'a', subject: '诗词', type: '判断', answer: '对' as any }), 'G2')).toBe(25);
    expect(timeLimitFor(mk({ id: 'a', subject: '诗词', type: '判断', answer: '对' as any }), 'G3')).toBe(20);
    expect(timeLimitFor(mk({ id: 'a', subject: '语文', type: '判断', answer: '对' as any, question: '阅读下面的句子，'.repeat(6) }), 'G3')).toBe(40);
    expect(timeLimitFor(mk({ id: 'a', subject: '数学', question: '计算：3+4=?' }), 'G3')).toBe(45);
    expect(timeLimitFor(mk({ id: 'a', time: 90 as any }), 'G3')).toBe(90);
    expect(timeLimitFor(mk({ id: 'a' }), 'K')).toBe(0);
    expect(timeLimitFor(mk({ id: 'a' }), 'G1', { g1NoLimit: true })).toBe(0);
  });
});

describe('章节与关卡', () => {
  const qs = pub('3');
  const ch = buildChapters(qs.filter(q => q.status === 'AI初审通过'));
  it('每个科目一章；按 册别+单元 分组；单元内每 ≤8 题一关，单元 Boss 题池=整个单元', () => {
    expect(ch.map(c => c.subject)).toEqual(['数学', '语文', '英语', '诗词', '科学']);
    const m = ch[0];
    const normals = m.levels.filter(l => l.kind === 'normal');
    expect(new Set(normals.flatMap(l => l.pool)).size).toBe(m.count);
    for (const l of normals) expect(l.pool.length).toBeLessThanOrEqual(CHUNK + 3);
    // 普通关不跨单元
    const byKey = new Map(qs.map(q => [q.key, q]));
    for (const l of normals) expect(new Set(l.pool.map(k => byKey.get(k)!.volume)).size).toBe(1);
    for (const b of m.levels.filter(l => l.kind === 'boss')) {
      const unitNormals = m.levels.filter(l => l.kind === 'normal' && l.unit === b.unit && l.volume === b.volume).flatMap(l => l.pool);
      expect(new Set(b.pool)).toEqual(new Set(unitNormals));
    }
    expect(new Set(m.levels.map(l => l.unit)).size).toBeGreaterThan(3);
  });
  it('按 volume 排序（上册在前），按已学册别过滤', () => {
    const m = ch[0];
    expect(m.volumes[0]).toBe('三年级上册');
    const only = buildChapters(qs, ['三年级上册']);
    expect(only.every(c => c.levels.every(l => l.pool.every(k => qs.find(q => q.key === k)!.volume === '三年级上册')))).toBe(true);
  });
  it('关卡 id 稳定（单元改名不影响 id）', () => {
    const changed = qs.map(q => ({ ...q, unit: '新版·' + (q.unit ?? '') }));
    expect(buildChapters(changed.filter(q => q.status === 'AI初审通过'))[0].levels.map(l => l.id)).toEqual(ch[0].levels.map(l => l.id));
  });
  it('星级与解锁', () => {
    expect(starsFor(false, 1, false)).toBe(0); expect(starsFor(true, 0.5, false)).toBe(1);
    expect(starsFor(true, 0.8, true)).toBe(2); expect(starsFor(true, 0.8, false)).toBe(3);
    expect(starsFor(true, 0.6, false)).toBe(2); expect(starsFor(true, 0.75, false)).toBe(2); expect(starsFor(true, 2 / 3, false)).toBe(2); expect(starsFor(true, 1 / 3, false)).toBe(1);   // D3（小班 3 题：0-1 ★ / 2 ★★ / 3 ★★★）
    const L = ch[0].levels;
    expect(isUnlocked(L, 0, {})).toBe(true);
    const j = L.findIndex((l, i) => i > 0 && l.unit === L[i - 1].unit && l.volume === L[i - 1].volume);
    expect(isUnlocked(L, j, {})).toBe(false); expect(isUnlocked(L, j, { [L[j - 1].id]: 1 })).toBe(true);
    const u = L.findIndex((l, i) => i > 0 && l.unit !== L[i - 1].unit);   // 每单元首关开放
    expect(isUnlocked(L, u, {})).toBe(true);
  });
});

describe('自适应难度', () => {
  it('连对 3 升级、连错 2 降级；幼儿园 4 连对才升、最高 2、不降', () => {
    let s = updateSkill(undefined, true, BANDS.J); s = updateSkill(s, true, BANDS.J); s = updateSkill(s, true, BANDS.J);
    expect(s.level).toBe(3);
    s = updateSkill(s, false, BANDS.J); s = updateSkill(s, false, BANDS.J); expect(s.level).toBe(2);
    let k = updateSkill(undefined, true, BANDS.K); for (let i = 0; i < 10; i++) k = updateSkill(k, true, BANDS.K);
    expect(k.level).toBe(2);
    for (let i = 0; i < 5; i++) k = updateSkill(k, false, BANDS.K); expect(k.level).toBe(2);
  });
  it('优先目标难度，约 20% 错题混入，不重复', () => {
    const pool = [1, 1, 2, 2, 3, 3, 4, 5].map((d, i) => mk({ id: 'p' + i, difficulty: d }));
    const due = [mk({ id: 'w1' }), mk({ id: 'w2' })];
    const out = selectQuestions({ pool, fallback: [], n: 5, target: 3, kind: 'normal', due, rnd: () => 0.5 });
    expect(out.length).toBe(5); expect(new Set(out.map(q => q.key)).size).toBe(5);
    expect(out.filter(q => q.id.startsWith('w')).length).toBe(1);
    expect(out.filter(q => !q.id.startsWith('w')).slice(0, 2).every(q => q.difficulty === 3)).toBe(true);
    const k = selectQuestions({ pool, fallback: [], n: 4, target: 2, kind: 'normal', maxDifficulty: 2 });
    expect(k.every(q => q.difficulty <= 2)).toBe(true);
  });
});

describe('错题本（盒子法）', () => {
  const base = { profileId: 'p', qkey: '3:M3-001', subject: '数学' };
  it('答错→1 号盒明天；复习对 1→2(3天)→3(7天)→掌握', () => {
    const e = onWrong(undefined, base, 'A', '2026-10-14');
    expect(e.box).toBe(1); expect(e.due).toBe('2026-10-15');
    expect(isDue(e, '2026-10-14')).toBe(false); expect(isDue(e, '2026-10-15')).toBe(true);
    const e2 = onReviewRight(e, '2026-10-15')!; expect(e2.box).toBe(2); expect(e2.due).toBe('2026-10-18');
    const e3 = onReviewRight(e2, '2026-10-18')!; expect(e3.box).toBe(3); expect(e3.due).toBe('2026-10-25');
    expect(onReviewRight(e3)).toBeNull();
    const back = onWrong(e3, base, 'C', '2026-10-25'); expect(back.box).toBe(1); expect(back.wrongCount).toBe(2);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('时长与密码', () => {
  const wd = new Date(2026, 9, 14), we = new Date(2026, 9, 17);
  it('上学日/周末上限、用量、加时、0=不限', () => {
    const l = { weekday: 30, weekend: 60 };
    expect(remainingSec(l, {}, '2026-10-14', wd)).toBe(1800);
    expect(remainingSec(l, {}, '2026-10-17', we)).toBe(3600);
    let u = addUsage({}, '2026-10-14', 1700); expect(remainingSec(l, u, '2026-10-14', wd)).toBe(100);
    u = addUsage(u, '2026-10-14', 500); expect(remainingSec(l, u, '2026-10-14', wd)).toBe(0);
    u = addBonus(u, '2026-10-14', 600); expect(remainingSec(l, u, '2026-10-14', wd)).toBe(200);
    expect(remainingSec({ weekday: 0, weekend: 0 }, u, '2026-10-14', wd)).toBe(Infinity);
  });
  it('密码 4–6 位数字', () => {
    expect(validPin('1234')).toBe(true); expect(validPin('123')).toBe(false); expect(validPin('12a4')).toBe(false);
    expect(hashPin('1234')).toBe(hashPin('1234')); expect(hashPin('1234')).not.toBe(hashPin('4321'));
  });
});

describe('战斗 v1', () => {
  const c = PUPS[3];
  it('简易模式：怪物攻击就闪避，否则攻击', () => {
    const s = newBattle('std'); expect(autoAction(s)).toBe('dodge'); expect(autoAction({ ...s, turn: 2 })).toBe('attack');
  });
  it('不会失败模式血量最低 1', () => {
    let s = newBattle('std', 'normal', true);
    for (let i = 0; i < 20; i++) s = resolveWrong(s, c)[0];
    expect(s.playerHp).toBe(1); expect(s.over).toBeNull();
  });
  it('精英/Boss 数值更高；复活回 50%', () => {
    expect(newBattle('std', 'boss').monsterMax).toBeGreaterThan(newBattle('std', 'elite').monsterMax);
    let s = newBattle('std'); while (!s.over) s = resolveWrong(s, c)[0];
    const r = revive(s); expect(r.playerHp).toBe(50); expect(r.over).toBeNull(); expect(r.revived).toBe(true);
    expect(resolveCorrect(r, c, 'attack', '数学', 2)[0].revived).toBe(true);
  });
});
import { unitKey } from '../src/game/levels';
describe('单元排序', () => {
  it('中文数字按数值', () => {
    const u = ['三上·十 认识', '三上·二 两、三位数', '三上·一 混合', '三上·十一 x'];
    expect([...u].sort((a, b) => unitKey(a).localeCompare(unitKey(b)))).toEqual(['三上·一 混合', '三上·二 两、三位数', '三上·十 认识', '三上·十一 x']);
    expect(unitKey('2.10') > unitKey('2.9')).toBe(true);
  });
});

import { chapterOf } from '../src/game/levels';
describe('小节合并到章', () => {
  it('解析章/单元号', () => {
    expect(chapterOf('七上·第2章 有理数·2.2 数轴')?.key).toBe('第2章');
    expect(chapterOf('七上·第2章 有理数·2.4 有理数的加法')?.key).toBe('第2章');
    expect(chapterOf('必修一·第三章 相互作用——力·2 摩擦力')?.key).toBe('第3章');
    expect(chapterOf('必修上·第七单元·14.2 荷塘月色')?.key).toBe('第7单元');
    expect(chapterOf('7A Unit 3 Welcome to our school!')?.key).toBe('Unit3');
    expect(chapterOf('必修一·专题3 从海水中获得的化学物质·第二单元 金属钠')?.key).toBe('专题3');
    expect(chapterOf('2.4 有理数')?.key).toBe('第2章');
    expect(chapterOf('三上·大青树下的小学')).toBeNull();
  });
  it('初一数学按章合并；普通关仍按小节切分（id 不变）', () => {
    const qs = pub('7').filter(q => q.subject === '数学');
    const m = buildChapters(qs)[0];
    const units = [...new Set(m.levels.map(l => l.unit))];
    expect(units.length).toBeLessThanOrEqual(14);
    expect(units.filter(u => u.startsWith('第2章')).length).toBe(1);
  });
});

describe('题库 v7', () => {
  it('新科目按文件年级归属（D7 道法 ≠ D10 地理；K3 科学 ≠ 幼儿园）', () => {
    const g7 = pub('7'), g10 = pub('10'), g3 = pub('3');
    expect(g7.filter(q => q.subject === '道德与法治').every(q => q.grade === '7' && q.id.startsWith('D7-'))).toBe(true);
    expect(g10.filter(q => q.subject === '地理').every(q => q.grade === '10' && q.id.startsWith('D10-'))).toBe(true);
    expect(g3.filter(q => q.subject === '科学').every(q => q.grade === '3')).toBe(true);
    for (const s of ['生物', '地理', '政治']) expect(buildChapters(g10.filter(q => q.subject === s && canPlay(q.status, false))).length).toBe(1);
  });
  it('停用永不出现（即使家长打开待审核）', () => {
    for (const g of ['1', '2', '3', '4', '5', '6', '7', '10']) for (const q of pub(g)) if (q.status === '停用') expect(canPlay(q.status, true)).toBe(false);
  });
  it('新单元格式解析为章', () => {
    expect(chapterOf('七上·第一单元 少年有梦·第一课 开启初中生活')?.key).toBe('第1单元');
    expect(chapterOf('必修1·第1章 走近细胞·第1节 细胞是生命活动的基本单位')?.key).toBe('第1章');
    expect(chapterOf('必修第一册·第一章 宇宙中的地球·第一节 地球的宇宙环境')?.key).toBe('第1章');
    expect(chapterOf('必修1·第一课 社会主义从空想到科学、从理论到实践的发展·1.1 原始社会的解体')?.key).toBe('第1课');
    expect(chapterOf('三上·研究土壤')).toBeNull();
  });
});

import { levelsOfUnit } from '../src/game/levels';
describe('试玩报告 r1', () => {
  it('#1 关卡出题（含补题）只来自同一章：高一每一关', () => {
    const qs = pub('10').filter(q => canPlay(q.status, false)); const byKey = new Map(qs.map(q => [q.key, q]));
    for (const ch of buildChapters(qs)) for (const l of ch.levels) {
      const unitKeys = new Set(levelsOfUnit(ch.levels, l).flatMap(x => x.pool));
      const pick = selectQuestions({ pool: l.pool.map(k => byKey.get(k)!), fallback: [...unitKeys].map(k => byKey.get(k)!), n: 12, target: 2, kind: l.kind });
      for (const q of pick) expect(unitKeys.has(q.key)).toBe(true);
    }
    // M10-115 余弦定理不在「集合」章
    const math = buildChapters(qs).find(c => c.subject === '数学')!;
    const setCh = math.levels.filter(l => l.unit.includes('集合')).flatMap(l => l.pool);
    expect(setCh.includes('10:M10-115')).toBe(false);
  });
  it('#11 关卡/章节标题不截断', () => {
    const math = buildChapters(pub('10').filter(q => canPlay(q.status, false))).find(c => c.subject === '数学')!;
    expect(math.levels.some(l => l.name.includes('两角和与差的三角函数'))).toBe(true);
  });
});

import { checkClock } from '../src/state';
import { nextLock } from '../src/game/pin';
import { splitStem } from '../src/ui/Battle';
describe('技术修复 & 策划确认单', () => {
  it('D8 时钟：倒退 > 5 分钟锁定；前进正常', () => {
    const c = checkClock({ maxSeen: 0, locked: false }, 1e12);
    expect(checkClock(c, 1e12 + 60e3)).toMatchObject({ locked: false, maxSeen: 1e12 + 60e3 });
    expect(checkClock(c, 1e12 - 4 * 60e3).locked).toBe(false);
    expect(checkClock(c, 1e12 - 6 * 60e3).locked).toBe(true);
  });
  it('D9 锁定：5 次 → 60 秒，再 5 次 → 5 分钟，再 → 15 分钟；对一次清零', () => {
    let s = { fails: 0, level: 0, until: 0 };
    for (let i = 0; i < 5; i++) s = nextLock(s, false, 0);
    expect(s.until).toBe(60e3);
    for (let i = 0; i < 5; i++) s = nextLock(s, false, 0);
    expect(s.until).toBe(300e3);
    for (let i = 0; i < 5; i++) s = nextLock(s, false, 0);
    expect(s.until).toBe(900e3);
    expect(nextLock(s, true, 0)).toMatchObject({ fails: 0, level: 0, until: 0 });
  });
  it('J-1 数数题：题干 emoji 拆成可数物品，数量与答案一致', () => {
    const k1 = loadBank(JSON.parse(readFileSync(new URL('../public/banks/bank_K1.json', import.meta.url), 'utf8')), 'k').all;
    const counting = k1.filter(q => /数一数/.test(q.question) && q.type === '选择');
    expect(counting.length).toBeGreaterThan(20);
    for (const q of counting) {
      const items = splitStem(q.question).flatMap(x => x.items);
      const ans = q.options.find(o => o.key === q.answer[0])!.text;
      if (/^\d+$/.test(ans)) expect(items.length, q.id).toBe(Number(ans));
    }
    expect(splitStem('数一数，有几个苹果？🍎')[1].items).toEqual(['🍎']);
  });
  it('v8：M10-115 在 11.1 余弦定理关；初一 2.2 数轴单独成关', () => {
    const lv10 = buildChapters(pub('10').filter(q => q.status !== '停用')).flatMap(c => c.levels).filter(l => l.kind === 'normal');
    const l115 = lv10.find(l => l.pool.includes('10:M10-115'))!;
    expect(l115.name).toContain('余弦定理');
    const p7 = pub('7'); const by7 = new Map(p7.map(q => [q.key, q])); const lv7 = buildChapters(p7).flatMap(c => c.levels);
    expect(lv7.some(l => l.kind === 'normal' && l.name.includes('数轴'))).toBe(true);
    expect(lv7.filter(l => l.kind === 'normal' && !l.parts).every(l => new Set(l.pool.map(k => by7.get(k)!.unit)).size === 1)).toBe(true);
  });
});
