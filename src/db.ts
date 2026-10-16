/* IndexedDB：kv（设置/档案/进度/时长）、wrong（错题本）、answers（答题记录）、bank（家长导入的题，覆盖内置题） */
import { openDB, type IDBPDatabase } from 'idb';
import type { WrongEntry } from './game/wrongbook';
export interface AnswerRecord { profileId: string; questionId: string; correct: boolean; at: number; subject?: string }
const DB = 'zhishi-yongzhe';
export const STORES = ['kv', 'answers', 'wrong', 'bank'] as const;
let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) dbp = openDB(DB, 2, {
    upgrade(d, old) {
      if (old < 1) {
        d.createObjectStore('kv');
        d.createObjectStore('answers', { autoIncrement: true }).createIndex('byProfile', 'profileId');
      }
      if (old < 2) {
        d.createObjectStore('wrong', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        d.createObjectStore('bank', { keyPath: 'key' });
      }
    },
  });
  return dbp;
}
const safe = async <T>(f: () => Promise<T>, dflt: T): Promise<T> => { try { return await f(); } catch (e) { console.warn('IDB', e); return dflt; } };
/** 写入失败不再静默：广播 zy-storage-error，界面给家长可见提示（技术QA P1-4） */
export const STORAGE_ERROR = 'zy-storage-error';
const safeW = async (f: () => Promise<void>): Promise<boolean> => {
  try { await f(); return true; } catch (e) { console.warn('IDB write', e); try { window.dispatchEvent(new CustomEvent(STORAGE_ERROR, { detail: String((e as Error)?.name ?? e) })); } catch { /* */ } return false; }
};
/** 每个档案最多保留最近 ANSWER_CAP 条答题记录（防止无限增长） */
export const ANSWER_CAP = 5000;
export const recordAnswer = (r: AnswerRecord) => safeW(async () => { const d = await db(); await d.add('answers', r); });
/* ---- 月度汇总（技术QA P1-4 / R4 P2-5）：删除超过 180 天（或超过 ANSWER_CAP 条）的明细前，先按 档案×科目×月 汇总进 kv「rollup:<档案>」。
   汇总写入与明细删除在同一个事务里，不会重复计数也不会丢。每次启动检查一次（App 加载题库后）。 */
export type Rollup = Record<string, Record<string, { n: number; ok: number }>>;   // 月份 YYYY-MM → 科目 → 计数
export const RETAIN_DAYS = 180;
export const monthOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
/** 纯函数：选出要汇总的明细（超过 180 天，或按时间排序后超出上限的最旧部分） */
export function pickOld(recs: AnswerRecord[], now: number, cap = ANSWER_CAP): number[] {
  const order = recs.map((r, i) => i).sort((a, b) => recs[a].at - recs[b].at); const cut = now - RETAIN_DAYS * 864e5; const excess = recs.length - cap;
  return order.filter((i, k) => recs[i].at < cut || k < excess);
}
export function rollupAdd(r0: Rollup, recs: AnswerRecord[], subjectOf: (r: AnswerRecord) => string): Rollup {
  const r: Rollup = JSON.parse(JSON.stringify(r0 ?? {}));
  for (const a of recs) { const m = monthOf(a.at), s = a.subject ?? subjectOf(a); const e = ((r[m] ??= {})[s] ??= { n: 0, ok: 0 }); e.n++; if (a.correct) e.ok++; }
  return r;
}
export const rollupOf = (pid: string) => safe<Rollup>(async () => ((await (await db()).get('kv', 'rollup:' + pid)) as Rollup | undefined) ?? {}, {});
export const compactAnswers = (pid: string, subjectOf: (r: AnswerRecord) => string, now = Date.now()) => safe<number>(async () => {
  const d = await db(); const tx = d.transaction(['answers', 'kv'], 'readwrite'); const idx = tx.objectStore('answers').index('byProfile');
  const keys = await idx.getAllKeys(pid); const vals = await idx.getAll(pid);
  const pick = pickOld(vals, now); if (!pick.length) { await tx.done; return 0; }
  const prev = ((await tx.objectStore('kv').get('rollup:' + pid)) as Rollup | undefined) ?? {};
  await tx.objectStore('kv').put(rollupAdd(prev, pick.map(i => vals[i]), subjectOf), 'rollup:' + pid);
  for (const i of pick) await tx.objectStore('answers').delete(keys[i]);
  await tx.done; return pick.length;
}, 0);
/** 删档案：清理该档案的 kv 前缀、错题和答题记录（技术QA P1-2） */
export const deleteProfileData = (pid: string, kvKeys: string[]) => safeW(async () => {
  const d = await db(); const tx = d.transaction(['kv', 'wrong', 'answers'], 'readwrite');
  for (const k of kvKeys) await tx.objectStore('kv').delete(k);
  for (const s of ['wrong', 'answers'] as const) { const idx = tx.objectStore(s).index('byProfile'); for (const k of await idx.getAllKeys(pid)) await tx.objectStore(s).delete(k); }
  await tx.done;
});
export const getKV = <T>(k: string) => safe<T | undefined>(async () => (await db()).get('kv', k), undefined);
export const setKV = (k: string, v: unknown) => safeW(async () => { await (await db()).put('kv', v, k); });
export const answersOf = (pid: string) => safe<AnswerRecord[]>(async () => (await db()).getAllFromIndex('answers', 'byProfile', pid), []);
export const wrongOf = (pid: string) => safe<WrongEntry[]>(async () => (await db()).getAllFromIndex('wrong', 'byProfile', pid), []);
export const putWrong = (e: WrongEntry) => safeW(async () => { await (await db()).put('wrong', e); });
export const delWrong = (id: string) => safe(async () => { await (await db()).delete('wrong', id); }, undefined);
export const importedQuestions = () => safe<any[]>(async () => (await db()).getAll('bank'), []);
export const putImported = (qs: any[]) => safe(async () => {
  const tx = (await db()).transaction('bank', 'readwrite');
  for (const q of qs) await tx.store.put(q);
  await tx.done;
}, undefined);
export const clearImported = () => safe(async () => { await (await db()).clear('bank'); }, undefined);

