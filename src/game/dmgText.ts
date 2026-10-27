/* r16 D15（挑剔学霸 r15.4.4 问题 1、2）：伤害加成摘要 + 明细文字。只改显示，数值来自 rounds.dmgInfo（和结算同一套）。 */
import type { DmgInfo } from './rounds';
import { INNER_CAP } from './balance';

/** 倍率两位小数、去掉末尾 0：1.6 → 「×1.6」，1.32 → 「×1.32」，2 → 「×2」 */
export const fmtX = (m: number) => '×' + String(Math.round(m * 100) / 100);
const f1 = (x: number) => String(Math.round(x * 10) / 10);

export interface SumItem { name: string; m: number; outer: boolean }
const isMultiSkill = (d: DmgInfo, n: string, m: number) => !!d.multi && n === '技能' && Math.abs(m - d.multi.perHit) < 1e-9;
/** 所有 ≠×1 的加成（难度不算：明细第一行单列；多段技能的每段倍率另列）；按「不封顶在前、封顶在后」，每组内倍率从大到小 */
export function bonusItems(d: DmgInfo): SumItem[] {
  const by = (a: SumItem, b: SumItem) => b.m - a.m;
  const o = d.outer.filter(([, m]) => Math.abs(m - 1) > 1e-9).map(([name, m]) => ({ name, m, outer: true })).sort(by);
  const i = d.inner.filter(([n, m]) => Math.abs(m - 1) > 1e-9 && !isMultiSkill(d, n, m)).map(([name, m]) => ({ name, m, outer: false })).sort(by);
  return [...o, ...i];
}
/** r17.1 D15 §6.2 B：多段技能单独一段「青莲剑歌 2 段×70%」 */
export const multiText = (d: DmgInfo) => d.multi ? `${d.skill ?? '技能'} ${d.multi.hits} 段×${Math.round(d.multi.perHit * 100)}%` : null;
/** 摘要（D15 §6.2 B）：增益（>×1）最多 n 个（挑倍率最大的 n 个，再按 bonusItems 的顺序排），多了加「等」；多段技能一段；减益（<×1，含漏选）最多 2 个、前面写「减：」；
    封顶时 cap 标签放最后。什么都没有 → null（不显示第二行） */
export function summary(d: DmgInfo | undefined, n = 3): { items: SumItem[]; more: boolean; cap: string | null; multi: string | null; neg: SumItem[] } | null {
  if (!d) return null; const all = bonusItems(d);
  const gain = all.filter(x => x.m > 1), neg = [...all.filter(x => x.m < 1), ...(d.half ? [{ name: '漏选', m: 0.5, outer: false }] : [])].sort((a, b) => a.m - b.m).slice(0, 2);
  const multi = multiText(d);
  if (!gain.length && !neg.length && !multi && !d.capped) return null;
  const keep = new Set([...gain].sort((a, b) => b.m - a.m).slice(0, n));
  return { items: gain.filter(x => keep.has(x)), more: gain.length > n, cap: d.capped ? `已到上限 ${fmtX(INNER_CAP)}` : null, multi, neg };
}
/** self = 题卡自己的名字（卡面上）：r17.4 技术QA N4，卡面已经写着「轻击」，减益里这张卡自己就只写倍率 →「减 ×0.9」（800×600 窄卡放得下） */
export const negText = (neg: SumItem[], self?: string) => {
  if (!neg.length) return '';
  const parts = neg.map(x => self && x.name === self ? fmtX(x.m) : `${x.name} ${fmtX(x.m)}`);
  return (self && neg.every(x => x.name === self) ? '减 ' : '减：') + parts.join(' · ');
};
export const summaryText = (s: NonNullable<ReturnType<typeof summary>>) =>
  [[s.items.map(x => `${x.name} ${fmtX(x.m)}`).join(' · ') + (s.more ? ' 等' : ''), s.multi ?? '', negText(s.neg)].filter(Boolean).join(' ｜ '), s.cap ?? ''].filter(Boolean).join(' · ');
/** r16.1 (w) Boss补测裁定_r17 §2：打穿第一阶段线时多出的伤害不带到下一阶段（数值不变）；r17-5：叫「阶段线」，不再借用玩家技能的「护体」 */
export const guardText = (n: number) => `🚧 阶段线！第一阶段破了，多出 ${n} 点没打进去`;
/** r16.1 (v)：预计伤害会被阶段线截住时的说明 */
export const phaseCapText = (x: number) => `本阶段最多扣 ${x}，多出的不会带到下一阶段`;
/** 题卡来源「（基础 ×a，难度 d 按 k% 生效）」；难度 ≥3（按 100%）不写 */
const cardSrc = (d: DmgInfo, n: string) => d.card && d.card.name === n && d.card.k < 1 ? `（基础 ${fmtX(d.card.base)}，难度 ${d.card.d} 按 ${Math.round(d.card.k * 100)}% 生效）` : '';
/** 明细浮层的几行（D15 §6.2 C）；「≈ 数」那行的数 = 每段实际伤害（护盾抵扣前），dealt 给了就再写护盾 / 实际造成 */
export function detailLines(d: DmgInfo, dealt?: number, absorbed = 0): string[] {
  const L: string[] = []; const ab = d.atk * d.diff;
  L.push(`攻击 ${d.atk} × 难度 ${fmtX(d.diff)} = ${f1(ab)}`);
  const o = d.outer.filter(([, m]) => Math.abs(m - 1) > 1e-9);
  L.push(`不封顶加成：${o.length ? o.map(([n, m]) => n === d.passive ? `被动「${n}」${fmtX(m)}` : `${n} ${fmtX(m)}`).join(' · ') : '无'} → 基础 ≈ ${f1(d.base)}`);
  const i = d.inner.filter(([, m]) => Math.abs(m - 1) > 1e-9);
  const one = ([n, m]: [string, number]) => isMultiSkill(d, n, m) ? `技能「${d.skill ?? ''}」每段 ${fmtX(m)}（共 ${d.multi!.hits} 段）` : n === '技能' && d.skill ? `技能「${d.skill}」${fmtX(m)}` : `${n} ${fmtX(m)}${cardSrc(d, n)}`;
  const up = i.filter(([n, m]) => m > 1 || isMultiSkill(d, n, m)).map(one), down = i.filter(([n, m]) => m < 1 && !isMultiSkill(d, n, m)).map(one);
  L.push(`封顶加成：${i.length ? [up.join(' · '), down.length ? '减：' + down.join(' · ') : ''].filter(Boolean).join('；') + (i.length > 1 ? ` = ${fmtX(d.innerRaw)}` : '') : '无'}`);
  if (d.capped) L.push(`已到上限，按 ${fmtX(INNER_CAP)} 算`);
  const total = d.per * d.hits;
  L.push(`${f1(d.base)} × ${fmtX(d.innerUsed)}${d.half ? ' × 漏选 ×0.5' : ''} ≈ ${d.per}${d.hits > 1 ? `（每段）× ${d.hits} 段 = ${total}` : ''}`);
  if (d.multi) L.push(`${d.skill ?? '技能'}：每段 ${Math.round(d.multi.perHit * 100)}%，${d.multi.hits} 段合计约 ${Math.round(d.multi.perHit * d.multi.hits * 100)}%，每段的倍率算在 ${fmtX(INNER_CAP)} 上限里`);
  if (dealt !== undefined && dealt !== total) L.push(`${absorbed ? `护盾挡掉 ${absorbed} · ` : ''}实际造成 ${dealt}${dealt < total - absorbed ? `（${guardText(total - absorbed - dealt)}）` : ''}`);
  return L;
}
