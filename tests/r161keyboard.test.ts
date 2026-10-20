/* r16.1 [HIGH] 填空键盘：数字键盘只给纯数答案；每道填空在分配到的键盘上都能打出至少一个可接受答案（构建检查：内置题库全部年级）。
   R16_KB_AUDIT=1 时另写 /workspace/playtest/r16dev/填空键盘审计.md（含开发机上没开放的大班 / 初三 / 高三） */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { loadBank, judge, type Question } from '../src/game/questions';
import { fillKind, kindProblems, isPureNumber, sciOf, type FillKind } from '../src/game/inputKind';
import { boxPath } from './boxSrc';
const grades = readdirSync('public/banks').map(f => f.match(/^bank_(\w+)\.json$/)?.[1]).filter(Boolean) as string[];
const fills = (all: Question[]) => all.filter(q => q.type === '填空');
const builtIn = grades.flatMap(g => fills(loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`).all));
/** r16 及以前的规则（审计对照） */
const oldKind = (q: Question): FillKind => (q.subject === '英语' || q.answer.some(a => /[a-df-z]/i.test(a)) ? 'letters' : 'num');

describe('规则', () => {
  it('纯数', () => {
    for (const a of ['3', '-2', '0.5', '.5', '3/4', '-3/4', '1又1/2', '1 1/2', '50%', '6.02e23', '3×10^8', '+5', '１２']) expect(isPureNumber(a), a).toBe(true);
    for (const a of ['千金散尽还复来', 'H2O', 'x=2', '3cm', 'apple', '二', '']) expect(isPureNumber(a), a).toBe(false);
  });
  it('键盘选择', () => {
    expect(fillKind({ subject: '诗词', answer: ['千金散尽还复来'] })).toBe('ime');
    expect(fillKind({ subject: '数学', answer: ['12'] })).toBe('num');
    expect(fillKind({ subject: '数学', answer: ['3', '三'] })).toBe('ime');   // 任何一个答案不是纯数 → 输入法
    expect(fillKind({ subject: '英语', answer: ['apple'] })).toBe('letters');
    expect(fillKind({ subject: '英语', answer: ['5'] })).toBe('num');
    expect(fillKind({ subject: '化学', answer: ['H2O'] })).toBe('ime');
    expect(fillKind({ subject: '物理', answer: ['3×10^8'] }, true)).toBe('num');
    expect(fillKind({ subject: '物理', answer: ['3×10^8'] }, false)).toBe('ime');   // 初中数字键盘没有 ×10ⁿ
    expect(fillKind({ subject: '数学', answer: ['50%'] })).toBe('ime');
  });
  it('判分：全角 / 半角、空白、句末标点归一', () => {
    const q = { type: '填空', subject: '诗词', answer: ['千金散尽还复来'] } as unknown as Question;
    for (const v of ['千金散尽还复来', ' 千金散尽还复来 ', '千金 散尽 还复来', '千金散尽还复来。']) expect(judge(q, v), v).toBe('full');
    expect(judge(q, '千金散尽还复')).toBe('wrong');
    const e = { type: '填空', subject: '英语', answer: ['ice cream'] } as unknown as Question;
    for (const v of ['ice cream', 'ＩＣＥ　ＣＲＥＡＭ', 'Ice  Cream']) expect(judge(e, v), v).toBe('full');
    const n = { type: '填空', subject: '数学', answer: ['12'] } as unknown as Question; expect(judge(n, '１２')).toBe('full');
  });
});
it('构建检查：内置题库每道填空的键盘都打得出答案；数字键盘只给纯数答案', () => {
  const bad = builtIn.map(q => ({ q, p: kindProblems(q, fillKind(q, sciOf(q.grade)), sciOf(q.grade)) })).filter(x => x.p.length);
  expect(bad.map(x => `${x.q.grade} ${x.q.id} ${x.p.join('；')}`)).toEqual([]);
  expect(builtIn.length).toBeGreaterThan(100);
});
it('高二诗词「天生我材必有用」→ 系统输入法，汉字答案判对', () => {
  const q = builtIn.find(q => q.grade === '11' && q.subject === '诗词' && q.question.includes('天生我材必有用'))!;
  expect(q).toBeTruthy(); expect(fillKind(q, true)).toBe('ime'); expect(judge(q, q.answer[0])).toBe('full');
});
it('审计（R16_KB_AUDIT=1）', () => {
  if (!process.env.R16_KB_AUDIT) return;
  const NAME: Record<string, string> = { K3: '幼儿园大班', '9': '初三', '12': '高三' };
  const extra = Object.entries(NAME).flatMap(([g, n]) => { const f = boxPath(`questions/题库_游戏可用_${n}.json`); return existsSync(f) ? fills(loadBank(JSON.parse(readFileSync(f, 'utf8')), `bank_${g}.json`).all) : []; });
  const all = [...builtIn, ...extra]; const rows = all.map(q => { const sci = sciOf(q.grade); const o = oldKind(q), n = fillKind(q, sci); return { q, o, n, po: kindProblems(q, o, sci), pn: kindProblems(q, n, sci) }; });
  const K: Record<FillKind, string> = { num: '数字键盘', letters: '字母键盘', ime: '系统输入法' };
  const cnt = (f: (r: typeof rows[0]) => boolean) => rows.filter(f).length;
  const by = new Map<string, number>(); for (const r of rows) { const k = `${r.q.grade}|${r.q.subject}|${K[r.o]}→${K[r.n]}`; by.set(k, (by.get(k) ?? 0) + 1); }
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const L = ['# 填空键盘审计（题库 v46，r16.1）', '',
    `规则见 src/game/inputKind.ts。共 ${rows.length} 道填空（内置 ${builtIn.length}，另含开发机上未开放的大班 / 初三 / 高三 ${extra.length}）。`, '',
    `- 改了键盘的：**${cnt(r => r.o !== r.n)}** 道（其中 r16 打不出答案的：${cnt(r => r.po.length > 0)} 道；改后打不出：${cnt(r => r.pn.length > 0)} 道）`,
    `- 其中内置题库（线上 r16 的 12 个年级）：改键盘 ${rows.filter(r => r.o !== r.n && builtIn.includes(r.q)).length} 道，r16 打不出答案 ${rows.filter(r => r.po.length && builtIn.includes(r.q)).length} 道；r15.4.4 已上线年级（小班、1–7、高一）：${rows.filter(r => r.po.length && ['K1', '1', '2', '3', '4', '5', '6', '7', '10'].includes(r.q.grade)).length} 道`,
    `- 新规则分布：数字键盘 ${cnt(r => r.n === 'num')}，字母键盘 ${cnt(r => r.n === 'letters')}，系统输入法 ${cnt(r => r.n === 'ime')}`, '',
    '## 按年级 / 科目', '', '| 年级 | 科目 | r16 键盘 → r16.1 键盘 | 题数 |', '|---|---|---|---|',
    ...[...by].sort().map(([k, n]) => { const [g, s, t] = k.split('|'); return `| ${g} | ${s} | ${t} | ${n} |`; }), '',
    '## r16 不匹配（键盘打不出答案）→ r16.1 改法', '', '| 年级 | id | 科目 | 题干 | 答案 | r16 问题 | r16.1 |', '|---|---|---|---|---|---|---|',
    ...rows.filter(r => r.po.length).map(r => `| ${r.q.grade} | ${r.q.id} | ${r.q.subject} | ${esc(r.q.question.slice(0, 30))} | ${esc(r.q.answer.join(' / '))} | ${esc(r.po.join('；'))} | ${K[r.n]}${r.pn.length ? '（仍有问题：' + r.pn.join('；') + '）' : ''} |`), '',
    '## 换了键盘、但 r16 也能打出答案的', '', '| 年级 | id | 科目 | 答案 | r16 → r16.1 |', '|---|---|---|---|---|',
    ...rows.filter(r => r.o !== r.n && !r.po.length).map(r => `| ${r.q.grade} | ${r.q.id} | ${r.q.subject} | ${esc(r.q.answer.join(' / '))} | ${K[r.o]} → ${K[r.n]} |`), '',
    '## 全部填空（按键盘）', '', '| 年级 | id | 科目 | 答案 | 键盘 |', '|---|---|---|---|---|',
    ...rows.map(r => `| ${r.q.grade} | ${r.q.id} | ${r.q.subject} | ${esc(r.q.answer.join(' / '))} | ${K[r.n]} |`)];
  writeFileSync(boxPath('playtest/r16dev/填空键盘审计.md'), L.join('\n') + '\n');
});
it('界面：三处填空（关卡 / 回合战 / 错题复习）都按 fillKind 选键盘，系统输入法模式不拦物理键盘', () => {
  for (const f of ['src/ui/Battle.tsx', 'src/ui/RoundBattle.tsx', 'src/ui/Screens.tsx']) { const s = readFileSync(f, 'utf8'); expect(s, f).toMatch(/fillKind\(/); expect(s, f).toMatch(/ime=\{/); expect(s, f).not.toMatch(/\/\[a-df-z\]\/i/); }
  const c = readFileSync('src/ui/common.tsx', 'utf8'); expect(c).toMatch(/if \(ime\) return;/); expect(c).toMatch(/inputMode="text"/); expect(c).toMatch(/isComposing/);
});
