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
/** 把 emoji 去掉、符号读法友好化 */
export function speakable(t: string) {
  return t.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').replace(/[_＿]{2,}/g, '空格').replace(/？/g, '？ ').trim();
}
export function speak(text: string, lang = 'zh-CN') {
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = /^en/.test(lang) ? 'en-US' : 'zh-CN';
  if (u.lang === 'zh-CN' && zhVoice) u.voice = zhVoice;
  u.rate = 0.9; u.pitch = 1.1;
  synth.speak(u);
  // iOS Safari 偶发卡住：resume 兜底
  setTimeout(() => synth.resume(), 250);
}
let sfxCtx: AudioContext | null = null;
export const audioCtx = () => sfxCtx;
export function beep(good: boolean) {
  if (!sfxCtx) return;
  const o = sfxCtx.createOscillator(), g = sfxCtx.createGain();
  o.frequency.value = good ? 880 : 220; o.type = good ? 'triangle' : 'sawtooth';
  g.gain.setValueAtTime(0.08, sfxCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, sfxCtx.currentTime + 0.25);
  o.connect(g).connect(sfxCtx.destination); o.start(); o.stop(sfxCtx.currentTime + 0.25);
}
