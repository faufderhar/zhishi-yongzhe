/* r13 学霸：页面跳转日志与错误日志（本机 localStorage，只留最近若干条；家长导出 / 排查用） */
type Entry = Record<string, unknown>;
function push(key: string, e: Entry, max: number) {
  try { const a = JSON.parse(localStorage.getItem(key) ?? '[]') as Entry[]; a.push(e); localStorage.setItem(key, JSON.stringify(a.slice(-max))); } catch { /* 存储满 / 隐私模式：不影响游戏 */ }
}
const stack = () => (new Error().stack ?? '').split('\n').slice(3, 9).map(x => x.trim()).join(' | ');
export function logNav(from: string, to: string, reason: string) {
  if (from === to && to !== 'profiles') return;
  const e = { from, to, reason, stack: stack(), t: Date.now(), at: new Date().toISOString() };
  push('zy.navLog', e, 80);
  if ((from === 'battle' || from === 'review') && !['result', 'review-done', 'battle'].includes(to)) console.warn('[zy] 战斗中离开', e);
}
const benignErr = (msg: string) => /ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i.test(msg);   // r15.4.4 技术QA P4：浏览器良性警告，不进家长可见的错误日志
export function logErr(kind: string, msg: string, stk?: string) {
  if (benignErr(String(msg))) return;
  push('zy.errLog', { kind, msg: String(msg).slice(0, 500), stack: (stk ?? '').slice(0, 1500), t: Date.now(), at: new Date().toISOString() }, 40);
}
export function installErrLog() {
  window.addEventListener('error', e => { if (benignErr(e.message)) { e.stopImmediatePropagation(); return; } logErr('error', e.message, e.error?.stack); });
  window.addEventListener('unhandledrejection', e => logErr('rejection', String((e.reason as Error)?.message ?? e.reason), (e.reason as Error)?.stack));
}
