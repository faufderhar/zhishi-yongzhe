let unlocked = false;
let sfxCtx: AudioContext | null = null;
let zhVoice: SpeechSynthesisVoice | null = null;
const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
function pickVoice() {
  const vs = synth?.getVoices() ?? [];
  zhVoice = vs.find(v => /zh[-_]CN/i.test(v.lang)) ?? vs.find(v => /^zh/i.test(v.lang)) ?? null;
}
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
/* r15.4 安卓真机没声音（根因）：以前只在第一次 pointerdown 里建 AudioContext + 空朗读，并且只试一次。
   规范里触屏的 pointerdown 不算「用户激活」（只有 pointerup / touchend / click / keydown 算），安卓 Chrome 上
   这时建的 AudioContext 一直是 suspended，空朗读也被拒，之后再也不重试 → 音效全静音。桌面用鼠标，pointerdown 算激活，所以测不出来。
   现在：每次手势（pointerdown/pointerup/touchend/click/keydown）都检查，AudioContext 没在跑就 resume + 播一个静音样本，直到真正 running；
   朗读预热在第一个算激活的手势里做；切回前台也 resume。 */
let warmed = false;
const activating = (e?: Event) => !e || e.type !== 'pointerdown' || (e as PointerEvent).pointerType === 'mouse';
export function unlockAudio(e?: Event) {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!sfxCtx && AC) sfxCtx = new AC();
    if (sfxCtx && sfxCtx.state !== 'running') {
      void sfxCtx.resume().catch(() => {});
      const b = sfxCtx.createBuffer(1, 1, 22050), src = sfxCtx.createBufferSource(); src.buffer = b; src.connect(sfxCtx.destination); src.start(0);
    }
  } catch { /* */ }
  if (synth && !warmed && activating(e)) { warmed = true; unlocked = true; try { pickVoice(); const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch { /* */ } }
}
if (typeof window !== 'undefined') for (const t of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(t, ev => { if (ev.isTrusted && (!sfxCtx || sfxCtx.state !== 'running' || !warmed)) unlockAudio(ev); }, { capture: true, passive: true });
export const audioState = () => ({ ctx: sfxCtx?.state ?? 'none', warmed, unlocked, tts: ttsState, voices: synth?.getVoices().length ?? 0, zh: zhVoice?.lang ?? null });
/** r15.4：朗读出问题时通知界面（没有中文语音 / 被浏览器拦了），不再静悄悄失败 */
/* r15.4：每种问题本次打开只提示一次（不每题弹一次盖住题目）；提示条几秒后自己收起（App） */
const told = new Set<string>();
const notify = (kind: 'novoice' | 'blocked' | 'unavailable' | 'missing') => { if (told.has(kind)) return; told.add(kind); try { window.dispatchEvent(new CustomEvent('zy-tts-issue', { detail: kind })); } catch { /* */ } };
let noVoiceTold = false;
export const ttsSupported = () => !!synth;
/** 家长页「音效」「朗读」开关 + 音量（技术QA P3-4） */
export const audioPrefs = { sfx: true, tts: true, volume: 0.8 };
export function setAudioPrefs(p: Partial<typeof audioPrefs>) { Object.assign(audioPrefs, p); }
/** 有可用中文语音才显示 🔊（voices 异步加载，未加载完时先当有） */
/** 显示 🔊：系统朗读可能可用，或者有录音退路（点了没声音会出提示） */
export const hasVoice = () => audioPrefs.tts;
export const noZhVoice = () => !!synth && synth.getVoices().length > 0 && !zhVoice;
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { void sfxCtx?.resume().catch(() => {}); synth?.resume(); } });
/** 把 emoji 去掉、符号读法友好化 */
export function speakable(t: string) {
  // 公式段（$…$，\$ 为字面美元符号）不朗读，其余照读（技术QA P3-5）
  t = t.replace(/\\\$/g, '\u0000').replace(/\$[^$]*\$/g, ' ').replace(/\u0000/g, '美元');
  t = t.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').replace(/[_＿]{2,}/g, '空格').replace(/？/g, '？ ').trim();
  // r15.4.4：只有几何图形符号（▭ 等，U+25A0–25FF，不算 emoji）的选项和 🔺⚪ 一样不朗读（KC-028 选项「▭」）
  return /^[\u25A0-\u25FF\s]*$/.test(t) ? '' : t;
}
let speakingFlag = false;
/** 正在朗读（朗读时答题计时暂停，策划 r7） */
export const isSpeaking = () => audioPrefs.tts && (speakingFlag || !!synth?.speaking) && !(__TEST_HOOKS__ && typeof window !== 'undefined' && (window as unknown as { __zyTestNoTts?: boolean }).__zyTestNoTts);
/* r15.4 华为平板（华为浏览器 / 鸿蒙）：speechSynthesis 可能没有、没有中文语音、或 speak() 根本不开始。
   能力检测：没有 speechSynthesis → none；voiceschanged 后 / 2 秒后仍 0 个语音 → none；有语音但没有中文 → nozh；
   speak() 1.5 秒内没有 onstart → broken（本次会话不再用系统朗读）。
   退路：录音文件（public/voice/manifest.json：题号 / 文字 → 文件，按需加载，Service Worker 运行时缓存 zy-voice）；
   都没有 → 界面提示「这台平板暂时不能朗读」（zy-tts-issue 事件），不再静悄悄失败。 */
