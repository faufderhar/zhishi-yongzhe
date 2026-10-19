import { isBossOnly, shuffle } from './questions';
import { STAR3, STAR2 } from './balance';
/* 章节/关卡生成（GDD §7.1）：每个科目一个章节（地图区域），区域内按「册别 volume + 教材单元 unit」分组；
   每单元每 8 题 1 个普通关，每 3 个普通关后 1 个精英关，单元 ≥12 题时以单元 Boss 收尾。
   关卡 id 取首题的 grade:id（不含单元文本，单元改名不影响星级）。 */
import type { Question } from './questions';
import type { LevelKind } from './grades';
/** 题库改版后旧关卡 id → 新关卡（按题池重合度生成，见 tools/level_aliases.md）；星级继承 */
import LEVEL_ALIASES from './levelAliases.json';
const ALIASES = LEVEL_ALIASES as Record<string, string[]>;
export interface Level { lesson?: string /* r13：所属小节（册别|单元原文），重新分关时按「小节 + 第几关」迁移星星 */; ord?: number; bossPool?: string[] /* r11：本单元 usage=boss 的题（只在 Boss 关，优先出） */; id: string; chapter: string; index: number; kind: LevelKind; name: string; pool: string[] /* question keys */; volume: string; unit: string; aliases?: string[] /* 旧版关卡 id（合并前的小节 Boss），星级继承 */; redirect?: string /* 语文题少的古诗课：卡片直接进同名诗词关 */; fresh?: string[] /* 精英关：生成时留给它、没分进前面普通关的题（策划 r7：精英先出没出现过的本课题） */; parts?: string[] /* 临时合并关：各课单独成关时的 id（得星时同时记到这些 id，拆回后星级保留） */ }
export interface Chapter { subject: string; name: string; icon: string; levels: Level[]; volumes: string[]; count: number }
export const AREA: Record<string, [string, string]> = {
  数学: ['数之城', '🔢'], 语文: ['墨韵山', '🖌️'], 英语: ['星语港', '🔤'], 诗词: ['诗词江湖', '📜'], 历史: ['时光长廊', '⏳'],
  物理: ['力之塔', '🧲'], 化学: ['炼金工坊', '⚗️'], 科学: ['探索森林', '🔬'],
  道德与法治: ['正义广场', '⚖️'], 生物: ['生命花园', '🧬'], 地理: ['山河地图', '🌏'], 政治: ['理想议事厅', '🏛️'],
  数数: ['数数小路', '🍎'], 颜色形状: ['彩虹花园', '🌈'], 认识动物: ['动物农场', '🐮'], 生活常识: ['温馨小屋', '🏠'], 儿歌古诗: ['儿歌小河', '🎵'],
};
export const CHUNK = 8;
/** r13 策划：小节分关 = ceil(题数 / 8) 关，题目平均分（12 → 6+6，20 → 7+7+6，13 → 7+6）。
    旧规则（r12 及以前）：每 8 题一关，最后一段 < 4 题并入前一段——会留下 4–5 题的尾关。旧规则只用来迁移星星。 */
export function splitLesson<T>(plain: T[], legacy = false): T[][] {
  if (!plain.length) return [[]];
  if (legacy) { const ch: T[][] = []; for (let i = 0; i < plain.length; i += CHUNK) ch.push(plain.slice(i, i + CHUNK)); if (ch.length > 1 && ch[ch.length - 1].length < 4) ch[ch.length - 2].push(...ch.pop()!); return ch; }
  // ceil(n/8) 在 9–11、17 题等情况下会分出 5 题的关，和「≥6 题的小节不出 <6 题的关」冲突：关数再以 floor(n/6) 封顶（至少 1 关）
  const n = Math.max(1, Math.min(Math.ceil(plain.length / CHUNK), Math.floor(plain.length / 6))), base = Math.floor(plain.length / n), extra = plain.length % n; const out: T[][] = []; let i = 0;
  for (let k = 0; k < n; k++) { const sz = base + (k < extra ? 1 : 0); out.push(plain.slice(i, i + sz)); i += sz; }
  return out;
}
let LEGACY_SPLIT = false;
const SUBJECT_ORDER = ['数数', '颜色形状', '认识动物', '生活常识', '儿歌古诗', '数学', '语文', '英语', '诗词', '科学', '历史', '道德与法治', '地理', '政治', '物理', '化学', '生物'];

