/* 章节/关卡生成（GDD §7.1）：每个科目一个章节（地图区域），区域内按「册别 volume + 教材单元 unit」分组；
   每单元每 8 题 1 个普通关，每 3 个普通关后 1 个精英关，单元 ≥12 题时以单元 Boss 收尾。
   关卡 id 取首题的 grade:id（不含单元文本，单元改名不影响星级）。 */
import type { Question } from './questions';
import type { LevelKind } from './grades';
export interface Level { id: string; chapter: string; index: number; kind: LevelKind; name: string; pool: string[] /* question keys */; volume: string; unit: string; aliases?: string[] /* 旧版关卡 id（合并前的小节 Boss），星级继承 */ }
export interface Chapter { subject: string; name: string; icon: string; levels: Level[]; volumes: string[]; count: number }
export const AREA: Record<string, [string, string]> = {
  数学: ['数之城', '🔢'], 语文: ['墨韵山', '🖌️'], 英语: ['星语港', '🔤'], 诗词: ['诗词江湖', '📜'], 历史: ['时光长廊', '⏳'],
  物理: ['力之塔', '🧲'], 化学: ['炼金工坊', '⚗️'], 科学: ['探索森林', '🔬'],
  数数: ['数数小路', '🍎'], 颜色形状: ['彩虹花园', '🌈'], 认识动物: ['动物农场', '🐮'], 生活常识: ['温馨小屋', '🏠'], 儿歌古诗: ['儿歌小河', '🎵'],
};
export const CHUNK = 8;
const SUBJECT_ORDER = ['数数', '颜色形状', '认识动物', '生活常识', '儿歌古诗', '数学', '语文', '英语', '诗词', '科学', '历史', '物理', '化学'];

export function shortUnit(u?: string) {
  if (!u) return '';
  const parts = u.split('·');
  return (parts[parts.length - 1] || u).replace(/^第[一二三四五六七八九十\d]+[单元章课节]\s*/, '').slice(0, 14);
}

/** volumes：已学册别（null = 全部）；volumeOrder：册别显示顺序 */
export function buildChapters(qs: Question[], volumes: string[] | null = null): Chapter[] {
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
    list.sort((a, b) => volOrder.indexOf(a.volume) - volOrder.indexOf(b.volume) || unitKey(a.unit).localeCompare(unitKey(b.unit)) || a.order - b.order);
    // 1) 先按「册别 + 单元原文」分成小节（与旧版完全相同 → 普通关 id 不变，星级不丢）
    const subs: { volume: string; units: string[]; qs: Question[] }[] = [];
    for (const q of list) {
      const last = subs[subs.length - 1];
      if (last && last.volume === q.volume && last.units[last.units.length - 1] === (q.unit ?? '')) last.qs.push(q);
      else subs.push({ volume: q.volume, units: [q.unit ?? ''], qs: [q] });
    }
    for (let i = subs.length - 1; i > 0; i--) if (subs[i].qs.length < 4 && subs[i - 1].volume === subs[i].volume) {
      subs[i - 1].qs.push(...subs[i].qs); subs[i - 1].units.push(...subs[i].units); subs.splice(i, 1);
    }
    if (subs.length > 1 && subs[0].qs.length < 4 && subs[1].volume === subs[0].volume) { subs[1].qs.unshift(...subs[0].qs); subs[1].units.unshift(...subs[0].units); subs.shift(); }
    // 2) 小节按「册别 + 章/单元号」合并成地图上的章节（2.1、2.2 → 第2章）；小节变成章内关卡顺序
    const groups: { volume: string; title: string; subs: typeof subs }[] = [];
    for (const sb of subs) {
      const ck = chapterOf(sb.units[0]); const last = groups[groups.length - 1];
      if (last && last.volume === sb.volume && ck && chapterOf(last.subs[0].units[0])?.key === ck.key) last.subs.push(sb);
      else groups.push({ volume: sb.volume, title: ck?.title || shortUnit(sb.units[0]) || sb.volume, subs: [sb] });
    }
    // 3) 每个小节每 8 题一个普通关；章内每 3 个普通关后加精英关；章 ≥12 题时以章节 Boss 收尾
    const levels: Level[] = [];
    for (const g of groups) {
      const meta = { volume: g.volume, unit: g.title };
      let recent: Question[][] = [];
      const all = g.subs.flatMap(x => x.qs);
      const normals: { c: Question[]; name: string }[] = [];
      for (const sb of g.subs) {
        const chunks: Question[][] = [];
        for (let i = 0; i < sb.qs.length; i += CHUNK) chunks.push(sb.qs.slice(i, i + CHUNK));
        if (chunks.length > 1 && chunks[chunks.length - 1].length < 4) chunks[chunks.length - 2].push(...chunks.pop()!);
        const nm = shortUnit(sb.units[0]) || sb.volume;
        chunks.forEach((c, k) => normals.push({ c, name: chunks.length > 1 ? `${nm} ${k + 1}` : nm }));
      }
      normals.forEach(({ c, name }, k) => {
        recent.push(c);
        levels.push({ id: `${subject}|N|${c[0].key}`, chapter: subject, index: levels.length + 1, kind: 'normal', name, pool: c.map(q => q.key), ...meta });
        if (recent.length === 3 && k < normals.length - 1) {
          const pool = recent.flat(); recent = [];
          levels.push({ id: `${subject}|E|${pool[0].key}`, chapter: subject, index: levels.length + 1, kind: 'elite', name: '精英挑战', pool: pool.map(q => q.key), ...meta });
        }
      });
      if (all.length >= 12) levels.push({ id: `${subject}|B|${all[0].key}`, chapter: subject, index: levels.length + 1, kind: 'boss', name: '章节 Boss', pool: all.map(q => q.key), ...meta,
        aliases: g.subs.filter((x, i) => i > 0 && x.qs.length >= 12).map(x => `${subject}|B|${x.qs[0].key}`) });
    }
    const [name, icon] = AREA[subject] ?? [subject + '之地', '⭐'];
    return { subject, name, icon, levels, volumes: volOrder, count: list.length };
  });
}
/** 上册 < 下册 < 通用 < 未标；其余按出现顺序 */
function volRank(v: string) {
  if (/上册|上$|第一册|7A|\(7A\)/.test(v)) return 1;
  if (/下册|下$|第二册|7B/.test(v)) return 2;
  if (/通用/.test(v)) return 3;
  if (/未标/.test(v)) return 9;
  return 5;
}

