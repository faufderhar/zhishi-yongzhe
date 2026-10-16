/* r10：D14 修正（题卡随难度、蓄力不叠怒、Boss 名）、v19 册别迁移、时长负数、星级说明、密码备份 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cardOut, DIFF_MULT, CARDS, ROUND, BOSS_CAP } from '../src/game/balance';
import { newRound, resolveRound, intentLabel } from '../src/game/rounds';
import { PUPS, SCIFI } from '../src/game/characters';
import { repairProfile } from '../src/state';
import { migrateVolumes } from '../src/game/volumeMigrate';
import { skinFor } from '../src/game/monsterSkin';
import { STAR_RULES_ROUND } from '../src/game/levels';
import { rulesFor, TIP_TEXT } from '../src/ui/rules';
const sci = SCIFI[0], abei = PUPS.find(c => c.id === 'abei')!;
describe('D14 修正 2：高一题卡倍率随难度', () => {
  it('有效 = 1 + (卡 − 1) × k，k = 0.5 / 0.75 / 1', () => {
    expect(cardOut(1.6, 1)).toBeCloseTo(1.3); expect(cardOut(1.6, 2)).toBeCloseTo(1.45); expect(cardOut(1.6, 3)).toBeCloseTo(1.6); expect(cardOut(1.6, 5)).toBeCloseTo(1.6);
    expect(cardOut(0.8, 1)).toBeCloseTo(0.9); expect(cardOut(1, 1)).toBe(1);
  });
  it('引擎用有效倍率；答错反击倍率不变', () => {
    const h = { ...newRound('h', 'normal'), monsterHp: 999 };
    const [, o] = resolveRound(h, sci, { correct: true, subject: '历史', difficulty: 1, card: 'heavy', rng: () => 0.99, noSkill: true });
    expect(o.dealt).toBe(Math.round(26 * DIFF_MULT[1] * 1.3 * (sci.major === '历史' ? 1.2 : 1)));
    const [, w] = resolveRound(h, sci, { correct: false, subject: '历史', difficulty: 1, card: 'heavy', rng: () => 0.99, noSkill: true });
    expect(w.taken).toBe(Math.round(ROUND.h.monsters.normal.atk * CARDS.heavy.ctr));
  });
});
describe('D14 修正 3：Boss 蓄力重击按基础攻击，不叠怒气', () => {
  it('初一 Boss 二阶段：普攻 17，重击 2×14 = 28', () => {
    const s = { ...newRound('j', 'boss'), monsterHp: 100, rage: true, side: 'M' as const, pattern: ['heavy' as const], mi: 0 };
    expect(intentLabel(s).short).toBe('💥 28');
    const [, o] = resolveRound(s, abei, { correct: false, subject: '数学', difficulty: 2, rng: () => 0.99, noSkill: true }); expect(o.taken).toBe(28);
  });
  it('高一 Boss 血条 250，重击 2×22 = 44；Boss 回合上限在配置里', () => {
    expect(ROUND.h.monsters.boss.hp).toBe(250);
    const s = { ...newRound('h', 'boss'), rage: true, side: 'M' as const, pattern: ['heavy' as const], mi: 0 };
    expect(resolveRound(s, sci, { correct: false, subject: '数学', difficulty: 2, rng: () => 0.99, noSkill: true })[1].taken).toBe(44);
    expect(ROUND.j.monsters.boss.cap).toBe(BOSS_CAP.j);
  });
});
describe('D14 修正 4：首次提示与规则', () => {
  it('押注 / 专注 / 能量提示写明实际得失；规则含押注、专注、能量、Boss 二阶段', () => {
    expect(TIP_TEXT.wagerP).toMatch(/×1\.2.*×1\.3.*×0\.5/); expect(TIP_TEXT.focus).toMatch(/完美闪避.*\+10%.*2 层/); expect(TIP_TEXT.energy).toMatch(/5/);
    const h = rulesFor('h').map(r => r[0]); for (const k of ['押注', '专注', '能量', 'Boss 二阶段']) expect(h).toContain(k);
    expect(rulesFor('j').find(r => r[0] === '挑战题')![1]).toMatch(/出题前/);
  });
});
describe('学霸：各学段 Boss 名字不同', () => {
  it('数学 Boss：小学 / 初一 / 高一三个名字', () => {
    const n = ['G3', 'J', 'H'].map(b => skinFor('数学', 'boss', b)!.name); expect(new Set(n).size).toBe(3); expect(n[0]).toBe('圆周率国王');
  });
});
describe('题库 v19：已学册别迁移', () => {
  it('旧写法 → 新写法，不用重新勾选', () => {
    expect(migrateVolumes('7', ['七年级上册(7A)'])).toEqual(['七年级上册']);
    expect(migrateVolumes('10', ['必修上', '纲要上', '必修1 分子与细胞'])).toEqual(['必修上册', '必修第一册']);
    expect(migrateVolumes('3', ['三年级上册'])).toEqual(['三年级上册']); expect(migrateVolumes('10', null)).toBeNull();
    const p = repairProfile({ id: 'a', name: 'x', grade: '7', volumes: ['七年级下册(7B)', '七年级下册'] })!; expect(p.volumes).toEqual(['七年级下册']);
  });
  it('迁移后的册别都在 v19 允许取值里', () => {
    const al = JSON.parse(readFileSync('tests/fixtures/volume_allowed.json', 'utf8')) as Record<string, string[]>;
    const all = new Set(Object.values(al).flat());
    for (const v of [...migrateVolumes('7', ['七年级上册(7A)', '七年级下册(7B)', ''])!, ...migrateVolumes('10', ['必修上', '纲要上', '必修1 中国特色社会主义', '必修2 经济与社会', '必修1 分子与细胞', ''])!]) expect(all.has(v)).toBe(true);
  });
  it('题库发布号 v19，可玩 6163', () => { expect(JSON.parse(readFileSync('public/banks/release.json', 'utf8'))).toEqual({ release: 'v19', playable: 6163 }); });
});
describe('技术QA R9-7：负数时长按默认，只有合法的 0 才迁移成不限', () => {
  it('-5 → 默认、不是不限；0 → 不限', () => {
    const p = repairProfile({ id: 'a', name: 'x', grade: '7', limit: { weekday: -5, weekend: 0 } })!;
    expect(p.unlimited?.weekday).toBeFalsy(); expect(p.limit.weekday).toBeGreaterThanOrEqual(5); expect(p.unlimited?.weekend).toBe(true);
  });
  it('R9-3：轮流回合星级说明', () => { expect(STAR_RULES_ROUND).toMatch(/剩一半血/); });
});
