/* r9 Service Worker 更新机制
   - 新 sw.js 自己 skipWaiting + clientsClaim（老页面 r1–r8 的代码不需要配合：下次打开就是新版）
   - updateViaCache:'none'：检查更新时不走 HTTP 缓存（GitHub Pages 统一 max-age=600，改不了响应头）
   - 启动、切回前台、每小时检查一次
   - 新 SW 接管后：只在安全页面（档案/学段/年级/地图）自动刷新；战斗中只记下，回到安全页面再刷新，并显示「有新版本」按钮 */
export const UPDATE_READY = 'zy-update-ready';
let pending = false;
export const updatePending = () => pending;
export function setupSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const had = !!navigator.serviceWorker.controller;
  let reg: ServiceWorkerRegistration | undefined;
  const check = () => { void reg?.update().catch(() => {}); };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;   // 第一次安装接管，不算更新
    pending = true; window.dispatchEvent(new CustomEvent(UPDATE_READY, { detail: () => location.reload() }));
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(r => {
      reg = r; check();
      if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });   // 万一有等待中的新 SW
      r.addEventListener('updatefound', () => { const n = r.installing; n?.addEventListener('statechange', () => { if (n.state === 'installed' && r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' }); }); });
    }).catch(() => {});
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 60 * 60e3);
}
