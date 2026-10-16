/* 章节/关卡生成（GDD §7.1）：每个科目一个章节（地图区域），区域内按「册别 volume + 教材单元 unit」分组；
   每单元每 8 题 1 个普通关，每 3 个普通关后 1 个精英关，单元 ≥12 题时以单元 Boss 收尾。
   关卡 id 取首题的 grade:id（不含单元文本，单元改名不影响星级）。 */
import type { Question } from './questions';
import type { LevelKind } from './grades';
/** 题库改版后旧关卡 id → 新关卡（按题池重合度生成，见 tools/level_aliases.md）；星级继承 */
import LEVEL_ALIASES from './levelAliases.json';
const ALIASES = LEVEL_ALIASES as Record<string, string[]>;
export interface Level { id: string; chapter: string; index: number; kind: LevelKind; name: string; pool: string[] /* question keys */; volume: string; unit: string; aliases?: string[] /* 旧版关卡 id（合并前的小节 Boss），星级继承 */; redirect?: string /* 语文题少的古诗课：卡片直接进同名诗词关 */; parts?: string[] /* 临时合并关：各课单独成关时的 id（得星时同时记到这些 id，拆回后星级保留） */ }
export interface Chapter { subject: string; name: string; icon: string; levels: Level[]; volumes: string[]; count: number }
export const AREA: Record<string, [string, string]> = {
  数学: ['数之城', '🔢'], 语文: ['墨韵山', '🖌️'], 英语: ['星语港', '🔤'], 诗词: ['诗词江湖', '📜'], 历史: ['时光长廊', '⏳'],
  物理: ['力之塔', '🧲'], 化学: ['炼金工坊', '⚗️'], 科学: ['探索森林', '🔬'],
  道德与法治: ['正义广场', '⚖️'], 生物: ['生命花园', '🧬'], 地理: ['山河地图', '🌏'], 政治: ['理想议事厅', '🏛️'],
  数数: ['数数小路', '🍎'], 颜色形状: ['彩虹花园', '🌈'], 认识动物: ['动物农场', '🐮'], 生活常识: ['温馨小屋', '🏠'], 儿歌古诗: ['儿歌小河', '🎵'],
};
export const CHUNK = 8;
const SUBJECT_ORDER = ['数数', '颜色形状', '认识动物', '生活常识', '儿歌古诗', '数学', '语文', '英语', '诗词', '科学', '历史', '道德与法治', '地理', '政治', '物理', '化学', '生物'];

