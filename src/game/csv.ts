/* CSV 导入（UTF-8，可带 BOM）：表头见 GDD §6.3；A–F 列 + X_image/X_audio；tag 用 | 分隔；填空 answer 用 | 分隔 */
export function parseCSV(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, '');
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = ''; if (row.some(x => x !== '')) rows.push(row); row = [];
    } else cell += c;
  }
  row.push(cell); if (row.some(x => x !== '')) rows.push(row);
  return rows;
}
/** CSV 行 → v0.3 JSON 题目对象 */
export function csvToQuestions(text: string): any[] {
  const [head, ...rows] = parseCSV(text);
  if (!head) return [];
  const h = head.map(x => x.trim());
  return rows.map(r => {
    const o: Record<string, string> = {};
    h.forEach((k, i) => { o[k] = (r[i] ?? '').trim(); });
    const options: any[] = [];
    for (const L of 'ABCDEF') if (o[L] || o[L + '_image']) options.push({ text: o[L] ?? '', image: o[L + '_image'] ?? '', audio: o[L + '_audio'] ?? '' });
    const q: any = { ...o, options, tags: (o.tag ?? '').split('|').map(s => s.trim()).filter(Boolean) };
    for (const L of 'ABCDEF') { delete q[L]; delete q[L + '_image']; delete q[L + '_audio']; }
    if (o.type === '填空') q.answer = o.answer.split('|').map(s => s.trim()).filter(Boolean);
    if (o.difficulty) q.difficulty = Number(o.difficulty); else delete q.difficulty;
    for (const k of ['tolerance', 'time']) if (!o[k]) delete q[k];
    if (!o.status) delete q.status;
    return q;
  });
}
const esc = (v: unknown) => { const s = v === undefined || v === null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function toCSV(head: string[], rows: Record<string, unknown>[]) {
  return '\uFEFF' + [head.join(','), ...rows.map(r => head.map(k => esc(r[k])).join(','))].join('\r\n');
}
