/* r14 策划：合并导入规则（纯函数，便于测试）
   - 档案按 ID 匹配，备份里有、本机没有的加进来；本机已有的档案信息保持本机
   - 星星 / 经验 / 已掌握星取较高值（解锁进度由星星决定）；当天玩的次数保持本机
   - 错题本、答题记录取并集去重（同一错题保留更新时间较晚的一条）
   - 家长密码、时长设置、今天已用时长、锁、时钟等设备状态保持本机 */
type KV = [string, unknown][];
interface Prog { stars?: Record<string, number>; plays?: Record<string, unknown>; masteredStars?: number; xp?: number }
interface Ans { profileId: string; questionId: string; at: number; correct?: boolean }
interface Wr { id: string; updatedAt?: number }
export interface MergeIn { kv: KV; answers: [unknown, Ans][]; wrong: Wr[]; bank: { key: string }[] }
export interface MergeSummary { profilesAdded: number; levelsUpdated: number; wrongAdded: number; answersAdded: number }
export const NUM_MAX = 1e7;   // r15 技术QA R141-5：数字字段夹到合理上限
const num = (x: unknown, max = NUM_MAX) => { const n = typeof x === 'number' ? x : NaN; return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };   // r14.1 技术QA R14-3："NaN" 等坏值按 0
export function mergeBackup(cur: MergeIn, bk: MergeIn, today: string): { out: MergeIn; summary: MergeSummary } {
  const cm = new Map(cur.kv), bm = new Map(bk.kv);
  const cp = (Array.isArray(cm.get('profiles')) ? cm.get('profiles') : []) as { id: string }[];
  const bp = (Array.isArray(bm.get('profiles')) ? bm.get('profiles') : []) as { id: string }[];
  const added = bp.filter(p => p && p.id && !cp.some(c => c.id === p.id));
  const out = new Map(cm); out.set('profiles', [...cp, ...added]);
  let levelsUpdated = 0;
  for (const p of [...cp, ...added]) {
    const k = 'progress:' + p.id; const a = cm.get(k) as Prog | undefined, b = bm.get(k) as Prog | undefined;
    if (!b) continue; if (!a) { const st = Object.fromEntries(Object.entries(b.stars ?? {}).map(([id, v]) => [id, Math.min(3, num(v))])); out.set(k, { ...b, stars: st, xp: num(b.xp), masteredStars: num(b.masteredStars) }); levelsUpdated += Object.values(b.stars ?? {}).filter(v => v > 0).length; continue; }
    const stars = { ...(a.stars ?? {}) };
    for (const [id, v0] of Object.entries(b.stars ?? {})) { const v = Math.min(3, num(v0)); if (v > num(stars[id])) { stars[id] = v; levelsUpdated++; } }
    out.set(k, { ...a, stars, xp: Math.max(num(a.xp), num(b.xp)), masteredStars: Math.max(num(a.masteredStars), num(b.masteredStars)) });
  }
  for (const p of added) for (const pre of ['skills:', 'usage:']) {
    const k = pre + p.id; const v = bm.get(k); if (v === undefined || out.has(k)) continue;
    if (pre === 'usage:' && v && typeof v === 'object') { const u = { ...(v as Record<string, unknown>) }; delete u[today]; out.set(k, u); } else out.set(k, v);   // 今天的用时不从备份带过来
  }
  const sig = (x: Ans) => `${x.profileId}|${x.questionId}|${x.at}`;
  const have = new Set(cur.answers.map(([, v]) => sig(v)));
  const newAns = bk.answers.filter(([, v]) => v && !have.has(sig(v)));
  const wm = new Map(cur.wrong.map(w => [w.id, w])); let wrongAdded = 0;
  for (const w of bk.wrong) { const o = wm.get(w.id); if (!o) { wm.set(w.id, w); wrongAdded++; } else if ((w.updatedAt ?? 0) > (o.updatedAt ?? 0)) wm.set(w.id, w); }
  const bkKeys = new Set(cur.bank.map(q => q.key));
  return { out: { kv: [...out.entries()], answers: [...cur.answers, ...newAns], wrong: [...wm.values()], bank: [...cur.bank, ...bk.bank.filter(q => !bkKeys.has(q.key))] },
    summary: { profilesAdded: added.length, levelsUpdated, wrongAdded, answersAdded: newAns.length } };
}
