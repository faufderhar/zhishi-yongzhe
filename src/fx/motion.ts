/* 动画开关：系统 prefers-reduced-motion + 应用内「减少动画」设置 */
const LS = 'zy.reduceMotion';
let appReduce = (() => { try { return localStorage.getItem(LS) === '1'; } catch { return false; } })();
const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const appReduceMotion = () => appReduce;
export const setAppReduceMotion = (b: boolean) => { appReduce = b; try { localStorage.setItem(LS, b ? '1' : '0'); } catch { /* */ } document.documentElement.classList.toggle('reduce-motion', reducedMotion()); };
export const reducedMotion = () => appReduce || !!mq?.matches;
mq?.addEventListener?.('change', () => document.documentElement.classList.toggle('reduce-motion', reducedMotion()));
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
/** WAAPI 动画（只用 transform / opacity），返回 Promise；减少动画时直接跳到结束 */
export function anim(el: Element | null | undefined, frames: Keyframe[], opts: KeyframeAnimationOptions & { duration: number }): Promise<void> {
  if (!el || !(el as HTMLElement).animate) return Promise.resolve();
  if (reducedMotion()) return Promise.resolve();
  const a = (el as HTMLElement).animate(frames, { easing: 'ease-out', ...opts });
  return a.finished.then(() => undefined, () => undefined);
}
if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduce-motion', reducedMotion());
