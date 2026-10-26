/* 题库：内置 public/banks/bank_<grade>.json（来自 /workspace/questions 的完整题库），再叠加家长导入（IndexedDB bank 表，相同 grade+id 覆盖） */
import { loadBank, normalize, validateQuestion, qRev, sameAsBuiltin, type Bank, type GradeKey, type Question } from './game/questions';
import { importedQuestions } from './db';
import { logErr } from './navLog';
import { computeVisibility, isHiddenBy, type Visibility, type HideRow } from './game/visibility';
declare const __BANK_VER__: string;
/** 题库内容哈希（构建时算），用于缓存失效 */
export const BANK_VER = typeof __BANK_VER__ === 'string' ? __BANK_VER__ : 'dev';
declare const __BANK_RELEASE__: string;
/** 题库发布号（public/banks/release.json，如 v16） */
export const BANK_RELEASE = typeof __BANK_RELEASE__ === 'string' ? __BANK_RELEASE__ : 'dev';
export const BUILTIN_GRADES: GradeKey[] = ['K1', 'K2', 'K3', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];   // r16：+K2 / 8 / 11；r17.1：+K3 / 9 / 12
export interface BankState { /** r16.1 (m)：可见性（导入预览算「会被隐藏 N 题」） */ vis?: Visibility; /** r16 第 10 步：藏起来的 年级 / 科目 / 册别（家长题库页列出来） */ hidden?: HideRow[]; byKey: Map<string, Question>; builtin: Record<string, Bank>; importedCount: number; importedInvalid: number; /** r16：和内置题同号、但内置题已更新（或没有 base_rev 的旧导入）→ 用内置新版，导入那份不用 */ importedSuperseded?: number; /** r16.1：是哪些题（年级 / id / 科目 / 题干开头） */ importedSupersededList?: SupRow[] }
/** r16：家长导入题叠加到内置题上。规则（总是按 id 读当前题库）：
    - 和内置题同号、内容一样 → 不算覆盖（以后题库升级照样生效）；
    - 同号、内容不同，且导入时记下的 base_rev = 现在内置题的版本 → 用导入的（家长改过的题）；
    - 同号、内容不同，但内置题在导入之后更新过（base_rev ≠ 现在），或旧导入没有 base_rev → 用内置新版（superseded）；
    - 内置没有的号 → 新题，照常加入。非法题跳过（技术QA P2-6）。 */
