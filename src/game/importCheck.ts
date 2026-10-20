/* r16 技术QA_r1544 [P3]/[P4]：导入题库前的检查。
   - 大小 / 题数上限：21 MB / 6 万题的文件以前直接解析，界面卡 ~13 秒（之后一年级第 1 关 39 秒）。上限按内置最大的年级（初二 3 MB / 3006 题）留出余量。
   - 编码：GBK 的 CSV 按 UTF-8 读出来是一堆 U+FFFD，以前每行都报「status 非法」；现在整份文件只给一条「请另存为 UTF-8」。 */
export const IMPORT_MAX_BYTES = 8 * 1024 * 1024;
export const IMPORT_MAX_QUESTIONS = 6000;
/** 导入题总数上限（多次导入累计；内置 16370 题，导入的另算） */
export const IMPORT_MAX_TOTAL = 20000;
export function totalIssue(have: number, add: number): string | null {
  return have + add > IMPORT_MAX_TOTAL ? `已导入 ${have} 题，再加 ${add} 题会超过上限 ${IMPORT_MAX_TOTAL} 题（题太多会让进关变慢）。请先「清除已导入」或少导入一些。` : null;
}
export const STEM_MAX = 600;     // 内置题干最长 360 字（E8-015）
export const OPTION_MAX = 200;   // 内置选项最长 99 字
const mb = (n: number) => (n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0);

/** 读文件之前：只看大小 */
export function sizeIssue(size: number): string | null {
  return size > IMPORT_MAX_BYTES ? `文件太大（${mb(size)} MB），一次最多导入 ${mb(IMPORT_MAX_BYTES)} MB / ${IMPORT_MAX_QUESTIONS} 题。请按年级或科目拆成几个文件分别导入。` : null;
}
/** 读成文字之后：不是 UTF-8（解码出替换字符 U+FFFD）→ 整份只报一条 */
export function encodingIssue(text: string, name = ''): string | null {
  if (!text.includes('\uFFFD')) return null;
  const n = text.split('\uFFFD').length - 1;
  return /\.csv$/i.test(name)
    ? `这个 CSV 不是 UTF-8 编码（有 ${n} 处乱码，常见于 Excel 直接保存的 GBK 文件）。请在 Excel 里「另存为 → CSV UTF-8（逗号分隔）」后重新导入。`
    : `这个文件不是 UTF-8 编码（有 ${n} 处乱码）。请用 UTF-8 重新保存后再导入。`;
}
/** 解析之后：题数 */
export function countIssue(n: number): string | null {
  return n > IMPORT_MAX_QUESTIONS ? `文件里有 ${n} 题，一次最多导入 ${IMPORT_MAX_QUESTIONS} 题。请按年级或科目拆成几个文件分别导入。` : null;
}
/** 让出主线程一帧（进度提示能先画出来） */
export const yieldFrame = () => new Promise<void>(r => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => setTimeout(r, 0)) : setTimeout(r, 0)));