export type TtsState = 'unknown' | 'ok' | 'none' | 'nozh' | 'broken';
let ttsState: TtsState = !synth ? 'none' : 'unknown';
export const ttsStatus = () => ttsState;
if (synth) { const chk = () => { const n = synth.getVoices().length; if (n === 0) { if (ttsState === 'unknown') ttsState = 'none'; } else { pickVoice(); if (!zhVoice && (ttsState === 'unknown' || ttsState === 'none')) ttsState = 'nozh'; else if (zhVoice && ttsState === 'none') ttsState = 'unknown'; } };
  synth.addEventListener?.('voiceschanged', () => { pickVoice(); if (synth.getVoices().length) { if (ttsState === 'none') ttsState = 'unknown'; chk(); } }); setTimeout(chk, 2000); }
/* 录音规格（音频设计）：mp3 单声道 24 kHz 40 kbps，放 public/voice/（CREDITS.md 写来源 / 授权），由 /workspace/tts/batch.py 生成。
   题干和每个选项是单独的文件（点选项单独听）。文件本身带 50 ms 头 / 150 ms 尾静音，所以播放器只补：题干 → 选项 200 ms，选项之间 100 ms；
   同一题干的中英文分段：batch.py 合成在一个文件里（中间 120 ms）；如果 manifest 给的是分段文件数组，播放器在分段之间插 120 ms。
   常用提示语（答对、再试试…）共用文件。小班不再降 6 dB。
   manifest：items 的键 = 「题号#stem」「题号#optN」（N = 原始选项序号）「p:提示语 id」→ 文件名（相对 voice/，或分段文件名数组）；meta 只给生成脚本用。
   manifest 不存在 / 为空时照常工作（全部走系统朗读或提示）。 */