/** 按「·」分段，但书名号《》里的不算 */
export function splitDot(u: string): string[] {
  const out: string[] = []; let cur = '', depth = 0;
  for (const ch of u) { if (ch === '《') depth++; if (ch === '》') depth = Math.max(0, depth - 1); if (ch === '·' && !depth) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out;
}
export function shortUnit(u?: string) {
  if (!u) return '';
  const parts = splitDot(u);   // 书名号里的「·」（《清平乐·村居》）不拆
  return (parts[parts.length - 1] || u).replace(/^第[一二三四五六七八九十\d]+(?:单元|[章课节])\s*/, '');
}

/** volumes：已学册别（null = 全部）；volumeOrder：册别显示顺序 */
/** all：含不可玩题的全部题（用来找「可玩题为 0 的语文古诗课」，给它一张指向同名诗词关的卡片） */
export function buildChapters(qs: Question[], volumes: string[] | null = null, all?: Question[]): Chapter[] { return linkShortChinese(buildChapters0(qs, volumes), zeroCnLessons(qs, volumes, all)); }
function zeroCnLessons(qs: Question[], volumes: string[] | null, all?: Question[]) {
  if (!all) return [];
  const have = new Set(qs.filter(q => q.subject === '语文').map(q => q.volume + '|' + (q.unit ?? '')));
  const out = new Map<string, Question>();
  for (const q of all) { if (q.subject !== '语文' || (volumes && !volumes.includes(q.volume))) continue; const k = q.volume + '|' + (q.unit ?? ''); if (!have.has(k) && !out.has(k)) out.set(k, q); }
  return [...out.values()];
}
function buildChapters0(qs: Question[], volumes: string[] | null = null): Chapter[] {
  const bySubj = new Map<string, Question[]>();
  for (const q of qs) {
    if (volumes && !volumes.includes(q.volume)) continue;
    (bySubj.get(q.subject) ?? bySubj.set(q.subject, []).get(q.subject)!).push(q);
  }
  const subjects = [...bySubj.keys()].sort((a, b) => (SUBJECT_ORDER.indexOf(a) + 1 || 99) - (SUBJECT_ORDER.indexOf(b) + 1 || 99));
  return subjects.map(subject => {
    const list = bySubj.get(subject)!;
    const volOrder: string[] = [];
    for (const q of list) if (!volOrder.includes(q.volume)) volOrder.push(q.volume);
    volOrder.sort((a, b) => volRank(a) - volRank(b));
    // 册别为主键；册内按单元文本排序（只用于排序，不用于分组/命名 id），再按源顺序
    // 排序：册别 → 章/单元号（数字序）→ 小节：都是「n.m」编号时按编号，否则按题库中首次出现顺序（如一年级语文课名）→ 源顺序
    const firstSeen = new Map<string, number>();
    for (const q of list) { const k = q.volume + '|' + (q.unit ?? ''); if (!firstSeen.has(k)) firstSeen.set(k, q.order); }
    const ck = (q: Question) => { const c = chapterOf(q.unit); return c ? unitKey(c.key) : unitKey(q.unit); };
    const secNum = (u?: string) => { const m = (u ?? '').split('·').pop()!.match(/^(\d+)\.(\d+)/); return m ? +m[1] * 1000 + +m[2] : null; };
    list.sort((a, b) => {
      const v = volOrder.indexOf(a.volume) - volOrder.indexOf(b.volume); if (v) return v;
      const c = ck(a).localeCompare(ck(b)); if (c) return c;
      const sa = secNum(a.unit), sb = secNum(b.unit);
      if (sa !== null && sb !== null && sa !== sb) return sa - sb;
      return (firstSeen.get(a.volume + '|' + (a.unit ?? ''))! - firstSeen.get(b.volume + '|' + (b.unit ?? ''))!) || a.order - b.order;
    });
    // 1) 先按「册别 + 单元原文」分成小节（与旧版完全相同 → 普通关 id 不变，星级不丢）
    const subs: { volume: string; units: string[]; qs: Question[]; parts?: string[] }[] = [];
    for (const q of list) {
      const last = subs[subs.length - 1];
      if (last && last.volume === q.volume && last.units[last.units.length - 1] === (q.unit ?? '')) last.qs.push(q);
      else subs.push({ volume: q.volume, units: [q.unit ?? ''], qs: [q] });
    }
    // 小节题少也单独成关（不再并入相邻小节，避免「2.2 数轴」被吞进 2.1 关；审核 v8）
    // 2) 小节按「册别 + 章/单元号」合并成地图上的章节（2.1、2.2 → 第2章）；小节变成章内关卡顺序
    const groups: { volume: string; title: string; subs: typeof subs }[] = [];
    for (const sb of subs) {
      const ck = chapterOf(sb.units[0]); const last = groups[groups.length - 1];
      if (last && last.volume === sb.volume && ck && chapterOf(last.subs[0].units[0])?.key === ck.key) last.subs.push(sb);
      else groups.push({ volume: sb.volume, title: ck?.title || shortUnit(sb.units[0]) || sb.volume, subs: [sb] });
    }
    // 3) 每个小节每 8 题一个普通关；章内每 3 个普通关后加精英关；章 ≥12 题时以章节 Boss 收尾
    const levels: Level[] = [];
    for (const g of groups) g.subs = mergeSmallLessons(subject, g.subs);
    for (const g of groups) {
      const meta = { volume: g.volume, unit: g.title };
      let recent: Question[][] = [];
      const all = g.subs.flatMap(x => x.qs);
      const normals: { c: Question[]; name: string; sub: number }[] = [];
      for (const [si, sb] of g.subs.entries()) {
        const chunks: Question[][] = [];
        for (let i = 0; i < sb.qs.length; i += CHUNK) chunks.push(sb.qs.slice(i, i + CHUNK));
        if (chunks.length > 1 && chunks[chunks.length - 1].length < 4) chunks[chunks.length - 2].push(...chunks.pop()!);
        const nm = sb.units.map(u => shortUnit(u) || sb.volume).join(' + ');
        chunks.forEach((c, k) => normals.push({ c, name: chunks.length > 1 ? `${nm} ${k + 1}` : nm, sub: si }));
      }
      // 精英关只取本小节（同一课）的题，不跨课（策划 r6 裁定 2）：同一小节每 3 个普通关后 1 个精英关
      normals.forEach(({ c, name, sub }, k) => {
        if (k > 0 && normals[k - 1].sub !== sub) recent = [];
        recent.push(c);
        const parts = g.subs[sub].parts;
        levels.push({ id: `${subject}|N|${c[0].key}`, chapter: subject, index: levels.length + 1, kind: 'normal', name, pool: c.map(q => q.key), ...meta,
          ...(parts && k === normals.findIndex(x => x.sub === sub) ? { parts: parts.filter(x => x !== `${subject}|N|${c[0].key}`), aliases: parts.filter(x => x !== `${subject}|N|${c[0].key}`) } : {}) });
        if (recent.length === 3 && k < normals.length - 1) {
          const pool = recent.flat(); recent = [];
          levels.push({ id: `${subject}|E|${pool[0].key}`, chapter: subject, index: levels.length + 1, kind: 'elite', name: '精英挑战', pool: pool.map(q => q.key), ...meta });
        }
      });
      if (all.length >= 12) levels.push({ id: `${subject}|B|${all[0].key}`, chapter: subject, index: levels.length + 1, kind: 'boss', name: '章节 Boss', pool: all.map(q => q.key), ...meta,
        aliases: g.subs.filter((x, i) => i > 0 && x.qs.length >= 12).map(x => `${subject}|B|${x.qs[0].key}`) });
    }
    for (const l of levels) if (ALIASES[l.id]) l.aliases = [...(l.aliases ?? []), ...ALIASES[l.id]];
    const [name, icon] = AREA[subject] ?? [subject + '之地', '⭐'];
    return { subject, name, icon, levels, volumes: volOrder, count: list.length };
  });
}
/** 题少的课（策划 r6）：语文课文 / 古诗词（含小班儿歌古诗）永不合并，单独成关（不够时关内重复本课题，错题优先）；
    其他科目：本章内相邻、题数 < 4 的课临时合并（名字「1.2 + 1.3」），合并到 ≥4 题为止；只和同样题少（< 6）的相邻课合并。
    数据驱动：某课题数 ≥ 6 时自动拆回单独成关，星级经 parts / aliases 继承。 */
export const MERGE_BELOW = 4, SPLIT_AT = 6;
export const NEVER_MERGE = new Set(['语文', '诗词', '儿歌古诗']);
type Sub = { volume: string; units: string[]; qs: Question[]; parts?: string[] };
export function mergeSmallLessons(subject: string, subs: Sub[]): Sub[] {
  if (NEVER_MERGE.has(subject)) return subs;
  const out: Sub[] = [];
  const idOf = (x: Sub) => `${subject}|N|${x.qs[0].key}`;
  for (const sb of subs) {
    const last = out[out.length - 1];
    const lastOpen = last && last.qs.length < MERGE_BELOW && last.volume === sb.volume;
    const canJoin = sb.qs.length < SPLIT_AT && last && last.volume === sb.volume && (last.parts ? true : last.qs.length < SPLIT_AT);
    if (canJoin && (lastOpen || (sb.qs.length < MERGE_BELOW && last.qs.length < SPLIT_AT))) {
      const parts = last.parts ?? [idOf(last)];
      out[out.length - 1] = { volume: last.volume, units: [...last.units, ...sb.units], qs: [...last.qs, ...sb.qs], parts: [...parts, idOf(sb)] };
    } else out.push({ ...sb });
  }
  return out;
}
/** 语文课可玩题 < 3 时：若有同名诗词关，卡片指向那一关（不重复同一道题）；否则隐藏（策划 r6 / 题库 v14） */
export const SHORT_CN = 3;
const poemTitle = (s: string) => s.replace(/[（(][^）)]*[）)]/g, '').replace(/^.*?古诗(?:词)?(?:[一二三四两]首)?\s*/, '').replace(/[《》\s]/g, '');
export function linkShortChinese(chs: Chapter[], zero: Question[] = []): Chapter[] {
  const cn = chs.find(c => c.subject === '语文'); const po = chs.find(c => c.subject === '诗词'); if (!cn) return chs;
  const poems = (po?.levels ?? []).filter(l => l.kind === 'normal');
  const keep: Level[] = [];
  for (const l of cn.levels) {
    if (l.kind !== 'normal' || l.pool.length >= SHORT_CN) { keep.push(l); continue; }
    const t = poemTitle(l.name); const hit = t.length >= 2 ? poems.find(p => { const pt = poemTitle(p.name); return pt.length >= 2 && (pt === t || t.includes(pt) || pt.includes(t)); }) : undefined;
    if (hit) keep.push({ ...l, redirect: hit.id, name: `${l.name} → 古诗关` });
  }
  // 可玩题为 0 的语文课：有同名诗词关就加一张指向它的卡片（放在同册同章最后），否则不显示
  for (const q of zero) {
    const nm = shortUnit(q.unit) || q.volume; const t = poemTitle(nm); if (t.length < 2) continue;
    const hit = poems.find(p => { const pt = poemTitle(p.name); return pt.length >= 2 && (pt === t || t.includes(pt) || pt.includes(t)); }); if (!hit) continue;
    const unit = chapterOf(q.unit)?.title || nm; let at = -1;
    keep.forEach((l, i) => { if (l.volume === q.volume && l.unit === unit) at = i; });
    const lv: Level = { id: `语文|R|${q.key}`, chapter: '语文', index: 0, kind: 'normal', name: `${nm} → 古诗关`, pool: [], volume: q.volume, unit, redirect: hit.id };
    if (at >= 0) keep.splice(at + 1, 0, lv); else keep.push(lv);
  }
  keep.forEach((l, i) => { l.index = i + 1; });
  cn.levels = keep; return chs;
}
/** 上册 < 下册 < 通用 < 未标；其余按出现顺序 */
function volRank(v: string) {
  if (/上册|上$|第一册|7A|\(7A\)/.test(v)) return 1;
  if (/下册|下$|第二册|7B/.test(v)) return 2;
  if (/通用/.test(v)) return 3;
  if (/未标/.test(v)) return 9;
  return 5;
}

