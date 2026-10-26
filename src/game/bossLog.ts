/** r17.1（Boss测试解锁_r17 §4.2-3/4/5，r16.1 延后项）：本场统计 + 逐回合伤害日志。
 *  只在测试构建里被引用（RoundBattle 里包在 `if (__TEST_HOOKS__)` 里），正式版整个模块被摇掉；
 *  数值直接取 ROut / ROut.dmg，这里不另算伤害。 */
import { phaseOf, type RState, type ROut } from './rounds';

export interface BossLogRound {
  turn: number; side: 'P' | 'M'; qid: string; difficulty: number; card: string; wager: boolean; challenge: boolean; result: '对' | '错' | '漏选';
  skill: string; hits: number; outer: [string, number][]; inner: [string, number][]; innerRaw: number | null; innerUsed: number | null; capped: boolean;
  perHit: number[]; absorbed: number; dealt: number; monHpBefore: number; monHpAfter: number; phase: number; phaseBefore: number; taken: number; dodged: boolean;
}
export interface BossLogSummary {
  level: string; monster: string; kind: string; result: '击杀' | '失败' | '超时' | '撤退' | '退出' | '进行中'; turns: number;
  correct: number; wrong: number; partial: number; correctToKill: number | null; correctByPhase: number[];
  totalDealt: number; avgPerQ: number; skills: number; caps: number; playerHp: number; revived: boolean; seconds: number;
}
export interface BossLog { summary: BossLogSummary; rounds: BossLogRound[] }

export function logRound(before: RState, after: RState, o: ROut, q: { id: string; difficulty: number }, inp: { card: string; wager: boolean; challenge: boolean; grade: 'full' | 'partial' | 'wrong' }): BossLogRound {
  const d = o.dmg;
  return {
    turn: after.turn, side: o.side as 'P' | 'M', qid: q.id, difficulty: q.difficulty, card: inp.card, wager: inp.wager, challenge: inp.challenge,
    result: inp.grade === 'full' ? '对' : inp.grade === 'partial' ? '漏选' : '错',
    skill: o.skill?.name ?? '', hits: o.hits.length, outer: d?.outer ?? [], inner: d?.inner ?? [], innerRaw: d ? d.innerRaw : null, innerUsed: d ? d.innerUsed : null,
    capped: !!o.capped, perHit: o.hits.slice(), absorbed: o.absorbed ?? 0, dealt: o.dealt, monHpBefore: before.monsterHp, monHpAfter: after.monsterHp,
    phase: phaseOf(after) + 1, phaseBefore: phaseOf(before) + 1, taken: o.taken, dodged: o.dodged,
  };
}

/** 本场统计。correctToKill：击杀时「从开打到击杀共答对几题」（漏选算 0.5，和结算页一致）；correctByPhase：按答题前所在阶段分开计（打穿第一阶段那一题算第一阶段） */
export function summarize(rounds: BossLogRound[], s: RState, meta: { level: string; monster: string; seconds: number; end?: BossLogSummary['result'] }): BossLogSummary {
  const n = (r: BossLogRound['result']) => rounds.filter(x => x.result === r).length;
  const correct = n('对') + 0.5 * n('漏选'); const byPhase: number[] = [];
  for (const r of rounds) byPhase[r.phaseBefore - 1] = (byPhase[r.phaseBefore - 1] ?? 0) + (r.result === '对' ? 1 : r.result === '漏选' ? 0.5 : 0);
  const result = meta.end ?? (s.over === 'win' ? '击杀' : s.over === 'lose' ? '失败' : s.over === 'retreat' ? '撤退' : '进行中');
  const totalDealt = rounds.reduce((a, r) => a + (r.side === 'P' ? r.dealt : 0), 0); const q = rounds.length;
  return {
    level: meta.level, monster: meta.monster, kind: s.kind, result, turns: s.turn, correct, wrong: n('错'), partial: n('漏选'),
    correctToKill: result === '击杀' ? correct : null, correctByPhase: Array.from(byPhase, x => x ?? 0),
    totalDealt, avgPerQ: q ? Math.round(totalDealt / q * 100) / 100 : 0, skills: rounds.filter(r => r.skill).length, caps: rounds.filter(r => r.capped).length,
    playerHp: s.playerHp, revived: s.revived, seconds: meta.seconds,
  };
}

const CSV_HEAD = ['回合', '我方/对方', '题目id', '难度', '题卡', '押注', '挑战题', '结果', '技能名', '段数', '外层', '内层', '内层原始', '内层生效', '是否封顶', '每段伤害', '护盾抵扣', '实际造成', '怪物血量前', '怪物血量后', '阶段', '反击伤害', '是否闪避'];
const parts = (p: [string, number][]) => p.map(([k, v]) => `${k}×${Math.round(v * 1000) / 1000}`).join(' ');
const cell = (v: unknown) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
const yn = (b: boolean) => b ? '是' : '否';
export function toCSV(rounds: BossLogRound[]): string {
  const rows = rounds.map(r => [r.turn, r.side === 'P' ? '我方' : '对方', r.qid, r.difficulty, r.card, yn(r.wager), yn(r.challenge), r.result, r.skill, r.hits, parts(r.outer), parts(r.inner),
    r.innerRaw ?? '', r.innerUsed ?? '', yn(r.capped), r.perHit.join('+'), r.absorbed, r.dealt, r.monHpBefore, r.monHpAfter, r.phase, r.taken, yn(r.dodged)]);
  return [CSV_HEAD, ...rows].map(r => r.map(cell).join(',')).join('\n') + '\n';
}
export const logFileName = (grade: string, level: string, ext: 'json' | 'csv', d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `bosslab_${grade}_${level}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
};
