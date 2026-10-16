import { ReduceToggle } from './Battle';
import { prefetchAll } from '../fx/sheets';
import { useState as useS } from 'react';
import { offlineStatus, onOffline } from '../offlineCache';
import { BANK_VER, BANK_RELEASE } from '../bankStore';
import { VERSION_LABEL } from '../version';
import { useInstallPrompt, isStandalone, isIOS, IosSteps, promptInstall } from './Screens';
import { toggleVol as toggleVolS, toggleAllVols, volsValid, learnedCount } from '../game/volumes';
import { effLimit, MIN_LIMIT } from '../state';
declare const __BUILD__: string; declare const __BUILD_TIME__: string;
/** 构建日期按用户设备的本地时区显示（r8） */
const buildDate = () => { try { return new Date(__BUILD_TIME__).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { return ''; } };
/** 离线就绪状态（技术QA R6-1） + 题库/构建版本（R6-5：来自构建信息） */
export function OfflineReady() {
  const [s, setS] = useS(offlineStatus());
  useEffect(() => onOffline(setS), []);
  const ready = !!s && s.total > 0 && s.done >= s.total && s.failed === 0;
  return <p className="hint" data-testid="offline-ready" data-ready={ready ? '1' : '0'}>
    {ready ? '✅ 离线就绪：怪物动画、技能特效和音效都已缓存' : s ? `⏳ 离线素材缓存中 ${s.done}/${s.total}${s.failed ? `（${s.failed} 个暂未下载，联网后自动重试）` : ''}` : '⏳ 联网时会在后台缓存离线素材'}
    <br /><b data-testid="version-label">版本 {VERSION_LABEL}</b><br /><span data-testid="build-info">题库 {BANK_RELEASE} · {BANK_VER} · 构建 {typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'} · {typeof __BUILD_TIME__ === 'string' ? buildDate() : ''}</span></p>;
}
function PrefetchAnim() {
  const [p, setP] = useS('');
  return <button className="chip" data-testid="prefetch-anim" onClick={() => { setP('0%'); void prefetchAll((d, t) => setP(Math.round(d / t * 100) + '%')).then(() => setP('已完成，可离线使用')); }}>⬇ 预下载战斗动画（约 4.3MB）{p && ' · ' + p}</button>;
}
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PinPad, fmtMin } from './common';
import { GRADE_LABEL, loadBank, countStatuses, type Bank, type GradeKey } from '../game/questions';
import { csvToQuestions, toCSV } from '../game/csv';
import { PROFILE_GRADES, bandConfig } from '../game/grades';
import { validPin, remainingSec, addBonus, cancelBonus, type Usage } from '../game/playtime';
import { dayStr } from '../game/wrongbook';
import { AVATARS, newProfile, type Profile, type Settings } from '../state';
import { questionsOfGrade, type BankState } from '../bankStore';
import { exportAll, importAll, putImported, clearImported, validateBackup, currentPin } from '../db';
import { exportQuestion } from '../game/questions';
import { getKVStrict } from '../db';
import { setKV, getKV, answersOf, wrongOf, rollupOf, rollupAdd, type AnswerRecord, type Rollup } from '../db';
import type { WrongEntry } from '../game/wrongbook';
import { DESIGN } from '../game/config';
import { HoldButton } from './Battle';
import { noZhVoice } from '../tts';
import { nextLock24, LK_REC, makePinHash, verifyPin, loadLock, saveLock, nextLock, tickLock, lockLeft, LK_HINT, markPinSet, pinWasSet, HINT_QUESTIONS, normAnswer, type LockState } from '../game/pin';
import { hintCandidates, answerVariants, readLocal, readCache, makeRecoveryCode, normCode, RESET_DELAY_MS, fmtWhen, fmtDay } from '../game/pinVault';
import type { Skills } from '../game/adaptive';

/** 家长密码门（D9 锁定 / X-13 首次设置需提示问题 / P2-1 密码丢失不当首次） */
export function ParentGate({ allHints, settings, onSetPin, onOk, onCancel, purpose, onRestorePin, hasProgress, onRequestReset }: { allHints?: string[]; settings: Settings; onSetPin: (h: string, hint?: { q: string; a: string }, rec?: string) => void; onOk: () => void; onCancel: () => void; purpose?: string; onRestorePin?: (h: string, hint?: { q: string; a: string }, rec?: string) => void; hasProgress?: boolean; onRequestReset?: () => void }) {
  const [first, setFirst] = useState<string>();
  const [err, setErr] = useState<string>();
  const [lock, setLock] = useState<LockState>({ fails: 0, level: 0, until: 0 });
  const [hlock, setHlock] = useState<LockState>({ fails: 0, level: 0, until: 0 });   // r9：找回问题单独锁定
  const [rc, setRc] = useState(''); const [rerr, setRerr] = useState<string>();
  const [rlock, setRlock] = useState<LockState>({ fails: 0, level: 0, until: 0, remain: 0 });   // r12：恢复码单独计错、锁 24 小时
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState<'pin' | 'hint' | 'forgot' | 'lost' | 'code' | 'rec' | 'reset'>('pin');
  const [code, setCode] = useState('');
  const [hq, setHq] = useState(HINT_QUESTIONS[0]); const [ha, setHa] = useState('');
  const [pend, setPend] = useState<string>();
  useEffect(() => {
    void loadLock().then(setLock); void loadLock(LK_HINT).then(setHlock); void loadLock(LK_REC).then(setRlock); void (!settings.pinHash && (async () => {
      // r10：只有「确实读到了、而且没有」才算丢失；没读到 / 还没加载完都不算
      let st: { pinHash?: string; pinHint?: { q: string; a: string } } | undefined;
      for (let i = 0; i < 3; i++) { try { st = await getKVStrict('settings'); break; } catch { await new Promise(r => setTimeout(r, 300)); if (i === 2) return; } }
      if (st?.pinHash) { onRestorePin?.(st.pinHash, st.pinHint, (st as { pinRec?: string }).pinRec); return; }
      const bk = readLocal() ?? await readCache(); if (bk) { onRestorePin?.(bk.pinHash, bk.pinHint, bk.recHash); return; }
      // r11：一份密码副本都没有：有孩子档案 → 不能直接设新密码（恢复码 / 24 小时延时重设）；真正的新装（没有档案）才走首次设置。到期的延时重设也算新设置
      if (hasProgress && !settings.pinResetDoneAt && await pinWasSet()) setMode('lost');   // 出厂自带的示例档案不算
    })());
    let last = performance.now();
    const t = setInterval(() => {   // 只按单调时钟扣锁定时间（技术QA R4-4）
      const p = performance.now(), dt = p - last; last = p; setNow(Date.now());
      setLock(l => { if (!lockLeft(l)) return l; const n = tickLock(l, dt, Date.now()); void saveLock(n); return n; });
      setHlock(l => { if (!lockLeft(l)) return l; const n = tickLock(l, dt, Date.now()); void saveLock(n, LK_HINT); return n; });
      setRlock(l => { if (!lockLeft(l)) return l; const n = tickLock(l, dt, Date.now()); void saveLock(n, LK_REC); return n; });
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.ceil(lockLeft(lock, now) / 1000);
  const locked = left > 0;
  const hleft = Math.ceil(lockLeft(hlock, now) / 1000), hlocked = hleft > 0;
  const rleft = Math.ceil(lockLeft(rlock, now) / 1000), rlocked = rleft > 0;
  const fmt = (x: number) => x >= 3600 ? `${Math.floor(x / 3600)} 小时 ${Math.floor(x % 3600 / 60)} 分` : `${Math.floor(x / 60)} 分 ${x % 60} 秒`;
  const lockMsg = locked ? `密码错太多次了，请 ${fmt(left)}后再试${settings.pinHint && !hlocked ? '。可以等待，或用找回问题' : ''}` : undefined;
  const hlockMsg = hlocked ? `找回问题连续答错 5 次，已锁定，请 ${fmt(hleft)}后再试` : undefined;
  const rlockMsg = rlocked ? `恢复码连续错 5 次，已锁定，请 ${fmt(rleft)}后再试` : undefined;
  const note = async (ok: boolean) => { const n = nextLock(lock, ok, Date.now()); setLock(n); await saveLock(n); return n; };
  const noteH = async (ok: boolean) => { const n = nextLock24(hlock, ok, Date.now()); setHlock(n); await saveLock(n, LK_HINT); return n; };
  const noteR = async (ok: boolean) => { const n = nextLock24(rlock, ok, Date.now()); setRlock(n); await saveLock(n, LK_REC); return n; };
  // r12：找回问题答案和所有密码副本里的答案逐一比对（升级前设的答案也认）；答案兼容几种规范化
  const checkHint = async (ans: string) => { const cands = hintCandidates(settings, readLocal()?.pinHint, await readCache().then(v => v?.pinHint), ...(allHints ?? []).map(a => ({ a }))); for (const h of cands) for (const v of answerVariants(ans)) if (await verifyPin(v, h)) return true; return false; };
  const recBox = (inline: boolean) => <div className={inline ? 'p-card' : ''} data-testid={inline ? 'forgot-rec-box' : undefined}>{inline && <b>有恢复码？</b>}
      <input className="name-input" data-testid="rec-input" placeholder="8 位恢复码" value={rc} disabled={rlocked} maxLength={12} onChange={e => setRc(e.target.value)} />
      {(rlockMsg || rerr) && <p className="warn" data-testid="rec-msg">{rlockMsg ?? rerr}</p>}
      <button className="btn" data-testid="rec-ok" disabled={rlocked || normCode(rc).length !== 8} onClick={async () => {
        const ok = await verifyPin(normCode(rc), settings.pinRec); const n = await noteR(ok);
        if (ok) { await note(true); setMode('pin'); setFirst(undefined); setErr(undefined); setRerr(undefined); setRc(''); onSetPin(''); } else setRerr(lockLeft(n) > 0 ? undefined : `恢复码不对，还可以试 ${5 - n.fails} 次`);
      }}>用恢复码重设</button></div>;
  // r11：设好密码后生成 8 位恢复码，只显示这一次
  const finishSet = async (pin: string, hint?: { q: string; a: string }) => { const c = makeRecoveryCode(); onSetPin(await makePinHash(pin), hint, await makePinHash(c)); markPinSet(); setCode(c); setMode('code'); };
  const resetBox = <div className="p-card" data-testid="reset-box"><b>没有恢复码？</b><p className="hint">可以申请重设：{RESET_DELAY_MS / 3600e3} 小时后到期。等待期间每个页面顶部都会提示、每次打开游戏会全屏提示一次，任何人都能点〔取消〕。到期后仍要回答找回问题或输入恢复码才能设新密码。时长限制照常生效。</p>
    {settings.pinReset ? <p data-testid="reset-pending">{settings.pinReset.ready ? '申请已到期：请回答找回问题或输入恢复码来设新密码。两样都没有，只能导入备份文件或清除浏览器数据（会清掉进度），见 ❓ 说明。' : `已申请，${fmtWhen(settings.pinReset.effectiveAt)}到期；到期后还要回答找回问题或输入恢复码。`}</p> : <button className="btn ghost" data-testid="reset-request" onClick={() => onRequestReset?.()}>申请重设密码（72 小时后到期）</button>}</div>;
  if (mode === 'code') return (
    <div className="center-screen"><div className="pinpad"><h2>请记下恢复码</h2>
      <p>忘记密码时，用这个恢复码可以马上重设密码。<b>只显示这一次</b>，请抄在纸上或拍照保存，别让孩子看到。</p>
      <div className="rec-code" data-testid="rec-code">{code.slice(0, 4)} {code.slice(4)}</div>
      <button className="btn" data-testid="rec-done" onClick={() => { setCode(''); onOk(); }}>我记下了</button></div></div>);
  if (mode === 'rec') return (
    <div className="center-screen"><div className="pinpad"><h2>用恢复码重设密码</h2><p>输入设置密码时记下的 8 位恢复码（不分大小写）。</p>
      {recBox(false)}<button className="btn ghost" onClick={() => { setRerr(undefined); setMode(settings.pinHash ? 'forgot' : 'lost'); }}>返回</button>{resetBox}</div></div>);
  const sub = purpose ? <p className="parent-hint">{purpose}</p> : null;
  if (mode === 'lost') return (
    <div className="center-screen"><div className="pinpad" data-testid="pin-lost"><h2>家长密码数据不见了</h2>
      <p>这台平板上有孩子的档案，但所有家长密码副本都没有了（通常是浏览器数据被部分清理）。为了不让孩子直接设新密码，不能马上重设。</p>
      <div className="row gap16">{settings.pinRec && <button className="btn" data-testid="lost-rec" onClick={() => { setHa(''); setErr(undefined); setMode('rec'); }}>用恢复码重设</button>}<button className="btn ghost" onClick={onCancel}>返回</button></div>
      {resetBox}</div></div>);
  if (mode === 'hint' && pend) return (
    <div className="center-screen"><div className="pinpad"><h2>设置找回问题（必填）</h2>
      <p className="hint" data-testid="hint-advice">别选孩子也知道答案的问题，比如家人生日。</p>
      <div className="col gap8">{HINT_QUESTIONS.map(x => <label key={x} className="toggle-line"><input type="radio" checked={hq === x} onChange={() => setHq(x)} /> {x}</label>)}</div>
      <input className="name-input" data-testid="hint-answer" placeholder="答案" value={ha} onChange={e => setHa(e.target.value)} />
      <button className="btn" data-testid="hint-ok" disabled={!normAnswer(ha)} onClick={async () => finishSet(pend, { q: hq, a: await makePinHash(normAnswer(ha)) })}>完成</button></div></div>);
  if (mode === 'forgot' && settings.pinHint) return (
    <div className="center-screen"><div className="pinpad"><h2>忘记密码</h2><p>{settings.pinHint.q}</p>
      <input className="name-input" data-testid="forgot-answer" value={ha} disabled={hlocked} onChange={e => setHa(e.target.value)} />
      {(hlockMsg || err) && <p className="warn" data-testid="forgot-msg">{hlockMsg ?? err}</p>}
      <div className="row gap16"><button className="btn" data-testid="forgot-ok" disabled={hlocked || !ha} onClick={async () => {
        const ok = await checkHint(ha); const n = await noteH(ok); if (ok) await note(true);
        if (ok) { setMode('pin'); setFirst(undefined); setErr(undefined); onSetPin(''); } else setErr(lockLeft(n) > 0 ? undefined : `答案不对，还可以试 ${5 - n.fails} 次`);
      }}>确定</button><button className="btn ghost" onClick={() => setMode('pin')}>返回</button></div>
      {settings.pinRec && recBox(true)}{resetBox}</div></div>);
  if (mode === 'reset') return <div className="center-screen"><div className="pinpad"><h2>忘记密码</h2>{resetBox}<button className="btn ghost" onClick={() => setMode('pin')}>返回</button></div></div>;
  if (!settings.pinHash) return (
    <div className="center-screen">{sub}
      <PinPad title={first ? '再输入一次确认' : '请爸爸妈妈来设置家长密码'} hint="请输入 4–6 位数字" error={err} onCancel={onCancel} onSubmit={p => {
        if (!validPin(p)) { setErr('请输入 4–6 位数字'); return; }
        if (!first) { setFirst(p); setErr(undefined); return; }
        if (p !== first) { setFirst(undefined); setErr('两次不一致，请重新设置'); return; }
        setPend(p); setMode('hint');
      }} />
    </div>
  );
  return <div className="center-screen">{sub}<PinPad title="输入家长密码" hint="请输入 4–6 位数字" error={lockMsg ?? err} disabled={locked} onCancel={onCancel}
    extra={<button className="link-btn" data-testid="forgot" onClick={() => { setHa(''); setErr(undefined); setMode(settings.pinHint ? 'forgot' : settings.pinRec ? 'rec' : 'reset'); }}>忘记密码</button>}
    onSubmit={async p => {
      if (locked) return;
      const ok = await verifyPin(p, settings.pinHash); const n = await note(ok);
      if (ok) { if (!settings.pinHash!.startsWith('s2:') && crypto?.subtle) onSetPin(await makePinHash(p), settings.pinHint); onOk(); }
      else setErr(lockLeft(n) > 0 ? undefined : `密码不对，还可以试 ${5 - n.fails} 次`);
    }} /></div>;
}

function download(name: string, text: string, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
type Tab = 'report' | 'profiles' | 'bank' | 'time' | 'backup' | 'pin';
export interface ParentProps {
  settings: Settings; setSettings: (s: Settings) => void;
  profiles: Profile[]; setProfiles: (p: Profile[]) => void;
  bank: BankState; reloadBank: () => Promise<void>;
  usage: Record<string, Usage>; setUsage: (pid: string, u: Usage) => void;
  skills: Record<string, Skills>; flags: Record<string, number>;
  clockLocked?: boolean; unlockClock?: () => void;
  onClose: () => void; initialTab?: Tab; currentPid?: string;
}
/** r10：家长页闲置 5 分钟自动退出，提前 30 秒提示（任何点击 / 输入都重新计时）；表单草稿会保留 */
export const PARENT_IDLE_MS = 5 * 60e3, PARENT_WARN_MS = 30e3;
export function ParentSettings(props: ParentProps) {
  const [tab, setTab] = useState<Tab>(props.initialTab ?? 'profiles');
  const [warn, setWarn] = useState(0); const [help, setHelp] = useState(false);
  useEffect(() => {
    const ms = (__TEST_HOOKS__ && (window as unknown as { __zyParentIdleMs?: number }).__zyParentIdleMs) || PARENT_IDLE_MS;
    let last = Date.now(); const poke = () => { last = Date.now(); setWarn(0); };
    const ev = ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart'] as const; ev.forEach(e => window.addEventListener(e, poke, true));
    const iv = setInterval(() => { const idle = Date.now() - last; if (idle >= ms) props.onClose(); else if (idle >= ms - Math.min(PARENT_WARN_MS, ms / 2)) setWarn(Math.ceil((ms - idle) / 1000)); }, 500);
    return () => { clearInterval(iv); ev.forEach(e => window.removeEventListener(e, poke, true)); };
  }, []);
  const tabs: [Tab, string][] = [['profiles', '👪 孩子档案'], ['report', '📊 学习报告'], ['bank', '📚 题库'], ['time', '⏳ 时长'], ['backup', '💾 备份/恢复'], ['pin', '🔑 密码']];
  return (
    <div className="parent">
      <div className="map-top">
        <button className="back-inline labeled" data-testid="parent-close" onClick={props.onClose} aria-label="退出家长设置">← <small>返回</small></button>
        <h2>家长设置</h2><button className="chip" data-testid="parent-help" aria-label="帮助" onClick={() => setHelp(h => !h)}>❓</button><span className="grow" />
        {tabs.map(([k, l]) => <button key={k} className={`chip ${tab === k ? 'on' : ''}`} data-testid={'ptab-' + k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {warn > 0 && <div className="yellow-bar" data-testid="idle-warn">家长设置很久没有操作了，{warn} 秒后自动退出（没保存的档案会留着草稿）。点任意处继续。</div>}
      {props.settings.pinResetDoneAt && <div className="yellow-bar" data-testid="pin-reset-notice">🔑 家长密码于 {fmtDay(props.settings.pinResetDoneAt)} 被重设过。如果不是你操作的，请检查孩子的时长和设置。<button className="chip" data-testid="pin-reset-ack" onClick={() => props.setSettings({ ...props.settings, pinResetDoneAt: undefined })}>知道了</button></div>}
      {help && <div className="p-card" data-testid="parent-help-pop"><b>❓ 家长帮助</b><ul className="hint">
        <li><b>清除浏览器数据（历史记录、网站数据、缓存）会把孩子的进度、错题本和设置一起删掉</b>，家长密码也可能跟着丢。请定期在「备份/恢复」里导出备份文件。</li>
        <li>设置密码时给的 8 位恢复码请抄下或拍照保存：忘记密码时输入恢复码或回答找回问题能马上重设。可以在「🔑 密码」里重新生成恢复码（旧的作废）。</li>
        <li>找回问题、恢复码各自连续错 5 次会锁 24 小时。申请重设要等 72 小时到期，期间任何人都能取消；<b>到期后仍要找回问题答案或恢复码</b>。</li>
        <li>两样都没有：只能①在「备份/恢复」导入以前导出的备份文件（备份里带着当时的家长密码和恢复码），或②清除浏览器数据重新开始（进度会一起清掉）。</li>
        <li>iPad「添加到主屏幕」的 App 与 Safari 里的数据是分开的。</li></ul><button className="chip" onClick={() => setHelp(false)}>关闭</button></div>}
      <RecGen prompt settings={props.settings} setSettings={props.setSettings} />
      <ParentAlerts goBackup={() => setTab('backup')} />
      <div className="parent-body">
        {tab === 'profiles' && <><div className="p-card" data-testid="overview-offline"><OfflineReady /></div><ProfilesTab {...props} /></>}
        {tab === 'report' && <ReportTab {...props} />}
        {tab === 'bank' && <BankTab {...props} />}
        {tab === 'time' && <TimeTab {...props} />}
        {tab === 'backup' && <BackupTab />}
        {tab === 'pin' && <PinTab {...props} />}
      </div>
    </div>
  );
}

/** 家长页顶部提示：存储用量 > 80%（P1-4）、上次备份 / 超 14 天提醒（P1-5） */
function ParentAlerts({ goBackup }: { goBackup: () => void }) {
  const [usage, setUsage] = useState<number>();
  const [last, setLast] = useState<number | null | undefined>();
  const [nag, setNag] = useState(false);
  useEffect(() => {
    void navigator.storage?.estimate?.().then(e => { if (e.quota) setUsage((e.usage ?? 0) / e.quota); }).catch(() => {});
    void getKV<number>('lastBackupAt').then(t => { setLast(t ?? null); if (!t || Date.now() - t > 14 * 864e5) void getKV<number>('backupSnoozeUntil').then(u => setNag(!(u && Date.now() < u))); });
  }, []);
  const days = last ? Math.floor((Date.now() - last) / 864e5) : null;
  return <>
    {usage !== undefined && usage > 0.8 && <div className="yellow-bar">保存失败风险：平板存储空间快满了（已用 {Math.round(usage * 100)}%），请导出备份</div>}
    <p className="hint backup-age" data-testid="backup-age">上次备份：{last === undefined ? '…' : days === null ? '从未备份' : days === 0 ? '今天' : `${days} 天前`}</p>
    {nag && <Modal onClose={() => { setNag(false); void setKV('backupSnoozeUntil', Date.now() + 7 * 864e5); }}>
      <h2>该备份啦</h2><p>{days === null ? '这台平板还没有备份过。' : `已经 ${days} 天没有备份了。`}清理浏览器或换平板时，没有备份会丢失进度。</p>
      <div className="row gap16"><button className="btn" onClick={() => { setNag(false); void setKV('backupSnoozeUntil', Date.now() + 7 * 864e5); goBackup(); }}>立即备份</button>
        <button className="btn ghost" onClick={() => { setNag(false); void setKV('backupSnoozeUntil', Date.now() + 7 * 864e5); }}>稍后</button></div>
    </Modal>}
  </>;
}
function ProfilesTab({ profiles, setProfiles, bank, skills, usage, setUsage }: ParentProps) {
  const [edit, setEdit] = useState<Profile | null>(() => { try { const d = JSON.parse(sessionStorage.getItem('zy-draft-profile') ?? 'null'); return d && typeof d.id === 'string' ? d : null; } catch { return null; } });   // r10：有草稿就直接打开
  const [delId, setDelId] = useState<string>();
  const save = (p: Profile) => { setProfiles(profiles.some(x => x.id === p.id) ? profiles.map(x => x.id === p.id ? p : x) : [...profiles, p]); setEdit(null); };
  return (
    <div>
      <div className="row gap16 wrap">
        {profiles.map(p => (
          <div key={p.id} className="p-card">
            <span className="big-emoji">{p.avatar}</span>
            <b>{p.name}</b><small>{GRADE_LABEL[p.grade]} · {p.volumes ? (learnedCount(p.volumes) ? `已选：${p.volumes.join('、')}` : '未选册别') : '全部册别'}</small>
            <small>每日 上学日 {effLimit(p).weekday || '不限'} / 周末 {effLimit(p).weekend || '不限'} 分钟</small>
            {skills[p.id] && <small>难度：{Object.entries(skills[p.id]).map(([s, v]) => `${s}${v.level}`).join(' · ') || '还没开始答题'}</small>}
            <div className="row gap16"><button className="chip" data-testid={'edit-' + p.id} onClick={() => setEdit(p)}>编辑</button>
              <button className="chip" data-testid={'del-' + p.id} onClick={() => setDelId(p.id)}>删除</button></div>
          </div>
        ))}
        {profiles.length < DESIGN.maxProfiles && <button className="p-card add" data-testid="add-profile" onClick={() => setEdit(newProfile('新同学', '1', '👧'))}>＋ 添加孩子</button>}
      </div>
      {delId && (() => { const dp = profiles.find(x => x.id === delId); return dp && <Modal onClose={() => setDelId(undefined)}>
        <h2>删除{dp.name}的档案吗？</h2><p>进度、错题和记录都会删掉，不能恢复。</p>
        <div className="row gap16"><button className="btn cancel-btn" data-testid="del-cancel" onClick={() => setDelId(undefined)}>取消，不删除</button>
          <HoldButton className="btn danger" label="长按 1.5 秒删除" testid="del-confirm" ms={1500} onDone={() => { setProfiles(profiles.filter(x => x.id !== delId)); setDelId(undefined); }}>长按删除</HoldButton></div>
      </Modal>; })()}
      {edit && <ProfileEditor p={edit} bank={bank} onSave={save} onCancel={() => setEdit(null)} bonusSec={usage[edit.id]?.[dayStr()]?.bonus ?? 0} onCancelBonus={() => setUsage(edit.id, cancelBonus(usage[edit.id] ?? {}, dayStr()))} />}
    </div>
  );
}
function ProfileEditor({ p, bank, onSave, onCancel, bonusSec = 0, onCancelBonus }: { p: Profile; bank: BankState; onSave: (p: Profile) => void; onCancel: () => void; bonusSec?: number; onCancelBonus?: () => void }) {
  // r10：未保存的表单草稿（超时退出后再进来还在）
  const DK = 'zy-draft-profile';
  const [f, setF0] = useState<Profile>(() => { try { const d = JSON.parse(sessionStorage.getItem(DK) ?? 'null'); if (d && d.id === p.id) return d; } catch { /* */ } return p; });
  const setF = (x: Profile) => { setF0(x); try { sessionStorage.setItem(DK, JSON.stringify(x)); } catch { /* */ } };
  const clearDraft = () => { try { sessionStorage.removeItem(DK); } catch { /* */ } };
  const vols = useMemo(() => { const m = new Map<string, number>(); for (const q of questionsOfGrade(bank, f.grade)) m.set(q.volume, (m.get(q.volume) ?? 0) + 1); return [...m]; }, [bank, f.grade]);
  const setGrade = (g: GradeKey) => { const d = bandConfig(g).dailyMinutes; setF({ ...f, grade: g, volumes: null, limit: { weekday: Math.max(MIN_LIMIT, d.weekday), weekend: Math.max(MIN_LIMIT, d.weekend) }, unlimited: { weekday: d.weekday <= 0, weekend: d.weekend <= 0 } }); };
  // r9（较真家长）：「全部册别」时点某一册 = 只选这一册（以前是把它取消，选二年级上册反而存成「下册+通用」）
  // r10：「全部册别」时每一册都显示为选中；点某一册 = 取消这一册（其余保留）
  const toggleVol = (v: string) => setF({ ...f, volumes: toggleVolS(f.volumes, v, vols.map(x => x[0])) });   // r11：状态定义见 game/volumes.ts
  // r9（较真家长 严重）：最少 5 分钟，−5 不会再变成 0（不限）；「不限」是单独开关，要确认
  const step = (k: 'weekday' | 'weekend', d: number) => setF({ ...f, limit: { ...f.limit, [k]: Math.min(240, Math.max(MIN_LIMIT, f.limit[k] + d)) } });
  const setUnl = (k: 'weekday' | 'weekend', on: boolean) => { if (on && !confirm(`确定${k === 'weekday' ? '上学日' : '周末'}不限时长吗？孩子可以一直玩。`)) return; setF({ ...f, unlimited: { ...f.unlimited, [k]: on } }); };
  return (
    <Modal onClose={onCancel}>
      <div className="editor" data-testid="profile-editor">
        <h2>编辑档案</h2>
        <label>名字 <input data-testid="profile-name" value={f.name} maxLength={8} onChange={e => setF({ ...f, name: e.target.value })} /></label>
        <div className="row gap16 wrap avatars">{AVATARS.map(a => <button key={a} className={`chip ${a === f.avatar ? 'on' : ''}`} onClick={() => setF({ ...f, avatar: a })}>{a}</button>)}</div>
        <div><b>年级</b><div className="row gap16 wrap">{PROFILE_GRADES.map(g => <button key={g} className={`chip ${g === f.grade ? 'on' : ''}`} data-testid={'grade-' + g} onClick={() => setGrade(g)}>{GRADE_LABEL[g]}</button>)}</div></div>
        <div><b>已学册别</b>（只从勾选的册别出题）<div className="row gap16 wrap">{vols.map(([v, n]) =>
          <button key={v} className={`chip ${!f.volumes || f.volumes.includes(v) ? 'on' : ''}`} data-testid={'vol-' + v} aria-pressed={!f.volumes || f.volumes.includes(v)} onClick={() => toggleVol(v)}>{v}（{n}）</button>)}
          <button className={`chip ${!f.volumes ? 'on' : ''}`} data-testid="vol-all" aria-pressed={!f.volumes} onClick={() => setF({ ...f, volumes: toggleAllVols(f.volumes) })}>全部册别</button></div>
          {!volsValid(f.volumes) && <p className="warn-text" data-testid="vol-none">⚠ 至少要选一册才能保存（点〔全部册别〕可以全选）</p>}</div>
        <div className="row gap16 wrap"><b>每日时长（分钟，最少 5）</b>
          {(['weekday', 'weekend'] as const).map(k => <span key={k} className="stepper" data-testid={'limit-' + k}>{k === 'weekday' ? '上学日' : '周末'}
            <button className="chip" data-testid={`limit-${k}-minus`} disabled={!!f.unlimited?.[k] || f.limit[k] <= MIN_LIMIT} onClick={() => step(k, -5)}>−5</button>
            <b data-testid={`limit-${k}-val`}>{f.unlimited?.[k] ? '不限' : Math.max(MIN_LIMIT, f.limit[k])}</b>
            <button className="chip" data-testid={`limit-${k}-plus`} disabled={!!f.unlimited?.[k]} onClick={() => step(k, 5)}>＋5</button>
            <label className={`chip unl-box ${f.unlimited?.[k] ? 'checked' : ''}`}><input type="checkbox" data-testid={`limit-${k}-unl`} checked={!!f.unlimited?.[k]} onChange={e => setUnl(k, e.target.checked)} /> 不限时长</label></span>)}</div>
        {bonusSec > 0 && <p className="hint" data-testid="bonus-note">今天还有临时加时 {Math.round(bonusSec / 60)} 分钟（只在今天有效，会加在每日上限之外）。<button className="chip" data-testid="bonus-cancel" onClick={onCancelBonus}>取消今天的临时加时</button></p>}
        <div className="row gap16 wrap"><button className="chip" data-testid="reset-tips" disabled={!f.tips || !Object.keys(f.tips).length} onClick={() => setF({ ...f, tips: {} })}>💡 重置提示（首次提示再弹一次）</button></div>
        <div className="row gap16"><button className="btn ghost" onClick={() => { clearDraft(); onCancel(); }}>取消</button><button className="btn" data-testid="profile-save" disabled={!f.name.trim() || !volsValid(f.volumes)} onClick={() => { clearDraft(); onSave(f); }}>保存</button></div>
      </div>
    </Modal>
  );
}

interface Preview { file: string; bank: Bank; isNew: number; isUpd: number; raw: any[] }
function BankTab({ settings, setSettings, bank, reloadBank, flags, profiles }: ParentProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pv, setPv] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<string>();
  const rows = Object.entries(bank.builtin);
  const onFile = async (f: File) => {
    const text = await f.text();
    let raw: any;
    try { raw = /\.csv$/i.test(f.name) ? { questions: csvToQuestions(text) } : JSON.parse(text); }
    catch (e) { setMsg('文件解析失败：' + (e as Error).message); return; }
    const b = loadBank(raw, f.name);
    const isUpd = b.all.filter(q => bank.byKey.has(q.key)).length;
    const list: any[] = Array.isArray(raw) ? raw : raw?.questions ?? [];
    setPv({ file: f.name, bank: b, isNew: b.all.length - isUpd, isUpd, raw: list });
  };
  const doImport = async () => {
    if (!pv) return;
    const bad = new Set(pv.bank.bad.map(x => x.row - 1));
    // 存原始题目（补上年级与唯一键），状态以 status 为准，game_ready 重新计算
    const good = pv.raw.map((r, i) => [r, i] as const).filter(([, i]) => !bad.has(i)).map(([r, i]) => {
      const q = pv.bank.all.find(x => x.order === i)!;
      return { ...r, grade: q.grade, key: q.key, status: q.status, game_ready: q.status === '已通过' || q.status === 'AI初审通过' };
    });
    await putImported(good);
    setMsg(`已导入 ${pv.bank.all.length} 题（新增 ${pv.isNew}，更新 ${pv.isUpd}），错误 ${pv.bank.bad.length} 行未导入。`);
    setPv(null); await reloadBank();
  };
  const exportGrade = (g: string, fmt: 'json' | 'csv') => {
    const qs = questionsOfGrade(bank, g as GradeKey);
    if (fmt === 'json') download(`题库导出_${GRADE_LABEL[g]}.json`, JSON.stringify({ bank_name: `导出-${GRADE_LABEL[g]}`, version: 'export', questions: qs.map(exportQuestion) }, null, 1));
    else {
      const head = ['id', 'status', 'subject', 'grade', 'textbook', 'unit', 'volume', 'type', 'question', 'tts_text', 'A', 'B', 'C', 'D', 'E', 'F', 'answer', 'tolerance', 'explanation', 'difficulty', 'tag', 'time', 'source', 'template', 'visual'];
      download(`题库导出_${GRADE_LABEL[g]}.csv`, toCSV(head, qs.map(q => ({ ...q, ...Object.fromEntries(q.options.map(o => [o.key, o.text])), answer: q.type === '填空' ? q.answer.join('|') : q.answer.join(''), tag: q.tags.join('|'), visual: q.visual ? JSON.stringify(q.visual) : '' }))), 'text/csv');
    }
  };
  const flagged = Object.entries(flags).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return (
    <div className="col gap16">
      <div className="row gap16 wrap">
        <label className="toggle"><input type="checkbox" data-testid="toggle-pending" checked={settings.includePending} onChange={e => setSettings({ ...settings, includePending: e.target.checked })} />
          也出「待审核 / 需家长确认」的题（停用的题永远不出）</label>
        <label className="toggle"><input type="checkbox" checked={settings.g1NoLimit} onChange={e => setSettings({ ...settings, g1NoLimit: e.target.checked })} /> 1–2 年级不限时</label>
        <label className="toggle"><input type="checkbox" data-testid="hs-wager" checked={settings.hsWager ?? true} onChange={e => setSettings({ ...settings, hsWager: e.target.checked })} /> 高一战斗开启「信心押注」</label>
 <label className="toggle"><input type="checkbox" data-testid="switch-nopin" checked={!!settings.switchNoPin} onChange={e => setSettings({ ...settings, switchNoPin: e.target.checked })} /> 切换档案不用密码（默认关：当天换另一个孩子的档案要家长密码，防止换档案躲时长。时长按每个孩子在这台设备上分别计）</label>
        <label className="toggle"><input type="checkbox" data-testid="lenient-time" checked={!!settings.lenientTime} onChange={e => setSettings({ ...settings, lenientTime: e.target.checked })} /> 时限宽松（所有答题时限 ×1.5）</label>
        <label className="toggle"><input type="checkbox" data-testid="toggle-demo-reward" checked={settings.kinderDemoReward ?? DESIGN.kinderDemoReward} onChange={e => setSettings({ ...settings, kinderDemoReward: e.target.checked })} /> 小班看演示学会的题也给⭐（不算「自己答对」）</label>
        <label className="toggle"><input type="checkbox" checked={settings.sfx ?? true} onChange={e => setSettings({ ...settings, sfx: e.target.checked })} /> 音效</label>
        <label className="toggle"><input type="checkbox" checked={settings.tts ?? true} onChange={e => setSettings({ ...settings, tts: e.target.checked })} /> 朗读</label>
        <label className="toggle">音量 <input type="range" min={0} max={1} step={0.1} value={settings.volume ?? 0.8} onChange={e => setSettings({ ...settings, volume: Number(e.target.value) })} /></label>
        {noZhVoice() && <p className="hint">这台平板没有中文语音，可在系统设置 → 辅助功能 → 朗读内容 / 文字转语音 里下载。</p>}
        {!('wakeLock' in navigator) && <p className="hint">这台平板不支持「战斗中保持亮屏」，建议把自动锁屏设为 5 分钟以上。</p>}
        <button className="btn ghost" data-testid="replay-tutorial" onClick={() => { setSettings({ ...settings, tutorialReplay: Object.fromEntries(profiles.map(p => [p.id, true])) }); }}>🔁 重新播放新手引导（所有孩子下次进战斗时）</button>
      </div>
      <table className="tbl" data-testid="bank-table">
        <thead><tr><th>年级</th><th>总题</th><th>可玩</th><th>待家长确认</th><th>待审核</th><th>停用</th><th>提示/错误</th><th>导出</th></tr></thead>
        <tbody>{rows.map(([g, b]) => {
          const merged = countStatuses(questionsOfGrade(bank, g as GradeKey));
          return <tr key={g}><td>{GRADE_LABEL[g]}</td><td>{merged.total}</td><td><b>{merged.playable}</b></td><td>{merged.pendingParent}</td><td>{merged.pending}</td><td>{merged.disabled}</td>
            <td>{b.warnings.length ? `⚠ ${b.warnings.length}` : '—'} / {b.bad.length ? `✘ ${b.bad.length}` : '—'}</td>
            <td><button className="chip sm" onClick={() => exportGrade(g, 'json')}>JSON</button><button className="chip sm" onClick={() => exportGrade(g, 'csv')}>CSV</button></td></tr>;
        })}</tbody>
      </table>
      <div className="row gap16 wrap">
        <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" hidden data-testid="import-file" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        <button className="btn" onClick={() => fileRef.current?.click()}>📥 导入题库（JSON / CSV）</button>
        <button className="btn ghost" disabled={!bank.importedCount} onClick={async () => { await clearImported(); await reloadBank(); setMsg('已清除导入的题，恢复内置题库'); }}>清除已导入（{bank.importedCount}）</button>
        {bank.importedInvalid > 0 && <p className="warn" data-testid="import-invalid">有 {bank.importedInvalid} 道导入题格式不对，已暂停使用（请修改后重新导入）。</p>}
      </div>
      {msg && <p className="note">{msg}</p>}
      {flagged.length > 0 && <div><b>孩子标记「这题有错」：</b>{flagged.map(([k, n]) => <span key={k} className="tag">{k} ×{n}</span>)}</div>}
      <p className="hint">导入规则：相同 年级+id 覆盖更新；以 status 为准重新计算 game_ready；年级取文件内 grade 字段或文件名，不看 id 前缀。xlsx 请先另存为 CSV（UTF-8）。</p>
      {pv && <Modal onClose={() => setPv(null)}>
        <div className="editor" data-testid="import-preview">
          <h2>导入预览：{pv.file}</h2>
          <p>年级：{pv.bank.grade ? GRADE_LABEL[pv.bank.grade] : '按每题 grade'} · 共 {pv.bank.all.length + pv.bank.bad.length} 行</p>
          <div className="row gap16 wrap preview-counts">
            <span className="tag big">新增 {pv.isNew}</span><span className="tag big">更新 {pv.isUpd}</span><span className="tag big bad">错误 {pv.bank.bad.length}</span>
          </div>
          <div className="row gap16 wrap preview-counts">
            <span className="tag big ok">可玩 {pv.bank.counts.playable}</span><span className="tag big">待家长确认 {pv.bank.counts.pendingParent}</span>
            <span className="tag big">待审核 {pv.bank.counts.pending}</span><span className="tag big">停用 {pv.bank.counts.disabled}</span>
          </div>
          {pv.bank.bad.length > 0 && <div className="issues"><b>错误（不会导入）：</b>{pv.bank.bad.slice(0, 15).map(x => <div key={x.row}>第 {x.row} 行（{x.id}）：{x.errors.join('；')}</div>)}</div>}
          {pv.bank.warnings.length > 0 && <div className="issues warnbox"><b>提示：</b>{pv.bank.warnings.slice(0, 10).map((x, i) => <div key={i}>第 {x.row} 行（{x.id}）：{x.errors.join('；')}</div>)}{pv.bank.warnings.length > 10 && <div>……共 {pv.bank.warnings.length} 条</div>}</div>}
          <div className="row gap16"><button className="btn ghost" onClick={() => setPv(null)}>取消，修改后重新导入</button>
            <button className="btn" data-testid="import-confirm" disabled={!pv.bank.all.length} onClick={doImport}>只导入正确的 {pv.bank.all.length} 题</button></div>
        </div>
      </Modal>}
    </div>
  );
}

function TimeTab({ profiles, usage, setUsage, clockLocked, unlockClock }: ParentProps) {
  const today = dayStr();
  return (
    <div className="col gap16">
      {clockLocked && <div className="p-card wide"><b>⏰ 时间锁定中</b><p className="hint">检测到平板时间被调回，今天按「已用完」处理。确认时间正确后可解除。</p><button className="btn" data-testid="unlock-clock" onClick={unlockClock}>解除时间锁定</button></div>}
      <table className="tbl"><thead><tr><th>孩子</th><th>今日已玩</th><th>今日剩余</th><th>每日上限（上学日/周末）</th><th>临时加时</th></tr></thead>
        <tbody>{profiles.map(p => { const u = usage[p.id] ?? {}; const r = u[today] ?? { used: 0, bonus: 0 };
          return <tr key={p.id}><td>{p.avatar} {p.name}</td><td>{Math.floor(r.used / 60)} 分 {r.used % 60} 秒</td><td>{fmtMin(remainingSec(effLimit(p), u, today))}</td><td>{effLimit(p).weekday || '不限'} / {effLimit(p).weekend || '不限'}</td>
            <td><button className="chip" data-testid={'bonus-' + p.id} onClick={() => setUsage(p.id, addBonus(u, today, 600))}>＋10 分钟</button>{r.bonus > 0 && <> <small data-testid={'bonus-now-' + p.id}>今天已加 {Math.round(r.bonus / 60)} 分钟</small> <button className="chip" data-testid={'bonus-cancel-' + p.id} onClick={() => setUsage(p.id, cancelBonus(u, today))}>取消</button></>}</td></tr>; })}</tbody></table>
      <div className="p-card"><b>动画</b> <ReduceToggle /><p className="hint">系统开启「减弱动态效果」时也会自动减少动画。</p><PrefetchAnim /><p className="hint">动画素材平时在第一次进入战斗时下载；联网空闲时也会按孩子的年级和学科在后台缓存。</p><OfflineReady /></div>
      <p className="hint">上限在「孩子档案 → 编辑」里改。只在答题/复习时计时，切到后台不计；关卡进行中时间到了会让孩子打完这一关。</p>
    </div>
  );
}

function BackupTab() {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string>();
  const [pending, setPending] = useState<any>(null);
  const [needPin, setNeedPin] = useState(false); const [rpin, setRpin] = useState('');
  useEffect(() => { if (pending) { setRpin(''); void currentPin().then(c => setNeedPin(!!c.vault)); } }, [pending]);
  return (
    <div className="col gap16">
      <p>备份包含：孩子档案、星星和进度、错题本、答题记录、难度等级、时长记录、家长导入的题、设置（含家长密码）。</p>
      <div className="row gap16">
        <button className="btn" data-testid="backup-export" onClick={async () => { const d = await exportAll(); download(`知识勇者备份_${dayStr()}.json`, JSON.stringify(d)); void setKV('lastBackupAt', Date.now()); setMsg('已导出备份文件'); }}>💾 导出备份</button>
        <input ref={ref} type="file" accept=".json,application/json" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { const d = JSON.parse(await f.text()); validateBackup(d); setPending(d); } catch (er) { setMsg(er instanceof SyntaxError ? '文件无法读取（不是 JSON）' : (er as Error).message); } e.target.value = ''; }} />
        <button className="btn ghost" onClick={() => ref.current?.click()}>📂 从备份恢复</button>
      </div>
      {msg && <p className="note">{msg}</p>}
      {pending && <Modal onClose={() => setPending(null)}>
        <h2>确定恢复？</h2><p>会用备份（{pending.exportedAt ?? '未知时间'}）<b>覆盖</b>这台平板上的全部数据。</p>
        {(() => { const v = validateBackup(pending).preview; return <p className="hint" data-testid="restore-preview">备份内容：孩子档案 {v.profiles} 个 · 设置/进度 {v.kv} 项 · 答题记录 {v.answers} 条 · 错题 {v.wrong} 条 · 导入题 {v.bank} 道{v.skipped ? ` · 跳过损坏行 ${v.skipped}` : ''}。恢复前会自动下载一份当前数据的快照。</p>; })()}
        <p className="hint" data-testid="restore-pin-note">{needPin ? '这台平板已设家长密码：恢复后仍用现在的密码。' : '这台平板还没有家长密码：会一起恢复备份里的家长密码和恢复码。'}正在进行的密码重设不会因为恢复而取消。</p>
        {needPin && <label className="row gap8">当前家长密码 <input type="password" inputMode="numeric" data-testid="restore-pin" value={rpin} onChange={e => setRpin(e.target.value)} /></label>}
        <div className="row gap16"><button className="btn ghost" onClick={() => setPending(null)}>取消</button>
          <button className="btn danger" data-testid="restore-go" disabled={needPin && !rpin} onClick={async () => { try { const snap = await importAll(pending, { pin: rpin }); download(`知识勇者_恢复前快照_${dayStr()}.json`, JSON.stringify(snap)); setTimeout(() => location.reload(), 800); } catch (e) { setMsg((e as Error).message); setPending(null); } }}>覆盖恢复</button></div>
      </Modal>}
      <UndoRestore />
      <p className="hint">iPad：「添加到主屏幕」的 App 与 Safari 的数据是分开的，换设备或清理浏览器前请先导出备份。</p>
      <InstallHelp />
    </div>
  );
}

function UndoRestore() {
  const [snap, setSnap] = useState<any>();
  useEffect(() => { void getKV('snapshot:last').then(setSnap); }, []);
  if (!snap) return null;
  return <button className="btn ghost" data-testid="undo-restore" onClick={async () => { if (!confirm('撤销上一次恢复，回到恢复前的数据？')) return; await importAll(snap, { trusted: true }); await setKV('snapshot:last', undefined); location.reload(); }}>↩ 撤销恢复（回到 {String(snap.exportedAt ?? '').slice(0, 16).replace('T', ' ')} 的数据）</button>;
}
function PinTab({ settings, setSettings }: ParentProps) {
  const [step, setStep] = useState<'old' | 'new' | 'confirm' | 'done'>('old');
  const [n1, setN1] = useState(''); const [err, setErr] = useState<string>();
  if (step === 'done') return <><p className="note">✔ 密码已修改</p><RecGen settings={settings} setSettings={setSettings} /></>;
  return <><RecGen settings={settings} setSettings={setSettings} /><PinPad title={step === 'old' ? '输入旧密码' : step === 'new' ? '输入新密码' : '再输入一次新密码'} hint="请输入 4–6 位数字" error={err} onSubmit={async p => {
    if (step === 'old') { if (await verifyPin(p, settings.pinHash)) { setStep('new'); setErr(undefined); } else setErr('旧密码不对'); return; }
    if (step === 'new') { if (!validPin(p)) { setErr('4–6 位数字'); return; } setN1(p); setStep('confirm'); setErr(undefined); return; }
    if (p !== n1) { setErr('两次不一致'); setStep('new'); return; }
    setSettings({ ...settings, pinHash: await makePinHash(p) }); markPinSet(); setStep('done');
  }} /></>;
}
/** r12（较真家长）：查看 / 重新生成恢复码（家长页内，已过密码）。旧码只存哈希，看不到原文，只能重新生成（旧的作废） */
export function RecGen({ settings, setSettings, prompt }: { settings: Settings; setSettings: (s: Settings) => void; prompt?: boolean }) {
  const [code, setCode] = useState('');
  if (code) return <div className="p-card" data-testid="recgen-code"><b>新的恢复码（只显示这一次）</b><div className="rec-code" data-testid="rec-code">{code.slice(0, 4)} {code.slice(4)}</div><p className="hint">请抄在纸上或拍照保存，别让孩子看到。旧的恢复码已作废。</p><button className="btn" data-testid="recgen-done" onClick={() => setCode('')}>我记下了</button></div>;
  const gen = async () => { const c = makeRecoveryCode(); setSettings({ ...settings, pinRec: await makePinHash(c), recPrompted: true }); setCode(c); };
  if (prompt) return settings.pinHash && !settings.pinRec && !settings.recPrompted ? <div className="yellow-bar" data-testid="recgen-prompt">🔑 你的家长密码是在有「恢复码」之前设置的。生成一个恢复码，忘记密码时能马上重设。<button className="chip" data-testid="recgen-now" onClick={gen}>现在生成</button><button className="chip" data-testid="recgen-later" onClick={() => setSettings({ ...settings, recPrompted: true })}>以后再说</button></div> : null;
  return <div className="p-card"><b>恢复码</b><p className="hint">{settings.pinRec ? '已设置恢复码（只存了指纹，原文看不到）。忘了或丢了可以重新生成，旧的会作废。' : '还没有恢复码。'}</p><button className="btn ghost" data-testid="recgen" onClick={gen}>{settings.pinRec ? '查看/重新生成恢复码' : '生成恢复码'}</button></div>;
}


/** 报告 #9：每个孩子的学习报告（复用答题记录 + 错题本；月度汇总后续再做） */
function ReportTab(props: ParentProps) {
  const { profiles, bank } = props;
  const [pid, setPid] = useState((props.currentPid && profiles.some(x => x.id === props.currentPid) ? props.currentPid : undefined) ?? profiles[0]?.id);   // r9：默认当前孩子
  const [data, setData] = useState<{ a: AnswerRecord[]; w: WrongEntry[]; ru: Rollup }>();
  useEffect(() => { if (!pid) return; setData(undefined); void Promise.all([answersOf(pid), wrongOf(pid), rollupOf(pid)]).then(([a, w, ru]) => setData({ a, w, ru })); }, [pid]);
  if (!profiles.length) return <p>还没有孩子档案。</p>;
  const since = Date.now() - 7 * 864e5;
  const by = new Map<string, { n: number; ok: number; n7: number; ok7: number }>();
  const units = new Map<string, { n: number; ok: number }>();
  for (const r of data?.a ?? []) {
    const q = bank.byKey.get(r.questionId); const sub = r.subject ?? q?.subject ?? '其他';
    const e = by.get(sub) ?? { n: 0, ok: 0, n7: 0, ok7: 0 }; e.n++; if (r.correct) e.ok++; if (r.at >= since) { e.n7++; if (r.correct) e.ok7++; } by.set(sub, e);
    const u = q ? `${sub} · ${q.unit ?? q.tags?.[0] ?? ''}` : ''; if (u) { const x = units.get(u) ?? { n: 0, ok: 0 }; x.n++; if (r.correct) x.ok++; units.set(u, x); }
  }
  const pct = (a: number, b: number) => b ? Math.round(a / b * 100) + '%' : '—';
  const weak = [...units].filter(([, x]) => x.n >= 3 && x.ok / x.n < 0.8).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).slice(0, 5);
  const w = data?.w ?? []; const today = dayStr();
  return (
    <div className="col gap16" data-testid="report">
      <div className="row gap16 wrap">{profiles.map(p => <button key={p.id} className={`chip ${p.id === pid ? 'on' : ''}`} data-testid={'report-' + p.id} onClick={() => setPid(p.id)}>{p.avatar} {p.name}</button>)}</div>
      {!data ? <p>加载中…</p> : <>
        <p>累计答题 {data.a.length} 题 · 正确率 {pct(data.a.filter(r => r.correct).length, data.a.length)} · 近 7 天 {data.a.filter(r => r.at >= since).length} 题</p>
        <table className="report-table"><thead><tr><th>科目</th><th>答题</th><th>正确率</th><th>近 7 天正确率</th></tr></thead>
          <tbody>{[...by].map(([s, e]) => <tr key={s}><td>{s}</td><td>{e.n}</td><td>{pct(e.ok, e.n)}</td><td>{pct(e.ok7, e.n7)}</td></tr>)}</tbody></table>
        {weak.length > 0 && <><h3>需要加强（至少 3 题）</h3><ul>{weak.map(([u, x]) => <li key={u}>{u}：{pct(x.ok, x.n)}（{x.n} 题）</li>)}</ul></>}
        <h3>错题本</h3>
        <p data-testid="report-wrong">共 {w.length} 题 · 今天待复习 {w.filter(e => e.due <= today).length} · 已掌握中（第 3 盒）{w.filter(e => e.box === 3).length}</p>
        <h3>月度汇总</h3>
        {(() => { const m = rollupAdd(data.ru, data.a, r => bank.byKey.get(r.questionId)?.subject ?? '其他'); const ms = Object.keys(m).sort().reverse();
          return ms.length ? <table className="report-table" data-testid="report-monthly"><thead><tr><th>月份</th><th>科目</th><th>答题</th><th>正确率</th></tr></thead>
            <tbody>{ms.flatMap(mo => Object.entries(m[mo]).map(([sub, e]) => <tr key={mo + sub}><td>{mo}</td><td>{sub}</td><td>{e.n}</td><td>{pct(e.ok, e.n)}</td></tr>))}</tbody></table> : <p>暂无</p>; })()}
        <p className="hint">答题明细保留 180 天，更早的按月份×科目汇总保存。</p>
      </>}
    </div>
  );
}

/** r10：家长页手动安装说明（桌面 Chrome / 安卓 / iPad），横幅关掉或没出现时也能装 */
function InstallHelp() {
  const dp = useInstallPrompt(); const [msg, setMsg] = useState('');
  const ios = isIOS();
  return <div className="p-card" data-testid="install-help"><b>📲 安装到主屏幕 / 桌面</b>
    {isStandalone() ? <p>✅ 已经是安装后的 App 模式。</p> : <>
      {ios ? <p data-testid="install-help-ios"><IosSteps /></p>
        : dp ? <button className="btn" data-testid="install-now" onClick={() => { void promptInstall().then(ok => setMsg(ok ? '✅ 已安装' : '没有安装。可以再点一次，或按下面的步骤手动安装。')); }}>现在安装</button>
        : <p className="hint" data-testid="install-no-prompt">浏览器现在没有提供一键安装（例如刚取消过，或已经装过），请按下面的步骤手动安装：</p>}
      {msg && <p className="hint" data-testid="install-msg">{msg}</p>}
      <ul className="hint">
        <li>电脑 Chrome / Edge：地址栏右侧的「安装」图标（⊕ 或小电脑），或菜单 ⋮ → 「投放、保存和分享」→「安装页面…」。</li>
        <li>安卓 Chrome：菜单 ⋮ → 「添加到主屏幕」/「安装应用」。</li>
        <li>iPad / iPhone Safari：顶部「分享」⬆ → 「添加到主屏幕」。</li>
      </ul></>}
  </div>;
}
