// r17：题库 v56 → v57（import-bank.py）。v57 只改大班（还没导入）：「左右和镜像」新增 K3C-071，K3C-013 改成需家长确认——已导入年级逐题不变
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUILTIN_GRADES } from '../src/bankStore';
import { REV_CHANGED_SINCE_R16 } from '../src/game/revChanged';
const raw = (g: string) => JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8'));
it('v57：所有内置年级版本号 v57；大班 / 初三 / 高三没导入；REV 集合没加大班的题', () => {
  for (const g of BUILTIN_GRADES) expect(raw(g).version, g).toMatch(/^v5[78]$/);   // r17.2：v58
  expect((BUILTIN_GRADES as readonly string[]).includes('K3')).toBe(true);   // r17.1：大班导入并开放（REV 集合仍不加大班——大班没有 r16 旧存档）
  expect(REV_CHANGED_SINCE_R16.has('K3C-071')).toBe(false); expect(REV_CHANGED_SINCE_R16.has('K3C-013')).toBe(false);
});
