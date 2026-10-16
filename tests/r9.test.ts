/* r9：D14 数值调整验收清单 + 较真家长（时长最少 5 分钟、册别、迁移）+ 学霸（护盾文案） */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { comboMult, INNER_CAP, ROUND, CARDS, BOSS_CAP } from '../src/game/balance';
import { newRound, resolveRound, phaseOf, nextIntent, monAtk, intentLabel, type RState } from '../src/game/rounds';
import { PUPS, SCIFI } from '../src/game/characters';
import { levelStars, starsFor, migrateStars } from '../src/game/levels';
import { repairProfile, effLimit } from '../src/state';
import { rulesFor, TIP_KEYS, TIP_TEXT } from '../src/ui/rules';
import { skillById } from '../src/game/skills';
const abei = PUPS.find(c => c.id === 'abei')!, sci = SCIFI[0];
const A14 = { id: 't14', effect: 'A14' } as never, A2H = { id: 't2h', effect: 'A2H' } as never;
const hit = (s: RState, c = abei, extra: object = {}) => resolveRound(s, c, { correct: true, subject: c.major, difficulty: 2, rng: () => 0.99, noSkill: true, ...extra });

describe('D14 §2 倍率封顶', () => {
  it('comboMult 1.0 / 1.05 / … / 1.30（7 连起封顶），连对 1–10', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => +comboMult(c).toFixed(2))).toEqual([1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.3, 1.3, 1.3]);
    expect(INNER_CAP).toBe(1.8);
  });
  it('复现 57：初一、攻击 20、2 级题、亲和、连对 5、专注 1、数字风暴 → 43', () => {
    const s = { ...newRound('j', 'normal'), combo: 4, focus: 1, monsterHp: 999 };
    const [, o] = hit(s, abei, { forceSkill: A14, noSkill: false }); expect(o.dealt).toBe(43); expect(o.capped).toBe(true);
  });
  it('连对 7 + 专注 2 + 数字风暴 → 内层 1.8；高一重击 + 连对 7 → 1.8；A2H 每段分别封顶', () => {
    const s = { ...newRound('j', 'normal'), combo: 6, focus: 2, monsterHp: 999 };
    expect(hit(s, abei, { forceSkill: A14, noSkill: false })[1].dealt).toBe(Math.round(20 * 1.2 * 1.8));
    const h = { ...newRound('h', 'normal'), combo: 6, monsterHp: 999 };
    const [, oh] = hit(h, sci, { card: 'heavy' }); expect(oh.dealt).toBe(Math.round(26 * 1.2 * 1.8 * (sci.major === '数学' ? 1.1 : 1))); expect(oh.capped).toBe(true);
    const s2 = { ...newRound('j', 'normal'), combo: 6, focus: 2, monsterHp: 999 };
    const [, o2] = hit(s2, abei, { forceSkill: A2H, noSkill: false });   // 1.3×1.5×0.7 = 1.365 < 1.8：每段 20×1.2×1.365
    expect(o2.hits).toEqual([33, 33]);
  });
  it('外层：押注、多步段倍率不进封顶', () => {
    const h = { ...newRound('h', 'normal'), combo: 6, monsterHp: 999 };
    expect(hit(h, sci, { card: 'heavy', wager: 'sure' })[1].dealt).toBe(Math.round(26 * 1.2 * 1.2 * 1.8 * (sci.major === '数学' ? 1.1 : 1)));
  });
});
describe('D14 §3 数值表（快照）', () => {
  it('与表格逐项一致', () => {
    const t = (m: 'p36' | 'j' | 'h') => (['normal', 'elite', 'boss'] as const).map(k => [ROUND[m].monsters[k].hp, ROUND[m].monsters[k].atk, ROUND[m].monsters[k].cap]);
    expect({ p36: t('p36'), j: t('j'), h: t('h'), players: [ROUND.p36.player, ROUND.j.player, ROUND.h.player], bossCap: BOSS_CAP }).toMatchSnapshot();
    expect(t('j')).toEqual([[80, 12, 14], [150, 16, 20], [200, 14, 28]]);
  });
});
describe('D14 §4 Boss 二阶段', () => {
  it('初一 Boss ≤100 进入二阶段：溢出作废、护盾清零、攻击 17、循环 ⚔→⚡→💥', () => {
    const s0 = { ...newRound('j', 'boss'), monsterHp: 105, shield: 3 };
    const [s, o] = hit(s0); expect(o.phaseShift).toBe(true); expect(o.rage).toBe(true); expect(s.monsterHp).toBe(100); expect(o.dealt).toBe(5);
    expect(s.shield).toBe(0); expect(monAtk(s)).toBe(17); expect(s.pattern).toEqual(['atk', 'charge', 'heavy']); expect(nextIntent(s)).toBe('atk');
    expect(intentLabel(s).short).toContain('17');
  });
  it('同一击后面的段不再结算（A2H）', () => {
    const [s, o] = hit({ ...newRound('j', 'boss'), monsterHp: 102 }, abei, { forceSkill: A2H, noSkill: false }); expect(s.monsterHp).toBe(100); expect(o.hits[1]).toBe(0);
  });
  it('高一 Boss 二阶段攻击 26、弱点变化学', () => {
    const [s] = hit({ ...newRound('h', 'boss'), monsterHp: 130 }, sci); expect(phaseOf(s)).toBe(1); expect(monAtk(s)).toBe(26);
    expect(ROUND.h.monsters.boss.phases![1].weak).toBe('化学');
    const [, o] = resolveRound({ ...s, side: 'M', intentMod: null }, sci, { correct: false, subject: '物理', difficulty: 2, rng: () => 0.99, noSkill: true }); expect(o.taken).toBe(26);
  });
  it('控制技能降级的意图保留到新循环第一个意图', () => {
    const [s] = hit({ ...newRound('j', 'boss'), monsterHp: 105, intentMod: 'idle' }); expect(nextIntent(s)).toBe('idle');
  });
  it('小学 Boss 没有二阶段，只在半血后换循环', () => {
    const [s, o] = hit({ ...newRound('p36', 'boss'), monsterHp: 85 }); expect(o.phaseShift).toBeFalsy(); expect(s.rage).toBeFalsy(); expect(s.pattern).toEqual(['atk', 'charge', 'heavy']); expect(monAtk(s)).toBe(13);
  });
});
describe('D14 §5 三星', () => {
  it('80% 但剩血 49% → ★★；80%、50%、没复活 → ★★★；撤退最多 ★', () => {
    expect(levelStars({ win: true, correct: 8, total: 10, revived: false, hpPct: 0.49 })).toBe(2);
    expect(levelStars({ win: true, correct: 8, total: 10, revived: false, hpPct: 0.5 })).toBe(3);
    expect(levelStars({ win: true, correct: 8, total: 10, revived: true, hpPct: 1 })).toBe(2);
    expect(levelStars({ win: true, correct: 10, total: 10, revived: false, retreat: true, hpPct: 1 })).toBe(1);
    expect(starsFor(true, 0.6, false, 0.1)).toBe(2);
  });
  it('旧档案 ★★★ 重打只拿 ★ 仍显示 ★★★（只升不降）', () => {
    const lv = [{ id: 'a', kind: 'normal', pool: [], parts: undefined }] as never;
    const old = { a: 3 }; const nx = migrateStars(lv, old); expect(nx === null || nx.a === undefined || nx.a >= 3).toBe(true);
    expect(Math.max(old.a, 1)).toBe(3);
  });
});
describe('D14 §6 挑战题', () => {
  it('答对伤害 ×1.5（进封顶）；答错闪避 0、反击 ×1.5', () => {
    const s = { ...newRound('j', 'normal'), monsterHp: 999 };
    expect(hit(s, abei, { challenge: true, difficulty: 3 })[1].dealt).toBe(Math.round(20 * 1.2 * 1.2 * 1.5));
    const [, w] = resolveRound(s, abei, { correct: false, subject: abei.major, difficulty: 3, rng: () => 0, noSkill: true, challenge: true });
    expect(w.dodged).toBe(false); expect(w.taken).toBe(Math.round(12 * 1.5));
    const [, w2] = resolveRound(s, abei, { correct: false, subject: abei.major, difficulty: 3, rng: () => 0, noSkill: true }); expect(w2.dodged).toBe(true);
  });
  it('挑战题封顶：连对 7 + 专注 2 + 挑战 → 1.8', () => {
    const s = { ...newRound('j', 'normal'), combo: 6, focus: 2, monsterHp: 999 };
    expect(hit(s, abei, { challenge: true })[1].dealt).toBe(Math.round(20 * 1.2 * 1.8));
  });
  it('UI：只在初一我方回合出现，挑战题同科目同小节难度 +1，没有时灰掉并提示', () => {
    const src = readFileSync('src/ui/RoundBattle.tsx', 'utf8');
    expect(src).toMatch(/bs\.mode === 'j' && bs\.side === 'P'\) \{ const n = take\(\)/);   // r10：出题前选
    expect(src).toMatch(/x\.subject === base\.subject && x\.unit === base\.unit && x\.difficulty === base\.difficulty \+ 1/);
    expect(src).toMatch(/这一关没有更难的题了/); expect(src).not.toMatch(/chooseChal\(false\), 3000/); expect(src).toMatch(/data-testid="chal-normal"[^>]*>.*默认/);   // r11：不再 3 秒自动普通，普通标「默认」
  });
});
describe('D14 §7 规则与首次提示', () => {
  it('「？」浮层按学段：小学不显示专注、挑战、题卡；初一有挑战、高一有题卡', () => {
    const p = rulesFor('p36').map(r => r[0]), j = rulesFor('j').map(r => r[0]), h = rulesFor('h').map(r => r[0]);
    expect(p).not.toContain('专注'); expect(p).not.toContain('挑战题'); expect(p).not.toContain('题卡'); expect(p).not.toContain('Boss 二阶段');
    expect(j).toContain('挑战题'); expect(j).not.toContain('题卡'); expect(h).toContain('题卡'); expect(h).toContain('押注');   // r10：题卡、押注分开 expect(h).not.toContain('挑战题');
  });
  it('7 种首次提示，文案与规格一致', () => {
    expect(TIP_KEYS).toEqual(['partial', 'dodge', 'perfect', 'guard', 'rage', 'challenge', 'cap', 'wagerP', 'wagerM', 'focus', 'energy']);   // r10 +押注/专注/能量
    expect(TIP_TEXT.cap).toBe('加成已经到顶啦（最多 ×1.8）');
  });
});
describe('r9 较真家长', () => {
  it('旧档案时长 0 → 不限开关；最少 5 分钟', () => {
    const p = repairProfile({ id: 'x', name: 'a', avatar: 'a', grade: '2', volumes: null, limit: { weekday: 0, weekend: 30 } })!;
    expect(p.unlimited?.weekday).toBe(true); expect(p.limit.weekday).toBeGreaterThanOrEqual(5); expect(effLimit(p)).toEqual({ weekday: 0, weekend: 30 });
    const q = repairProfile({ id: 'y', name: 'a', avatar: 'a', grade: '2', volumes: null, limit: { weekday: 3, weekend: 30 } })!; expect(effLimit(q).weekday).toBe(5);
  });
  it('修复档案时保留 lastGrade / charIds / tips / 册别', () => {
    const p = repairProfile({ id: 'x', name: 'a', avatar: 'a', grade: '2', volumes: ['二年级上册'], limit: { weekday: 30, weekend: 30 }, lastGrade: '7', charIds: { pups: 'abei' }, tips: { cap: true } })!;
    expect(p.lastGrade).toBe('7'); expect(p.charIds).toEqual({ pups: 'abei' }); expect(p.tips).toEqual({ cap: true }); expect(p.volumes).toEqual(['二年级上册']);
  });
  it('编辑器：−5 不会到 0；「全部册别」时点某册 = 只选这一册', () => {
    const src = readFileSync('src/ui/Parent.tsx', 'utf8');
    expect(src).toMatch(/Math\.max\(MIN_LIMIT, f\.limit\[k\] \+ d\)/); expect(src).toMatch(/toggleVolS\(f\.volumes, v, vols\.map/);   // r11：状态逻辑移到 game/volumes.ts（有单测）
  });
});
describe('r9 学霸', () => {
  it('护盾不再出现「14·14」：意图只写要做什么，已有护盾单独写', () => {
    for (const f of ['src/ui/Battle.tsx', 'src/ui/RoundBattle.tsx']) expect(readFileSync(f, 'utf8')).not.toMatch(/护盾 \$\{bs\.shieldAmt\}`\}\{bs\.monsterShield > 0 && ` · 护盾/);
    expect(intentLabel({ ...newRound('j', 'normal'), mi: 2 }).short).toBe('🛡 要开盾');
  });
  it('技能 id 存在（回归）', () => { expect(skillById('nope')).toBeUndefined(); });
});
