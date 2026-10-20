/* 题库：内置 public/banks/bank_<grade>.json（来自 /workspace/questions 的完整题库），再叠加家长导入（IndexedDB bank 表，相同 grade+id 覆盖） */
import { loadBank, normalize, validateQuestion, qRev, type Bank, type GradeKey, type Question } from './game/questions';
import { importedQuestions } from './db';
import { computeVisibility, isHiddenBy, type Visibility, type HideRow } from './game/visibility';
declare const __BANK_VER__: string;
/** 题库内容哈希（构建时算），用于缓存失效 */
export const BANK_VER = typeof __BANK_VER__ === 'string' ? __BANK_VER__ : 'dev';
declare const __BANK_RELEASE__: string;
/** 题库发布号（public/banks/release.json，如 v16） */
export const BANK_RELEASE = typeof __BANK_RELEASE__ === 'string' ? __BANK_RELEASE__ : 'dev';
export const BUILTIN_GRADES: GradeKey[] = ['K1', 'K2', '1', '2', '3', '4', '5', '6', '7', '8', '10', '11'];   // r16：+K2 / 8 / 11
export interface BankState { /** r16 第 10 步：藏起来的 年级 / 科目 / 册别（家长题库页列出来） */ hidden?: HideRow[]; byKey: Map<string, Question>; builtin: Record<string, Bank>; importedCount: number; importedInvalid: number; /** r16：和内置题同号、但内置题已更新（或没有 base_rev 的旧导入）→ 用内置新版，导入那份不用 */ importedSuperseded?: number; /** r16.1：是哪些题（年级 / id / 科目 / 题干开头） */ importedSupersededList?: SupRow[] }
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
      if (old) { const cur = qRev(old); if (qRev(q) === cur) { same++; continue; } if (raw.base_rev !== cur) { superseded++; supList.push({ grade: q.grade, id: q.id, subject: q.subject, stem: shortStem(q.question) }); continue; } }
      byKey.set(q.key, old ? { ...q, order: old.order } : q);
    } catch { bad++; }
  }
  return { bad, superseded, same, supList };
}
export async function loadAllBanks(onProgress?: (done: number, total: number) => void): Promise<BankState> {
  const builtin: Record<string, Bank> = {}; let done = 0;
  await Promise.all(BUILTIN_GRADES.map(async g => {
    const url = `${import.meta.env.BASE_URL}banks/bank_${g}.json?v=${BANK_VER}`;
    try { const raw = await (await fetch(url)).json(); builtin[g] = loadBank(raw, `bank_${g}.json`); }
    catch (e) { console.warn('题库加载失败', url, e); }
    onProgress?.(++done, BUILTIN_GRADES.length);
  }));
  const byKey = new Map<string, Question>();
  /* r16 第 10 步：可见性 = 不在 FORCE_HIDDEN 且 内置题过题量门槛（game/visibility.ts）；藏起来的不进地图 / 推荐 / 复习 / 册别选择 */
  const vis = computeVisibility(BUILTIN_GRADES.flatMap(g => builtin[g]?.all ?? []));
  for (const g of BUILTIN_GRADES) for (const q of builtin[g]?.all ?? []) if (!isHiddenBy(vis, q)) byKey.set(q.key, q);
  const imp = await importedQuestions();
  const { bad, superseded, supList } = mergeImported(byKey, imp, vis);
  return { byKey, builtin, importedCount: imp.length - bad, importedInvalid: bad, importedSuperseded: superseded, importedSupersededList: supList, hidden: vis.rows };
}
export const questionsOfGrade = (b: BankState, g: GradeKey) => [...b.byKey.values()].filter(q => q.grade === g);
