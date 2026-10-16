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
