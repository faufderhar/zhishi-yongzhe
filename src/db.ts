/* IndexedDB：kv（设置/档案/进度/时长）、wrong（错题本）、answers（答题记录）、bank（家长导入的题，覆盖内置题） */
import { openDB, type IDBPDatabase } from 'idb';
import type { WrongEntry } from './game/wrongbook';
import { findVault, findRec, writeRec, writeLocal, writeCache, readLocal, normCode, type PinVault } from './game/pinVault';
import { backupVault, mergePin } from './game/backupPin';
import { sanitizeData } from './game/sanitize';
import { verifyPin, freshLocks, LOCK_KEYS_ALL } from './game/pin';
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
/** r10：读失败时抛错（区分「没读到」和「确实没有」） */
export const getKVStrict = async <T>(k: string): Promise<T | undefined> => (await db()).get('kv', k);
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
  const pin = await currentPin();   // r12：备份带上家长密码哈希和恢复码哈希
  const rec = pin.vault?.recHash ?? await findRec(undefined, [], getKV);   // r12 R11-3：恢复码独立副本也写进备份
  return { app: 'zhishi-yongzhe', format: 1, exportedAt: new Date().toISOString(), ...(pin.vault ? { pin: { ...pin.vault, ...(rec ? { recHash: rec } : {}) } } : {}), ...(rec ? { rec } : {}), stores: out };
}
/** 当前生效的家长密码（4 处副本任一）和等待中的重设 */
export async function currentPin() {
  const st = await getKV<any>('settings'); const ps = await getKV<any[]>('profiles');
  const vault: PinVault | null = await findVault(st && typeof st === 'object' ? st : undefined, Array.isArray(ps) ? ps : []);
  return { vault, pinReset: st?.pinReset, pinResetDoneAt: st?.pinResetDoneAt };
}
/** r15.4.3 较真家长 P1：设好新密码后马上自检——库里的设置、localStorage 副本、每个档案里的副本、锁屏实际会用的那份，都要能用刚输入的密码通过。
 *  写库是异步的，最多等约 1.5 秒；返回对不上的副本名（settings / local / profile / vault） */
