import { isInactive } from './runtimeFlags';
declare const __BUILD__: string;
/* r9 Service Worker 更新机制
   - 新 sw.js 自己 skipWaiting + clientsClaim（老页面 r1–r8 的代码不需要配合：下次打开就是新版）
   - updateViaCache:'none'：检查更新时不走 HTTP 缓存（GitHub Pages 统一 max-age=600，改不了响应头）
   - 启动、切回前台、每小时检查一次
   - r17.3（学霸 r17.2.1：页开着跨发版 20 秒+ 无更新条）：页面可见时每 5 分钟检查一次（替代每小时）；focus / online / pageshow 也检查，限 1 次/分钟
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
export function safeReload(reason: string, screen?: string) { if (!safeNow || isInactive()) { logReload('blocked:' + reason, screen); return false; } logReload(reason, screen); location.reload(); return true; }
/** r14：每次换页记心跳；正常离开（pagehide）记离开——下次启动时「重载但没有正常离开」= 页面崩溃/被系统杀掉，而不是有人刷新 */
const BEAT = 'zy.beat', BYE = 'zy.bye';
export const beat = (screen: string) => { try { localStorage.setItem(BEAT, JSON.stringify({ screen, at: Date.now() })); } catch { /* */ } };
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { try { localStorage.setItem(BYE, String(Date.now())); } catch { /* */ } });
/** r17.2.1：新 SW 接管计数。version.json 先发现新版时新 SW 可能还没装好——这时刷新，旧 SW 会用旧预缓存（旧题库）喂新页面。
    所以先等新 SW 接管（controllerchange），最多等 ms 毫秒，再刷新 */
let ctlGen = 0; export const controllerGen = () => ctlGen;
type SWC = Pick<ServiceWorkerContainer, 'addEventListener' | 'removeEventListener'>;
export function waitForController(sinceGen: number, ms = 8000, sw: SWC | undefined = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined): Promise<boolean> {
  if (ctlGen !== sinceGen || !sw) return Promise.resolve(ctlGen !== sinceGen);
  return new Promise(res => {
    const done = (v: boolean) => { clearTimeout(t); sw.removeEventListener('controllerchange', on); res(v); };
    const on = () => done(true); const t = setTimeout(() => done(false), ms);
    sw.addEventListener('controllerchange', on);
  });
}
/** r17.3：页面可见时的轮询间隔（5 分钟；隐藏时不轮询，切回前台另有 visibilitychange 检查）。测试构建可用 window.__zyUpdatePollMs 缩短 */
export const UPDATE_POLL_MS = 5 * 60e3;
/** r17.3：focus / online / pageshow 触发的检查最多 1 次/分钟 */
export const NUDGE_MIN_GAP_MS = 60e3;
/** r17.3：检查节流器。kick(force) = 启动 / 轮询 / 切回前台（照旧不受限）；nudge = focus / online / pageshow（距上次检查 < minGap 就跳过） */
export function makeUpdateTrigger(run: (why: string) => void, minGap = NUDGE_MIN_GAP_MS, now: () => number = Date.now) {
  let last = -Infinity;
  const kick = (why: string) => { last = now(); run(why); };
  const nudge = (why: string) => { if (now() - last < minGap) return false; kick(why); return true; };
  return { kick, nudge };
}
let healWaiting = false;
let pending = false;
export const updatePending = () => pending;
export function setupSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const had = !!navigator.serviceWorker.controller;
  let reg: ServiceWorkerRegistration | undefined;
  const check = () => { void reg?.update().catch(() => {}); };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    ctlGen++;
    if (!had || healWaiting) return;   // r17.2.1：自愈那边正在等这次接管，它自己会刷新（不再弹第二个更新）   // 第一次安装接管，不算更新
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
      const gen = ctlGen;
      // r17.2.1：点更新条 / 自动刷新时，先让新 SW 装好并接管（最多 8 秒），再刷新——刷新后的页面和题库都来自新 SW
      const go = async (sc?: string) => {
        if (healWaiting) return false; healWaiting = true;
        try { check(); reg?.waiting?.postMessage({ type: 'SKIP_WAITING' }); const got = await waitForController(gen); return safeReload('version.json:' + v.build + (got ? '' : ':no-sw'), sc); }
        finally { healWaiting = false; }
      };
      pending = true; window.dispatchEvent(new CustomEvent(UPDATE_READY, { detail: go }));
    } catch { /* 离线 */ }
  };
  // r14 较真家长：选文件 / 弹键盘 / 系统对话框会让页面短暂隐藏——60 秒内回来不算「切回前台」，不触发更新检查
  const trig = makeUpdateTrigger(() => { check(); void heal(); });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; } if (Date.now() - hiddenAt < 60e3) return; trig.kick('visible'); });
  // r17.3：页开着跨发版——可见时每 5 分钟查一次（以前只有每小时，孩子一直开着页面就要等很久才看到「有新版本」）
  const testPoll = __TEST_HOOKS__ ? Number((window as unknown as { __zyUpdatePollMs?: number }).__zyUpdatePollMs) || 0 : 0;
  setInterval(() => { if (document.visibilityState === 'visible') trig.kick('poll'); }, testPoll > 0 ? testPoll : UPDATE_POLL_MS);
  for (const ev of ['focus', 'online', 'pageshow'] as const) window.addEventListener(ev, () => { trig.nudge(ev); });
  window.addEventListener('load', () => { trig.kick('load'); });   // 启动检查（自愈 version.json）；记下时间：紧跟着的 pageshow / focus 不再重复查
}
