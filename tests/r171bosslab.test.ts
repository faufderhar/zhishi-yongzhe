// r17.1 Boss测试解锁_r17 §4.2：BossLab 无界面模拟（真实 drawNext / resolveRound / logRound / summarize）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBank } from '../src/game/questions';
import { listBosses, simBoss, batch, batchCSV, seeded } from '../src/debug/bossLabSim';

const bank = (g: string) => loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`).all;

describe('BossLab sim', () => {
  const qs11 = bank('11');
  const rows = listBosses('11', qs11);
  it('高二 Boss 列表：有数学，名字 / 血量 / 两阶段 / 题池都在', () => {
    const math = rows.filter(r => r.subject === '数学');
    expect(math.length).toBeGreaterThan(0);
    for (const r of rows) { expect(r.name).toBeTruthy(); expect(r.hp).toBeGreaterThan(0); expect(r.phases.length).toBe(2); expect(r.phases[0] + r.phases[1]).toBe(r.hp); expect(r.pool).toBeGreaterThan(0); }
  });
  it('同一种子结果完全相同；不同种子可以不同', () => {
    const r = rows.find(x => x.subject === '数学')!;
    const a = simBoss(r, qs11, { seed: 7, p: 0.8 }), b = simBoss(r, qs11, { seed: 7, p: 0.8 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const outs = new Set([1, 2, 3, 4, 5, 6].map(s => JSON.stringify(simBoss(r, qs11, { seed: s, p: 0.8 }).rounds.map(x => x.q))));
    expect(outs.size).toBeGreaterThan(1);
  });
  it('全对：每场都击杀，答对数 = correctToKill，日志逐回合', () => {
    const r = rows.find(x => x.subject === '数学')!;
    const L = simBoss(r, qs11, { seed: 3, p: 1 });
    expect(L.summary.result).toBe('击杀'); expect(L.summary.correctToKill).toBeGreaterThan(0); expect(L.rounds.length).toBe(L.summary.turns);
  });
  it('批量统计：均值 / 中位数 / 最大 / 最小 一致，CSV 有汇总行', () => {
    const r = rows.find(x => x.subject === '数学')!; const b = batch(r, qs11, 20, { p: 1 });
    expect(b.kills).toBe(20); expect(b.min!).toBeLessThanOrEqual(b.median!); expect(b.median!).toBeLessThanOrEqual(b.max!);
    expect(b.mean!).toBeGreaterThanOrEqual(b.min!); expect(b.mean!).toBeLessThanOrEqual(b.max!);
    expect(batchCSV(b)).toMatch(/中位数,/);
  });
  it('「高二数学 Boss 约答对 6.7 题击杀」：全对 + 主修数学（阿算）+ 固定重击 ≈ 6.7；标准卡更多', () => {
    const math = rows.filter(r => r.subject === '数学');
    const avg = (o: Parameters<typeof batch>[3]) => { const ms = math.map(r => batch(r, qs11, 10, { p: 1, ...o }).mean!); return ms.reduce((a, b) => a + b, 0) / ms.length; };
    const heavy = avg({ charId: 'asuan', card: 'heavy' }), std = avg({ charId: 'asuan', card: 'std' });
    console.info(`[bosslab] 高二数学 ${math.length} 个 Boss：阿算 重击 ${heavy.toFixed(2)} / 标准 ${std.toFixed(2)} 题击杀`);
    expect(heavy).toBeGreaterThan(6); expect(heavy).toBeLessThan(7.5); expect(std).toBeGreaterThan(heavy);
  });
  it('其他回合制年级也能列出并跑（初一 / 小学 3 年级）', () => {
    for (const g of ['7', '3'] as const) { const qs = bank(g); const rs = listBosses(g, qs); expect(rs.length).toBeGreaterThan(0); expect(['击杀', '失败', '超时', '撤退']).toContain(simBoss(rs[0], qs, { seed: 1, p: 0.7 }).summary.result); }
  });
  it('seeded 可复现', () => { const a = seeded(5), b = seeded(5); expect([a(), a()]).toEqual([b(), b()]); });
});
