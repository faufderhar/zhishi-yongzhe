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
export const recordAnswer = (r: AnswerRecord) => safe(async () => { await (await db()).add('answers', r); }, undefined);
export const getKV = <T>(k: string) => safe<T | undefined>(async () => (await db()).get('kv', k), undefined);
export const setKV = (k: string, v: unknown) => safe(async () => { await (await db()).put('kv', v, k); }, undefined);
export const answersOf = (pid: string) => safe<AnswerRecord[]>(async () => (await db()).getAllFromIndex('answers', 'byProfile', pid), []);
export const wrongOf = (pid: string) => safe<WrongEntry[]>(async () => (await db()).getAllFromIndex('wrong', 'byProfile', pid), []);
export const putWrong = (e: WrongEntry) => safe(async () => { await (await db()).put('wrong', e); }, undefined);
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
/** 恢复：清空后写入（会覆盖当前平板上的全部数据） */
export async function importAll(data: any) {
  if (data?.app !== 'zhishi-yongzhe' || !data.stores) throw new Error('不是《知识勇者》的备份文件');
  const d = await db();
  const tx = d.transaction([...STORES], 'readwrite');
  for (const s of STORES) {
    const st = tx.objectStore(s); await st.clear();
    const rows = data.stores[s] ?? [];
    if (s === 'kv') for (const [k, v] of rows) await st.put(v, k);
    else if (s === 'answers') for (const [, v] of rows) await st.add(v);
    else for (const v of rows) await st.put(v);
  }
  await tx.done;
}