interface VoiceMan { items?: Record<string, string | string[]> }
let voiceMan: Promise<VoiceMan> | null = null;
const vbase = () => (typeof document !== 'undefined' ? (document.baseURI || '/') : '/').replace(/[^/]*$/, '');
export function voiceManifest() { return voiceMan ??= (typeof fetch === 'undefined' ? Promise.resolve({}) : fetch(vbase() + 'voice/manifest.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))).then(m => (m && typeof m === 'object' ? m : {}) as VoiceMan); }
export const VOICE_GAP_STEM_MS = 200, VOICE_GAP_OPT_MS = 100, VOICE_GAP_SEG_MS = 120;
export const voiceKey = (id: string, part: 'stem' | `opt${number}`) => `${id}#${part}`;
let recEl: HTMLAudioElement | null = null; let recSeq = 0; let recSrc: AudioBufferSourceNode | null = null;
/* r15.4：有已解锁的 AudioContext 时用 fetch + decodeAudioData 播（不发 Range 请求 → 整个 200 响应进 SW 缓存 zy-voice，离线也能播；
   停顿按毫秒准；和音效同一个已解锁的 context，不受 <audio> 自动播放限制）。没有 context 才退回 <audio>。 */
const bufCache = new Map<string, Promise<AudioBuffer | null>>();
const loadBuf = (url: string) => { const ctx = sfxCtx; if (!ctx || typeof fetch === 'undefined') return Promise.resolve(null); let p = bufCache.get(url); if (!p) { p = fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))).then(b => ctx.decodeAudioData(b)).then(d => { if (aLog) alog('decode', url, d.duration); return d; }).catch(() => { if (aLog) alog('decode-fail', url); bufCache.delete(url); return null; }); bufCache.set(url, p); if (bufCache.size > 60) bufCache.delete(bufCache.keys().next().value as string); } return p; };
const playEl = (url: string, my: number) => new Promise<boolean>(res => { if (my !== recSeq) return res(false); const el = new Audio(url); recEl = el; el.volume = audioPrefs.volume; el.onended = () => res(true); el.onerror = () => { if (aLog) alog('el-error', url); res(false); }; el.play().then(() => { if (aLog) alog('el-start', url); }, () => { if (aLog) alog('el-blocked', url); res(false); }); });
const playOne = async (url: string, my: number): Promise<boolean> => {
  if (my !== recSeq) return false;
  const ctx = sfxCtx; if (!ctx || ctx.state !== 'running') return playEl(url, my);
  const buf = await loadBuf(url); if (my !== recSeq) return false; if (!buf) return playEl(url, my);
  return new Promise<boolean>(res => { const src = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = audioPrefs.volume; src.buffer = buf; src.connect(g).connect(ctx.destination);
    recSrc = src; src.onended = () => { if (aLog) alog('end', url); if (recSrc === src) recSrc = null; res(true); }; recLog?.push({ url, t: performance.now(), dur: buf.duration }); src.start(); if (aLog) alog('start', url, buf.duration); });
};
const stopRec = () => { recEl?.pause(); try { recSrc?.stop(); } catch { /* */ } recSrc = null; };
/* 仅测试构建：记录每段录音开始的时间（r154-nosynth 量停顿） */
/* 仅测试构建（r15.4.2 小萌新）：每段录音的 解码 / 开始 / 结束（带 manifest 键和 AudioContext 状态），<audio> 退路的开始 / 失败 */
type ALog = { ev: string; key: string; url: string; t: number; state: string; dur?: number };
const aLog: ALog[] | null = __TEST_HOOKS__ && typeof window !== 'undefined' ? ((window as unknown as { __zyAudioLog?: ALog[] }).__zyAudioLog = []) : null;
const urlKey = new Map<string, string>();
const alog = (ev: string, url: string, dur?: number) => { aLog?.push({ ev, key: urlKey.get(url) ?? '', url: url.split('/').pop() ?? url, t: performance.now(), state: sfxCtx?.state ?? 'none', dur }); };
const recLog: { url: string; t: number; dur: number }[] | null = __TEST_HOOKS__ && typeof window !== 'undefined' ? ((window as unknown as { __zyRecLog?: { url: string; t: number; dur: number }[] }).__zyRecLog = []) : null;
/** 录音：按 manifest 键依次播放（键之间按规格插停顿）。一个都没有 → false */
let recHad = false;
export async function playRecorded(keys: string[], strict = false): Promise<boolean> {
  const it = (await voiceManifest()).items ?? {};
  if (strict && keys.some(k => !it[k])) return false;   // 拼接的句子：缺一段就不用录音（不读半句）
  const steps: { url: string; gap: number }[] = []; let prevKey = '';
  for (const k of keys) { const v = it[k]; const fs = (Array.isArray(v) ? v : v ? [v] : []).filter(f => typeof f === 'string' && f); if (!fs.length) continue;
    fs.forEach(f => { if (aLog) urlKey.set(vbase() + 'voice/' + f, k); }); fs.forEach((f, i) => steps.push({ url: vbase() + 'voice/' + f, gap: i ? VOICE_GAP_SEG_MS : !steps.length ? 0 : prevKey.endsWith('#stem') ? VOICE_GAP_STEM_MS : VOICE_GAP_OPT_MS })); prevKey = k; }
  if (!steps.length) return false;
  recHad = true;   // r15.4.2：有录音只是没放出来（多半是还没下载、又断网）→ 提示「联网后自动补全」而不是「安装语音引擎」
  const my = ++recSeq; stopRec(); speakingFlag = true;
  steps.forEach(st => { void loadBuf(st.url); });   // 先并行取 / 解码，后面按顺序播
  try { for (let i = 0; i < steps.length; i++) { if (steps[i].gap) await new Promise(r => setTimeout(r, steps[i].gap)); if (my !== recSeq) return true; const ok = await playOne(steps[i].url, my); if (my !== recSeq) return true; /* 被下一句打断不算失败 */ if (!ok && i === 0) return false; } return true; }
  finally { if (my === recSeq) speakingFlag = false; }
}
/** 共用提示语：文字 → 提示语 id（ui/voicePrompts 登记）；speak() 用文字查录音 */
let promptIds: Record<string, string> = {};
export const registerPrompts = (m: Record<string, string>) => { promptIds = { ...promptIds, ...m }; normIds = null; };
/* r15.4：整句没有录音时，按登记过的句子拼接（只看汉字 / 字母 / 数字，标点和表情不算）；必须整句都拼得上，否则不用录音 */
const norm = (t: string) => t.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, '');
let normIds: Map<string, string> | null = null;
function segmentKeys(text: string): string[] | null {
  if (!normIds) { normIds = new Map(); for (const [t, id] of Object.entries(promptIds)) { const n = norm(t); if (n && !normIds.has(n)) normIds.set(n, id); } }
  const s = norm(text); if (!s) return null; const n = s.length; const best: (string[] | null)[] = Array(n + 1).fill(null); best[0] = [];
  for (let i = 0; i < n; i++) { const cur = best[i]; if (!cur) continue; for (let j = n; j > i; j--) { const id = normIds.get(s.slice(i, j)); if (id && (!best[j] || best[j]!.length > cur.length + 1)) best[j] = [...cur, 'p:' + id]; } }
  return best[n];
}
const keysFor = (text: string, o: { id?: string; keys?: string[]; alt?: string[] }) => o.keys ?? (o.id ? [voiceKey(o.id, 'stem')] : promptIds[text] ? ['p:' + promptIds[text]] : promptIds[text.trim()] ? ['p:' + promptIds[text.trim()]] : segmentKeys(text) ?? []);
/* 测试构建：大多数浏览器测试把 speechSynthesis.speak 换成记录函数（不会触发 onstart），这时不做能力检测，照旧走系统朗读；
   专门的测试设 __zyTestTtsDetect 才走检测 / 退路 */
