declare const __BUILD__: string;
/* r9 Service Worker 更新机制
   - 新 sw.js 自己 skipWaiting + clientsClaim（老页面 r1–r8 的代码不需要配合：下次打开就是新版）
   - updateViaCache:'none'：检查更新时不走 HTTP 缓存（GitHub Pages 统一 max-age=600，改不了响应头）
   - 启动、切回前台、每小时检查一次
   - 新 SW 接管后：只在安全页面（档案/学段/年级/地图）自动刷新；战斗中只记下，回到安全页面再刷新，并显示「有新版本」按钮 */
export const UPDATE_READY = 'zy-update-ready';
/** r12：每次由游戏自己发起的刷新都记原因（下次启动时能分辨「游戏更新刷新」和「浏览器回收 / 崩溃重载」） */
export const RELOAD_LOG = 'zy.reloadLog';
export function logReload(reason: string, screen?: string) { try { const a = JSON.parse(localStorage.getItem(RELOAD_LOG) ?? '[]'); a.push({ reason, screen, at: Date.now() }); localStorage.setItem(RELOAD_LOG, JSON.stringify(a.slice(-20))); } catch { /* */ } }
/** 启动时判断这次加载是怎么来的 */
export function launchCause(): { kind: 'sw' | 'discarded' | 'reload' | 'navigate'; detail?: string } {
  try {
    const a = JSON.parse(localStorage.getItem(RELOAD_LOG) ?? '[]'); const last = a[a.length - 1];
    if ((document as unknown as { wasDiscarded?: boolean }).wasDiscarded) return { kind: 'discarded' };
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (last && Date.now() - last.at < 15e3) return { kind: 'sw', detail: last.reason };
    return { kind: nav?.type === 'reload' ? 'reload' : 'navigate' };
  } catch { return { kind: 'navigate' }; }
}
let pending = false;
export const updatePending = () => pending;
export function setupSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const had = !!navigator.serviceWorker.controller;
  let reg: ServiceWorkerRegistration | undefined;
  const check = () => { void reg?.update().catch(() => {}); };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;   // 第一次安装接管，不算更新
    pending = true; window.dispatchEvent(new CustomEvent(UPDATE_READY, { detail: (sc?: string) => { logReload('controllerchange', sc); location.reload(); } }));
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(r => {
      reg = r; check();
      if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });   // 万一有等待中的新 SW
      r.addEventListener('updatefound', () => { const n = r.installing; n?.addEventListener('statechange', () => { if (n.state === 'installed' && r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' }); }); });
    }).catch(() => {});
  });
  // r10 自愈：不走缓存读 version.json，和本页构建号比对；不一致就检查 SW 更新，并在安全页面刷新（同一个新版本只自动刷新一次，防循环）
  const heal = async () => {
    try {
      const v = await (await fetch('version.json?t=' + Date.now(), { cache: 'no-store' })).json() as { build?: string };
      if (!v.build || v.build === __BUILD__) return;
      check(); const k = 'zy-heal-' + v.build;
      if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1');
      pending = true; window.dispatchEvent(new CustomEvent(UPDATE_READY, { detail: (sc?: string) => { logReload('version.json:' + v.build, sc); location.reload(); } }));
    } catch { /* 离线 */ }
  };
  window.addEventListener('load', () => { void heal(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { check(); void heal(); } });
  setInterval(() => { check(); void heal(); }, 60 * 60e3);
}
