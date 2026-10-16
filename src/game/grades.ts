/* 年级 → 模式配置（GDD §2.2 / §2.8 / §4 / §8） */
import type { GradeKey, Question } from './questions';
export type Band = 'K' | 'G1' | 'G2' | 'G3' | 'J' | 'H';
export type LevelKind = 'normal' | 'elite' | 'boss';
export interface BandConfig {
  band: Band; label: string;
  theme: 'kinder' | 'g1' | 'std' | 'hs';
  chars: 'pups' | 'scifi';
  battle: 'kinder' | 'simple' | 'full';   // simple=答对后系统自动选攻击/闪避
  canFail: boolean;
  questions: Record<LevelKind, number>;
  autoTTS: boolean;          // 自动朗读题干
  optionSpeaker: boolean;    // 选项旁小喇叭（G1）
  manualTTS: boolean;        // 手动 🔊
  stats: 'std' | 'hs';
  dailyMinutes: { weekday: number; weekend: number };
  adaptive: { up: number; down: number; min: number; max: number };
}
export const BANDS: Record<Band, BandConfig> = {
  K:  { band: 'K',  label: '幼儿园', theme: 'kinder', chars: 'pups', battle: 'kinder', canFail: false, questions: { normal: 3, elite: 3, boss: 5 }, autoTTS: true, optionSpeaker: false, manualTTS: true, stats: 'std', dailyMinutes: { weekday: 15, weekend: 15 }, adaptive: { up: 4, down: 99, min: 1, max: 2 } },
  G1: { band: 'G1', label: '小学·启蒙', theme: 'g1', chars: 'pups', battle: 'simple', canFail: false, questions: { normal: 5, elite: 6, boss: 8 }, autoTTS: true, optionSpeaker: true, manualTTS: true, stats: 'std', dailyMinutes: { weekday: 30, weekend: 40 }, adaptive: { up: 3, down: 2, min: 1, max: 5 } },
  G2: { band: 'G2', label: '小学·进阶', theme: 'std', chars: 'pups', battle: 'full', canFail: true, questions: { normal: 6, elite: 7, boss: 10 }, autoTTS: false, optionSpeaker: false, manualTTS: true, stats: 'std', dailyMinutes: { weekday: 40, weekend: 60 }, adaptive: { up: 3, down: 2, min: 1, max: 5 } },
  G3: { band: 'G3', label: '小学·挑战', theme: 'std', chars: 'pups', battle: 'full', canFail: true, questions: { normal: 7, elite: 7, boss: 10 }, autoTTS: false, optionSpeaker: false, manualTTS: true, stats: 'std', dailyMinutes: { weekday: 40, weekend: 60 }, adaptive: { up: 3, down: 2, min: 1, max: 5 } },
  J:  { band: 'J',  label: '初中', theme: 'std', chars: 'pups', battle: 'full', canFail: true, questions: { normal: 6, elite: 7, boss: 10 }, autoTTS: false, optionSpeaker: false, manualTTS: true, stats: 'std', dailyMinutes: { weekday: 40, weekend: 60 }, adaptive: { up: 3, down: 2, min: 1, max: 5 } },
  H:  { band: 'H',  label: '高中', theme: 'hs', chars: 'scifi', battle: 'full', canFail: true, questions: { normal: 8, elite: 9, boss: 10 }, autoTTS: false, optionSpeaker: false, manualTTS: true, stats: 'hs', dailyMinutes: { weekday: 45, weekend: 90 }, adaptive: { up: 3, down: 2, min: 1, max: 5 } },
};
export function bandOf(g: GradeKey): Band {
  if (g.startsWith('K')) return 'K';
  const n = Number(g);
  return n <= 2 ? 'G1' : n <= 4 ? 'G2' : n <= 6 ? 'G3' : n <= 9 ? 'J' : 'H';
}
export const bandConfig = (g: GradeKey) => BANDS[bandOf(g)];
/** 可选的档案年级（有题库的年级） */
export const PROFILE_GRADES: GradeKey[] = ['K1', '1', '2', '3', '4', '5', '6', '7', '10'];

const READING_SUBJECTS = new Set(['语文', '英语', '历史', '道德与法治', '政治', '地理']);
export const isReading = (q: Question) => READING_SUBJECTS.has(q.subject) && q.question.replace(/\$[^$]*\$/g, 'x').length >= 40;
export const isCalc = (q: Question) => ['数学', '物理', '化学', '科学'].includes(q.subject) && (q.type === '填空' || /计算|求|多少|=\s*\?|＝/.test(q.question));
/**
 * 每题时限（秒），0 = 不限时。题目 time 字段优先。
 * G1 30；G2 25；G3 20（阅读类 40、计算 45）；初中 45（理科计算 60）；高中 90（理科计算 120）；幼儿园不限时
 */
/** 答题时限（策划 r7）：小班不限时；1–2 年级 40s；3–4 年级 30s；5–6 年级 25s；初一 25s；高一 30s。
    计算题、填空题 ×1.5；家长页「时限宽松」再 ×1.5（叠加）。多步题按每一小问计时（调用方按小问传入）。 */
export const BASE_LIMIT: Record<Band, number> = { K: 0, G1: 40, G2: 30, G3: 25, J: 25, H: 30 };
export const timePrefs = { lenient: false };
export function timeLimitFor(q: Question, band: Band, opts: { g1NoLimit?: boolean; lenient?: boolean } = {}): number {
  const base = BASE_LIMIT[band]; if (!base) return 0;
  if (band === 'G1' && opts.g1NoLimit) return 0;
  let t = base;
  if (isCalc(q) || q.type === '填空') t *= 1.5;
  if (opts.lenient ?? timePrefs.lenient) t *= 1.5;
  return Math.round(t);
}
