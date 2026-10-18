/* r15.4 策划定稿：取消「重设家长密码」申请要输入家长密码或恢复码；连错 5 次锁 24 小时。
   r15.4.1 技术QA P3-1：取消框单独计数（LK_CANCEL），锁住的只是取消框，不影响用恢复码重设；提示写「取消框」。
   「为什么要等 3 天？」文字是策划定稿，忘记密码页、全屏提醒共用 */
import { useEffect, useState } from 'react';
import { verifyPin, loadLock, saveLock, nextLock24, tickLock, lockLeft, LK_CANCEL, type LockState } from '../game/pin';
import { findRec, normCode, readLocal } from '../game/pinVault';
import { getKV } from '../db';
import type { Settings } from '../state';
export const RESET_WHY = [
  '从申请算起要满 72 小时。',
  '这期间要在 3 个不同的日子打开游戏，每次开满 5 分钟，关着的时间才算数；累计要开满 30 分钟。',
  '关着的时间每段最多算 12 小时。',
  '到期前请联一次网，用来核对时间；网络时间和平板时间相差超过 10 分钟，这次申请会取消。',
  '如果平板的时间被往回调过，这次申请会取消，需要重新申请。',
  '等待期间，每次打开都会提醒「有人申请重设家长密码」；不是你申请的，输入家长密码就能取消。',
];
export const ResetWhy = ({ open, testid = 'reset-why' }: { open?: boolean; testid?: string }) =>
  <details className="reset-why" data-testid={testid} open={open}><summary>为什么要等 3 天？</summary><ul>{RESET_WHY.map(t => <li key={t}>{t}</li>)}</ul></details>;
export const CANCEL_BTN = '不是我申请的？输入家长密码取消';
/** 输入的是家长密码（4–6 位数字）或恢复码（8 位）；对得上任何一份副本都算 */
export async function cancelSecretOk(s: Pick<Settings, 'pinHash' | 'pinRec'>, input: string): Promise<boolean> {
  const t = input.trim();
  if (/^\d{4,6}$/.test(t)) { if (await verifyPin(t, s.pinHash)) return true; const l = readLocal(); if (l && l.pinHash !== s.pinHash && await verifyPin(t, l.pinHash)) return true; }
  const c = normCode(t); if (c.length !== 8) return false;
  if (await verifyPin(c, s.pinRec)) return true;
  const h = await findRec(await getKV<any>('settings'), (await getKV<any[]>('profiles')) ?? [], getKV); return !!h && h !== s.pinRec && verifyPin(c, h);
}
export function ResetCancelBox({ settings, onCancelled, onBack }: { settings: Settings; onCancelled: () => void; onBack: () => void }) {
  const [v, setV] = useState(''); const [err, setErr] = useState<string>(); const [lk, setLk] = useState<LockState>({ fails: 0, level: 0, until: 0 }); const [busy, setBusy] = useState(false);
  useEffect(() => { void loadLock(LK_CANCEL).then(setLk); let last = performance.now(); const t = setInterval(() => { const p = performance.now(), dt = p - last; last = p; setLk(l => { if (!lockLeft(l)) return l; const n = tickLock(l, dt, Date.now()); void saveLock(n, LK_CANCEL); return n; }); }, 1000); return () => clearInterval(t); }, []);
  const left = Math.ceil(lockLeft(lk) / 1000), locked = left > 0;
  const fmt = (x: number) => x >= 3600 ? `${Math.floor(x / 3600)} 小时 ${Math.floor(x % 3600 / 60)} 分` : `${Math.floor(x / 60)} 分 ${x % 60} 秒`;
  const go = async () => { if (busy || locked || !v.trim()) return; setBusy(true);
    try { const ok = await cancelSecretOk(settings, v); const n = nextLock24(lk, ok, Date.now()); setLk(n); await saveLock(n, LK_CANCEL);
      if (ok) { onCancelled(); return; } setV(''); setErr(lockLeft(n) > 0 ? undefined : `不对，还可以试 ${5 - n.fails} 次`); } finally { setBusy(false); } };
  return <div className="modal-back" style={{ zIndex: 1100 }} data-testid="reset-cancel-box" role="dialog"><div className="modal">
    <h2>取消重设家长密码的申请</h2><p>输入家长密码或 8 位恢复码。</p>
    <input className="name-input" data-testid="reset-cancel-input" type="password" autoComplete="off" value={v} disabled={locked} maxLength={12} onChange={e => { setV(e.target.value); setErr(undefined); }} onKeyDown={e => { if (e.key === 'Enter') void go(); }} autoFocus />
    {(locked || err) && <p className="warn" data-testid="reset-cancel-msg">{locked ? `这个取消框连续输错 5 次，已锁定，请 ${fmt(left)}后再试（不影响用恢复码重设）` : err}</p>}
    <div className="row gap16"><button className="btn ghost" data-testid="reset-cancel-back" onClick={onBack}>返回</button>
      <button className="btn danger" data-testid="reset-cancel-ok" disabled={locked || busy || !v.trim()} onClick={() => void go()}>取消申请</button></div>
    <p className="hint">这个框单独计数：连错 5 次只锁这个框 24 小时，不影响用恢复码重设。</p></div></div>;
}
