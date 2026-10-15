/* 反馈：画面 + 声音必有；震动只在安卓（iPad 无 navigator.vibrate） */
import { beep, softDong } from './tts';
export const isAndroid = () => /Android/i.test(navigator.userAgent);
export function haptic(pattern: number | number[]) {
  try { if (isAndroid() && 'vibrate' in navigator) navigator.vibrate(pattern); } catch { /* ignore */ }
}
export function flash(kind: 'good' | 'bad') {
  const el = document.createElement('div');
  el.className = 'screen-flash ' + kind;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 450);
}
/** 统一答题反馈：画面闪 + 音效 + 安卓震动 */
export function answerFeedback(good: boolean) {
  flash(good ? 'good' : 'bad'); beep(good); haptic(good ? 30 : [60, 40, 60]);
}
/** 小班答错：无红闪、无失败音，只轻轻「咚」+ 短震（策划 D1） */
export function softBump() { softDong(); haptic(20); }