const testPlain = () => __TEST_HOOKS__ && typeof window !== 'undefined' && !!(window as unknown as { __zyTestNoTts?: boolean }).__zyTestNoTts && !(window as unknown as { __zyTestTtsDetect?: boolean }).__zyTestTtsDetect;
const canSystem = (lang: string) => testPlain() ? !!synth : !!synth && ttsState !== 'none' && ttsState !== 'broken' && !(ttsState === 'nozh' && !/^en/.test(lang));
/* r15.4.2 小萌新：重要提示（小班收尾「时间到啦，打完这关就休息哦」）用 prio：它播的时候，别的朗读（答对表扬、下一题题干）不打断它，
   而是等它播完再播最后那一句。以前孩子在横条出现的同时点了答案，表扬 / 下一题题干会把收尾提示切掉（录音 recSeq / 系统朗读 cancel）。 */
let prioBusy = false; let prioPending: (() => void) | null = null; let prioSeq = 0;
const prioDone = (my: number) => { if (my !== prioSeq || !prioBusy) return; prioBusy = false; const f = prioPending; prioPending = null; f?.(); };
export const prioState = () => ({ busy: prioBusy, pending: !!prioPending });
/** 朗读。o.id = 题号（有录音时用录音兜底）；o.prio = 重要提示，播完前别的朗读排队（只留最后一句） */
export function speak(text: string, lang = 'zh-CN', o: { id?: string; keys?: string[]; alt?: string[] /* keys 缺段时改放这几段 */; prio?: boolean } = {}) {
  if (!audioPrefs.tts) return;
  if (prioBusy && !o.prio) { prioPending = () => speak(text, lang, o); return; }
  const myPrio = o.prio ? ++prioSeq : 0; if (o.prio) { prioBusy = true; prioPending = null; setTimeout(() => prioDone(myPrio), 8000); }   // 兜底：最多挡 8 秒
  const endPrio = () => { if (myPrio) prioDone(myPrio); };
  const fallback = () => { recHad = false; void (o.alt ? playRecorded(keysFor(text, o), true).then(ok => ok || playRecorded(o.alt!)) : playRecorded(keysFor(text, o), !o.keys && !o.id)).then(ok => { endPrio(); if (!ok && __TEST_HOOKS__ && typeof window !== 'undefined') ((window as unknown as { __zyMissLog?: string[] }).__zyMissLog ??= []).push(text); if (!ok) notify(recHad ? 'missing' : ttsState === 'nozh' ? 'novoice' : 'unavailable'); }); };
  if (!canSystem(lang)) { fallback(); return; }
  synth!.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = /^en/.test(lang) ? 'en-US' : 'zh-CN';
  if (u.lang === 'zh-CN' && zhVoice) u.voice = zhVoice;
  u.rate = 0.9; u.pitch = 1.1; u.volume = audioPrefs.volume;
  if (!testPlain() && u.lang === 'zh-CN' && !zhVoice && synth!.getVoices().length > 0 && !noVoiceTold) { noVoiceTold = true; notify('novoice'); }
  let started = false;
  speakingFlag = true; const done = () => { speakingFlag = false; };
  u.onstart = () => { started = true; ttsState = 'ok'; };
  u.onend = () => { done(); endPrio(); }; u.onerror = (ev: SpeechSynthesisErrorEvent) => { done(); if (ev?.error === 'not-allowed') { notify('blocked'); endPrio(); } else if (!started && ev?.error !== 'interrupted' && ev?.error !== 'canceled') fallback(); else endPrio(); };
  synth!.speak(u);
  // iOS Safari 偶发卡住：resume 兜底
  setTimeout(() => synth!.resume(), 250);
  // 1.5 秒还没开始：系统朗读不可用（华为浏览器等），本次会话改用录音 / 提示
  if (!testPlain()) setTimeout(() => { if (!started && ttsState !== 'ok' && speakingFlag && document.visibilityState === 'visible' && warmed) { ttsState = 'broken'; synth!.cancel(); done(); fallback(); } }, 1500);
}
export const audioCtx = () => { if (sfxCtx && sfxCtx.state === 'suspended') void sfxCtx.resume().catch(() => {}); return sfxCtx; };
/** 小班答错：柔和的「咚」（不用刺耳锯齿波） */
export function softDong() {
  if (!audioCtx() || !sfxCtx || !audioPrefs.sfx) return;
  const o = sfxCtx.createOscillator(), g = sfxCtx.createGain();
  o.frequency.setValueAtTime(330, sfxCtx.currentTime); o.frequency.exponentialRampToValueAtTime(220, sfxCtx.currentTime + 0.3); o.type = 'sine';
  g.gain.setValueAtTime(0.1 * audioPrefs.volume, sfxCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, sfxCtx.currentTime + 0.35);
  o.connect(g).connect(sfxCtx.destination); o.start(); o.stop(sfxCtx.currentTime + 0.35);
}
export function beep(good: boolean) {
  if (!audioCtx() || !sfxCtx || !audioPrefs.sfx) return;
  const o = sfxCtx.createOscillator(), g = sfxCtx.createGain();
  o.frequency.value = good ? 880 : 220; o.type = good ? 'triangle' : 'sawtooth';
  g.gain.setValueAtTime(0.08 * audioPrefs.volume, sfxCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, sfxCtx.currentTime + 0.25);
  o.connect(g).connect(sfxCtx.destination); o.start(); o.stop(sfxCtx.currentTime + 0.25);
}

/* 仅测试构建：r154-nosynth 用来读音频状态、直接触发朗读 */
if (__TEST_HOOKS__ && typeof window !== 'undefined') Object.assign(window, { __zyAudio: audioState, __zySpeak: speak, __zyPrio: prioState });
