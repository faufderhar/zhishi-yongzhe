let unlocked = false;
let zhVoice: SpeechSynthesisVoice | null = null;
const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
function pickVoice() {
  const vs = synth?.getVoices() ?? [];
  zhVoice = vs.find(v => /zh[-_]CN/i.test(v.lang)) ?? vs.find(v => /^zh/i.test(v.lang)) ?? null;
}
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
/** 必须在用户手势（点击）回调内调用一次，iOS Safari 才允许后续朗读 */
export function unlockAudio() {
  if (unlocked || !synth) return;
  unlocked = true;
  const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u);
  try { const AC = (window as any).AudioContext || (window as any).webkitAudioContext; const ac = new AC(); ac.resume(); sfxCtx = ac; } catch {}
}
export const ttsSupported = () => !!synth;
/** 家长页「音效」「朗读」开关 + 音量（技术QA P3-4） */
export const audioPrefs = { sfx: true, tts: true, volume: 0.8 };
export function setAudioPrefs(p: Partial<typeof audioPrefs>) { Object.assign(audioPrefs, p); }
/** 有可用中文语音才显示 🔊（voices 异步加载，未加载完时先当有） */
export const hasVoice = () => !!synth && audioPrefs.tts && ((synth.getVoices().length === 0) || !!zhVoice);
export const noZhVoice = () => !!synth && synth.getVoices().length > 0 && !zhVoice;
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { void sfxCtx?.resume().catch(() => {}); synth?.resume(); } });
/** 把 emoji 去掉、符号读法友好化 */
export function speakable(t: string) {
  // 公式段（$…$，\$ 为字面美元符号）不朗读，其余照读（技术QA P3-5）
  t = t.replace(/\\\$/g, '\u0000').replace(/\$[^$]*\$/g, ' ').replace(/\u0000/g, '美元');
  return t.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').replace(/[_＿]{2,}/g, '空格').replace(/？/g, '？ ').trim();
}
let speakingFlag = false;
/** 正在朗读（朗读时答题计时暂停，策划 r7） */
export const isSpeaking = () => !!synth && audioPrefs.tts && (speakingFlag || synth.speaking) && !(__TEST_HOOKS__ && typeof window !== 'undefined' && (window as unknown as { __zyTestNoTts?: boolean }).__zyTestNoTts);
export function speak(text: string, lang = 'zh-CN') {
  if (!synth || !audioPrefs.tts) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = /^en/.test(lang) ? 'en-US' : 'zh-CN';
  if (u.lang === 'zh-CN' && zhVoice) u.voice = zhVoice;
  u.rate = 0.9; u.pitch = 1.1; u.volume = audioPrefs.volume;
  speakingFlag = true; const done = () => { speakingFlag = false; }; u.onend = done; u.onerror = done;
  synth.speak(u);
  // iOS Safari 偶发卡住：resume 兜底
  setTimeout(() => synth.resume(), 250);
}
let sfxCtx: AudioContext | null = null;
export const audioCtx = () => sfxCtx;
/** 小班答错：柔和的「咚」（不用刺耳锯齿波） */
export function softDong() {
  if (!sfxCtx || !audioPrefs.sfx) return;
  const o = sfxCtx.createOscillator(), g = sfxCtx.createGain();
  o.frequency.setValueAtTime(330, sfxCtx.currentTime); o.frequency.exponentialRampToValueAtTime(220, sfxCtx.currentTime + 0.3); o.type = 'sine';
  g.gain.setValueAtTime(0.1 * audioPrefs.volume, sfxCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, sfxCtx.currentTime + 0.35);
  o.connect(g).connect(sfxCtx.destination); o.start(); o.stop(sfxCtx.currentTime + 0.35);
}
export function beep(good: boolean) {
  if (!sfxCtx || !audioPrefs.sfx) return;
  const o = sfxCtx.createOscillator(), g = sfxCtx.createGain();
  o.frequency.value = good ? 880 : 220; o.type = good ? 'triangle' : 'sawtooth';
  g.gain.setValueAtTime(0.08 * audioPrefs.volume, sfxCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, sfxCtx.currentTime + 0.25);
  o.connect(g).connect(sfxCtx.destination); o.start(); o.stop(sfxCtx.currentTime + 0.25);
}
