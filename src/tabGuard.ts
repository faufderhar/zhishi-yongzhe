/* r14.1 多标签页保护：同一浏览器里只有一个标签页是「活动」的（共用 localStorage / IndexedDB）。
   新打开 / 点「在这里继续」的标签页接管，其他标签页显示「已在别处打开」，不再读写数据、不再自动跳转。
   BroadcastChannel 为主，localStorage 的 storage 事件兜底（不支持 BroadcastChannel 的浏览器）。 */
const KEY = 'zy.activeTab';
export const TAB_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
type L = (active: boolean) => void;
const ls: L[] = []; let active = true;
const bc: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('zy-tab') : null;
const set = (v: boolean) => { if (v === active) return; active = v; (window as unknown as { __zyPaused?: boolean; __zyInactive?: boolean }).__zyInactive = !v; ls.forEach(f => f(v)); };
export const isActiveTab = () => active;
export function claimTab() { try { localStorage.setItem(KEY, JSON.stringify({ id: TAB_ID, at: Date.now() })); } catch { /* */ } bc?.postMessage({ t: 'claim', id: TAB_ID }); set(true); }
export function onTabActive(f: L) { ls.push(f); return () => { const i = ls.indexOf(f); if (i >= 0) ls.splice(i, 1); }; }
if (typeof window !== 'undefined') {
  bc?.addEventListener('message', e => { const d = e.data as { t: string; id: string }; if (d?.t === 'claim' && d.id !== TAB_ID) set(false); });
  window.addEventListener('storage', e => { if (e.key !== KEY || !e.newValue) return; try { const v = JSON.parse(e.newValue); if (v.id !== TAB_ID) set(false); } catch { /* */ } });
  claimTab();
}
