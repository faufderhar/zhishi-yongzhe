/* r11（较真家长）：已学册别选择的状态定义
   - null = 全部册别（每册都亮）；[] = 一册都没选（保存时提示至少选一册，不会悄悄变回全部）
   - 点某一册：亮 → 灭，灭 → 亮；全部都亮了就记成 null
   - 〔全部册别〕：全亮时 → 全灭；否则 → 全亮
   - 「已学 X 册」不算「通用」和「拓展复习（不分册）」这类不分册的题 */
export type Vols = string[] | null;
export function toggleVol(cur: Vols, v: string, all: string[]): Vols {
  const base = cur ?? all; const nx = base.includes(v) ? base.filter(x => x !== v) : [...base, v];
  return all.every(x => nx.includes(x)) ? null : nx;
}
export const toggleAllVols = (cur: Vols): Vols => (cur === null ? [] : null);
export const isRealVolume = (v: string) => !/通用/.test(v) && !/拓展复习|不分册/.test(v) && v.trim() !== '';
export const learnedCount = (cur: Vols) => (cur ?? []).filter(isRealVolume).length;
export const volsValid = (cur: Vols) => cur === null || cur.length > 0;
