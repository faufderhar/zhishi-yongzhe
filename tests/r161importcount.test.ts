// r16.1 (m) 技术QA P3-2：导入预览 / 结果单独数「会被隐藏 N 题」（以前隐藏科目的题也算进「可玩 27、已导入 27」）
// r16.1 (n) P4：超过总量上限在预览就禁用「确认导入」并写原因；地图引导气泡不挡关卡卡片（pointer-events:none）
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { hiddenCount } from '../src/ui/Parent';
import { normalize } from '../src/game/questions';
import { computeVisibility } from '../src/game/visibility';
import { totalIssue, IMPORT_MAX_TOTAL } from '../src/game/importCheck';
const mk = (id: string, grade: number, subject: string, volume: string, status = '已通过') => normalize({ id, grade, subject, volume, unit: 'U', type: '选择', status, question: 'q', options: [{ text: 'a' }, { text: 'b' }], answer: 'A' });
it('会被隐藏：高二物理（强制隐藏）算进去；停用的不算；其他不算', () => {
  const vis = computeVisibility([]);
  const qs = [...Array.from({ length: 24 }, (_, i) => mk(`P11-${i}`, 11, '物理', '必修第三册')), mk('M11-x', 11, '数学', '选择性必修第一册'), mk('M11-y', 11, '数学', '选择性必修第一册'), mk('M11-z', 11, '数学', '选择性必修第一册'), mk('P11-off', 11, '物理', '必修第三册', '停用')];
  expect(hiddenCount({ vis }, qs)).toBe(24); expect(hiddenCount({}, qs)).toBe(0);
});
it('超总量：totalIssue 有原因；预览就禁用确认按钮并显示原因', () => {
  expect(totalIssue(IMPORT_MAX_TOTAL - 10, 11)).toMatch(/超过上限/); expect(totalIssue(0, 10)).toBeNull();
  const s = readFileSync('src/ui/Parent.tsx', 'utf8');
  expect(s).toMatch(/over: totalIssue\(bank\.importedCount, cls\.isNew\)/);
  expect(s).toMatch(/data-testid="import-confirm" disabled=\{!pv\.bank\.all\.length \|\| !!pv\.over\}/); expect(s).toMatch(/data-testid="pv-over"/);
  expect(s).toMatch(/data-testid="pv-hidden"/); expect(s).toMatch(/会被隐藏、先玩不到/);
});
it('地图引导气泡 pointer-events:none', () => { expect(readFileSync('src/app.css', 'utf8')).toMatch(/\.map-tip\{pointer-events:none/); });
