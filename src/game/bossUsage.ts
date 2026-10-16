/** r11：Boss 关题目 = 本单元 Boss 专用题在前（最多 n 道），再用原规则选出的题补满 n 道（去重） */
export function withBossFirst<T extends { key: string }>(boss: T[], rest: T[], n: number): T[] {
  const out: T[] = [], seen = new Set<string>();
  for (const q of [...boss, ...rest]) { if (out.length >= n) break; if (!seen.has(q.key)) { seen.add(q.key); out.push(q); } }
  return out;
}
