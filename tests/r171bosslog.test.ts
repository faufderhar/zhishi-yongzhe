// r17.1（Boss测试解锁_r17 §4.2-3/4/5 · §4.3；r16.1 延后项）：__zyBossLog = { summary, rounds[] } + 导出 CSV / JSON，只在测试构建
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newRound, resolveRound, phaseOf, type RState } from '../src/game/rounds';
import { PUPS } from '../src/game/characters';
import { logRound, summarize, toCSV, logFileName, type BossLogRound } from '../src/game/bossLog';
// @ts-expect-error 纯 JS 脚本
import { HOOKS } from '../scripts/check-prod-hooks.mjs';

const mk = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const c = PUPS.find(x => x.major === '数学')!;
/** 高一（mode h）两阶段 Boss，按正确率 p 用种子答题，打到结束 */
function fight(seed: number, p = 1) {
  const rng = mk(seed); let s: RState = newRound('h', 'boss', { grade: '10' }); const rounds: BossLogRound[] = [];
  for (let i = 0; i < 200 && !s.over; i++) {
    const r = rng(); const grade = r < p ? 'full' : 'wrong'; const q = { id: 'Q' + i, difficulty: 1 + (i % 3) };
    const [ns, o] = resolveRound(s, c, { correct: grade === 'full', subject: i % 2 ? '数学' : '化学', difficulty: q.difficulty, card: 'std', rng });
    rounds.push(logRound(s, ns, o, q, { card: 'std', wager: false, challenge: false, grade })); s = ns;
  }
  return { s, rounds, summary: summarize(rounds, s, { level: 'L1', monster: 'boss', seconds: 0 }) };
}

describe('伤害日志 / 本场统计', () => {
  it('全对打穿两阶段：击杀；数值直接取 ROut；分阶段答对数加起来 = 总答对', () => {
    const { s, rounds, summary } = fight(1);
    expect(s.over).toBe('win'); expect(summary.result).toBe('击杀'); expect(summary.correctToKill).toBe(summary.correct);
    expect(summary.correctByPhase.length).toBe(2); expect(summary.correctByPhase[0] + summary.correctByPhase[1]).toBe(summary.correct);
    expect(rounds.at(-1)!.monHpAfter).toBe(0);
    for (let i = 1; i < rounds.length; i++) expect(rounds[i].monHpBefore).toBe(rounds[i - 1].monHpAfter);   // 怪物血量 前→后 首尾相接
    const p = rounds.filter(r => r.side === 'P' && r.result === '对');
    expect(p.every(r => r.outer.length >= 0 && r.innerUsed != null && r.perHit.length === r.hits)).toBe(true);
    expect(summary.totalDealt).toBe(p.reduce((a, r) => a + r.dealt, 0));
    expect(summary.skills).toBe(rounds.filter(r => r.skill).length);
    expect(rounds.some(r => r.phaseBefore === 1 && r.phase === 2)).toBe(true);   // 打穿第一阶段那一题按第一阶段计
  });
  it('同一种子跑两次完全相同；换种子不同（p = 0.7）', () => {
    expect(JSON.stringify(fight(5, 0.7))).toBe(JSON.stringify(fight(5, 0.7)));
    expect(JSON.stringify(fight(5, 0.7).rounds)).not.toBe(JSON.stringify(fight(6, 0.7).rounds));
  });
  it('答错有反击 / 闪避；未打完的结果按 end 写', () => {
    const { rounds } = fight(3, 0.4); const s0 = newRound('h', 'boss', { grade: '10' });
    expect(rounds.some(r => r.result === '错')).toBe(true);
    const sum = summarize(rounds.slice(0, 3), { ...s0, turn: 3 }, { level: 'L', monster: 'm', seconds: 1.5, end: '超时' });
    expect(sum.result).toBe('超时'); expect(sum.correctToKill).toBeNull(); expect(phaseOf(s0)).toBe(0);
  });
  it('CSV：表头 23 列 + 每回合一行；带逗号的字段加引号', () => {
    const { rounds } = fight(2); const csv = toCSV(rounds).trimEnd().split('\n');
    expect(csv.length).toBe(rounds.length + 1); expect(csv[0].split(',')).toHaveLength(23);
    expect(csv[0]).toBe('回合,我方/对方,题目id,难度,题卡,押注,挑战题,结果,技能名,段数,外层,内层,内层原始,内层生效,是否封顶,每段伤害,护盾抵扣,实际造成,怪物血量前,怪物血量后,阶段,反击伤害,是否闪避');
    expect(toCSV([{ ...rounds[0], qid: 'a,"b"' }]).split('\n')[1]).toContain('"a,""b"""');
    expect(logFileName('10', 'g10-math-b1', 'csv', new Date(2026, 9, 26, 9, 5, 7))).toBe('bosslab_10_g10-math-b1_20261026-090507.csv');
  });
});

it('只在测试构建：RoundBattle 里每处用到日志都在 __TEST_HOOKS__ 后面；生产检查名单含 BossLab / 导出', () => {
  const rb = readFileSync('src/ui/RoundBattle.tsx', 'utf8');
  for (const m of rb.matchAll(/writeBossLog\(|exportBossLog\(|logRound\(|__zyBossLab/g)) {
    const st = rb.lastIndexOf('\n', m.index); const line = rb.slice(rb.lastIndexOf('\n', st - 1) + 1, rb.indexOf('\n', m.index));   // 这一行 + 上一行（导出按钮在上一行的 JSX 条件里）
    if (/const (writeBossLog|exportBossLog) =/.test(line)) continue;   // 定义本身第一行就 return
    expect(line, line.trim().slice(-160)).toMatch(/__TEST_HOOKS__/);
  }
  expect(rb).toMatch(/const writeBossLog = [^\n]*\n\s+if \(!__TEST_HOOKS__/); expect(rb).toMatch(/const exportBossLog = [^\n]*\n\s+if \(!__TEST_HOOKS__/);
  for (const h of ['__zyBossLog', '__zyBossLab', 'BossLab', 'bosslab_', 'bosslog-export']) expect(HOOKS).toContain(h);
});
