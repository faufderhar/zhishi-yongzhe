/* r15.4.2 技术QA P1-1：手机竖屏（短边 < 600 且竖着）时战斗 / 复习盖一层「请把手机横过来」。
   战斗状态保留（组件不卸载），计时暂停：战斗自己的倒计时走 usePauseOnHide 的暂停，App 的每日计时 / 收尾看 runtimeFlags.rotateLock()（r16.2 起不挂 window）。
   平板竖屏（短边 ≥ 600）不盖，走竖屏布局。小班：用小狗图 + 录音「请把手机横过来，就能接着玩啦」（zf_002 1.5 倍速，离线包里有）。 */
import { useEffect, useState, type ReactNode } from 'react';
import { speak } from '../tts';
import { ROTATE_K_TEXT } from '../game/playtime';
import { setRotateLock } from '../runtimeFlags';
export const PHONE_SHORT = 600;
export const isPhonePortrait = (w = typeof window !== 'undefined' ? window.innerWidth : 1024, h = typeof window !== 'undefined' ? window.innerHeight : 768) => h > w && Math.min(w, h) < PHONE_SHORT;
export function usePhonePortrait() {
  const [p, setP] = useState(() => isPhonePortrait());
  useEffect(() => { const f = () => setP(isPhonePortrait()); window.addEventListener('resize', f); window.addEventListener('orientationchange', f); screen.orientation?.addEventListener?.('change', f); f();
    return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); screen.orientation?.removeEventListener?.('change', f); }; }, []);
  return p;
}
export function RotateOverlay({ kinder, pic }: { kinder: boolean; pic?: ReactNode }) {
  useEffect(() => { setRotateLock(true); const t = kinder ? setTimeout(() => speak(ROTATE_K_TEXT, 'zh-CN', { prio: true }), 300) : null;
    return () => { setRotateLock(false); if (t) clearTimeout(t); }; }, [kinder]);
  return <div className={`rotate-overlay ${kinder ? 'kinder' : ''}`} data-testid="rotate-overlay" role="alertdialog" aria-label="请把手机横过来">
    {kinder && pic ? <div className="rotate-char">{pic}</div> : null}
    <div className="rotate-phone" aria-hidden>📱</div>
    <h2>请把手机横过来</h2>
    <p>{kinder ? '横过来就能接着玩啦' : '横屏才能看清题目和按钮，进度和计时都暂停了，横过来就接着玩'}</p>
    {kinder && <button className="kspeaker" aria-label="再听一遍" data-testid="rotate-replay" onClick={() => speak(ROTATE_K_TEXT, 'zh-CN', { prio: true })}>🔊</button>}
  </div>;
}
