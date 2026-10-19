/* r15.4 小班录音：带变量的句子按数据展开成固定句子（提示语 id → 文字）。生成录音用 tests/voiceLines.test.ts 导出的
   /workspace/tts/prompts_dynamic.json（batch.py --prompt-list）；游戏里 speak() 按文字查到这些 id（整句或按句子拼接）。 */
import { PUPS } from './characters';
import { SKILL_DATA } from './skills.data';
import { KINDER_MON, KINDER_BOSS, kinderSkin } from './monsterSkin';
import { STAGES } from './stages';

export const KINDER_LOCK_VOICE = '还要先打赢前面的关，才能打开这一关哦';   // 小班：锁住的关卡，屏幕上写关名，朗读用这一句（关名不录音）
export const DEMO_PRE = '我来帮你看看！是', DEMO_POST = '哦！', DEMO_THIS = '我来帮你看看！是这个哦！';
export const KINDER_CLOUD = '小乌云';
/** r15.4.4 题库审核（小班读音复查 v2）：量词前的 2 读「两」——「开心值2个」会被读成 èr，朗读文字直接写「两个」 */
const cnCount = (n: number) => n === 2 ? '两' : String(n);
export const HAPPY_LINE = (lit: number, hearts: number) => `开心值${cnCount(lit)}个，一共${cnCount(hearts)}个。`;
/** r15.4.4 题库审核：没开放的年级，朗读不用书面的「敬请期待」，改成小朋友听得懂的话（按钮上的小字不变） */
export const SOON_LINE = (label: string) => `${label}还在准备中，快要来啦，等一等哦`;
export const HOME_LINE = (mon: string) => `${mon}变成你的好朋友，挥挥手回家啦！`;
/** 幼儿园会出现的怪兽：[id, 名字]（温和战斗的柔和版 + 普通关的小乌云 + r16 中班 Boss） */
export const kinderMons = (): [string, string][] => { const m = new Map<string, string>(); for (const sub of Object.keys(KINDER_MON)) { const k = kinderSkin(sub); if (k) m.set(k.id.replace(/^mon_/, '').replace(/_normal$/, ''), k.name); } m.set('cloud', KINDER_CLOUD);
  for (const b of KINDER_BOSS) m.set(b.id.replace(/^mon_/, '').replace(/_boss$/, ''), b.name);   // r16：中班专属 Boss（「X变成你的好朋友…」「X笑啦！」要录音）
  return [...m]; };

export function dynamicPrompts(): Record<string, string> {
  const P: Record<string, string> = {};
  for (const c of PUPS) { P['name_' + c.id] = c.name; P['go_' + c.id] = `${c.name}，出发！`; P['tut_hi_' + c.id] = `我是${c.name}！哪个是苹果？点一点苹果`; }
  P.map_kmon = '这里有小怪兽等你交朋友！'; P.lock_prev = '先打赢前一关，就能打开这一关哦'; P.lock_k = KINDER_LOCK_VOICE;
  for (const s of STAGES) { P['stage_' + s.id.toLowerCase()] = s.label;
    for (const g of s.grades) { if (g.grade) P['grade_' + g.key.toLowerCase()] = g.label; else P['soon_' + g.key.toLowerCase()] = SOON_LINE(g.label); } }
  for (let n = 1; n <= 20; n++) P['num_' + n] = String(n);
  P.demo_pre = DEMO_PRE; P.demo_post = DEMO_POST; P.demo_this = DEMO_THIS;
  for (const k of SKILL_DATA.filter(k => k.seg === 'K')) P['sk_' + k.id] = `${k.char}的${k.name}！`;
  for (let m = 1; m <= 5; m++) for (let n = 1; n <= m; n++) P[`happy_${n}_${m}`] = HAPPY_LINE(n, m);
  for (const [id, name] of kinderMons()) { P['home_' + id] = HOME_LINE(name); P['laugh_' + id] = `${name}笑啦！`; }
  return P;
}
