/* 题库 v0.3 schema（GDD §6.2）。JSON: {bank_name, version, questions:[...]}；CSV 见 csv.ts */
import { STEM_MAX, OPTION_MAX } from './importCheck';
export type QType = '选择' | '多选' | '判断' | '填空';
export type Status = '待审核' | 'AI初审通过' | '需家长确认' | '已通过' | '停用';
export const STATUSES: Status[] = ['待审核', 'AI初审通过', '需家长确认', '已通过', '停用'];
export type GradeKey = 'K1' | 'K2' | 'K3' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';
export interface Option { key: string; text: string; image?: string; audio?: string }
/** 数一数配图（v9）：CSV/XLSX 里是 JSON 字符串 */
export interface Visual { item?: string; emoji?: string; count: number; label?: string }
export function parseVisual(v: unknown): Visual | undefined {
  let o: any = v; if (typeof v === 'string') { if (!v.trim()) return undefined; try { o = JSON.parse(v); } catch { return undefined; } }
  if (!o || typeof o !== 'object' || !(Number(o.count) > 0)) return undefined;
  return { item: o.item || undefined, emoji: o.emoji || o.item || undefined, count: Number(o.count), label: o.label || undefined };
}
export interface Question {
  key: string;            // 全局唯一键 = grade + ':' + id（科学题 id 如 K3-001 与幼儿园 K1 冲突，不能只靠 id）
  id: string; status: Status; subject: string; grade: GradeKey; gradeNum: number;
  textbook?: string; textbook_note?: string; unit?: string; volume: string;
  usage?: 'boss' /* r11：只在 Boss 关出现（缺省 = normal，不写） */;
  type: QType; question: string; question_image?: string; question_audio?: string; tts_text?: string;
  options: Option[]; answer: string[]; template?: string; visual?: Visual; tolerance?: number; explanation: string; difficulty: number;
  tags: string[]; knowledge_point?: string; time?: number; source?: string; review_note?: string;
  /** r16.1（题库 v48）：填空题的输入方式——numeric = 数字键盘；text = 不弹数字键盘（字母键盘 / 系统输入法由 inputKind.fillKind 再分）。不参与 qRev */
  input_type?: 'numeric' | 'text';
  /** r17（可选）：小班上 / 下学期（题库字段 term 或 semester：1 / 2 / 上 / 下 / 上学期 / 下学期）；有就覆盖按单元顺序的对半分。不参与 qRev */
  term?: 1 | 2;
  order: number;          // 在源文件中的顺序（章节排序用）
}
/** r17：题库的学期字段 → 1 / 2（认不出 = 没有） */
export function parseTerm(v: unknown): 1 | 2 | undefined {
  const t = String(v ?? '').trim(); return /^(1|上|上学期|上册)$/.test(t) ? 1 : /^(2|下|下学期|下册)$/.test(t) ? 2 : undefined;
}
export const KEYS = 'ABCDEF'.split('');
/** r16（题库 v43：ids 不变、判断题答案 / 选项文字 / 高一选项位置有改动）：题目「内容版本」= 题型 + 题干 + 选项 + 答案 + 容差 的短哈希。
    错题本记下答错时的版本；导入题记下导入时内置题的版本（base_rev），内置题升级后以新版为准 */
