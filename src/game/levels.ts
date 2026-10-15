/* 章节/关卡生成（GDD §7.1）：每个科目一个章节；按「册别 volume」顺序 + 源文件顺序，每 8 题 1 个普通关；
   关卡序列按 [普通,普通,普通,精英,普通,Boss] 循环。精英关题池=前 3 个普通关，Boss 关题池=自上个 Boss 以来所有普通关。
   不按 unit 文本分组（单元名会变）：unit 只用于册内排序和显示关卡名；关卡 id 取首题的 grade:id。 */
import type { Question } from './questions';
import type { LevelKind } from './grades';
export interface Level { id: string; chapter: string; index: number; kind: LevelKind; name: string; pool: string[] /* question keys */; volume: string }
export interface Chapter { subject: string; name: string; icon: string; levels: Level[]; volumes: string[]; count: number }
export const AREA: Record<string, [string, string]> = {
  数学: ['数之城', '🔢'], 语文: ['墨韵山', '🖌️'], 英语: ['星语港', '🔤'], 诗词: ['诗词江湖', '📜'], 历史: ['时光长廊', '⏳'],
  物理: ['力之塔', '🧲'], 化学: ['炼金工坊', '⚗️'], 科学: ['探索森林', '🔬'],
  数数: ['数数小路', '🍎'], 颜色形状: ['彩虹花园', '🌈'], 认识动物: ['动物农场', '🐮'], 生活常识: ['温馨小屋', '🏠'], 儿歌古诗: ['儿歌小河', '🎵'],
};
const PATTERN: LevelKind[] = ['normal', 'normal', 'normal', 'elite', 'normal', 'boss'];
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
    const chunks: Question[][] = [];
    for (let i = 0; i < list.length; i += CHUNK) chunks.push(list.slice(i, i + CHUNK));
    // 最后一块太少（<4）并入前一块
    if (chunks.length > 1 && chunks[chunks.length - 1].length < 4) chunks[chunks.length - 2].push(...chunks.pop()!);
    const levels: Level[] = [];
    let ci = 0, slot = 0, sinceBoss: Question[][] = [], recent: Question[][] = [];
    while (ci < chunks.length) {
      const kind = PATTERN[slot % PATTERN.length]; slot++;
      if (kind === 'normal') {
        const c = chunks[ci++]; sinceBoss.push(c); recent.push(c); if (recent.length > 3) recent.shift();
        levels.push({ id: `${subject}|N|${c[0].key}`, chapter: subject, index: levels.length + 1, kind, name: shortUnit(c[0].unit) || c[0].volume, pool: c.map(q => q.key), volume: c[0].volume });
      } else if (kind === 'elite') {
        const pool = recent.flat();
        levels.push({ id: `${subject}|E|${pool[0].key}`, chapter: subject, index: levels.length + 1, kind, name: '精英挑战', pool: pool.map(q => q.key), volume: pool[0].volume });
      } else {
        const pool = sinceBoss.flat(); sinceBoss = [];
        levels.push({ id: `${subject}|B|${pool[0].key}`, chapter: subject, index: levels.length + 1, kind, name: 'Boss 战', pool: pool.map(q => q.key), volume: pool[0].volume });
      }
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
/** 解锁：每章第 1 关开放；前一关 ≥1 星解锁下一关 */
export function isUnlocked(levels: Level[], i: number, stars: Record<string, number>) {
  return i === 0 || (stars[levels[i - 1].id] ?? 0) > 0;
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