/** 按「·」分段，但书名号《》里的不算 */
export function splitDot(u: string, parens?: boolean): string[] {
  const out: string[] = []; let cur = '', depth = 0;
  // r16：新年级（初二 / 高二路径）括号里的「·」也不拆（初二物理引言「走进物理世界（奇妙的物理现象·物理学与科技强国·体验科学探究）」）；
  // 旧年级保持原拆法（初一「基础积累（字词·病句）」、高一「拓展（课外·毛泽东诗词）」的章名 / 关名不变）
  const par = parens ?? /^(八[上下]|选择性必修)/.test(u);
  for (const ch of u) { if (ch === '《' || (par && ch === '（')) depth++; if (ch === '》' || (par && ch === '）')) depth = Math.max(0, depth - 1);
    if (ch === '·' && !depth) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out;
}
export function shortUnit(u?: string) {
  if (!u) return '';
  const parts = splitDot(u);   // 书名号 / 括号里的「·」（《清平乐·村居》）不拆
  return (parts[parts.length - 1] || u).replace(/^第[一二三四五六七八九十\d]+(?:单元|[章课节])\s*/, '');
}

/** volumes：已学册别（null = 全部）；volumeOrder：册别显示顺序 */
/** all：含不可玩题的全部题（用来找「可玩题为 0 的语文古诗课」，给它一张指向同名诗词关的卡片） */
export function buildChapters(qs0: Question[], volumes: string[] | null = null, all?: Question[]): Chapter[] {
  // r11：usage=boss 的题不进普通 / 精英题池，只挂到同科目、同册、同单元的 Boss 关（本册 Boss：同册）
  const qs = qs0.filter(q => !isBossOnly(q)); const bq = qs0.filter(isBossOnly);
  const build = (qs: Question[]): Chapter[] => ensureBoss(linkShortChinese(buildChapters0(qs, volumes), zeroCnLessons(qs, volumes, all)));
  const chs = build(qs);
  // r13：分关规则改了（平均分）——旧规则下同一小节第 k 个普通关 / 精英关的 id 记成新关的别名，星星按「小节 + 第几关」继承（只升不降，见 migrateStars / starOf）
  LEGACY_SPLIT = true; let old: Chapter[] = []; try { old = build(qs); } finally { LEGACY_SPLIT = false; }
  for (const ch of chs) { const oc = old.find(x => x.subject === ch.subject); if (!oc) continue;
    const key = (l: Level) => `${l.kind}|${l.lesson}|${l.ord}`; const om = new Map(oc.levels.filter(l => l.lesson != null).map(l => [key(l), l.id]));
    for (const l of ch.levels) { if (l.lesson == null) continue; const oid = om.get(key(l)); if (oid && oid !== l.id && !(l.aliases ?? []).includes(oid)) l.aliases = [...(l.aliases ?? []), oid]; } }
  if (bq.length) {
    // 单元名按正常建关的方式算：带上 Boss 题再建一次，看它本来会落在哪一关（科目 / 册 / 单元）
    const home = new Map<string, string>(); const bset = new Set(bq.map(q => q.key));
    for (const ch of build(qs0)) for (const l of ch.levels) if (l.kind !== 'boss') for (const k of l.pool) if (bset.has(k)) home.set(k, `${ch.subject}|${l.volume}|${l.unit}`);
    for (const ch of chs) for (const l of ch.levels) if (l.kind === 'boss') {
    const vb = l.id.includes('|VB|'); const ks = bq.filter(q => { const h = home.get(q.key); return !!h && (vb ? h.startsWith(`${ch.subject}|${l.volume}|`) : h === `${ch.subject}|${l.volume}|${l.unit}`); }).map(q => q.key);
    if (ks.length) l.bossPool = ks;
  } }
  return chs;
}
/** 学霸全解锁报告 #4：单元都不满 12 题的学科（如高一政治、五年级英语、诗词）原来没有 Boss。
    整个学科一个 Boss 都没有时，每册加一个「本册 Boss」（≥8 题），题池为本册全部题，放在本册最后一关之后（前一关得星解锁） */
export function ensureBoss(chs: Chapter[]): Chapter[] {
  for (const ch of chs) {
    if (ch.levels.some(l => l.kind === 'boss')) continue;
    const vols = [...new Set(ch.levels.map(l => l.volume))];
    for (const v of vols) {
      const ls = ch.levels.filter(l => l.volume === v && !l.redirect); const pool = [...new Set(ls.flatMap(l => l.pool))];
      if (ls.length < 2 || pool.length < 8) continue;
      const last = ls[ls.length - 1];
      ch.levels.splice(ch.levels.indexOf(last) + 1, 0, { id: `${ch.subject}|VB|${pool[0]}`, chapter: ch.subject, index: 0, kind: 'boss', name: '本册 Boss', pool, volume: v, unit: last.unit });
    }
    ch.levels.forEach((l, i) => { l.index = i + 1; });
  }
  return chs;
}
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
    const fs = (q: Question) => firstSeen.get(q.volume + '|' + (q.unit ?? ''))!;
    const bankOrder = BANK_ORDER_GRADES.has(list[0]?.grade ?? '');
    list.sort((a, b) => {
      const v = volOrder.indexOf(a.volume) - volOrder.indexOf(b.volume); if (v) return v;
      if (bankOrder) return (fs(a) - fs(b)) || a.order - b.order;   // r16：中班 / 初二 / 高二 册内小节按题库顺序（配合说明 v35–v41）
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
    const groups: { volume: string; title: string; subs: typeof subs; tag?: string }[] = [];
    for (const sb of subs) {
      const ck = chapterOf(sb.units[0]); const last = groups[groups.length - 1];
      if (last && last.volume === sb.volume && ck && chapterOf(last.subs[0].units[0])?.key === ck.key) last.subs.push(sb);
      else groups.push({ volume: sb.volume, title: ck?.title || shortUnit(sb.units[0]) || sb.volume, subs: [sb] });
    }
    // r16：同一科目里无章号、同名的章（高二诗词「古诗词诵读」选必上 / 选必中）标出册别，避免两章、两组关卡同名
    if (bankOrder) {
      const vols = new Map<string, Set<string>>();
      for (const g of groups) if (!chapterOf(g.subs[0].units[0])) (vols.get(g.title) ?? vols.set(g.title, new Set()).get(g.title)!).add(g.volume);
      for (const g of groups) if ((vols.get(g.title)?.size ?? 0) > 1) { g.tag = `（${volShort(g.volume)}）`; g.title += g.tag; }
    }
    // 3) 每个小节每 8 题一个普通关；章内每 3 个普通关后加精英关；章 ≥12 题时以章节 Boss 收尾
    const levels: Level[] = [];
    for (const g of groups) g.subs = mergeSmallLessons(subject, g.subs);
    for (const g of groups) {
      const meta = { volume: g.volume, unit: g.title };
      let recent: Question[][] = []; let reserved: Question[] = [];
      const all = g.subs.flatMap(x => x.qs);
      const normals: { c: Question[]; name: string; sub: number; res?: Question[] }[] = [];
      for (const [si, sb] of g.subs.entries()) {
        const chunks: Question[][] = [];
        // r8：多选题属于整个小节：先不参与分段，再加进本小节每个普通关的题池（是否出、出几道由战斗按回合规则定）
        const plain = sb.qs.filter(q => q.type !== '多选');
        chunks.push(...splitLesson(plain, LEGACY_SPLIT));
        const nm = sb.units.map(u => shortUnit(u) || sb.volume).join(' + ') + (g.tag ?? '');
        chunks.forEach((c, k) => normals.push({ c, name: chunks.length > 1 ? `${nm} ${k + 1}` : nm, sub: si }));
      }
      // 精英关只取本小节（同一课）的题，不跨课（策划 r6 裁定 2）：同一小节每 3 个普通关后 1 个精英关
      // 策划 r7：每组 3 个普通关后的精英关要有「前面普通关没出现过」的题：从组内每个 ≥6 题的普通关末尾留 2 道给精英（普通关 id 用首题，不变）
      for (let k = 0; k + 2 < normals.length; k++) {
        const grp = normals.slice(k, k + 3); if (grp.some(x => x.sub !== grp[0].sub)) continue;
        const first = normals.findIndex(x => x.sub === grp[0].sub); if ((k - first) % 3 !== 0 || k + 2 >= normals.length - 1) continue;
        // r13 策划：普通关至少 6 题——每关最多留 2 道给精英，但留完不少于 6 题
        for (const x of grp) { const r = Math.min(2, x.c.length - 6); if (r > 0) x.res = x.c.splice(x.c.length - r, r); }
      }
      normals.forEach(({ c, name, sub, res }, k) => {
        if (k > 0 && normals[k - 1].sub !== sub) { recent = []; reserved = []; }
        if (res) reserved.push(...res);
        recent.push(c);
        const parts = g.subs[sub].parts;
        const lm = g.subs[sub].qs.filter(q => q.type === '多选'); const c0 = c[0] ?? lm[0];
        const lesson = `${g.volume}|${g.subs[sub].units.join('+')}`, ord = normals.slice(0, k).filter(x => x.sub === sub).length;
        levels.push({ id: `${subject}|N|${c0.key}`, chapter: subject, index: levels.length + 1, kind: 'normal', name, pool: [...c, ...lm].map(q => q.key), ...meta, lesson, ord,
          ...(parts && k === normals.findIndex(x => x.sub === sub) ? { parts: parts.filter(x => x !== `${subject}|N|${c0.key}`), aliases: parts.filter(x => x !== `${subject}|N|${c0.key}`) } : {}) });
        if (recent.length === 3 && k < normals.length - 1) {
          const pool = [...reserved, ...recent.flat()]; const id0 = recent[0][0].key; const fresh = reserved.map(q => q.key); recent = []; reserved = [];
          const eord = levels.filter(x => x.kind === 'elite' && x.lesson === lesson).length;
          levels.push({ id: `${subject}|E|${id0}`, chapter: subject, index: levels.length + 1, kind: 'elite', name: '精英挑战', pool: pool.map(q => q.key), ...meta, lesson, ord: eord, ...(fresh.length ? { fresh } : {}) });
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
/** 上册 < 下册 < 第三册 < 通用 < 未标；其余按出现顺序 */
/** r16：这些年级册内按题库顺序排小节（旧年级保持原排序，地图 / 解锁顺序不变） */
export const BANK_ORDER_GRADES = new Set(['K2', '8', '11']);
/** 册别短名：选择性必修上册 → 选必上，选择性必修第一册 → 选必一 */
export const volShort = (v: string) => v.replace(/^选择性必修/, '选必').replace(/^必修/, '必修').replace(/第([一二三四])册$/, '$1').replace(/册$/, '');
export function volRank(v: string) {
  // r16 高二（设计 R-3）：必修四 → 选必一 / 上 → 选必二 / 中 → 选必三 / 下（须在通用规则之前，否则「选择性必修第一册」被当成上册）
  if (/^必修第四册$/.test(v)) return 0.8;
  if (/^选择性必修(第一册|上册)$/.test(v)) return 1.1;
  if (/^选择性必修(第二册|中册)$/.test(v)) return 1.2;
  if (/^选择性必修(第三册|下册)$/.test(v)) return 1.3;
  if (/上册|上$|第一册|7A|\(7A\)/.test(v)) return 1;
  if (/下册|下$|第二册|7B/.test(v)) return 2;
  if (/第三册/.test(v)) return 2.5;   // r15.4.4 题库 v32：政治必修3（必修第三册）排在第二册之后、通用 / 拓展复习之前
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
/** r10 R9-3：轮流回合（小学 3–6、初一、高一）按 D14 */
export const STAR_RULES_ROUND = '⭐ 过关　⭐⭐ 答对六成　⭐⭐⭐ 答对八成、没复活、剩一半血以上';
export const STAR_RULES_K = '⭐ 过关　⭐⭐ 第一次就答对六成　⭐⭐⭐ 第一次就答对八成';
/** r12（策划）：怪物撤退时正确率 ≥ 40%（半对算 0.5）才算通关，最多 ★ */
export const RETREAT_CLEAR = 0.4;
export const retreatCleared = (r: { correct: number; total: number }) => !!r.total && r.correct / r.total >= RETREAT_CLEAR - 1e-9;
/** r15.2（用户 + 策划）：初一普通关 ★★★ 还要至少答对 1 道挑战题；挑战按钮整关一直灰着就不要求（chalNeed=false）。精英 / Boss / 其他年级不变 */
export const CHAL_STAR_HINT = '答对一道挑战题就能拿 3 星';
export const chalMissing = (r: { chalNeed?: boolean; chalRight?: number }) => !!r.chalNeed && !(r.chalRight ?? 0);
export function levelStars(r: { win: boolean; correct: number; total: number; revived: boolean; retreat?: boolean; timeUp?: boolean; hpPct?: number; chalNeed?: boolean; chalRight?: number }) {
  if (r.timeUp) return 0;
  if (r.retreat && !retreatCleared(r)) return 0;   // r12：撤退且正确率 < 40% 不算通关
  const s0 = starsFor(r.win, r.total ? r.correct / r.total : 0, r.revived, r.hpPct ?? 1);
  const s = s0 === 3 && chalMissing(r) ? 2 : s0;
  return r.retreat ? Math.min(1, s) : s;
}
/** 结算页：是不是只因为没答对挑战题才从 3 星变 2 星 */
export const chalCostStar = (r: Parameters<typeof levelStars>[0]) => levelStars(r) === 2 && levelStars({ ...r, chalNeed: false }) === 3;
/** Boss 选题池（裁定 2）：整章题，优先「还没出过」和「之前答错」的题；不够才重复已答对过的 */
/** 精英关选题（策划 r7）：先出生成时留给精英、且没出现过的题，再出本课其它没出现过的，再出答错过的；不够才重复 */
export function elitePool<T extends { key: string }>(pool: T[], fresh: string[] = [], seen: Set<string>, wrong: Set<string>, n: number, assigned: Set<string> = new Set(), rnd?: () => number): T[] {
  const f = new Set(fresh);
  const a = pool.filter(q => f.has(q.key) && !seen.has(q.key));
  const b = pool.filter(q => !f.has(q.key) && !seen.has(q.key) && !assigned.has(q.key));
  // r14 策划：没见过的用完 → 以前答错的 → 以前见过的（不强求 6 道新题）
  const b2 = pool.filter(q => !f.has(q.key) && !seen.has(q.key) && assigned.has(q.key));
  /* r15.3 小萌新：以前这里按题池原顺序截取——题全见过后，每局永远是同样的前 n 道。传 rnd 时同一组内随机 */
  const mix = (xs: T[]) => rnd ? shuffle(xs, rnd) : xs;
  const c = mix(pool.filter(q => seen.has(q.key) && wrong.has(q.key)));
  const d = mix(pool.filter(q => seen.has(q.key) && !wrong.has(q.key)));
  const un = [...a, ...b, ...b2]; return un.length >= n ? un : [...un, ...[...c, ...d].slice(0, n - un.length)];
}
/** r15.3 学霸 / 小萌新：普通关开局候选 = 整个小节（规则 C）。名次：本关没见过 0 → 同小节其他关没见过 1 → 本关答错 2 → 同小节答错 3 → 本关见过 4 → 同小节见过 5；
 *  同名次内由 selectQuestions 随机。以前只用本关题池、且见过的题按原顺序截取：题全见过后每局同一批题，同小节其他关没见过的题反而排在后面 */
export function lessonRank(levelKeys: Set<string>, seen: Set<string>, wrong: Set<string>) {
  return (q: { key: string }) => (!seen.has(q.key) ? 0 : wrong.has(q.key) ? 2 : 4) + (levelKeys.has(q.key) ? 0 : 1);
}
/** 本单元在 level 之前的关卡（按生成顺序）已分到的题 */
export function assignedBefore(levels: Level[], level: Level): Set<string> {
  const out = new Set<string>(); for (const l of levels) { if (l.id === level.id) break; if (l.volume === level.volume && l.unit === level.unit) l.pool.forEach(k => out.add(k)); } return out;
}
/** 多选题每关最多 2 道（策划 r7，题库加多选题后生效）：多出的换成同池非多选题 */
export function capMulti<T extends { key: string; type: string }>(qs: T[], pool: T[], cap = 2): T[] {
  let m = 0; const used = new Set(qs.map(q => q.key)); const spare = pool.filter(q => q.type !== '多选' && !used.has(q.key));
  const out: T[] = [];
  for (const q of qs) { if (q.type === '多选' && ++m > cap) { const r = spare.shift(); if (r) out.push(r); continue; } out.push(q); }
  return out;
}
export function bossPool<T extends { key: string }>(pool: T[], seen: Set<string>, wrong: Set<string>, n: number, freshFirst: Set<string> = new Set()): T[] {
  const fresh = pool.filter(q => !seen.has(q.key)).sort((x, y) => +freshFirst.has(y.key) - +freshFirst.has(x.key)), bad = pool.filter(q => seen.has(q.key) && wrong.has(q.key));
  const pref = [...fresh, ...bad];
  return pref.length >= n ? pref : [...pref, ...pool.filter(q => !pref.includes(q))];
}
/** D14：★★★ = 答对率 ≥ 80%、没复活、剩余血量 ≥ 50%（hpPct 只有轮流回合战斗会传；其余模式按满血） */
export function starsFor(win: boolean, accuracy: number, revived: boolean, hpPct = 1): number {
  if (!win) return 0;
  if (accuracy >= STAR3.acc - 1e-9) return revived || hpPct < STAR3.hp - 1e-9 ? 2 : 3;
  if (accuracy >= STAR2.acc - 1e-9) return 2;
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
/** r14.1 学霸：锁着的关还差哪些前置关（同一单元里前面所有没打出星的普通关 / 精英关） */
export function missingPrereqs(levels: Level[], i: number, stars: Record<string, number>): Level[] {
  const out: Level[] = [];
  for (let j = i - 1; j >= 0; j--) { const p = levels[j]; if (p.unit !== levels[i].unit || p.volume !== levels[i].volume) break; if (p.redirect) continue; if (starOf(p, stars) <= 0) out.unshift(p); }
  return out;
}
export function isUnlocked(levels: Level[], i: number, stars: Record<string, number>) {
  if (levels[i]?.redirect) return true;   // 指向诗词关的卡片：总是可点（进入后按诗词关处理）
  let j = i - 1; while (j >= 0 && levels[j].redirect) j--;   // 跳过指向诗词关的卡片
  const p = levels[j];
  if ((stars[levels[i].id] ?? 0) > 0) return true;   // r14：这一关自己打出过星（不是继承的）就算开着
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
