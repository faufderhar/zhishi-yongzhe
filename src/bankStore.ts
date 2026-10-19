/* 题库：内置 public/banks/bank_<grade>.json（来自 /workspace/questions 的完整题库），再叠加家长导入（IndexedDB bank 表，相同 grade+id 覆盖） */
import { loadBank, normalize, validateQuestion, type Bank, type GradeKey, type Question } from './game/questions';
import { importedQuestions } from './db';
import { isHiddenSubject } from './game/grades';
declare const __BANK_VER__: string;
/** 题库内容哈希（构建时算），用于缓存失效 */
export const BANK_VER = typeof __BANK_VER__ === 'string' ? __BANK_VER__ : 'dev';
declare const __BANK_RELEASE__: string;
/** 题库发布号（public/banks/release.json，如 v16） */
export const BANK_RELEASE = typeof __BANK_RELEASE__ === 'string' ? __BANK_RELEASE__ : 'dev';
export const BUILTIN_GRADES: GradeKey[] = ['K1', 'K2', '1', '2', '3', '4', '5', '6', '7', '8', '10', '11'];   // r16：+K2 / 8 / 11
export interface BankState { byKey: Map<string, Question>; builtin: Record<string, Bank>; importedCount: number; importedInvalid: number }
export async function loadAllBanks(onProgress?: (done: number, total: number) => void): Promise<BankState> {
  const builtin: Record<string, Bank> = {}; let done = 0;
  await Promise.all(BUILTIN_GRADES.map(async g => {
    const url = `${import.meta.env.BASE_URL}banks/bank_${g}.json?v=${BANK_VER}`;
    try { const raw = await (await fetch(url)).json(); builtin[g] = loadBank(raw, `bank_${g}.json`); }
    catch (e) { console.warn('题库加载失败', url, e); }
    onProgress?.(++done, BUILTIN_GRADES.length);
  }));
  const byKey = new Map<string, Question>();
  for (const g of BUILTIN_GRADES) for (const q of builtin[g]?.all ?? []) if (!isHiddenSubject(q)) byKey.set(q.key, q);
  const imp = await importedQuestions();
  let i = 0, bad = 0;
  // 加载导入题时也重新校验（技术QA P2-6）：非法题跳过，家长页提示
  for (const raw of imp) { try { if (validateQuestion(raw, raw?.grade).length) { bad++; continue; } const q = normalize(raw, 100000 + i++); if (isHiddenSubject(q)) continue; const old = byKey.get(q.key); byKey.set(q.key, old ? { ...q, order: old.order } : q); } catch { bad++; } }
  return { byKey, builtin, importedCount: imp.length - bad, importedInvalid: bad };
}
export const questionsOfGrade = (b: BankState, g: GradeKey) => [...b.byKey.values()].filter(q => q.grade === g);