/** r16.1（总管）：「内置题已更新」要列出是哪些题 */
export interface SupRow { grade: string; id: string; subject: string; stem: string }
export const shortStem = (s: string, n = 24) => { const t = s.replace(/\$[^$]*\$/g, '…').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
const NO_VIS: Visibility = { hiddenVol: new Set(), hiddenSubj: new Set(), rows: [] };
export function mergeImported(byKey: Map<string, Question>, imp: any[], vis: Visibility = NO_VIS) {
  let i = 0, bad = 0, superseded = 0, same = 0; const supList: SupRow[] = [];
  for (const raw of imp) {
    try {
      if (validateQuestion(raw, raw?.grade).length) { bad++; continue; }
      const q = normalize(raw, 100000 + i++); if (isHiddenBy(vis, q)) continue;
      const old = byKey.get(q.key);
      if (old) { const cur = qRev(old); if (sameAsBuiltin(old, q, raw)) { same++; continue; } if (raw.base_rev !== cur) { superseded++; supList.push({ grade: q.grade, id: q.id, subject: q.subject, stem: shortStem(q.question) }); continue; } }
      byKey.set(q.key, old ? { ...q, order: old.order } : q);
    } catch { bad++; }
  }
  return { bad, superseded, same, supList };
}
/** r17.2.1 热修（学霸 r17.2：旧档点更新条后初三仍只 5 科）：
    ① 以前 SW 预缓存忽略 ?v=，老 SW / 预缓存会把旧题库当成新题库返回 → vite.config 已去掉 /^v$/，?v=新哈希 不再命中旧预缓存；
       但这样断网时 ?v= 也不命中预缓存——网络失败就退回不带参数的地址（预缓存里那份，离线照常能玩）；
    ② 兜底：全部读完后比对每册 version 和本构建的题库发布号（BANK_RELEASE），不一致 = 拿到的是旧缓存 →
       cache:'no-store' + 唯一参数 r= 重拉这几册（老 SW 只忽略 v / utm_，带 r= 的请求一定走网络），记 bank-stale 日志。 */
export interface BankFetchResult { builtin: Record<string, Bank>; stale: string[]; refetched: string[]; offline: string[] }
export async function fetchBuiltinBanks(o: { base: string; ver: string; release: string; grades?: GradeKey[]; fetchFn?: typeof fetch; onProgress?: (done: number, total: number) => void; now?: () => number; /** 有 SW 接管时：网络超过这么多毫秒就用预缓存（0 = 不限） */ timeoutMs?: number; log?: (kind: string, msg: string) => void }): Promise<BankFetchResult> {
  const grades = o.grades ?? BUILTIN_GRADES, f = o.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a)), log = o.log ?? (() => {});
  const builtin: Record<string, Bank> = {}, raws: Record<string, any> = {}, offline: string[] = []; let done = 0;
  /* 网络很慢时别一直卡在「正在加载题库」：有 SW 接管时（timeoutMs>0）超时就退回预缓存那份 */
  const get = async (url: string, init?: RequestInit, ms = 0) => {
    const ac = ms > 0 && typeof AbortController !== 'undefined' ? new AbortController() : undefined; let t: ReturnType<typeof setTimeout> | undefined;
    const job = (async () => { const r = await f(url, ac ? { ...init, signal: ac.signal } : init); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })();
    if (!ms) return job;
    try { return await Promise.race([job, new Promise((_, rej) => { t = setTimeout(() => { ac?.abort(); rej(new Error('timeout')); }, ms); })]); } finally { clearTimeout(t); }
  };
  await Promise.all(grades.map(async g => {
    const plain = `${o.base}banks/bank_${g}.json`, url = `${plain}?v=${o.ver}`;
    try { raws[g] = await get(url, undefined, o.timeoutMs); }
    catch (e) {
      try { raws[g] = await get(plain); offline.push(g); }   // 断网：用预缓存里的那份
      catch { console.warn('题库加载失败', url, e); }
    }
    o.onProgress?.(++done, grades.length);
  }));
  const verOf = (raw: any) => raw && !Array.isArray(raw) && raw.version != null ? String(raw.version) : undefined;
  const stale = o.release === 'dev' ? [] : grades.filter(g => { const v = verOf(raws[g]); return v !== undefined && v !== o.release; });
  const refetched: string[] = [];
  if (stale.length) {
    log('bank-stale', `题库缓存旧了：${stale.map(g => `${g}=${verOf(raws[g])}`).join(',')}，应为 ${o.release}；no-store 重拉`);
    console.warn('[zy] bank-stale', stale, o.release);
    const t = (o.now ?? Date.now)();
    await Promise.all(stale.map(async g => {
      try { const raw = await get(`${o.base}banks/bank_${g}.json?v=${o.ver}&r=${t}`, { cache: 'no-store' }, o.timeoutMs ? o.timeoutMs + 4000 : 0); if (verOf(raw) === o.release) { raws[g] = raw; refetched.push(g); } else log('bank-stale', `bank_${g} 重拉后仍是 ${verOf(raw)}`); }
      catch (e) { log('bank-stale', `bank_${g} 重拉失败（可能断网），先用旧的：${(e as Error)?.message ?? e}`); }
    }));
  }
  for (const g of grades) if (raws[g] !== undefined) { try { builtin[g] = loadBank(raws[g], `bank_${g}.json`); } catch (e) { console.warn('题库解析失败', g, e); } }
  return { builtin, stale, refetched: refetched.sort(), offline };
}
export async function loadAllBanks(onProgress?: (done: number, total: number) => void): Promise<BankState> {
  const { builtin } = await fetchBuiltinBanks({ base: import.meta.env.BASE_URL, ver: BANK_VER, release: BANK_RELEASE, onProgress, log: logErr, timeoutMs: typeof navigator !== 'undefined' && navigator.serviceWorker?.controller ? 8000 : 0 });
  const byKey = new Map<string, Question>();
  /* r16 第 10 步：可见性 = 不在 FORCE_HIDDEN 且 内置题过题量门槛（game/visibility.ts）；藏起来的不进地图 / 推荐 / 复习 / 册别选择 */
  const vis = computeVisibility(BUILTIN_GRADES.flatMap(g => builtin[g]?.all ?? []));
  for (const g of BUILTIN_GRADES) for (const q of builtin[g]?.all ?? []) if (!isHiddenBy(vis, q)) byKey.set(q.key, q);
  const imp = await importedQuestions();
  const { bad, superseded, supList } = mergeImported(byKey, imp, vis);
  return { byKey, builtin, importedCount: imp.length - bad, importedInvalid: bad, importedSuperseded: superseded, importedSupersededList: supList, hidden: vis.rows, vis };
}
export const questionsOfGrade = (b: BankState, g: GradeKey) => [...b.byKey.values()].filter(q => q.grade === g);
