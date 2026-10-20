// r16 第 10 步：科目 / 册别可见性 = 不在 FORCE_HIDDEN 且 通过题量门槛（每个小节 ≥ MIN_SECTION_QS 道可玩题）
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { loadBank, normalize, type Question, type GradeKey } from '../src/game/questions';
import { autoHidden, computeVisibility, isHiddenBy, MIN_SECTION_QS, FORCE_HIDDEN, AUTO_EXEMPT_GRADES } from '../src/game/visibility';
import { BUILTIN_GRADES } from '../src/bankStore';

const mk = (grade: string, subject: string, volume: string, unit: string, n: number, status = '已通过') =>
  Array.from({ length: n }, (_, i) => normalize({ id: `${subject}-${volume}-${unit}-${i}`, grade, subject, volume, unit, type: '判断', question: 'q' + i, answer: '对', status }, i, grade as GradeKey));
const bank = (g: string) => loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`).all;
const LIVE_R1544 = ['K1', '1', '2', '3', '4', '5', '6', '7', '10'];   // r15.4.4 已上线的年级

describe('题量门槛', () => {
  it('小节 9 题 → 整个科目 + 册别藏；10 题 → 不藏；只算可玩题', () => {
    expect(MIN_SECTION_QS).toBe(10);
    expect(autoHidden([...mk('7', '数学', '上册', 'A', 30), ...mk('7', '数学', '上册', 'B', 9)]).map(r => [r.subject, r.volume, r.unit, r.n])).toEqual([['数学', '上册', 'B', 9]]);
    expect(autoHidden([...mk('7', '数学', '上册', 'A', 10), ...mk('7', '数学', '上册', 'B', 10)])).toEqual([]);
    expect(autoHidden([...mk('7', '数学', '上册', 'A', 9), ...mk('7', '数学', '上册', 'A', 5, '待审核')]).length).toBe(1);   // 待审核不算
  });
  it('一个册别藏了，同科目别的册别照常；全部册别都藏了 → 整个科目藏', () => {
    const v = computeVisibility([...mk('7', '数学', '上册', 'A', 3), ...mk('7', '数学', '下册', 'A', 12), ...mk('7', '英语', '上册', 'A', 2)]);
    const q = (s: string, vol: string) => ({ grade: '7' as GradeKey, subject: s, volume: vol });
    expect(isHiddenBy(v, q('数学', '上册'))).toBe(true); expect(isHiddenBy(v, q('数学', '下册'))).toBe(false);
    expect(v.hiddenSubj.has('7|英语')).toBe(true); expect(v.hiddenSubj.has('7|数学')).toBe(false);
  });
  it('强制隐藏（总管）独立于门槛：题量够也藏；可以只藏一个册别', () => {
    const v = computeVisibility([...mk('8', '生物', '八年级上册', 'A', 40), ...mk('8', '数学', '八年级上册', 'A', 40)]);
    expect(isHiddenBy(v, { grade: '8', subject: '生物', volume: '八年级上册' })).toBe(true); expect(v.rows.find(r => r.subject === '生物')?.why).toBe('force');
    expect(isHiddenBy(v, { grade: '8', subject: '数学', volume: '八年级上册' })).toBe(false);
    expect(FORCE_HIDDEN).toEqual({ '8': ['生物', '地理'], '11': ['物理'] });   // 总管 r16：先不开；以后取消 = 删这一行
  });
  it('幼儿园不用门槛', () => { expect(AUTO_EXEMPT_GRADES.has('K2')).toBe(true); expect(autoHidden(mk('K2', '数数', '中班', 'A', 3))).toEqual([]); });
});

describe('内置题库（v46）', () => {
  const all = BUILTIN_GRADES.flatMap(bank); const vis = computeVisibility(all);
  it('r15.4.4 已上线的年级：自动规则一条都不藏（不回退）', () => {
    expect(vis.rows.filter(r => r.why === 'auto' && LIVE_R1544.includes(r.grade))).toEqual([]);
  });
  it('r16 新开年级里自动规则藏的：v46 没有（v45 时藏高二地理选必二——第二章第三节只有 4 题；v46 补进 D11-241～252）', () => {
    expect(vis.rows.filter(r => r.why === 'auto').map(r => `${r.grade}|${r.subject}|${r.volume}`)).toEqual([]);
  });
  it('报告（R16_VIS_REPORT=1 时写 /workspace/playtest/r16dev/visibility_v46.md；含没开的 K3 / 9 / 12 供参考）', () => {
    if (!process.env.R16_VIS_REPORT) return;
    const src = '/workspace/questions'; const NAME: Record<string, string> = { K3: '幼儿园大班', '9': '初三', '12': '高三' };
    const extra: Question[] = []; for (const g of ['K3', '9', '12']) { const f = `${src}/题库_游戏可用_${NAME[g]}.json`; if (existsSync(f)) extra.push(...loadBank(JSON.parse(readFileSync(f, 'utf8')), `bank_${g}.json`).all); }
    const v2 = computeVisibility([...all, ...extra]); const k3 = autoHidden(extra.filter(q => q.grade === 'K3').map(q => ({ ...q, grade: 'K9' as GradeKey })));   // K3 不豁免时会藏什么
    const L = ['| 年级 | 科目 | 册别 | 原因 | 最小小节（题数） | r15.4.4 已上线？ |', '|---|---|---|---|---|---|',
      ...v2.rows.map(r => `| ${r.grade} | ${r.subject} | ${r.volume} | ${r.why === 'force' ? '总管强制' : '题量不足'} | ${r.unit ? `${r.unit}（${r.n}）` : r.n != null ? `（${r.n}）` : '—'} | ${LIVE_R1544.includes(r.grade) ? '**是 → 回退**' : '否'} |`),
      '', `整科藏：${[...v2.hiddenSubj].join('、') || '无'}`, `K3 如果不豁免会藏：${k3.map(r => `${r.subject}|${r.volume}（${r.unit} ${r.n}）`).join('；') || '无'}`];
    writeFileSync('/workspace/playtest/r16dev/visibility_v46.md', L.join('\n') + '\n');
  });
});