export async function checkPinSaved(pin: string, tries = 10, gap = 150): Promise<{ ok: boolean; bad: string[] }> {
  let bad: string[] = [];
  for (let i = 0; i < tries; i++) {
    bad = [];
    if (__TEST_HOOKS__ && typeof window !== 'undefined' && (window as unknown as { __zyTestPinSaveFail?: boolean }).__zyTestPinSaveFail) bad.push('test');
    const st = await getKV<any>('settings'); const ps = (await getKV<any[]>('profiles')) ?? []; const loc = readLocal();
    if (!(await verifyPin(pin, st?.pinHash))) bad.push('settings');
    if (loc && !(await verifyPin(pin, loc.pinHash))) bad.push('local');
    for (const p of Array.isArray(ps) ? ps : []) if (p?.pinVault?.pinHash && !(await verifyPin(pin, p.pinVault.pinHash))) { bad.push('profile'); break; }
    const v = await findVault(st && typeof st === 'object' ? st : undefined, Array.isArray(ps) ? ps : []); if (!v || !(await verifyPin(pin, v.pinHash))) bad.push('vault');
    if (!bad.length) return { ok: true, bad };
    if (i < tries - 1) await new Promise(r => setTimeout(r, gap));
  }
  return { ok: false, bad };
}
export class NeedPinError extends Error { constructor(m = '要先输入当前的家长密码才能恢复') { super(m); } }
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
export class BackupSecretError extends Error { constructor() { super('备份时的家长密码 / 恢复码不对，没有恢复'); } }
/** r13 策划：忘了当前密码时，输入「备份时的家长密码」或「备份时的恢复码」也能恢复——恢复后密码变成备份里的密码（错 5 次共用一个 24 小时锁，由界面计） */
export async function backupSecretOk(data: any, secret: string): Promise<boolean> {
  const { clean } = validateBackup(data); const bv = backupVault(data, clean.kv as [string, unknown][]); if (!bv || !secret) return false;
  if (await verifyPin(secret, bv.pinHash)) return true;
  const c = normCode(secret); return !!bv.recHash && c.length === 8 && await verifyPin(c, bv.recHash);
}
/** r14：上一次恢复走的验证方式（结算提示只显示对应的一句） */
export let lastImportPath: 'backup' | 'current' = 'current';
export async function importAll(data: any, o: { pin?: string; trusted?: boolean; backupSecret?: string } = {}) {
  const { clean } = validateBackup(data);
  // r12：当前有密码 → 先验证；导入后保留当前密码；没有 → 用备份里的密码。等待中的 24 小时重设不被导入取消
  let cur = await currentPin();
  // r14 较真家长：在「当前密码」框里输了备份时的旧密码 / 恢复码——当前密码不对时再按备份里的密码 / 恢复码验证
  if (!o.backupSecret && o.pin && cur.vault && !o.trusted && !(await verifyPin(o.pin, cur.vault.pinHash)) && await backupSecretOk(data, o.pin)) o = { ...o, backupSecret: o.pin, pin: undefined };
  const viaBackup = !!o.backupSecret && !o.trusted; lastImportPath = viaBackup ? 'backup' : 'current';
  if (viaBackup) { if (!(await backupSecretOk(data, o.backupSecret!))) throw new BackupSecretError(); cur = { ...cur, vault: null, pinResetDoneAt: undefined }; }
  else if (cur.vault && !o.trusted && !(o.pin && await verifyPin(o.pin, cur.vault.pinHash))) throw new NeedPinError(o.pin ? '家长密码不对，没有恢复' : undefined);
  /* r15.1（总管确认 R10-2）：覆盖恢复 = 换成备份里的家长密码和恢复码（4 处副本都写备份的）；只保留本机今天已玩的时长和时钟基准。
     备份里没有密码时保留本机密码（避免恢复后没有密码）。撤销恢复（trusted 快照）照旧。 */
  const bv = backupVault(data, clean.kv as [string, unknown][]);
  if (!o.trusted && bv) cur = { ...cur, vault: null, pinReset: undefined, pinResetDoneAt: undefined };
  /* r15.3 技术QA R152-3：撤销恢复要连家长密码、恢复码（4 处副本）和等待中的重设一起回到恢复前（以前保留了恢复后的密码，和确认框说的不一样） */
  if (o.trusted && bv) { const st = (clean.kv as [string, any][]).find(r => r[0] === 'settings')?.[1]; cur = { vault: null, pinReset: st?.pinReset, pinResetDoneAt: undefined }; }
  const m = mergePin(clean.kv as [string, unknown][], cur, bv); clean.kv = m.kv;
  if (!o.trusted && bv) clean.kv = (clean.kv as [string, unknown][]).map(([k, v]): [string, unknown] => k === 'settings' && v && typeof v === 'object' ? [k, { ...(v as object), restoredFromAt: data.exportedAt ?? 'unknown', restoredSeen: undefined }] : [k, v]);
  // r14.1：覆盖恢复也保留本机「今天已玩」的时长（和合并一致），防止用旧备份把今天的用时清零
  if (!o.trusted) { const td = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    const curKv = new Map<string, unknown>(); { const d0 = await db(); const ks = await d0.getAllKeys('kv'); const vs = await d0.getAll('kv'); ks.forEach((k, i) => curKv.set(String(k), vs[i])); }
    const keys = new Set([...(clean.kv as [string, unknown][]).map(([k]) => k), ...curKv.keys()].filter(k => k.startsWith('usage:')));
    const kvm = new Map(clean.kv as [string, unknown][]);
    for (const k of keys) { const b = { ...((kvm.get(k) as Record<string, unknown>) ?? {}) }; const c = curKv.get(k) as Record<string, unknown> | undefined; if (c?.[td]) b[td] = c[td]; else delete b[td]; if (kvm.has(k) || c?.[td]) kvm.set(k, b); }
    // r14.1：时钟基准是设备状态，覆盖恢复也保留本机的（以前会写回备份里旧的 / 锁定的 clock）
    if (curKv.has('clock')) kvm.set('clock', curKv.get('clock')); else kvm.delete('clock');
    /* r15.4.3 较真家长 P2-1：「上次备份」是本机做过的事，覆盖恢复不能退回「从未备份」——取本机记录、备份里的记录、这份备份的导出时间里最新的一个 */
    { const ex = Date.parse(typeof data.exportedAt === 'string' ? data.exportedAt : ''); const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= Date.now() ? x : 0;
      const t = Math.max(num(curKv.get('lastBackupAt')), num(kvm.get('lastBackupAt')), num(ex)); if (t > 0) kvm.set('lastBackupAt', t); }
      /* r15.4.4 技术QA P4：「该备份啦」稍后提醒按恢复时刻重算，不沿用备份里的 snooze（否则刚恢复就被压 7 天） */
      kvm.delete('backupSnoozeUntil');
    clean.kv = [...kvm.entries()]; }
  /* r15.3 技术QA R152-4：写库前清洗数字（星星 / 经验 / 时长 / 次数 / 难度 / 时间戳）；不合格的项丢掉 */
  { const sd = sanitizeData(clean); clean.kv = sd.kv; clean.answers = sd.answers; clean.wrong = sd.wrong; }   // r15.4：和合并共用
  /* r15.4.3 技术QA P3-1：防误入的错误计数 / 锁（家长密码、找回问题、恢复码、取消申请框、导入）是本机状态，覆盖恢复一律清零，不从备份带入——
     家长刚用对的密码 / 备份密码授权了恢复，不能一恢复完就被锁 15 分钟、恢复码框锁 24 小时，也不能留着 fails 4。撤销恢复（trusted）照旧回到恢复前的快照 */
  const zeroLocks = !o.trusted ? freshLocks() : null;
  if (zeroLocks) clean.kv = [...(clean.kv as [string, unknown][]).filter(([k]) => !LOCK_KEYS_ALL.includes(k)), ...Object.entries(zeroLocks)];
  /* r15.4.4 技术QA P3：先竖旗再写库——密码页 1 秒计时器在写锁清零和竖旗之间会把旧锁盖回去（忘记密码页复现） */
  if (typeof window !== 'undefined') { const w = window as unknown as { __zyRestoring?: boolean }; w.__zyRestoring = true; setTimeout(() => { w.__zyRestoring = false; }, 15e3); }
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
  if (zeroLocks) for (const [k, v] of Object.entries(zeroLocks)) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } }
  writeLocal(m.vault); await writeCache(m.vault); if (m.vault?.recHash) await writeRec(m.vault.recHash, setKV);
  await setKV('snapshot:last', snapshot);   // 恢复后可「撤销恢复」（策划 T-P1-3）
  return snapshot;
}

