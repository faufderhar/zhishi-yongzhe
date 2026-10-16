/* r7 策划裁定：星级迁移只升不降、答题时限、朗读暂停计时 */
import { describe, it, expect } from 'vitest';
import { normalize } from '../src/game/questions';
import { migrateStars, starOf, type Level } from '../src/game/levels';
import { timeLimitFor, BASE_LIMIT, timePrefs } from '../src/game/grades';
import { PERFECT_FRACTION } from '../src/game/balance';
const L = (id: string, aliases?: string[]): Level => ({ id, chapter: '数学', index: 1, kind: 'normal', name: id, pool: [], volume: 'v', unit: 'u', aliases });
describe('星级迁移', () => {
  it('新关卡取自身与旧普通/精英关的最大值', () => {
    const nx = migrateStars([L('new', ['oldN', 'oldE'])], { new: 1, oldN: 2, oldE: 3 })!;
    expect(nx.new).toBe(3);
  });
  it('只升不降：自身更高时不变（返回 null）', () => {
    expect(migrateStars([L('new', ['old'])], { new: 3, old: 1 })).toBeNull();
    const s = { new: 2, old: 0 }; expect(migrateStars([L('new', ['old'])], s)).toBeNull(); expect(s.new).toBe(2);
  });
  it('原对象不被修改；没有映射的关卡不受影响', () => {
    const s = { a: 0, old: 2, b: 1 }; const nx = migrateStars([L('a', ['old']), L('b')], s)!;
    expect(nx).toEqual({ a: 2, old: 2, b: 1 }); expect(s.a).toBe(0); expect(starOf(L('a', ['old']), nx)).toBe(2);
  });
});
describe('答题时限', () => {
  const q = (o: object) => normalize({ id: 'x', status: 'AI初审通过', subject: '语文', grade: 3, type: '选择', question: '选一个', options: [{ text: 'a' }, { text: 'b' }], answer: 'A', difficulty: 2, ...o });
  it('各年级基础时限', () => {
    expect(BASE_LIMIT).toEqual({ K: 0, G1: 40, G2: 30, G3: 25, J: 25, H: 30 });
    expect(timeLimitFor(q({}), 'K')).toBe(0); expect(timeLimitFor(q({}), 'G1')).toBe(40); expect(timeLimitFor(q({}), 'G2')).toBe(30);
    expect(timeLimitFor(q({}), 'G3')).toBe(25); expect(timeLimitFor(q({}), 'J')).toBe(25); expect(timeLimitFor(q({}), 'H')).toBe(30);
  });
  it('计算题、填空题 ×1.5', () => {
    expect(timeLimitFor(q({ subject: '数学', question: '计算 3+4 等于多少' }), 'G3')).toBe(38);
    expect(timeLimitFor(q({ type: '填空', answer: ['x'], options: [] }), 'H')).toBe(45);
  });
  it('「时限宽松」再 ×1.5（叠加）；题目自带 time 不再覆盖', () => {
    expect(timeLimitFor(q({}), 'J', { lenient: true })).toBe(38);
    expect(timeLimitFor(q({ type: '填空', answer: ['x'], options: [] }), 'H', { lenient: true })).toBe(68);
    timePrefs.lenient = true; expect(timeLimitFor(q({}), 'G1')).toBe(60); timePrefs.lenient = false;
    expect(timeLimitFor(q({ time: 99 }), 'G2')).toBe(30);
  });
  it('一年级家长关闭时限仍有效；完美闪避按有效时限的一半', () => {
    expect(timeLimitFor(q({}), 'G1', { g1NoLimit: true })).toBe(0);
    expect(PERFECT_FRACTION).toBe(0.5); expect(timeLimitFor(q({}), 'J', { lenient: true }) * PERFECT_FRACTION).toBe(19);
  });
});
describe('朗读时不计时', () => {
  it('isSpeaking：朗读开关关闭或无语音时为 false', async () => {
    const { isSpeaking, setAudioPrefs } = await import('../src/tts');
    setAudioPrefs({ tts: false }); expect(isSpeaking()).toBe(false); setAudioPrefs({ tts: true });
  });
});
import { readFileSync } from 'node:fs';
import { loadBank } from '../src/game/questions';
import { buildChapters, isUnlocked } from '../src/game/levels';
describe('题库 v16：可玩题为 0 的语文古诗课', () => {
  it('二下《赋得古原草送别》卡片指向同名诗词关；不挡后面关卡解锁', () => {
    const all = loadBank(JSON.parse(readFileSync(new URL('../public/banks/bank_2.json', import.meta.url), 'utf8')), 'bank_2.json').all;
    const ok = all.filter(q => q.status === 'AI初审通过' || q.status === '已通过');
    expect(ok.filter(q => q.unit?.includes('赋得古原草送别') && q.subject === '语文')).toHaveLength(0);
    const chs = buildChapters(ok, null, all);
    const cn = chs.find(c => c.subject === '语文')!.levels; const i = cn.findIndex(l => l.name.includes('赋得古原草送别'));
    expect(i).toBeGreaterThanOrEqual(0);
    const poem = chs.find(c => c.subject === '诗词')!.levels.find(l => l.id === cn[i].redirect)!; expect(poem.name).toContain('赋得古原草送别');
    if (cn[i + 1] && cn[i + 1].unit === cn[i].unit && cn[i - 1]?.unit === cn[i].unit) {
      const st = { [cn[i - 1].id]: 1 }; expect(isUnlocked(cn, i + 1, st)).toBe(true); expect(isUnlocked(cn, i + 1, {})).toBe(false);
    }
  });
});
import { elitePool, assignedBefore, capMulti } from '../src/game/levels';
describe('策划 r7：精英 / Boss 选题不抄前面的关', () => {
  it('所有年级：精英关有生成时预留、前面关卡没分到的题，选题先出这些；高一数学各课不出精英抄题', () => {
    let n = 0;
    for (const g of ['K1', '1', '2', '3', '4', '5', '6', '7', '10']) {
      const all = loadBank(JSON.parse(readFileSync(new URL(`../public/banks/bank_${g}.json`, import.meta.url), 'utf8')), 'b.json').all.filter(q => q.status === 'AI初审通过' || q.status === '已通过');
      const by = new Map(all.map(q => [q.key, q]));
      for (const ch of buildChapters(all)) for (const e of ch.levels.filter(l => l.kind === 'elite')) {
        n++; const before = assignedBefore(ch.levels, e);
        // r13：普通关至少 6 题优先，精英预留可能少于 4 道
        for (const k of e.fresh ?? []) expect(before.has(k)).toBe(false);
        const pick = elitePool(e.pool.map(k => by.get(k)!), e.fresh, new Set(), new Set(), 6, before);
        const nf = Math.min(6, e.pool.filter(k => !before.has(k)).length); expect(pick.slice(0, nf).filter(q => !before.has(q.key)).length).toBe(nf);
      }
    }
    expect(n).toBeGreaterThan(0);
  });
  it('多选题每关最多 2 道', () => {
    const q = (k: string, t: string) => ({ key: k, type: t });
    const out = capMulti([q('a', '多选'), q('b', '多选'), q('c', '多选'), q('d', '选择')], [q('e', '选择'), q('c', '多选')]);
    expect(out.filter(x => x.type === '多选')).toHaveLength(2); expect(out.map(x => x.key)).toContain('e');
  });
});
import { judge } from '../src/game/questions';
import { newRound, resolveRound } from '../src/game/rounds';
import { PUPS } from '../src/game/characters';
import { selectQuestions, spreadTemplates } from '../src/game/adaptive';
describe('题库 v18：150 道多选题', () => {
  const raw = (g: string) => JSON.parse(readFileSync(new URL(`../public/banks/bank_${g}.json`, import.meta.url), 'utf8'));
  it('version 字段是字符串 v18，导入转字符串；数字也接受', () => {
    expect(raw('10').version).toBe('v27');
    expect(loadBank(raw('10'), 'bank_10.json').version).toBe('v27');
    expect(loadBank({ ...raw('7'), version: 4 }, 'bank_7.json').version).toBe('4');
  });
  it('真题判分：全对 full、漏选 partial、错选 wrong；漏选半伤害', () => {
    const ms = ['7', '10'].flatMap(g => loadBank(raw(g), `bank_${g}.json`).all).filter(q => q.type === '多选' && (q.status === 'AI初审通过' || q.status === '已通过'));
    expect(ms.length).toBe(151);
    const c = PUPS.find(x => x.major === '数学')!;
    for (const q of ms) {
      expect(q.options).toHaveLength(4); expect(q.answer.length).toBeGreaterThanOrEqual(2); expect(q.answer.length).toBeLessThanOrEqual(3);
      expect(judge(q, [...q.answer])).toBe('full');
      expect(judge(q, q.answer.join(''))).toBe('full');
      expect(judge(q, [q.answer[0]])).toBe('partial');
      const bad = ['A', 'B', 'C', 'D'].find(k => !q.answer.includes(k))!;
      expect(judge(q, [q.answer[0], bad])).toBe('wrong');
    }
    const s0 = { ...newRound('j', 'normal'), monsterHp: 999, monsterMax: 999 };
    const full = resolveRound(s0, c, { correct: true, subject: '历史', difficulty: 2, rng: () => 0.99, noSkill: true })[1].dealt;
    const half = resolveRound(s0, c, { correct: true, partial: true, subject: '历史', difficulty: 2, rng: () => 0.99, noSkill: true })[1];
    expect(Math.abs(half.dealt - full / 2)).toBeLessThanOrEqual(1); expect(half.taken).toBe(0);
  });
  it('每关最多 2 道多选（真题、全部关卡各抽 20 次）', () => {
    for (const g of ['7', '10']) {
      const all = loadBank(raw(g), 'b.json').all.filter(q => q.status === 'AI初审通过' || q.status === '已通过'); const by = new Map(all.map(q => [q.key, q]));
      for (const ch of buildChapters(all)) for (const l of ch.levels) {
        const pool = l.pool.map(k => by.get(k)!); if (!pool.some(q => q.type === '多选')) continue;
        for (let i = 0; i < 20; i++) { const qs = capMulti(spreadTemplates(selectQuestions({ pool, fallback: pool, n: l.kind === 'boss' ? 10 : 9, target: 2, kind: l.kind }), pool), pool); expect(qs.filter(q => q.type === '多选').length).toBeLessThanOrEqual(2); }
      }
    }
  });
});
describe('技术QA R6-3：撇号/连字符', () => {
  const by = (g: string, id: string) => loadBank(JSON.parse(readFileSync(new URL(`../public/banks/bank_${g}.json`, import.meta.url), 'utf8')), 'b.json').all.find(q => q.id === id)!;
  it("E3-078 isn't / E5-089 Mid-Autumn：直撇号、弯撇号、各种横线、大小写都判对", () => {
    const a = by('3', 'E3-078'), b = by('5', 'E5-089');
    expect(a.answer[0]).toBe("isn't"); expect(b.answer[0]).toBe('Mid-Autumn');
    for (const v of ["isn't", 'isn’t', 'isn‘t', "ISN'T"]) expect(judge(a, v)).toBe('full');
    for (const v of ['mid-autumn', 'Mid–Autumn', 'mid—autumn', 'Mid‑Autumn', 'mid−autumn']) expect(judge(b, v)).toBe('full');
    expect(judge(a, 'isnt')).toBe('wrong'); expect(judge(b, 'midautumn')).toBe('wrong');
  });
});
