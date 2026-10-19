/* r16 D15（挑剔学霸 r15.4.4 问题 1、2）：伤害加成摘要 + 明细文字。只改显示，数值来自 rounds.dmgInfo（和结算同一套）。 */
import type { DmgInfo } from './rounds';
import { INNER_CAP } from './balance';

/** 倍率两位小数、去掉末尾 0：1.6 → 「×1.6」，1.32 → 「×1.32」，2 → 「×2」 */
export const fmtX = (m: number) => '×' + String(Math.round(m * 100) / 100);
const f1 = (x: number) => String(Math.round(x * 10) / 10);

export interface SumItem { name: string; m: number; outer: boolean }
/** 所有 ≠×1 的加成（难度不算：明细第一行单列）；按「不封顶在前、封顶在后」，每组内倍率从大到小 */
export function bonusItems(d: DmgInfo): SumItem[] {
  const by = (a: SumItem, b: SumItem) => b.m - a.m;
  const o = d.outer.filter(([, m]) => Math.abs(m - 1) > 1e-9).map(([name, m]) => ({ name, m, outer: true })).sort(by);
  const i = d.inner.filter(([, m]) => Math.abs(m - 1) > 1e-9).map(([name, m]) => ({ name, m, outer: false })).sort(by);
  return [...o, ...i];
}
/** 摘要：最多 n 个（挑倍率最大的 n 个，再按 bonusItems 的顺序排），多了加「等」；封顶时 cap 标签。没有加成也没封顶 → null（不显示第二行） */
export function summary(d: DmgInfo | undefined, n = 3): { items: SumItem[]; more: boolean; cap: string | null } | null {
  if (!d) return null; const all = bonusItems(d);
  if (!all.length && !d.capped) return null;
  const keep = new Set([...all].sort((a, b) => b.m - a.m).slice(0, n));
  return { items: all.filter(x => keep.has(x)), more: all.length > n, cap: d.capped ? `已到上限 ${fmtX(INNER_CAP)}` : null };
}
export const summaryText = (s: NonNullable<ReturnType<typeof summary>>) =>
  [s.items.map(x => `${x.name} ${fmtX(x.m)}`).join(' · ') + (s.more ? ' 等' : ''), s.cap ?? ''].filter(Boolean).join(' · ');
/** 明细浮层的几行；最后一行的数 = 每段实际伤害（护盾抵扣前），dealt 给了就再写护盾 / 实际造成 */
export function detailLines(d: DmgInfo, dealt?: number, absorbed = 0): string[] {
  const L: string[] = []; const ab = d.atk * d.diff;
  L.push(`攻击 ${d.atk} × 难度 ${fmtX(d.diff)} = ${f1(ab)}`);
  const o = d.outer.filter(([, m]) => Math.abs(m - 1) > 1e-9);
  L.push(`不封顶加成：${o.length ? o.map(([n, m]) => `${n} ${fmtX(m)}`).join(' · ') : '无'} → 基础 ≈ ${f1(d.base)}`);
  const i = d.inner.filter(([, m]) => Math.abs(m - 1) > 1e-9);
  L.push(`封顶加成：${i.length ? i.map(([n, m]) => `${n} ${fmtX(m)}`).join(' · ') + (i.length > 1 ? ` = ${fmtX(d.innerRaw)}` : '') : '无'}`);
  if (d.capped) L.push(`已到上限，按 ${fmtX(INNER_CAP)} 算`);
  L.push(`${f1(d.base)} × ${fmtX(d.innerUsed)}${d.half ? ' × 漏选 ×0.5' : ''} ≈ ${d.per}${d.hits > 1 ? `（每段，共 ${d.hits} 段）` : ''}`);
  const total = d.per * d.hits;
  if (dealt !== undefined && dealt !== total) L.push(`${absorbed ? `护盾挡掉 ${absorbed} · ` : ''}实际造成 ${dealt}${dealt < total - absorbed ? '（Boss 阶段到底，多出的不算）' : ''}`);
  return L;
}