/** 同一章（册别 + 章/单元）的所有关卡 */
export const levelsOfUnit = (levels: Level[], l: Level) => levels.filter(x => x.volume === l.volume && x.unit === l.unit);
/** 星级（策划 D3，全年龄统一）：正确率 = 第 1 次就答对 ÷ 作答题数；★ 通关；★★ ≥ 60%；★★★ ≥ 80% 且未复活 */
/** 星级（策划 r6 裁定 1）：正确率 = 答对 ÷ 作答（我方 + 对方回合全部题；超时算错；多选漏选算 0.5）。
    ★ 通关；★★ ≥60%；★★★ ≥80% 且未复活；回合上限撤退最多 ★；时间到 0★。小班沿用 D1–D3（只算自己第一次答对）。 */
export const STAR_RULES = '⭐ 过关　⭐⭐ 答对六成　⭐⭐⭐ 答对八成且没复活';
export const STAR_RULES_K = '⭐ 过关　⭐⭐ 第一次就答对六成　⭐⭐⭐ 第一次就答对八成';
export function levelStars(r: { win: boolean; correct: number; total: number; revived: boolean; retreat?: boolean; timeUp?: boolean }) {
  if (r.timeUp) return 0;
  const s = starsFor(r.win, r.total ? r.correct / r.total : 0, r.revived);
  return r.retreat ? Math.min(1, s) : s;
}
/** Boss 选题池（裁定 2）：整章题，优先「还没出过」和「之前答错」的题；不够才重复已答对过的 */
export function bossPool<T extends { key: string }>(pool: T[], seen: Set<string>, wrong: Set<string>, n: number): T[] {
  const fresh = pool.filter(q => !seen.has(q.key)), bad = pool.filter(q => seen.has(q.key) && wrong.has(q.key));
  const pref = [...fresh, ...bad];
  return pref.length >= n ? pref : [...pref, ...pool.filter(q => !pref.includes(q))];
}
export function starsFor(win: boolean, accuracy: number, revived: boolean): number {
  if (!win) return 0;
  if (accuracy >= 0.8 - 1e-9) return revived ? 2 : 3;
  if (accuracy >= 0.6 - 1e-9) return 2;
  return 1;
}
/** 解锁：每个教材单元的第 1 关开放（孩子可从正在学的单元开始）；单元内前一关 ≥1 星解锁下一关 */
/** 某关星级：本 id 与旧 id 取最大 */
/** 星级迁移（策划 r7）：星星只升不降。每个新关卡 = max(自身已有星, 映射到它的旧普通/精英关的星)；返回 null 表示无变化 */
export function migrateStars(levels: Level[], stars: Record<string, number>): Record<string, number> | null {
  let nx: Record<string, number> | null = null;
  for (const l of levels) { const v = starOf(l, stars); if (v > (stars[l.id] ?? 0)) { nx ??= { ...stars }; nx[l.id] = v; } }
  return nx;
}
export const starOf = (l: Level, stars: Record<string, number>) => Math.max(stars[l.id] ?? 0, ...(l.aliases ?? []).map(a => stars[a] ?? 0));
export function isUnlocked(levels: Level[], i: number, stars: Record<string, number>) {
  if (levels[i]?.redirect) return true;   // 指向诗词关的卡片：总是可点（进入后按诗词关处理）
  let j = i - 1; while (j >= 0 && levels[j].redirect) j--;   // 跳过指向诗词关的卡片
  const p = levels[j];
  return j < 0 || p.unit !== levels[i].unit || p.volume !== levels[i].volume || starOf(p, stars) > 0;
}