/** r14 策划：合并导入（只在家长页、已验证当前家长密码后可选）。先自动快照，可一次「撤销」 */
import { mergeBackup, type MergeIn, type MergeSummary } from './game/merge';
async function readAllRaw(): Promise<MergeIn> { const d = await db(); const ak = await d.getAllKeys('answers'), av = await d.getAll('answers'); const kk = await d.getAllKeys('kv'), kvv = await d.getAll('kv');
  return { kv: kk.map((k, i) => [String(k), kvv[i]]), answers: ak.map((k, i) => [k, av[i]]) as MergeIn['answers'], wrong: await d.getAll('wrong'), bank: await d.getAll('bank') }; }
/** r15.4 技术QA P2-1：合并前先清洗备份，合并结果写库前再清洗一次（和覆盖恢复同一个 sanitizeData） */
const cleanIn = (x: MergeIn): MergeIn => sanitizeData(x) as unknown as MergeIn;
export async function mergePreview(data: any, today: string): Promise<MergeSummary> { const { clean } = validateBackup(data); return mergeBackup(await readAllRaw(), cleanIn(clean as unknown as MergeIn), today).summary; }
export async function mergeAll(data: any, o: { pin: string; today: string }) {
  const { clean } = validateBackup(data); const cur = await currentPin();
  if (!cur.vault || !(await verifyPin(o.pin, cur.vault.pinHash))) throw new NeedPinError('合并要先输入现在的家长密码');
  const snapshot = await exportAll();
  const { out: out0, summary } = mergeBackup(await readAllRaw(), cleanIn(clean as unknown as MergeIn), o.today); const out = cleanIn(out0);
  const d = await db(); const tx = d.transaction([...STORES], 'readwrite');
  for (const s of STORES) { const st = tx.objectStore(s); await st.clear();
    if (s === 'kv') for (const [k, v] of out.kv) await st.put(v, k);
    else if (s === 'answers') for (const [, v] of out.answers) await st.add(v);
    else for (const v of (s === 'wrong' ? out.wrong : out.bank)) await st.put(v); }
  await tx.done; await setKV('snapshot:last', snapshot);
  return { snapshot, summary };
}