/** 星级（GDD §7.1）：★ 通关；★★ 正确率 ≥ 80%；★★★ 正确率 ≥ 80% 且没有用复活 */
export function starsFor(win: boolean, accuracy: number, revived: boolean): number {
  if (!win) return 0;
  if (accuracy >= 0.8) return revived ? 2 : 3;
  return 1;
}
/** 解锁：每个教材单元的第 1 关开放（孩子可从正在学的单元开始）；单元内前一关 ≥1 星解锁下一关 */
/** 某关星级：本 id 与旧 id 取最大 */
export const starOf = (l: Level, stars: Record<string, number>) => Math.max(stars[l.id] ?? 0, ...(l.aliases ?? []).map(a => stars[a] ?? 0));
export function isUnlocked(levels: Level[], i: number, stars: Record<string, number>) {
  const p = levels[i - 1];
  return i === 0 || p.unit !== levels[i].unit || p.volume !== levels[i].volume || starOf(levels[i - 1], stars) > 0;
}

/** 从单元文本解析「章/单元号」：'七上·第2章 有理数·2.2 数轴' → 第2章；'7A Unit 3 …' → Unit 3；'2.4 …' → 第2章；
    '三上·一 混合运算' → 一；解析不出返回 null（该小节单独成章） */
export function chapterOf(u?: string): { key: string; title: string } | null {
  if (!u) return null;
  const segs = u.split('·');
  const body = segs.length > 1 && /[上下]$|必修|选修|纲要|^[\dA-Z]+[AB]$/.test(segs[0]) ? segs.slice(1) : segs;
  for (const sg of body) {
    let m = sg.match(/^专题\s*(\d+)/);
    if (m) return { key: '专题' + m[1], title: sg.replace(/\s*第[一二三四五六七八九十]+单元.*$/, '').trim().slice(0, 18) };
    m = sg.match(/^第([一二三四五六七八九十\d]+)([章单元]+)/);
    if (m) return { key: '第' + (/\d/.test(m[1]) ? m[1] : String(cnNum(m[1]))) + m[2], title: sg.trim().slice(0, 18) };
    m = sg.match(/\bUnit\s*(\d+)/i);
    if (m) return { key: 'Unit' + m[1], title: sg.replace(/（.*$|\(.*$/, '').trim().slice(0, 24) };
    m = sg.match(/^(\d+)\.\d+/);
    if (m) return { key: '第' + m[1] + '章', title: '第' + m[1] + '章' };
    m = sg.match(/^([一二三四五六七八九十]+)[\s、]/);
    if (m) return { key: '第' + cnNum(m[1]) + '单元', title: sg.trim().slice(0, 18) };
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