/** 从单元文本解析「章/单元号」：'七上·第2章 有理数·2.2 数轴' → 第2章；'7A Unit 3 …' → Unit 3；'2.4 …' → 第2章；
    '三上·一 混合运算' → 一；解析不出返回 null（该小节单独成章） */
export function chapterOf(u?: string): { key: string; title: string } | null {
  if (!u) return null;
  const segs = splitDot(u);
  const body = segs.length > 1 && /[上下]$|必修|选修|纲要|^[\dA-Z]+[AB]$/.test(segs[0]) ? segs.slice(1) : segs;
  for (const sg of body) {
    let m = sg.match(/^专题\s*(\d+)/);
    if (m) return { key: '专题' + m[1], title: sg.replace(/\s*第[一二三四五六七八九十]+单元.*$/, '').trim() };
    m = sg.match(/^第([一二三四五六七八九十\d]+)([章单元课]+)/);
    if (m) return { key: '第' + (/\d/.test(m[1]) ? m[1] : String(cnNum(m[1]))) + m[2], title: sg.trim() };
    m = sg.match(/\bUnit\s*(\d+)/i);
    if (m) return { key: 'Unit' + m[1], title: sg.replace(/（.*$|\(.*$/, '').trim() };
    m = sg.match(/^(\d+)\.\d+/);
    if (m) return { key: '第' + m[1] + '章', title: '第' + m[1] + '章' };
    m = sg.match(/^([一二三四五六七八九十]+)[\s、]/);
    if (m) return { key: '第' + cnNum(m[1]) + '单元', title: sg.trim() };
  }
  return null;
}
const CN: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function cnNum(t: string) {
  if (t === '十') return 10;
  const m = t.match(/^([一二三四五六七八九]?)十([一二三四五六七八九]?)$/);
  if (m) return (m[1] ? CN[m[1]] : 1) * 10 + (m[2] ? CN[m[2]] : 0);
  return t.length === 1 ? CN[t] : NaN;
}
/** 单元排序键：中文/阿拉伯数字转成补零数字，使「二」排在「十」前、「2.10」排在「2.9」后 */
export function unitKey(u?: string) {
  return (u ?? '').replace(/[一二三四五六七八九十]+/g, m => { const n = cnNum(m); return isNaN(n) ? m : String(n).padStart(3, '0'); })
    .replace(/\d+/g, m => m.padStart(4, '0'));
}
