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
export const markAlive = () => { try { sessionStorage.setItem('zy-alive', '1'); } catch { /* */ } };
export function launchCause(): { kind: 'sw' | 'discarded' | 'reload' | 'crash' | 'restore' | 'tab' | 'navigate'; detail?: string } {
  try {
    const a = JSON.parse(localStorage.getItem(RELOAD_LOG) ?? '[]'); const last = a.filter((x: { reason: string }) => !String(x.reason).startsWith('blocked:')).pop();
    if ((document as unknown as { wasDiscarded?: boolean }).wasDiscarded) return { kind: 'discarded' };
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (last && Date.now() - last.at < 15e3) { const r = String(last.reason); return { kind: /^(import-|undo-)/.test(r) ? 'restore' : r === 'tab-takeover' ? 'tab' : 'sw', detail: r }; }   // r14.1：恢复 / 撤销 / 接管标签页的刷新写明真实原因
    // r13：有些环境（SW 接管 / 部分安卓 WebView）拿不到 navigation 条目；同一个标签页里的重载 sessionStorage 还在，用它补判
    const alive = (() => { try { return sessionStorage.getItem('zy-alive') === '1'; } catch { return false; } })();
    const isRe = nav?.type === 'reload' || (nav?.type !== 'navigate' && nav?.type !== 'back_forward' && alive);
    if (!isRe) return { kind: 'navigate' };
    // r14：真正的「刷新」会先触发 pagehide；没有正常离开记录（或比最后一次心跳还早）= 页面崩溃 / 内存不足被系统重启
    const bye = Number(localStorage.getItem(BYE) ?? 0); const bt = JSON.parse(localStorage.getItem(BEAT) ?? 'null') as { screen: string; at: number } | null;
    if (bt && bye < bt.at) return { kind: 'crash', detail: bt.screen };
    return { kind: 'reload' };
  } catch { return { kind: 'navigate' }; }
}
/** r14：只有安全页面才允许游戏自己刷新；先把原因落盘再刷新 */
let safeNow = false; export const setSafeScreen = (v: boolean) => { safeNow = v; };
export function safeReload(reason: string, screen?: string) { if (!safeNow || (window as unknown as { __zyInactive?: boolean }).__zyInactive) { logReload('blocked:' + reason, screen); return false; } logReload(reason, screen); location.reload(); return true; }
/** r14：每次换页记心跳；正常离开（pagehide）记离开——下次启动时「重载但没有正常离开」= 页面崩溃/被系统杀掉，而不是有人刷新 */
const BEAT = 'zy.beat', BYE = 'zy.bye';
export const beat = (screen: string) => { try { localStorage.setItem(BEAT, JSON.stringify({ screen, at: Date.now() })); } catch { /* */ } };
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { try { localStorage.setItem(BYE, String(Date.now())); } catch { /* */ } });
let pending = false;
export const updatePending = () => pending;
export function setupSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const had = !!navigator.serviceWorker.controller;
  let reg: ServiceWorkerRegistration | undefined;
  const check = () => { void reg?.update().catch(() => {}); };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;   // 第一次安装接管，不算更新
    pending = true; window.dispatchEvent(new CustomEvent(UPDATE_READY, { detail: (sc?: string) => { safeReload('controllerchange', sc); } }));
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
      pending = true; window.dispatchEvent(new CustomEvent(UPDATE_READY, { detail: (sc?: string) => { safeReload('version.json:' + v.build, sc); } }));
    } catch { /* 离线 */ }
  };
  window.addEventListener('load', () => { void heal(); });
  // r14 较真家长：选文件 / 弹键盘 / 系统对话框会让页面短暂隐藏——60 秒内回来不算「切回前台」，不触发更新检查
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; } if (Date.now() - hiddenAt < 60e3) return; check(); void heal(); });
  setInterval(() => { check(); void heal(); }, 60 * 60e3);
}