/** 备份：导出全部数据为 JSON */
export async function exportAll() {
  const d = await db();
  const out: Record<string, unknown> = {};
  for (const s of STORES) {
    if (s === 'kv' || s === 'answers') {
      const keys = await d.getAllKeys(s); const vals = await d.getAll(s);
      out[s] = keys.map((k, i) => [k, vals[i]]);
    } else out[s] = await d.getAll(s);
  }
  return { app: 'zhishi-yongzhe', format: 1, exportedAt: new Date().toISOString(), stores: out };
}
/** 恢复前校验（技术QA P1-3）：格式、各表行结构；返回预览和清洗后的数据；不合格抛出中文错误 */
export function validateBackup(data: any): { clean: Record<string, unknown[]>; preview: { exportedAt?: string; profiles: number; kv: number; answers: number; wrong: number; bank: number; skipped: number } } {
  if (!data || typeof data !== 'object' || data.app !== 'zhishi-yongzhe' || !data.stores || typeof data.stores !== 'object') throw new Error('这个文件不是知识勇者的备份，或已损坏');
  if (data.format !== undefined && data.format !== 1) throw new Error(`备份格式版本 ${data.format} 不支持，请更新 App 后再恢复`);
  let skipped = 0; const clean: Record<string, unknown[]> = {};
  const arr = (x: unknown) => Array.isArray(x) ? x : [];
  clean.kv = arr(data.stores.kv).filter(r => { const ok = Array.isArray(r) && r.length === 2 && typeof r[0] === 'string'; if (!ok) skipped++; return ok; });
  clean.answers = arr(data.stores.answers).filter(r => { const v = Array.isArray(r) ? r[1] : null; const ok = !!v && typeof v.profileId === 'string' && typeof v.questionId === 'string'; if (!ok) skipped++; return ok; });
  clean.wrong = arr(data.stores.wrong).filter((v: any) => { const ok = v && typeof v.id === 'string' && typeof v.profileId === 'string' && typeof v.qkey === 'string'; if (!ok) skipped++; return ok; });
  clean.bank = arr(data.stores.bank).filter((v: any) => { const ok = v && typeof v.key === 'string' && typeof v.question === 'string'; if (!ok) skipped++; return ok; });
  const prof = (clean.kv as [string, unknown][]).find(r => r[0] === 'profiles')?.[1];
  if (prof !== undefined && !Array.isArray(prof)) throw new Error('备份里的孩子档案已损坏，不能恢复');
  return { clean, preview: { exportedAt: data.exportedAt, profiles: Array.isArray(prof) ? prof.length : 0, kv: clean.kv.length, answers: clean.answers.length, wrong: clean.wrong.length, bank: clean.bank.length, skipped } };
}
/** 恢复：先校验，再把当前数据快照存到 localStorage 外的 kv 快照里不现实（会被清空），因此返回当前快照供界面下载；整库在一个事务里写入 */
export async function importAll(data: any) {
  const { clean } = validateBackup(data);
  const snapshot = await exportAll();
  const d = await db();
  const tx = d.transaction([...STORES], 'readwrite');
  for (const s of STORES) {
    const st = tx.objectStore(s); await st.clear();
    const rows = clean[s] ?? [];
    if (s === 'kv') for (const [k, v] of rows as [string, unknown][]) await st.put(v, k);
    else if (s === 'answers') for (const [, v] of rows as [unknown, unknown][]) await st.add(v);
    else for (const v of rows) await st.put(v);
  }
  await tx.done;
  await setKV('snapshot:last', snapshot);   // 恢复后可「撤销恢复」（策划 T-P1-3）
  return snapshot;
}
