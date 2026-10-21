// r16.2 技术QA B4–B8：导入题库的每条路径都有一句话（e2e：scripts/r162-importmsg.mjs）
import 'fake-indexeddb/auto';
import { it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { questionList, importFailMsg, IMPORT_CANCELLED, IMPORT_SAVE_FAILED } from '../src/ui/Parent';
import { putImported, importedQuestions, clearImported } from '../src/db';
const src = readFileSync('src/ui/Parent.tsx', 'utf8');
const tab = src.slice(src.indexOf('function BankTab'), src.indexOf('function TimeTab'));
const P0 = IDBObjectStore.prototype.put;
afterEach(() => { IDBObjectStore.prototype.put = P0; });
it('B5：写库成功 → true（事务完成之后），题目真的在', async () => {
  await clearImported(); expect(await putImported([{ key: '10:X-1', id: 'X-1' }])).toBe(true);
  expect((await importedQuestions()).map(q => q.key)).toEqual(['10:X-1']);
});
it('B5：写库失败（模拟 QuotaExceededError）→ false，没有存下；界面说「保存失败」不说「已导入」', async () => {
  await clearImported(); (globalThis as any).window ??= globalThis; (globalThis as any).CustomEvent ??= class { constructor(public type: string, public o?: unknown) {} }; (globalThis as any).dispatchEvent ??= () => true;
  IDBObjectStore.prototype.put = function () { throw new DOMException('quota', 'QuotaExceededError'); } as never;
  expect(await putImported([{ key: '10:X-2', id: 'X-2' }])).toBe(false);
  IDBObjectStore.prototype.put = P0; expect(await importedQuestions()).toEqual([]);
  expect(tab).toMatch(/if \(!\(await putImported\(good\)\)\) \{ setPv\(null\); setMsg\(IMPORT_SAVE_FAILED\); return; \}/);
  expect(tab.indexOf('putImported(good)')).toBeLessThan(tab.indexOf('setMsg(importResultMsg('));
  expect(IMPORT_SAVE_FAILED).toMatch(/^保存失败/); expect(IMPORT_SAVE_FAILED).toMatch(/没有导入任何题/);
});
it('B6：questions 不是数组 / 不是对象 / 0 题 → 同一句「导入失败：…没有导入任何题」', () => {
  expect(questionList([{ a: 1 }])).toEqual({ list: [{ a: 1 }] }); expect(questionList({ questions: [] })).toEqual({ list: [] });
  for (const r of [{ questions: { a: 1 } }, { questions: 'x' }, null, 123, 'abc', { foo: [] }]) expect('error' in questionList(r), JSON.stringify(r)).toBe(true);
  expect(importFailMsg('文件里没有题目')).toBe('导入失败：文件里没有题目。没有导入任何题。');
});
it('B6：读文件 / 解析 / 检查抛错都接住，用同一个 importFailMsg', () => {
  expect(tab).toMatch(/try \{ text = await f\.text\(\); \} catch \(e\) \{ setMsg\(importFailMsg\(`文件读不出来/);
  expect(tab).toMatch(/catch \(e\) \{ setMsg\(importFailMsg\(`文件解析失败/);
  expect(tab).toMatch(/if \('error' in ql\) \{ setMsg\(importFailMsg\(ql\.error\)\); return; \}/);
  expect(tab).toMatch(/if \(!list\.length\) \{ setMsg\(importFailMsg\('文件里没有题目'\)\); return; \}/);
  expect(tab).toMatch(/\} catch \(e\) \{ setPv\(null\); setMsg\(importFailMsg\(`检查题目时出错/);
  expect(tab).not.toMatch(/raw\?\.questions \?\? \[\]/);
});
it('B4：预览弹窗不传 onClose（点外面不关）；「取消」写「未导入」', () => {
  expect(tab).toMatch(/\{pv && <Modal>/); expect(tab).not.toMatch(/<Modal onClose=\{\(\) => setPv\(null\)\}>/);
  expect(tab).toMatch(/data-testid="import-cancel" onClick=\{\(\) => \{ setPv\(null\); setMsg\(IMPORT_CANCELLED\); \}\}/);
  expect(IMPORT_CANCELLED).toMatch(/^未导入/);
  expect((tab.match(/setPv\(null\)/g) ?? []).length).toBeGreaterThan(0);
});
it('B7：「内置题已更新」说重新导入导出的题目文件（恢复备份不行）', () => {
  expect(src).toMatch(/data-testid="sup-reimport">如果这些题是你改过的：用上面的「导入题库」重新导入你导出的题目文件/); expect(src).not.toMatch(/从你的备份/);
});
it('B8：点「导入题库」先清掉旧提示；结果提示出现时滚进视野', () => {
  expect(tab).toMatch(/data-testid="import-pick"[^>]*onClick=\{\(\) => \{ setMsg\(undefined\); fileRef\.current\?\.click\(\); \}\}/);
  expect(tab).toMatch(/useEffect\(\(\) => \{ if \(!msg\) return; const id = requestAnimationFrame\(\(\) => msgRef\.current\?\.scrollIntoView\?\.\(\{ block: 'nearest' \}\)\)/);
  // r17：重排（reloadBank / 关预览 / busy 收起）之后再滚一次
  expect(tab).toMatch(/cancelAnimationFrame\(id\); \}, \[msg, busy, pv, bank\]\)/);
});