export function qRev(q: Pick<Question, 'type' | 'question' | 'options' | 'answer'> & { tolerance?: number; question_image?: string }): string {
  const s = JSON.stringify([q.type, q.question, q.question_image ?? '', q.options.map(o => [o.text, o.image ?? '']), q.answer, q.tolerance ?? null]);
  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
/** r16.1 (l) 技术QA P3-1：家长导入「和内置题同号」的题时，判断「和内置题一样」要看家长能改的全部字段（qRev 只是内容版本：
    题型 / 题干 / 选项 / 答案 / 容差——给错题本和 base_rev 用，不能改，否则已存的 base_rev 全部对不上）。
    只改了解析、难度、停用（status）、朗读文字等也算「不一样」，要存下来。预览和确认导入用同一个函数。 */
export const EDIT_FIELDS = ['status', 'subject', 'textbook', 'unit', 'volume', 'type', 'question', 'question_image', 'question_audio', 'tts_text', 'options', 'answer',
  'tolerance', 'explanation', 'difficulty', 'tags', 'knowledge_point', 'time', 'source', 'usage', 'template', 'visual', 'input_type'] as const;
type EditField = typeof EDIT_FIELDS[number];
const nil = (v: unknown) => v === '' || v == null || (Array.isArray(v) && !v.length) ? null : v;
export function editRev(q: Question, fields: readonly EditField[] = EDIT_FIELDS): string {
  const o = q as unknown as Record<string, unknown>;
  const s = JSON.stringify(fields.map(k => k === 'options' ? q.options.map(x => [x.text, x.image ?? '', x.audio ?? '']) : nil(o[k])));
  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + ':' + s.length.toString(36);
}
/** 导入文件里给了哪些可改字段（CSV 没有图片 / 录音 / 知识点 / usage 列：没给的字段不算改动，导出再导入不会被当成「改过」） */
export function rawFields(raw: unknown): readonly EditField[] {
  if (!raw || typeof raw !== 'object') return EDIT_FIELDS; const r = raw as Record<string, unknown>;
  return EDIT_FIELDS.filter(k => k in r || (k === 'tags' && 'tag' in r) || (k === 'options' && ['A', 'B', 'C', 'D'].some(x => x in r)));
}
/** 导入的题和内置题完全一样（家长能改、且导入文件里给了的字段都相同）→ 不另存，仍用内置题。预览、确认导入、启动时合并都用它 */
export const sameAsBuiltin = (builtin: Question, imported: Question, raw?: unknown) => { const f = rawFields(raw); return editRev(builtin, f) === editRev(imported, f); };
export const NO_VOLUME = '（未标册别）';

/** 年级键：K1/K2/K3、1–12；宽松接受数字 0（=K1） */
export function parseGradeKey(g: unknown): GradeKey | null {
  const s = String(g ?? '').trim().toUpperCase();
  if (/^K[1-3]$/.test(s)) return s as GradeKey;
  const n = Number(s);
  if (s === '' || !Number.isInteger(n)) return null;
  if (n === 0) return 'K1';
  return n >= 1 && n <= 12 ? (String(n) as GradeKey) : null;
}
export const gradeNumOf = (g: GradeKey) => (g.startsWith('K') ? 0 : Number(g));
/** 兼容旧接口：K→0 */
export function parseGrade(g: unknown): number | null { const k = parseGradeKey(g); return k === null ? null : gradeNumOf(k); }
export const GRADE_LABEL: Record<string, string> = { K1: '幼儿园小班', K2: '幼儿园中班', K3: '幼儿园大班', 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级', 7: '初一', 8: '初二', 9: '初三', 10: '高一', 11: '高二', 12: '高三' };

/** 游戏可用：已通过 / AI初审通过；家长开关可放行 待审核 / 需家长确认；停用永不出 */
export const isPlayableStatus = (s: Status) => s === '已通过' || s === 'AI初审通过';
export function canPlay(s: Status, includePending: boolean) {
  return isPlayableStatus(s) || (includePending && (s === '待审核' || s === '需家长确认'));
}
const READY_TRUE = new Set([true, 'true', '是', 'TRUE', 1, '1']);
const READY_FALSE = new Set([false, 'false', '否', 'FALSE', 0, '0']);

/** 返回错误列表（空=合法）；ctxGrade=文件级年级（优先于题内 grade 缺失时） */
export function validateQuestion(q: any, ctxGrade?: GradeKey): string[] {
  const e: string[] = [];
  if (!q || typeof q !== 'object') return ['不是对象'];
  if (!q.id) e.push('缺少 id');
  if (!String(q.question ?? '').trim() && !q.question_image) e.push('题干为空');
  if (String(q.question ?? '').length > STEM_MAX) e.push(`题干太长（${String(q.question).length} 字，最多 ${STEM_MAX} 字）`);   // r16 技术QA P4
  const g = parseGradeKey(q.grade ?? ctxGrade);
  if (g === null) e.push(`grade 非法（应为 K1-K3 或 1-12）: ${q.grade}`);
  if (!String(q.subject ?? '').trim()) e.push('缺少 subject');
  if (q.status !== undefined && q.status !== '' && !STATUSES.includes(q.status)) e.push(`status 非法: ${q.status}`);
  if (!['选择', '多选', '判断', '填空'].includes(q.type)) e.push(`未知题型: ${q.type}`);
  const ans = q.answer;
  if (ans === undefined || ans === null || (Array.isArray(ans) ? ans.length === 0 || ans.every((a: any) => !String(a).trim()) : !String(ans).trim())) e.push('答案为空');
  const opts: any[] = Array.isArray(q.options) ? q.options : [];
  if (q.type === '选择' || q.type === '多选') {
    if (opts.length < 2) e.push('选项少于 2 个');
    if (opts.length > 6) e.push('选项多于 6 个');
    if (opts.some(o => !String(o?.text ?? '').trim() && !o?.image)) e.push('有空选项');
    if (opts.some(o => String(o?.text ?? '').length > OPTION_MAX)) e.push(`选项太长（最多 ${OPTION_MAX} 字）`);
    const letters = (Array.isArray(ans) ? ans.join('') : String(ans ?? '')).toUpperCase().replace(/[^A-Z]/g, '').split('');   // 数组答案先 join（技术QA P2-7）
    const valid = KEYS.slice(0, opts.length);
    if (letters.some(l => !valid.includes(l))) e.push(`answer 为 ${ans}，但只有 ${opts.length} 个选项`);
    if (q.type === '选择' && letters.length !== 1) e.push('单选题答案应为 1 个字母');
    if (q.type === '多选' && letters.length < 2) e.push('多选题答案应至少 2 个字母');
    if (g?.startsWith('K') && opts.length > 3) e.push('幼儿园题最多 3 个选项');
  }
  if (q.type === '判断' && !['对', '错'].includes(String(Array.isArray(ans) ? ans[0] : ans))) e.push('判断题答案须为 对/错');
  const d = q.difficulty;
  if (d !== undefined && d !== '' && d !== null && !(Number.isInteger(Number(d)) && Number(d) >= 1 && Number(d) <= 5)) e.push('difficulty 应为 1-5');
  if (q.tolerance !== undefined && q.tolerance !== '' && q.tolerance !== null && !(Number(q.tolerance) >= 0)) e.push('tolerance 应为非负数');
  if (q.status === '需家长确认' && !String(q.review_note ?? '').trim()) e.push('需家长确认 必须写 review_note');
  return e;
}

/** 由 status 推导 game_ready；返回不一致时的提示 */
export function gameReadyMismatch(q: any): string | null {
  if (q.game_ready === undefined || q.game_ready === '' || q.game_ready === null) return null;
  const derived = isPlayableStatus(q.status ?? '待审核');
  const given = READY_TRUE.has(q.game_ready) ? true : READY_FALSE.has(q.game_ready) ? false : null;
  if (given === null) return `game_ready 值无法识别：${q.game_ready}（已按 status 重新计算）`;
  return given !== derived ? `game_ready=${q.game_ready} 与 status=${q.status} 不一致，已按 status 重新计算为 ${derived ? '是' : '否'}` : null;
}

export function normalize(q: any, order = 0, ctxGrade?: GradeKey): Question {
  const grade = parseGradeKey(q.grade ?? ctxGrade)!;
  const ansRaw = Array.isArray(q.answer) ? q.answer : String(q.answer);
  const answer = q.type === '填空'
    ? (Array.isArray(ansRaw) ? ansRaw : ansRaw.split('|')).map((s: any) => String(s).trim()).filter(Boolean)
    : q.type === '判断' ? [String(Array.isArray(ansRaw) ? ansRaw[0] : ansRaw)] : (Array.isArray(ansRaw) ? ansRaw.join('') : String(ansRaw)).toUpperCase().replace(/[^A-Z]/g, '').split('');
  const t = Number(q.time);
  return {
    key: `${grade}:${q.id}`, id: String(q.id), status: (q.status || '待审核') as Status, subject: String(q.subject).trim(), grade, gradeNum: gradeNumOf(grade),
    textbook: q.textbook || undefined, textbook_note: q.textbook_note || undefined, unit: q.unit || undefined,
    volume: String(q.volume ?? '').trim() || NO_VOLUME, type: q.type, question: String(q.question ?? ''),
    question_image: q.question_image || undefined, question_audio: q.question_audio || undefined, tts_text: q.tts_text ?? undefined,
    options: (q.options ?? []).map((o: any, i: number) => ({ key: KEYS[i], text: String(o?.text ?? ''), image: o?.image || '', audio: o?.audio || '' })),
    answer, difficulty: Number(q.difficulty) || 2,
    tags: Array.isArray(q.tags) ? q.tags : String(q.tags ?? q.tag ?? '').split('|').map(s => s.trim()).filter(Boolean),
    knowledge_point: q.knowledge_point || undefined, time: t > 0 ? t : undefined, source: q.source, review_note: q.review_note || undefined,
    tolerance: q.tolerance === undefined || q.tolerance === '' || q.tolerance === null ? undefined : Number(q.tolerance),
    ...(q.usage === 'boss' ? { usage: 'boss' as const } : {}),
    ...(parseTerm(q.term ?? q.semester) ? { term: parseTerm(q.term ?? q.semester) } : {}),
    ...(q.type === '填空' && (q.input_type === 'numeric' || q.input_type === 'text') ? { input_type: q.input_type as 'numeric' | 'text' } : {}),
    explanation: cleanExplanation(q.explanation ?? ''), order, template: q.template ? String(q.template) : undefined, visual: parseVisual(q.visual),
  };
}

export interface BankIssue { row: number; id: string; errors: string[] }
export interface Bank {
  name: string; version?: string /* 题库 v18 起是字符串 'v18'，之前是数字 4：统一转字符串 */; grade?: GradeKey; all: Question[]; bad: BankIssue[]; warnings: BankIssue[];
  counts: { playable: number; pendingParent: number; pending: number; disabled: number; total: number };
}
/** 文件年级：优先 bank 级 grade 字段，其次文件名（题库_3年级 / 初一 / 高一 / 幼儿园小班 / bank_7） */
export function gradeFromFileName(name: string): GradeKey | null {
  if (/幼儿园小班|_K1\b|K1\./i.test(name)) return 'K1';
  if (/幼儿园中班|_K2/i.test(name)) return 'K2';
  if (/幼儿园大班|_K3/i.test(name)) return 'K3';
  const m = name.match(/(\d{1,2})年级/) ?? name.match(/bank_(\d{1,2})\./);
  if (m) return parseGradeKey(m[1]);
  const cn: Record<string, GradeKey> = { 初一: '7', 初二: '8', 初三: '9', 高一: '10', 高二: '11', 高三: '12' };
  for (const k in cn) if (name.includes(k)) return cn[k];
  return null;
}
export function countStatuses(qs: { status: Status }[]) {
  const c = { playable: 0, pendingParent: 0, pending: 0, disabled: 0, total: qs.length };
  for (const q of qs) {
    if (isPlayableStatus(q.status)) c.playable++;
    else if (q.status === '需家长确认') c.pendingParent++;
    else if (q.status === '停用') c.disabled++;
    else c.pending++;
  }
  return c;
}
export function loadBank(raw: any, fileName = ''): Bank {
  const list: any[] = Array.isArray(raw) ? raw : raw?.questions ?? [];
  const ctx = parseGradeKey(raw?.grade) ?? gradeFromFileName(fileName) ?? undefined;
  const all: Question[] = [], bad: BankIssue[] = [], warnings: BankIssue[] = [], seen = new Set<string>();
  list.forEach((q, i) => {
    const errors = validateQuestion(q, ctx);
    const g = parseGradeKey(q?.grade ?? ctx);
    const key = `${g}:${q?.id}`;
    if (q?.id && seen.has(key)) errors.push('id 重复');
    seen.add(key);
    if (ctx && g && g !== ctx) warnings.push({ row: i + 1, id: q?.id, errors: [`题目 grade=${q.grade} 与文件年级 ${ctx} 不同，以题目字段为准`] });
    const mm = q && gameReadyMismatch(q);
    if (mm) warnings.push({ row: i + 1, id: q?.id, errors: [mm] });
    // r11：usage 字段 'normal' | 'boss'，缺省 normal；不认识的值按 normal 导入并给警告
    if (q && q.usage != null && q.usage !== '' && q.usage !== 'normal' && q.usage !== 'boss') { warnings.push({ row: i + 1, id: q?.id, errors: [`usage=${String(q.usage)} 不认识，按 normal 处理`] }); console.warn('[题库] usage 不认识，按 normal 处理', q.id, q.usage); }
    if (errors.length) bad.push({ row: i + 1, id: q?.id ?? '?', errors }); else all.push(normalize(q, i, ctx));
  });
  return { name: raw?.bank_name ?? fileName, version: raw?.version == null ? undefined : String(raw.version), grade: ctx, all, bad, warnings, counts: countStatuses(all) };
}
/** 可出现在游戏里的题 */
export function playable(qs: Question[], includePending: boolean) { return qs.filter(q => canPlay(q.status, includePending)); }

export function choicesOf(q: Question): Option[] {
  if (q.type === '判断') return [{ key: '对', text: '✔ 对' }, { key: '错', text: '✘ 错' }];
  return q.options;
}

/** 解析数字：整数/小数/分数（含带分数 1又1/2、1 1/2）/百分数/科学计数法 */
export function parseNum(s: string): number | null {
  let t = s.trim().replace(/×10\^?/g, 'e').replace(/[−–]/g, '-').replace(/\s+/g, ' ');
  const mixed = t.match(/^(-?)(\d+)(?:又| )(\d+)\/(\d+)$/);
  if (mixed) { const v = Number(mixed[2]) + Number(mixed[3]) / Number(mixed[4]); return Number(mixed[4]) === 0 ? null : (mixed[1] ? -v : v); }
  t = t.replace(/\s/g, '');
  if (/^-?\d+(\.\d+)?%$/.test(t)) return Number(t.slice(0, -1)) / 100;
  if (/^-?\d+(\.\d+)?\/-?\d+(\.\d+)?$/.test(t)) { const [a, b] = t.split('/').map(Number); return b === 0 ? null : a / b; }
  if (/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t)) return Number(t);
  return null;
}
/** 技术QA R6-3：弯撇号 ’‘ʼ′ → '，各种连字符/破折号 ‐‑‒–—− → - */
/* r16.1：填空可以用系统输入法打字——先 NFKC（全角字母 / 数字 / 空格 → 半角），含汉字时去掉所有空白（「千金 散尽」），句末标点不计（「还复来。」） */
const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;
const norm = (s0: string) => { let s = s0.normalize('NFKC').replace(/[’‘ʼ′`]/g, "'").replace(/[‐‑‒–—−]/g, '-').trim().replace(/\s+/g, ' ').replace(/，/g, ',').replace(/[“”]/g, '"').toLowerCase();
  if (HAN.test(s)) s = s.replace(/\s+/g, '').replace(/\.+$/, ''); return s.replace(/[。．！？；!?;,、]+$/, '').trim(); };

export type Grade = 'full' | 'partial' | 'wrong';
/** 判分；多选：全对 full，漏选（无错选）partial，错选 wrong；填空数值（含分数）按数值等价 */
export function judge(q: Question, input: string | string[]): Grade {
  if (q.type === '多选') {
    const sel = new Set(Array.isArray(input) ? input : input.split(''));
    if (sel.size === 0 || [...sel].some(k => !q.answer.includes(k))) return 'wrong';
    return sel.size === q.answer.length ? 'full' : 'partial';
  }
  const v = Array.isArray(input) ? input.join('') : input;
  if (q.type !== '填空') return v.toUpperCase() === q.answer[0].toUpperCase() || v === q.answer[0] ? 'full' : 'wrong';
  if (q.answer.some(a => norm(a) === norm(v))) return 'full';
  const n = parseNum(v);
  if (n === null) return 'wrong';
  const tol = q.tolerance ?? 1e-9;
  return q.answer.some(a => { const m = parseNum(a); return m !== null && Math.abs(m - n) <= tol + 1e-9 * Math.max(1, Math.abs(m)); }) ? 'full' : 'wrong';
}
export const isCorrect = (q: Question, input: string | string[]) => judge(q, input) === 'full';

export function correctText(q: Question): string {
  if (q.type === '选择' || q.type === '多选') return q.answer.map(k => `${k}. ${q.options.find(o => o.key === k)?.text ?? ''}`).join('；');
  return q.answer[0];
}
/** 朗读文本：tts_text 优先；'-' 表示不朗读；含公式的题干不读 */
export function ttsText(q: Pick<Question, 'tts_text' | 'question'>): string | null {
  if (q.tts_text === '-') return null;
  if (q.tts_text && q.tts_text.trim()) return q.tts_text;
  if (/\$/.test(q.question)) { const t = q.question.replace(/\\\$/g, "美元").replace(/\$[^$]*\$/g, "").trim(); return t.length >= 4 ? t : null; }
  return q.question;
}

export function shuffle<T>(a: T[], rnd = Math.random): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
/** 幼儿园：最多 3 个选项（正确 + 至多 2 个错误） */
export function kinderChoices(q: Question, rnd = Math.random): Option[] {
  const all = choicesOf(q);
  if (all.length <= 3) return all;
  const right = all.filter(c => q.answer.includes(c.key));
  return shuffle([...right, ...shuffle(all.filter(c => !right.includes(c)), rnd).slice(0, 3 - right.length)], rnd);
}

/** 家长导出用：去掉程序内部字段和开发注记（textbook_note、review_note 等，试玩报告 #10） */
export const EXPORT_DROP = ['key', 'gradeNum', 'order', 'textbook_note', 'review_note', 'change_tag'] as const;
export function exportQuestion(q: Question) {
  const o: Record<string, unknown> = { ...q };
  for (const k of EXPORT_DROP) delete o[k];
  return { ...o, options: q.options.map(x => ({ text: x.text, image: x.image, audio: x.audio })), answer: q.type === '填空' ? q.answer : q.answer.join('') };
}

/** 游戏内显示的解析去掉教材/版本开发注记（「📘 人教版2019：…本题库按…默认…」等，补测报告 #4） */
export function cleanExplanation(e: string): string {
  return String(e)
    .split(/\n+/).filter(l => !/^\s*📘/.test(l)).join('\n')
    .replace(/[（(]?\s*(?:📘\s*)?(?:统编版|人教版|译林版|苏教版|鲁教版|北师大版)\d{0,4}\s*[:：][^。\n]*?(?:本题库[^。\n]*|默认[^。\n]*)[。]?[)）]?/g, '')
    .replace(/📘[^\n]*/g, '').trim();
}

/** r11：Boss 专用题（usage=boss）只在 Boss 关出现 */
export const isBossOnly = (q: { usage?: string }) => q.usage === 'boss';
