/* r15.4 录音退路：共用提示语（文字 → 提示语 id；manifest 键「p:id」）。只登记固定的句子；
   带变量的句子见 voiceLines.ts（按数据展开成固定句子；speak() 整句查不到时按句子拼接）。 */
import { GRACE_VOICE, SLEEPY_VOICE, TIMEUP_K_TEXT, ROTATE_K_TEXT, K_NOSTAR_TEXT, K_AGAIN_TEXT, K_NOSTAR_WHY, K_FIRST_LINE } from './playtime';
import { dynamicPrompts } from './voiceLines';
import { TERM_TEXT } from './kinderTerm';
export const VOICE_PROMPTS: Record<string, string> = {
  dui: '对', cuo: '错',
  retry: '再试试～', think: '嗯～再想想',
  praise1: '真棒！', praise2: '太厉害了！', praise3: '答对啦！', praise4: '你好聪明！',
  cloud_friend: '小乌云变成你的好朋友啦！', hold_pause: '按住不放就能暂停',
  tut_q1: '哪个是苹果？', tut_s2: '答对了，爱心亮起来啦！再来：哪个是小狗？', tut_s3: '听不清就点小喇叭再听一遍。哪个是红色的？', tut_q2: '哪个是小狗？', tut_q3: '哪个是红色的？', tut_done: '练习完成，开始闯关啦！',
  res_k0: '每道题都认真学会啦！下次试试第一次就答对哦', res_k1: '越来越棒啦！', res_k2: '太厉害啦！',
  back: '返回', back_grade: '返回选年级', stage_k: '幼儿园', grade_k1: '小班', stage_p: '小学', grade_1: '一年级', grade_2: '二年级',
  grace: GRACE_VOICE, sleepy: SLEEPY_VOICE, timeup_k: TIMEUP_K_TEXT,   // r15.4.1：小班时间到的结算页
  rotate_k: ROTATE_K_TEXT,   // r15.4.2：手机竖屏「请把手机横过来」
  res_k_done: K_NOSTAR_TEXT,   // r15.4.3 小萌新：小班没加星的结算页（r15.4.4 起只在今天第 3 次起）
  res_k_again: K_AGAIN_TEXT,   // r15.4.4：小班同一关今天第 2 次玩完
  res_k_why: K_NOSTAR_WHY,   // r16 小萌新：第 3 次不加星的原因
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`res_k_first_${i + 1}`, K_FIRST_LINE(i + 1)])),   // r16 小萌新：「自己答对 N 题」（幼儿园一关最多 5 题，留到 10）
  /* r17 D：小班期末庆祝关（录音 1.1 倍速，deploy.r17_term 声明的语速例外） */
  k_term1_intro: TERM_TEXT.intro[1], k_term2_intro: TERM_TEXT.intro[2], k_term1_end: TERM_TEXT.end[1], k_term2_end: TERM_TEXT.end[2],
  k_term1_medal: TERM_TEXT.medal[1], k_term2_medal: TERM_TEXT.medal[2], k_term_heart: TERM_TEXT.heart, k_term_retry: TERM_TEXT.retry,
  k_term1_sleep: TERM_TEXT.sleep[1], k_term2_sleep: TERM_TEXT.sleep[2],   // r17 策划：时间到 / 暂停超时（待录音：没录之前 TTS + 字幕）
  ...dynamicPrompts(),   // r15.4：小班带变量的句子（角色名、出发、技能、开心值、怪兽回家…）按数据展开；batch.py 用 --prompt-list 读导出的 JSON
};
/** speak() 用：文字 → id */
export const PROMPT_BY_TEXT: Record<string, string> = Object.fromEntries(Object.entries(VOICE_PROMPTS).map(([id, t]) => [t, id]));
