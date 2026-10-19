import { backupVault } from '../game/backupPin';
import { logReload } from '../swUpdate';
import { ReduceToggle } from './Battle';
import { prefetchAll } from '../fx/sheets';
import { useState as useS } from 'react';
import { offlineStatus, onOffline, voiceStatus, onVoiceStatus, cacheVoiceForOffline } from '../offlineCache';
import { BANK_VER, BANK_RELEASE } from '../bankStore';
import { VERSION_LABEL } from '../version';
import { useInstallPrompt, isStandalone, isIOS, IosSteps, promptInstall } from './Screens';
import { toggleVol as toggleVolS, toggleAllVols, volsValid, learnedCount } from '../game/volumes';
import { effLimit, MIN_LIMIT } from '../state';
import { STAR_RULES_K } from '../game/levels';
import { K_NOSTAR_TEXT, K_AGAIN_TEXT } from '../game/playtime';
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
    {/* r15.4.2 较真家长 D：题库指纹 / 构建号对家长没用，收进「技术信息」（反馈问题时展开给客服看） */}
    <br /><details className="tech-info"><summary>技术信息</summary><b data-testid="version-label">版本 {VERSION_LABEL}</b><br /><span data-testid="build-info">题库 {BANK_RELEASE} · {BANK_VER} · 构建 {typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'} · {typeof __BUILD_TIME__ === 'string' ? buildDate() : ''}</span></details></p>;
}
/** r15.4.1 技术QA P2-1：小班离线录音下载进度 + 手动「下载离线录音」 */
export function VoiceOffline() {
  const [s, setS] = useS(voiceStatus()); const [busy, setBusy] = useS(false);
  useEffect(() => onVoiceStatus(setS), []);
  const ready = !!s && s.total > 0 && s.done >= s.total && s.failed === 0;
  /* r15.4.2 较真家长 D / 技术QA P3-4：家长看得懂的说法——不写「507 段」；下载中显示真实已下载的比例；没下成功说清会自动重试 */
  const state = !s ? 'none' : ready ? 'done' : s.state === 'running' || (s.done < s.total && !s.failed) ? 'running' : 'failed';
  const pct = s && s.total ? Math.floor(((s.ok ?? Math.max(0, s.done - s.failed)) / s.total) * 100) : 0;
  return <p className="hint" data-testid="voice-offline" data-ready={ready ? '1' : '0'} data-state={state}>
    {state === 'done' ? '✅ 小班录音已下载，断网也能听' : state === 'running' ? <>⏳ 小班录音正在下载…已下载 <span data-testid="voice-offline-pct">{pct}%</span>（请保持联网）</> : state === 'failed' ? <>⚠️ 小班录音还差一点没下载完（已下载 <span data-testid="voice-offline-pct">{pct}%</span>），联网后会自动补全</> : '小班录音：有小班档案时，联网后会自动下载'}
    {!ready && state !== 'running' && <> <button className="chip" data-testid="voice-offline-dl" disabled={busy} onClick={() => { setBusy(true); void cacheVoiceForOffline().finally(() => setBusy(false)); }}>{state === 'failed' ? '⟳ 现在重试' : '⬇ 现在下载（约 4.5MB）'}</button></>}</p>;
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
import { validPin, remainingSec, limitMinutes, addBonus, cancelBonus, bonusUsedSec, cancelPreview, bonusAllSpent, splitUsed, fmtMS, type Usage } from '../game/playtime';
import { dayStr } from '../game/wrongbook';
import { AVATARS, newProfile, type Profile, type Settings } from '../state';
import { questionsOfGrade, type BankState } from '../bankStore';
import { mergeAll, mergePreview } from '../db';
import { exportAll, importAll, putImported, clearImported, validateBackup, currentPin, backupSecretOk, checkPinSaved } from '../db';
import { logErr } from '../navLog';
import { exportQuestion } from '../game/questions';
import { getKVStrict } from '../db';
import { ResetWhy } from './ResetCancel';
import { setKV, getKV, answersOf, wrongOf, rollupOf, rollupAdd, type AnswerRecord, type Rollup } from '../db';
import type { WrongEntry } from '../game/wrongbook';
import { DESIGN } from '../game/config';
import { HoldButton } from './Battle';
import { noZhVoice } from '../tts';
import { nextLock24, LK_REC, makePinHash, verifyPin, loadLock, saveLock, nextLock, tickLock, lockLeft, LK_HINT, LK_IMPORT, markPinSet, pinWasSet, HINT_QUESTIONS, normAnswer, type LockState } from '../game/pin';
import { pendingDays, pendingWaitedMs, PEND_DAYS, findRec, newPending } from '../game/pinVault';
import { hintCandidates, answerVariants, readLocal, readCache, makeRecoveryCode, normCode, RESET_DELAY_MS, fmtWhen, fmtDay } from '../game/pinVault';
import type { Skills } from '../game/adaptive';

/** 家长密码门（D9 锁定 / X-13 首次设置需提示问题 / P2-1 密码丢失不当首次） */
export function ParentGate({ onRecConfirmed, allHints, settings, onSetPin, onOk, onCancel, purpose, onRestorePin, hasProgress, onRequestReset, initialMode }: { onRecConfirmed?: () => void; initialMode?: 'forgot' | 'rec'; allHints?: string[]; settings: Settings; onSetPin: (h: string, hint?: { q: string; a: string }, rec?: string) => void; onOk: () => void; onCancel: () => void; purpose?: string; onRestorePin?: (h: string, hint?: { q: string; a: string }, rec?: string) => void; hasProgress?: boolean; onRequestReset?: () => void }) {
  const [first, setFirst] = useState<string>();
  const [err, setErr] = useState<string>();
  const [lock, setLock] = useState<LockState>({ fails: 0, level: 0, until: 0 });
  const [hlock, setHlock] = useState<LockState>({ fails: 0, level: 0, until: 0 });   // r9：找回问题单独锁定
  const [rc, setRc] = useState(''); const [rerr, setRerr] = useState<string>();
  const [rlock, setRlock] = useState<LockState>({ fails: 0, level: 0, until: 0, remain: 0 });   // r12：恢复码单独计错、锁 24 小时
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState<'pin' | 'hint' | 'forgot' | 'lost' | 'code' | 'rec' | 'reset' | 'recset'>(initialMode === 'forgot' ? (settings.pinHint ? 'forgot' : settings.pinRec ? 'rec' : 'reset') : initialMode ?? 'pin');
  const [code, setCode] = useState('');
  const [hq, setHq] = useState(''); const [ha, setHa] = useState('');   // r13 较真家长：找回问题不预选（以前默认「孩子的小名」，和「别选孩子也知道答案的问题」自相矛盾）
  const [pend, setPend] = useState<string>(); const [np1, setNp1] = useState(''); const [np2, setNp2] = useState('');
  // r13 较真家长：找回问题 / 恢复码验证通过后不再先清掉旧密码；新密码 + 找回问题收齐后一次提交，提交成功才作废旧恢复码、发新码
  const [resetting, setResetting] = useState(false); const [selfErr, setSelfErr] = useState<string>(); const [hintReq, setHintReq] = useState(false);
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
      /* r15.4.4 技术QA P3：覆盖恢复清零锁后，若本页还握着旧锁，先从存储拉一份（密码页 / 忘记密码页都走这里） */
      if ((window as unknown as { __zyRestoring?: boolean }).__zyRestoring) { void loadLock().then(setLock); void loadLock(LK_HINT).then(setHlock); void loadLock(LK_REC).then(setRlock); return; }
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
      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input" data-testid="rec-input" placeholder="8 位恢复码" value={rc} disabled={rlocked} maxLength={12} onChange={e => setRc(e.target.value)} />
      {(rlockMsg || rerr) && <p className="warn" data-testid="rec-msg">{rlockMsg ?? rerr}</p>}
      <button className="btn" data-testid="rec-ok" disabled={rlocked || normCode(rc).length !== 8} onClick={async () => {
        const ok = await verifyPin(normCode(rc), settings.pinRec) || await (async () => { const h = await findRec(await getKV<any>('settings'), (await getKV<any[]>('profiles')) ?? [], getKV); return !!h && h !== settings.pinRec && verifyPin(normCode(rc), h); })(); const n = await noteR(ok);
        if (ok) { await note(true); setResetting(true); setMode('recset'); setNp1(''); setNp2(''); setHq(''); setHa(''); setErr(undefined); setRerr(undefined); setRc(''); } else setRerr(lockLeft(n) > 0 ? undefined : `恢复码不对，还可以试 ${5 - n.fails} 次`);
      }}>用恢复码重设</button></div>;
  const restoreEntry = <GateRestore />;
  // r11：设好密码后生成 8 位恢复码，只显示这一次
  const finishSet = async (pin: string, hint?: { q: string; a: string }) => { const c = makeRecoveryCode(); { const z = nextLock(lock, true, Date.now()); setLock(z); await saveLock(z); const zh = nextLock24(hlock, true, Date.now()); setHlock(zh); await saveLock(zh, LK_HINT); }   /* r15.4.2 技术QA P2-1：设了新密码（含恢复码 / 找回问题重设）→ 家长密码锁和找回问题锁清零 */ setSelfErr(undefined); onSetPin(await makePinHash(pin), hint, await makePinHash(c));
    /* r15.4.3 较真家长 P1：存好后马上用刚输入的密码核对所有副本（和锁屏用的同一份）；对不上就报错、停在这一页，不发恢复码、不放行 */
    const chk = await checkPinSaved(pin); if (!chk.ok) { logErr('pin-selfcheck', chk.bad.join(',')); setSelfErr('新密码没有存好（存下来的和刚输入的对不上），请再点一次「确定」重试；如果一直这样，请先导出备份再刷新页面。'); return false; }
    markPinSet(); setCode(c); setMode('code'); return true; };
  const selfBox = selfErr ? <p className="warn" data-testid="pin-selfcheck">{selfErr}</p> : null;
  const resetBox = <div className="p-card" data-testid="reset-box"><b>没有恢复码？</b><p className="hint" data-testid="reset-box-text">约 3 天后答对找回问题即可重设。等待期间每次打开游戏都会提醒；不是你申请的，输入家长密码就能取消。时长限制照常生效。</p>
    {settings.pinReset && <ResetWhy open testid="reset-rules" />}{settings.pinReset ? <><p data-testid="reset-pending">{settings.pinReset.ready ? '申请已到期：请回答找回问题或输入恢复码来设新密码。两样都没有，只能导入备份文件或清除浏览器数据（会清掉进度），见 ❓ 说明。' : '已申请：约 3 天后到期（规则见上）；到期后还要答对找回问题或输入恢复码。'}</p>{settings.pinReset && <p className="big-rule" data-testid="reset-progress">已等 {Math.min(72, Math.floor(pendingWaitedMs(settings.pinReset) / 3600e3)) /* r15.4：和忘记密码页同一个数（联网申请按网络时间差），以前用本机累计 observed，两处显示会不一样 */} 小时（满 72 小时）<br />已打开 {Math.min(PEND_DAYS, pendingDays(settings.pinReset))}/{PEND_DAYS} 天</p>}</> : <button className="btn ghost" data-testid="reset-request" onClick={() => onRequestReset?.()}>申请重设密码（约 3 天后到期）</button>}</div>;
  if (mode === 'code') return (
    <div className="center-screen"><div className="pinpad"><h2>请记下恢复码</h2>
      <p>忘记密码时，用这个恢复码可以马上重设密码。<b>只显示这一次</b>，请抄在纸上或拍照保存，别让孩子看到。</p>
      <div className="rec-code" data-testid="rec-code">{code.slice(0, 4)} {code.slice(4)}</div>
      <RecTypeBack code={code} onConfirmed={() => { onRecConfirmed?.(); setCode(''); onOk(); }} onLater={() => { setCode(''); onOk(); }} /></div></div>);
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
      <HintQ q={hq} setQ={setHq} />
      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input" data-testid="hint-answer" placeholder="答案" value={ha} onChange={e => setHa(e.target.value)} />
      <button className="btn" data-testid="hint-ok" disabled={!hq.trim() || !normAnswer(ha)} onClick={async () => finishSet(pend, { q: hq.trim(), a: await makePinHash(normAnswer(ha)) })}>完成</button>{selfBox}</div></div>);
  // r14 较真家长：恢复码重设——新密码、确认密码、找回问题和答案在同一个面板里一次提交；提交成功才作废旧恢复码、发新码
  if (mode === 'recset') { const okPin = /^\d{4}$/.test(np1) && np1 === np2; return (
    <div className="center-screen"><div className="pinpad wide-panel" data-testid="recset"><h2>设新密码</h2>
      <label className="col gap8">新的 4 位家长密码<input autoComplete="new-password" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input" type="password" inputMode="numeric" maxLength={4} data-testid="recset-pin1" value={np1} onChange={e => setNp1(e.target.value.replace(/\D/g, ''))} /></label>
      <label className="col gap8">再输一次<input autoComplete="new-password" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input" type="password" inputMode="numeric" maxLength={4} data-testid="recset-pin2" value={np2} onChange={e => setNp2(e.target.value.replace(/\D/g, ''))} /></label>
      {np2.length === 4 && np1 !== np2 && <p className="warn" data-testid="recset-mismatch">两次输入的密码不一样</p>}
      <b>找回问题</b><HintQ q={hq} setQ={setHq} />
      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input" data-testid="recset-answer" placeholder="答案" value={ha} onChange={e => setHa(e.target.value)} />
      <div className="row gap16"><button className="btn" data-testid="recset-ok" disabled={!okPin || !hq.trim() || !normAnswer(ha)} onClick={async () => { if (!(await finishSet(np1, { q: hq.trim(), a: await makePinHash(normAnswer(ha)) }))) return; setResetting(false); }}>确定（旧恢复码作废）</button>
        <button className="btn ghost" onClick={() => { setResetting(false); setMode(settings.pinHint ? 'forgot' : 'rec'); }}>取消</button></div>{selfBox}
      {!(okPin && hq.trim() && normAnswer(ha)) && <p className="hint" data-testid="recset-why">还差：{[!/^\d{4}$/.test(np1) && '4 位新密码', /^\d{4}$/.test(np1) && np1 !== np2 && '再输一次相同的密码', !hq.trim() && '选或写一个找回问题', !normAnswer(ha) && '找回问题的答案'].filter(Boolean).join('、')}</p>}</div></div>); }
  if (mode === 'forgot' && settings.pinHint && OLD_HINT_QUESTIONS.includes(settings.pinHint.q)) return (
    <div className="center-screen"><div className="pinpad wide-panel" data-testid="forgot-old-hint"><h2>忘记密码</h2><p className="big-rule">原来的找回问题（{settings.pinHint.q}）孩子可能知道答案，已经不能用来找回。</p><p>请用恢复码重设，或从备份恢复。</p>{recBox(true)}{restoreEntry}<button className="btn ghost" onClick={onCancel}>返回</button></div></div>);
  /* r15.4 策划 / 较真家长：忘记密码页改成三个编号选项 + 折叠的「为什么要等 3 天？」，正文深灰、只有错误提示用深红。文字是策划定稿，逐条对过代码规则（不符的一条没放，见发布说明） */
  if (mode === 'forgot' && settings.pinHint) { const pr = settings.pinReset; const waitedH = pr ? Math.min(72, Math.floor(pendingWaitedMs(pr) / 3600e3)) : 0; const daysN = pr ? Math.min(PEND_DAYS, pendingDays(pr)) : 0; return (
    <div className="center-screen"><div className="pinpad wide-panel forgot-page" data-testid="forgot-page"><h2>忘记家长密码了？选一种办法：</h2>
      <ol className="forgot-opts">
        <li data-testid="forgot-opt-rec"><p>① 我有恢复码：输入设置密码时保存的 8 位恢复码，马上设新密码。</p>{settings.pinRec ? recBox(false) : <p className="hint">这台平板还没有恢复码。</p>}</li>
        <li data-testid="forgot-opt-backup"><p>② 我有备份文件：从备份恢复。</p><ul className="forgot-backup-notes"><li data-testid="forgot-backup-pin">家长密码：会变回<b>备份时的</b>密码（不是现在的）。</li><li data-testid="forgot-backup-today">今天已经玩的时长：保留<b>这台平板</b>记的，不会被备份改掉。</li></ul>{restoreEntry}</li>
        <li data-testid="forgot-opt-reset"><p>③ 什么都没有：点「申请重设」。约 3 天后回到这里，答对找回问题，就能设新密码。等这几天，是为了防止孩子自己重设密码。</p>
          {pr && <div data-testid="reset-progress"><label className="pbar-row">已等 {waitedH} 小时 / 72<progress data-testid="reset-bar-hours" max={72} value={waitedH} /></label>
            <label className="pbar-row">已打开 {daysN} / 3 天<progress data-testid="reset-bar-days" max={3} value={daysN} /></label></div>}
          {/* 规则不变：申请本身不用答题（r15.1 起就有「申请重设」按钮）；到期后要答对找回问题才设新密码 */}
          {!pr && <button className="btn ghost" data-testid="reset-request" onClick={() => onRequestReset?.()}>申请重设</button>}
          {pr?.ready && <><p>{settings.pinHint.q}</p><input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input" data-testid="forgot-answer" value={ha} disabled={hlocked} onChange={e => setHa(e.target.value)} />
            <button className="btn" data-testid="forgot-ok" disabled={hlocked || !ha} onClick={async () => {
              const ok = await checkHint(ha); const n = await noteH(ok); if (ok) { await note(true); setResetting(true); setMode('pin'); setFirst(undefined); setErr(undefined); }
              else setErr(lockLeft(n) > 0 ? undefined : `答案不对，还可以试 ${5 - n.fails} 次`);
            }}>确定</button></>}
          {(hlockMsg || err) && <p className="err-dark" data-testid="forgot-msg">{hlockMsg ?? err}</p>}</li>
      </ol>
      <ResetWhy />
      <button className="btn ghost" onClick={() => setMode('pin')}>返回</button></div></div>); }
  if (mode === 'reset') return <div className="center-screen"><div className="pinpad"><h2>忘记密码</h2>{resetBox}<button className="btn ghost" onClick={() => setMode('pin')}>返回</button></div></div>;
  if (!settings.pinHash || resetting) return (
    <div className="center-screen">{sub}
      <PinPad title={first ? '再输入一次确认' : resetting ? '设置新的家长密码' : '请爸爸妈妈来设置家长密码'} hint="请输入 4–6 位数字" error={err} onCancel={onCancel} onSubmit={p => {
        if (!validPin(p)) { setErr('请输入 4–6 位数字'); return; }
        if (!first) { setFirst(p); setErr(undefined); return; }
        if (p !== first) { setFirst(undefined); setErr('两次不一致，请重新设置'); return; }
        setPend(p); setMode('hint');
      }} />
    </div>
  );
  return <div className="center-screen">{sub}<PinPad title="输入家长密码" hint="请输入 4–6 位数字" error={lockMsg ?? err} disabled={locked} onCancel={onCancel}
    extra={<><button className="link-btn" data-testid="forgot" onPointerUp={e => { if (e.pointerType === 'mouse') return; e.preventDefault(); setHa(''); setErr(undefined); setMode(settings.pinHint ? 'forgot' : settings.pinRec ? 'rec' : 'reset'); }} onClick={() => { setHa(''); setErr(undefined); setMode(settings.pinHint ? 'forgot' : settings.pinRec ? 'rec' : 'reset'); }}>忘记密码</button>{restoreEntry}</>}   /* r15.4.4 较真家长 d：触屏第一次抬手就进忘记密码页（以前有时要点两次） */
    onSubmit={async p => {
      if (locked) return;
      // r15 较真家长：内存里的设置可能是旧的（另一个标签页改过 / 刚恢复）——也按库里最新的副本验证
      const ok = await verifyPin(p, settings.pinHash) || await currentPin().then(c => !!c.vault && c.vault.pinHash !== settings.pinHash && verifyPin(p, c.vault.pinHash)); const n = await note(ok);
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
  clockLocked?: boolean; unlockClock?: () => void; resetTiming?: () => void; remainingOf?: (id: string) => number;
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
  /* r15.4.3 较真家长 P3：「已从备份恢复」以前要点「知道了」才消失——现在第一次进家长页显示，下次再进家长页自动收起（也可以点 ✕ / 知道了） */
  useEffect(() => { const s0 = props.settings; if (!s0.restoredFromAt) return; props.setSettings(s0.restoredSeen ? { ...s0, restoredFromAt: undefined, restoredSeen: undefined } : { ...s0, restoredSeen: true }); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const oldHint = !!props.settings.pinHint && OLD_HINT_QUESTIONS.includes(props.settings.pinHint.q);
  // r14 技术QA：孩子能猜到的旧预设问题（小名 / 宠物 / 生日）已不能用来找回；r14.1 策划：不再拦住家长页，只常驻提示「已失效」+「现在更换」，直到换了新问题
  const [hintNow, setHintNow] = useState(false);
  return (
    <div className="parent">
      {props.settings.restoredFromAt && <div className="yellow-bar" data-testid="restored-from">✅ 已从{(() => { const d = new Date(props.settings.restoredFromAt!); return isNaN(+d) ? '一份' : `${d.getMonth() + 1}月${d.getDate()}日的`; })()}备份恢复，家长密码已变成备份时的密码。<button className="chip" data-testid="restored-ok" onClick={() => props.setSettings({ ...props.settings, restoredFromAt: undefined, restoredSeen: undefined })}>知道了</button><button className="chip bar-x" data-testid="restored-close" aria-label="关闭" onClick={() => props.setSettings({ ...props.settings, restoredFromAt: undefined, restoredSeen: undefined })}>✕</button></div>}
      {/* r15.4.4：题库新增的册别已给保存过勾选的档案自动勾上——提示一次（点 ✕ 收起） */}
      {props.profiles.filter(x => x.volNotice?.length).map(x => <div key={x.id} className="yellow-bar" data-testid="vol-new-notice">📚 {x.name}：题库新增了：{x.volNotice!.join('、')}，已自动勾上，不需要可以去掉（孩子档案 → 编辑 → 已学册别）
        <button className="chip" data-testid="vol-new-close" aria-label="知道了" onClick={() => props.setProfiles(props.profiles.map(y => { if (y.id !== x.id) return y; const { volNotice: _n, ...rest } = y; return rest; }))}>✕</button></div>)}
      {oldHint && <div className="yellow-bar" data-testid="old-hint-prompt">🔑 你的找回问题已失效，忘记密码时只能用恢复码或备份 <button className="chip" data-testid="old-hint-now" onClick={() => setHintNow(true)}>现在更换</button></div>}
      {oldHint && hintNow && <HintEdit settings={props.settings} setSettings={s2 => { props.setSettings(s2); setHintNow(false); }} forced />}
      <div className="map-top">
        <button className="back-inline labeled" data-testid="parent-close" onClick={props.onClose} aria-label="退出家长设置">← <small>返回</small></button>
        <h2>家长设置</h2><button className="chip" data-testid="parent-help" aria-label="帮助" onClick={() => setHelp(h => !h)}>❓</button><span className="grow" />
        {tabs.map(([k, l]) => <button key={k} className={`chip ${tab === k ? 'on' : ''}`} data-testid={'ptab-' + k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {warn > 0 && <div className="yellow-bar" data-testid="idle-warn">家长设置很久没有操作了，{warn} 秒后自动退出（没保存的档案会留着草稿）。点任意处继续。</div>}
      {props.settings.pinResetDoneAt && <div className="yellow-bar" data-testid="pin-reset-notice">🔑 家长密码于 {fmtDay(props.settings.pinResetDoneAt)} 被重设过。如果不是你操作的，请检查孩子的时长和设置。<button className="chip" data-testid="pin-reset-ack" onClick={() => props.setSettings({ ...props.settings, pinResetDoneAt: undefined })}>知道了</button></div>}
      {help && <div className="p-card" data-testid="parent-help-pop"><b>❓ 家长帮助</b><ul className="hint">
        <li><b>清除浏览器数据（历史记录、网站数据、缓存）会把孩子的进度、错题本和设置一起删掉</b>，家长密码也可能跟着丢。请定期在「备份/恢复」里导出备份文件。</li>
        <li>设置密码时给的 8 位恢复码请抄下或拍照保存：忘记密码时输入恢复码能马上重设（找回问题要等 72 小时）。可以在「🔑 密码」里重新生成恢复码（旧的作废）。</li>
        <li>忘记密码时：①有恢复码 → 马上重设（新密码和找回问题一起提交后，旧恢复码才作废并发新码）；②记得找回问题答案 → 只能提交 72 小时延时重设申请，到期后再答一次才能设新密码；③密码、找回问题、恢复码都忘了 → 在「备份/恢复」导入以前导出的备份，输入备份时的家长密码或那时的恢复码；④这些都没有 → 只能清除浏览器数据重新开始（进度会清掉）。</li>
        <li>旧的预设找回问题（小名 / 宠物 / 生日）孩子可能知道答案，已失效：家长页顶部会一直提示，点「现在更换」换个新问题；换之前忘记密码只能用恢复码或备份。</li>
        <li>找回问题、恢复码连续错 5 次会锁 24 小时；导入备份时输错备份密码 / 恢复码也计入同一个锁。24 小时锁定只按游戏开着的时间算；72 小时延时重设：联网时按网络时间计算（网络时间和平板时间差 10 分钟以上会取消申请）；不联网时，关掉游戏的时间只有在上一次打开满 5 分钟时才算，每次关闭最多算 12 小时；另外要在至少 3 个不同的日子打开过游戏、游戏开着的时间一共满 30 分钟才生效；时钟往回调会取消申请，调快平板时间无效，换时区不算回调。取消申请要输入家长密码或恢复码；取消框单独计数（连错 5 次只锁取消框 24 小时，不影响用恢复码重设）。</li><li>恢复码显示后请再输入一遍确认已抄好（可以「稍后」）；没确认时家长页会提醒。「重新生成恢复码」要先输入现在的家长密码，旧码立即作废。</li>
        <li>iPad「添加到主屏幕」的 App 与 Safari 里的数据是分开的。</li></ul><button className="chip" onClick={() => setHelp(false)}>关闭</button></div>}
      <RecGen prompt settings={props.settings} setSettings={props.setSettings} />
      <ParentAlerts goBackup={() => setTab('backup')} />
      <div className="parent-body">
        {tab === 'profiles' && <><div className="p-card" data-testid="overview-offline"><OfflineReady /><VoiceOffline /></div><ProfilesTab {...props} /></>}
        {tab === 'report' && <ReportTab {...props} />}
        {tab === 'bank' && <BankTab {...props} />}
        {tab === 'time' && <TimeTab {...props} />}
        {tab === 'backup' && <BackupTab />}
        {tab === 'pin' && <PinTab {...props} />}
      </div>
    </div>
  );
}

const BACKUP_SAVED = 'zy-backup-saved';
/** r15.4 较真家长：备份时间按本机时间显示（「10月17日 07:56」），不显示 ISO 原文 */
export const fmtBackupTime = (iso: unknown) => { const d = new Date(typeof iso === 'string' || typeof iso === 'number' ? iso : NaN); if (isNaN(+d)) return '未知时间'; const p2 = (n: number) => String(n).padStart(2, '0'); return `${d.getMonth() + 1}月${d.getDate()}日 ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
/** 家长页顶部提示：存储用量 > 80%（P1-4）、上次备份 / 超 14 天提醒（P1-5） */
function ParentAlerts({ goBackup }: { goBackup: () => void }) {
  const [usage, setUsage] = useState<number>();
  const [last, setLast] = useState<number | null | undefined>();
  const [nag, setNag] = useState(false);
  useEffect(() => {
    void navigator.storage?.estimate?.().then(e => { if (e.quota) setUsage((e.usage ?? 0) / e.quota); }).catch(() => {});
    void getKV<number>('lastBackupAt').then(t => { setLast(t ?? null); if (!t || Date.now() - t > 14 * 864e5) void getKV<number>('backupSnoozeUntil').then(u => setNag(!(u && Date.now() < u))); });
    /* r15.4 较真家长：导出备份后马上刷新「上次备份」（以前要等撤销恢复 / 重开家长页才变） */
    const f = () => { void getKV<number>('lastBackupAt').then(t => { setLast(t ?? null); if (t) setNag(false); }); };
    window.addEventListener(BACKUP_SAVED, f); return () => window.removeEventListener(BACKUP_SAVED, f);
  }, []);
  const days = last ? Math.floor((Date.now() - last) / 864e5) : null;
  return <>
    {usage !== undefined && usage > 0.8 && <div className="yellow-bar">保存失败风险：平板存储空间快满了（已用 {Math.round(usage * 100)}%），请导出备份</div>}
    <p className="hint backup-age" data-testid="backup-age">上次备份：{last === undefined ? '…' : days === null ? '从未备份' : `${days === 0 ? '今天' : `${days} 天前`}（${fmtBackupTime(last)}）`}</p>
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
      {edit && <ProfileEditor p={edit} bank={bank} onSave={save} onCancel={() => setEdit(null)} day={usage[edit.id]?.[dayStr()]} onCancelBonus={(limitSec: number) => setUsage(edit.id, cancelBonus(usage[edit.id] ?? {}, dayStr(), limitSec))} />}
    </div>
  );
}
function ProfileEditor({ p, bank, onSave, onCancel, day, onCancelBonus }: { p: Profile; bank: BankState; onSave: (p: Profile) => void; onCancel: () => void; day?: { used: number; bonus: number; wrap?: number }; onCancelBonus?: (limitSec: number) => void }) {
  const bonusSec = day?.bonus ?? 0;
  // r10：未保存的表单草稿（超时退出后再进来还在）
  const DK = 'zy-draft-profile';
  const [askCancel, setAskCancel] = useState(false);   // r15.4.2 较真家长：取消加时先确认
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
        <label>名字 <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-testid="profile-name" value={f.name} maxLength={8} onChange={e => setF({ ...f, name: e.target.value })} /></label>
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
        {bonusSec > 0 && (() => { /* r15.4.1 较真家长：按表单里现在的上限算加时用掉多少；取消只取消没用的部分 */ const lim = limitMinutes(effLimit(f), new Date()) * 60; const bu = bonusUsedSec(day, lim); const left = bonusSec - bu; const pv = cancelPreview(day, lim);
          return <><p className="hint" data-testid="bonus-note">{bonusAllSpent(day) ? <>今天的临时加时已取消；取消前已经用掉的 {fmtMS(bonusSec)} 仍算在今天（不能再取消）。</> : <>今天的临时加时 {fmtMS(bonusSec)}{bu > 0 ? <>，<span data-testid="bonus-note-used">加时已用 {fmtMS(bu)}</span></> : null}（只在今天有效，会加在每日上限之外）。{left > 0 ? <button className="chip" data-testid="bonus-cancel" onClick={() => setAskCancel(true)}>取消今天没用的加时 {fmtMS(left)}</button> : <span data-testid="bonus-all-used">已经全部用掉，没有可以取消的。</span>}</>}</p>
            {askCancel && left > 0 && <div className="p-card warn-box" data-testid="bonus-cancel-confirm"><b>取消没用的加时？</b><p className="hint" data-testid="bonus-cancel-text">会取消 {fmtMS(left)} 临时加时。取消后今天还能玩 <b data-testid="bonus-cancel-left">{Number.isFinite(pv.leftAfter) ? fmtMS(pv.leftAfter) : '不限'}</b>{Number.isFinite(pv.leftAfter) && pv.leftAfter >= 60 ? `（约 ${Math.floor(pv.leftAfter / 60)} 分钟）` : ''}（按这里现在的每日上限计算）。</p>
              <div className="row gap16"><button className="btn" data-testid="bonus-cancel-ok" onClick={() => { setAskCancel(false); onCancelBonus?.(lim); }}>确定取消</button><button className="btn ghost" data-testid="bonus-cancel-no" onClick={() => setAskCancel(false)}>算了</button></div></div>}</>; })()}
        <div className="row gap16 wrap"><button className="chip" data-testid="reset-tips" disabled={!f.tips || !Object.keys(f.tips).length} onClick={() => setF({ ...f, tips: {} })}>💡 重置提示（首次提示再弹一次）</button></div>
        <div className="row gap16"><button className="btn ghost" onClick={() => { clearDraft(); onCancel(); }}>取消</button><button className="btn" data-testid="profile-save" disabled={!f.name.trim() || !volsValid(f.volumes)} onClick={() => { clearDraft(); const { volsKnown: _k, ...g } = f; onSave(f.volumes ? { ...g, volsKnown: vols.map(x => x[0]) } : g); }}>保存</button></div>
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
        <label className="toggle"><input type="checkbox" data-testid="hs-wager" checked={settings.hsWager ?? true} onChange={e => setSettings({ ...settings, hsWager: e.target.checked })} /> 高一战斗开启「押注」开关</label>
 
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

function TimeTab({ profiles, usage, setUsage, clockLocked, unlockClock, resetTiming, remainingOf }: ParentProps) {
  const today = dayStr();
  /* r15.4.2 较真家长：「取消没用的」先弹确认（说清取消后今天还能玩多久）；按钮上的时间每秒按最新记录重算 */
  const [cc, setCc] = useState<{ pid: string; lim: number } | null>(null);
  const [, setTick] = useState(0); useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, []);
  const ccInfo = cc ? cancelPreview((usage[cc.pid] ?? {})[today], cc.lim) : null; const ccName = cc ? profiles.find(x => x.id === cc.pid)?.name ?? '' : '';
  return (
    <div className="col gap16">
      {clockLocked && <div className="p-card wide"><b>⏰ 时间锁定中</b><p className="hint">检测到平板时间被调回，今天按「已用完」处理。确认时间正确后可解除。</p><button className="btn" data-testid="unlock-clock" onClick={unlockClock}>解除时间锁定</button></div>}
      <table className="tbl"><thead><tr><th>孩子</th><th>今日已玩</th><th>今日剩余</th><th>每日上限（上学日/周末）</th><th>临时加时</th></tr></thead>
        <tbody>{profiles.map(p => { const u = usage[p.id] ?? {}; const r = u[today] ?? { used: 0, bonus: 0 };
          return <tr key={p.id}><td>{p.avatar} {p.name}</td><td>{(() => { const m = limitMinutes(effLimit(p), new Date()); const base = m ? m * 60 + r.bonus : Infinity; const sp = splitUsed(r.used, base, r.wrap); const bu = bonusUsedSec(r, m * 60);
            /* r15.3 较真家长 / 小萌新：已用和收尾分开显示；上限（含加时）、剩余都精确到秒 */
            return <><span data-testid={'used-' + p.id}>已用 {fmtMS(sp.play)}{sp.wrap > 0 ? <> + 收尾 {fmtMS(sp.wrap)}</> : null}</span>{bu > 0 ? <small className="hint" data-testid={'bonus-used-' + p.id}>（其中加时已用 {fmtMS(bu)}）</small> : null}{sp.over > 0 ? <small className="hint" data-testid={'over-' + p.id}>（比现在的上限多玩了 {fmtMS(sp.over)}：上限是后来改小的）</small> : null} <small className="hint" data-testid={'idle-note-' + p.id}>（2 分钟没操作会暂停计时）</small>
              {m ? <div><small data-testid={'limit-today-' + p.id}>今天上限 {fmtMS(base)}{r.bonus > 0 ? `（含加时 ${fmtMS(r.bonus)}）` : ''}</small>{sp.wrap > 0 ? <small className="hint" data-testid={'wrap-note-' + p.id}> · 收尾最多 3:00，不算进上限</small> : null}</div> : null}</>; })()}</td><td data-testid={'left-' + p.id} data-left-sec={(() => { const v = remainingOf ? remainingOf(p.id) : remainingSec(effLimit(p), u, today); return Number.isFinite(v) ? v : -1; })()}>{(() => { const v = remainingOf ? remainingOf(p.id) : remainingSec(effLimit(p), u, today); return Number.isFinite(v) ? fmtMS(v) : fmtMin(v); })()}{clockLocked ? '（时间锁定中）' : ''}</td><td data-testid={'limit-cfg-' + p.id}>{effLimit(p).weekday ? fmtMS(effLimit(p).weekday * 60) : '不限'} / {effLimit(p).weekend ? fmtMS(effLimit(p).weekend * 60) : '不限'}</td>
            <td><button className="chip" data-testid={'bonus-' + p.id} onClick={() => { if (clockLocked) unlockClock?.(); setUsage(p.id, addBonus(u, today, 600)); }}>＋10 分钟</button>{(() => { const m = limitMinutes(effLimit(p), new Date()); const over = m ? splitUsed(r.used, m * 60 + r.bonus, r.wrap).wrap : 0; return over > 0 ? <small className="warn" data-testid={'bonus-over-' + p.id}> 已超出 {fmtMS(over)}（关卡收尾时间，最多 3 分钟），加的时间先抵掉超出的部分</small> : null; })()}<span className="bonus-slot">{r.bonus > 0 && (() => { const m = limitMinutes(effLimit(p), new Date()); const bu = bonusUsedSec(r, m * 60); return <> <small data-testid={'bonus-now-' + p.id}>{bonusAllSpent(r) ? `今天的加时已取消；取消前已经用掉的 ${fmtMS(r.bonus)} 仍算在今天` : <>今天已加 {r.bonus % 60 ? fmtMS(r.bonus) : `${r.bonus / 60} 分钟`}{bu > 0 ? `，已用 ${fmtMS(bu)}` : ''}</>}</small> {r.bonus - bu > 0 ? <button className="chip" data-testid={'bonus-cancel-' + p.id} onClick={() => setCc({ pid: p.id, lim: m * 60 })}>取消没用的 {fmtMS(r.bonus - bu)}</button> : bonusAllSpent(r) ? null : <small className="hint">（已全部用掉，不能取消）</small>}</>; })()}</span></td></tr>; })}</tbody></table>
      {cc && ccInfo && <Modal onClose={() => setCc(null)}><div className="col gap16" data-testid="bonus-cancel-confirm"><h2>取消{ccName}没用的加时？</h2>
        <p data-testid="bonus-cancel-text">会取消 {fmtMS(ccInfo.cancel)} 临时加时（已经用掉的部分会留下）。<br />取消后{ccName}今天还能玩 <b data-testid="bonus-cancel-left">{Number.isFinite(ccInfo.leftAfter) ? fmtMS(ccInfo.leftAfter) : '不限'}</b>{Number.isFinite(ccInfo.leftAfter) && ccInfo.leftAfter >= 60 ? `（约 ${Math.floor(ccInfo.leftAfter / 60)} 分钟）` : ''}。</p>
        <div className="row gap16"><button className="btn" data-testid="bonus-cancel-ok" onClick={() => { const c = cc; setCc(null); setUsage(c.pid, cancelBonus(usage[c.pid] ?? {}, today, c.lim)); }}>确定取消</button><button className="btn ghost" data-testid="bonus-cancel-no" onClick={() => setCc(null)}>算了</button></div></div></Modal>}
      {resetTiming && <div className="p-card wide" data-testid="reset-timing-box"><b>计时出错了？</b><p className="hint">把今天所有孩子的已玩时长和临时加时清零，并把时间基准重置为现在（解除时间锁定，删掉「今天之后」的时长记录）。</p>
        <button className="btn ghost" data-testid="reset-timing" onClick={() => { if (confirm('把今天的计时清零并重置时间基准？')) resetTiming(); }}>重置今天的计时</button></div>}
      <div className="p-card"><b>动画</b> <ReduceToggle /><p className="hint">系统开启「减弱动态效果」时也会自动减少动画。</p><PrefetchAnim /><p className="hint">动画素材平时在第一次进入战斗时下载；联网空闲时也会按孩子的年级和学科在后台缓存。</p><OfflineReady /><VoiceOffline /></div>
      <ul className="hint time-rules" data-testid="time-rules"><li>每天的上限在「孩子档案 → 编辑」里改。</li><li>计时：选了孩子之后的游戏时间（地图、关卡、结算页、错题复习）。</li><li>不计时：家长页、密码页、选孩子页。</li><li>2 分钟没操作，或切到后台：暂停计时。</li><li>关卡进行中时间到了：让孩子打完这一关。</li><li>每天 0:00 重新计时。</li></ul>
    </div>
  );
}

function BackupTab() {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string>();
  const [pending, setPending] = useState<any>(null);
  const [needPin, setNeedPin] = useState(false); const [rpin, setRpin] = useState(''); const [bsec, setBsec] = useState('');
  const [ilock, setIlock] = useState<LockState>({ fails: 0, level: 0, until: 0, remain: 0 });
  useEffect(() => { void loadLock(LK_IMPORT).then(setIlock); let last = performance.now(); const t = setInterval(() => { const p = performance.now(), dt = p - last; last = p; setIlock(l => { if (!lockLeft(l)) return l; const n = tickLock(l, dt, Date.now()); void saveLock(n, LK_IMPORT); return n; }); }, 1000); return () => clearInterval(t); }, []);
  const ileft = lockLeft(ilock);
  // r14 策划：「合并」只在验证了现在的家长密码后可选
  const [curOk, setCurOk] = useState(false); const [mSum, setMSum] = useState<{ profilesAdded: number; levelsUpdated: number; wrongAdded: number; answersAdded: number } | null>(null);
  useEffect(() => { let dead = false; setCurOk(false); if (!rpin) return; void currentPin().then(async c => { const ok = !!c.vault && await verifyPin(rpin, c.vault.pinHash); if (!dead) setCurOk(ok); }); return () => { dead = true; }; }, [rpin]);
  useEffect(() => { if (pending) { setRpin(''); void currentPin().then(c => setNeedPin(!!c.vault)); } }, [pending]);
  return (
    <div className="col gap16">
      <p>备份包含：孩子档案、星星和进度、错题本、答题记录、难度等级、时长记录、家长导入的题、设置（含家长密码）。</p>
      <div className="row gap16">
        <button className="btn" data-testid="backup-export" onClick={async () => { const d = await exportAll(); download(`知识勇者备份_${dayStr()}.json`, JSON.stringify(d)); void setKV('lastBackupAt', Date.now()).then(() => window.dispatchEvent(new Event(BACKUP_SAVED))); setMsg('已导出备份文件'); }}>💾 导出备份</button>
        <input ref={ref} type="file" accept=".json,application/json" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { const d = JSON.parse(await f.text()); validateBackup(d); setPending(d); } catch (er) { setMsg(er instanceof SyntaxError ? '文件无法读取（不是 JSON）' : (er as Error).message); } e.target.value = ''; }} />
        <button className="btn ghost" onClick={() => ref.current?.click()}>📂 从备份恢复</button>
      </div>
      {msg && <p className="note">{msg}</p>}
      {pending && <Modal onClose={() => setPending(null)}>
        <h2>用备份恢复？</h2><p data-testid="restore-when">备份时间：{fmtBackupTime(pending.exportedAt)}</p>
        {(() => { const v = validateBackup(pending).preview; return <p className="hint" data-testid="restore-preview">备份内容：孩子档案 {v.profiles} 个 · 设置/进度 {v.kv} 项 · 答题记录 {v.answers} 条 · 错题 {v.wrong} 条 · 导入题 {v.bank} 道{v.skipped ? ` · 跳过损坏行 ${v.skipped}` : ''}。恢复前会自动下载一份当前数据的快照。</p>; })()}
        <p className="hint" data-testid="restore-pin-note">{needPin ? '验证：下面两个框填一个就行——记得现在的密码填上面；忘了现在的密码，填下面（备份时的密码或那时的恢复码）。' : '这台平板还没有家长密码。'}</p>
        {(() => { const vault = !!backupVault(pending, validateBackup(pending).clean.kv as [string, unknown][]);   /* r15.4 较真家长：两张清单「会被替换」「会保留」，每类数据只出现一次，和 importAll 实际做的一致 */
          return <div className="hint restore-list" data-testid="restore-replace">
            <p data-testid="restore-will-replace"><b>会被替换：</b>档案、星星和进度、错题和答题记录、导入的题、时长设置和以前的时长记录、其他设置{vault ? '、家长密码和恢复码（换成备份时的，重设申请也取消）' : ''}。</p>
            <p data-testid="restore-will-keep"><b>会保留：</b>今天已经玩了多久（按这台平板记的）、防改时间记录（游戏自己用来发现平板时间被往回调，家长不用管）{vault ? '' : '、现在的家长密码和恢复码（备份里没有密码）'}。</p></div>; })()}
        {needPin && <label className="row gap8" data-testid="restore-pin-label">现在的家长密码（这台平板现在用的） <input autoComplete="new-password" autoCorrect="off" autoCapitalize="off" spellCheck={false} type="password" inputMode="numeric" data-testid="restore-pin" value={rpin} onChange={e => setRpin(e.target.value)} /></label>}
        {/* r15.4.2 较真家长 B：短句分行（不再在词中间断行），占位文字缩短、输入框占满整行 */}
        {needPin && <div className="p-card restore-alt" data-testid="restore-alt"><b>忘了现在的密码？</b><p className="hint">填<b>备份时</b>的家长密码，或那时的 8 位恢复码。</p><p className="hint">连续错 5 次锁 24 小时。</p>
          <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input restore-bsec" data-testid="restore-bsec" disabled={ileft > 0} placeholder="备份时的密码或恢复码" value={bsec} onChange={e => setBsec(e.target.value)} />
          {ileft > 0 && <p className="warn" data-testid="restore-lock">错太多次了，请 {Math.ceil(ileft / 3600e3)} 小时后再试</p>}</div>}
        {mSum && <div className="p-card wide-panel" data-testid="merge-summary"><b>合并预览</b><p>新增孩子档案 {mSum.profilesAdded} 个 · 更新关卡星星 {mSum.levelsUpdated} 关 · 新增错题 {mSum.wrongAdded} 条 · 新增答题记录 {mSum.answersAdded} 条。</p><p className="hint">家长密码、时长设置和今天已用时长保持本机不变。合并前会自动保存当前数据的快照，之后可以「撤销」一次。</p>
          <div className="row gap16"><button className="btn ghost" data-testid="merge-cancel" onClick={() => setMSum(null)}>取消</button><button className="btn" data-testid="merge-confirm" onClick={async () => { try { const r = await mergeAll(pending, { pin: rpin, today: dayStr() }); download(`知识勇者_合并前快照_${dayStr()}.json`, JSON.stringify(r.snapshot)); logReload('import-merge', 'parent'); setTimeout(() => location.reload(), 800); setMsg('已合并，正在重新打开…'); setMSum(null); setPending(null); } catch (e) { setMsg((e as Error).message); setMSum(null); setPending(null); } }}>确定合并</button></div></div>}
        {/* r15.4.2 较真家长 B：两个按钮各一句「什么时候用」 */}
        <div className="hint restore-when-use" data-testid="restore-when-use">{needPin && <p data-testid="when-merge"><b>合并：</b>这台平板上的进度也想留着，把备份里的加进来时用（要现在的密码）。</p>}<p data-testid="when-overwrite"><b>覆盖恢复：</b>换了新平板或数据丢了，想整个回到备份那天时用。</p></div>
        <div className="row gap16"><button className="btn ghost" onClick={() => setPending(null)}>取消</button>
          {needPin && <button className="btn" data-testid="merge-go" disabled={!curOk} title={curOk ? '' : '先输入现在的家长密码'} onClick={async () => setMSum(await mergePreview(pending, dayStr()))}>合并…</button>}
          <button className="btn danger" data-testid="restore-go" disabled={needPin && !rpin && (!bsec || ileft > 0)} onClick={async () => { try {
            const useB = needPin && !rpin && !!bsec; if (useB) { const ok = await backupSecretOk(pending, bsec); const n = nextLock24(ilock, ok, Date.now()); setIlock(n); await saveLock(n, LK_IMPORT); if (!ok) { setMsg(lockLeft(n) > 0 ? '备份密码 / 恢复码连续错 5 次，已锁定 24 小时' : `备份时的家长密码 / 恢复码不对，还可以试 ${5 - n.fails} 次`); setPending(null); return; } }
            const snap = await importAll(pending, useB ? { backupSecret: bsec } : { pin: rpin }); download(`知识勇者_恢复前快照_${dayStr()}.json`, JSON.stringify(snap)); logReload('import-restore', 'parent'); setTimeout(() => location.reload(), 800); } catch (e) { setMsg((e as Error).message); setPending(null); } }}>覆盖恢复</button></div>
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
  return <button className="btn ghost" data-testid="undo-restore" onClick={async () => { if (!confirm('撤销上一次恢复，回到恢复前的数据？')) return; await importAll(snap, { trusted: true }); await setKV('snapshot:last', undefined); logReload('undo-restore', 'parent'); location.reload(); }}>↩ 撤销恢复 / 合并（回到 {(() => { const d = new Date(snap.exportedAt ?? ''); return isNaN(+d) ? '上一次' : d.toLocaleString('zh-CN', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); })()} 的数据）</button>;
}
function PinTab({ settings, setSettings }: ParentProps) {
  const [step, setStep] = useState<'menu' | 'old' | 'new' | 'confirm' | 'done'>('menu');   /* r15.1 较真家长：点进「🔑 密码」不直接弹数字键盘，点「修改家长密码」才出现 */
  const latestS = useRef(settings); latestS.current = settings;
  const [n1, setN1] = useState(''); const [err, setErr] = useState<string>();
  const [forgot, setForgot] = useState<'forgot' | 'rec'>(); const [viaChange, setViaChange] = useState(false);   // r15.4：只有「修改家长密码」走完才提示恢复码仍有效（找回流程里可能已换了新码）
  const toggles = <div className="p-card"><label className="toggle"><input type="checkbox" data-testid="switch-nopin" checked={!!settings.switchNoPin} onChange={e => setSettings({ ...settings, switchNoPin: e.target.checked })} /> 切换档案 / 切换年级不用密码（默认关：每次换另一个孩子的档案或换年级都要家长密码，防止换档案躲时长）</label></div>;
  // r13 较真家长：家长页「输入旧密码」也能走忘记密码 / 恢复码（同一套流程：新密码和找回问题一起提交）
  if (forgot) return <ParentGate settings={settings} initialMode={forgot} onRequestReset={() => setSettings({ ...latestS.current, pinReset: newPending(Date.now()) })} /* r15.1 较真家长：以前没传，「申请重设」点了什么都不做 */ onRecConfirmed={() => setSettings({ ...latestS.current, recConfirmed: true })} onSetPin={(h, hint, rec) => { if (h) setSettings({ ...settings, pinHash: h, pinHint: hint ?? settings.pinHint, pinRec: rec ?? settings.pinRec, ...(rec ? { recConfirmed: false } : {}), ...(rec && settings.pinReset ? { pinReset: undefined, pinResetDoneAt: Date.now() } : {}) }); }}
    onOk={() => { setForgot(undefined); setStep('done'); }} onCancel={() => setForgot(undefined)} />;
  if (step === 'done') return <><p className="note">✔ 密码已修改</p><RecGen settings={settings} setSettings={setSettings} afterChange={viaChange} />{toggles}<HintEdit settings={settings} setSettings={setSettings} /></>;
  return <>{toggles}<HintEdit settings={settings} setSettings={setSettings} /><RecGen settings={settings} setSettings={setSettings} />
    <div className="row gap16"><button className="link-btn" data-testid="pintab-forgot" onPointerUp={e => { if (e.pointerType === 'mouse') return; e.preventDefault(); setForgot('forgot'); }} onClick={() => setForgot('forgot')}>忘记密码</button>{settings.pinRec && <button className="link-btn" data-testid="pintab-rec" onClick={() => setForgot('rec')}>用恢复码</button>}</div>
    {step === 'menu' ? <button className="btn" data-testid="pintab-change" onClick={() => { setStep('old'); setErr(undefined); }}>修改家长密码…</button> : <div className="pintab-pad"><button className="chip" data-testid="pintab-close" aria-label="关闭" onClick={() => { setStep('menu'); setErr(undefined); setN1(''); }}>✕ 不改了</button>
    <PinPad title={step === 'old' ? '输入旧密码' : step === 'new' ? '输入新密码' : '再输入一次新密码'} hint="请输入 4–6 位数字" error={err} onSubmit={async p => {
    if (step === 'old') { if (await verifyPin(p, settings.pinHash) || await currentPin().then(c => !!c.vault && c.vault.pinHash !== settings.pinHash && verifyPin(p, c.vault.pinHash))) { setStep('new'); setErr(undefined); } else setErr('旧密码不对'); return; }
    if (step === 'new') { if (!validPin(p)) { setErr('4–6 位数字'); return; } setN1(p); setStep('confirm'); setErr(undefined); return; }
    if (p !== n1) { setErr('两次不一致'); setStep('new'); return; }
    setSettings({ ...settings, pinHash: await makePinHash(p) }); markPinSet(); setViaChange(true); setStep('done');
  }} /></div>}</>;
}
const OLD_HINT_QUESTIONS = ['孩子的小名是？', '家里宠物/玩偶的名字是？', '孩子的生日（如 0612）是？'];
/** r13 策划：找回问题选择（5 个预设 + 自己写），不预选 */
function HintQ({ q, setQ }: { q: string; setQ: (q: string) => void }) {
  const [own, setOwn] = useState(!!q && !HINT_QUESTIONS.includes(q));
  return <div className="col gap8">{HINT_QUESTIONS.map(x => <label key={x} className="toggle-line"><input type="radio" checked={!own && q === x} onChange={() => { setOwn(false); setQ(x); }} /> {x}</label>)}
    <label className="toggle-line"><input type="radio" data-testid="hint-own" checked={own} onChange={() => { setOwn(true); setQ(''); }} /> 自己写问题</label>
    {own && <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input" data-testid="hint-own-q" placeholder="写一个孩子不知道答案的问题" value={q} maxLength={40} onChange={e => setQ(e.target.value)} />}</div>;
}
/** r13 较真家长：修改找回问题（家长页内，已过密码）。不预选问题 */
function HintEdit({ settings, setSettings, forced }: { settings: Settings; setSettings: (s: Settings) => void; forced?: boolean }) {
  const [open, setOpen] = useState(!!forced); const [q, setQ] = useState(''); const [a, setA] = useState(''); const [done, setDone] = useState(false);
  if (!open) return <div className="p-card"><b>找回问题</b><p className="hint">{done ? '✔ 找回问题已修改。' : settings.pinHint ? `现在的问题：${settings.pinHint.q}（答案只存了指纹）` : '还没有找回问题。'}</p><button className="btn ghost" data-testid="hint-edit" onClick={() => { setOpen(true); setQ(''); setA(''); }}>修改找回问题</button></div>;
  return <div className="p-card wide-panel" data-testid="hint-edit-box"><b>修改找回问题</b><p className="hint">别选孩子也知道答案的问题。</p>
    <HintQ q={q} setQ={setQ} />
    <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input" data-testid="hint-edit-answer" placeholder="答案" value={a} onChange={e => setA(e.target.value)} />
    <div className="row gap16"><button className="btn" data-testid="hint-edit-ok" disabled={!q.trim() || !normAnswer(a)} onClick={async () => { setSettings({ ...settings, pinHint: { q: q.trim(), a: await makePinHash(normAnswer(a)) } }); setOpen(false); setDone(true); }}>保存</button><button className="btn ghost" onClick={() => setOpen(false)}>取消</button></div></div>;
}
/** r15 策划 R141-2：显示恢复码后，家长把它打回来确认已抄好（可以「稍后」） */
function RecTypeBack({ code, onConfirmed, onLater, doneId = 'rec-done' }: { code: string; onConfirmed: () => void; onLater: () => void; doneId?: string }) {
  const [v, setV] = useState(''); const ok = normCode(v) === code;
  return <div className="rec-typeback" data-testid="rec-typeback"><p className="hint">抄好后，请把恢复码再输入一遍确认：</p>
    <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input" data-testid="rec-type" placeholder="再输入一遍 8 位恢复码" value={v} maxLength={12} onChange={e => setV(e.target.value)} />
    {v && !ok && normCode(v).length >= 8 && <p className="warn">和上面的不一样，请对照再输一遍</p>}
    <div className="row gap16"><button className="btn" data-testid="rec-type-ok" disabled={!ok} onClick={onConfirmed}>确认已抄好</button><button className="btn ghost" data-testid={doneId} onClick={onLater}>稍后</button></div></div>;
}
/** r12（较真家长）：查看 / 重新生成恢复码（家长页内，已过密码）。旧码只存哈希，看不到原文，只能重新生成（旧的作废） */
export function RecGen({ settings, setSettings, prompt, afterChange }: { settings: Settings; setSettings: (s: Settings) => void; prompt?: boolean; afterChange?: boolean }) {
  const [code, setCode] = useState(''); const [kept, setKept] = useState(false); const [ask, setAsk] = useState(false); const [pin, setPin] = useState(''); const [pinOk, setPinOk] = useState(false);
  useEffect(() => { let dead = false; setPinOk(false); if (pin.length < 4) return; void currentPin().then(async c => { const ok = (!!settings.pinHash && await verifyPin(pin, settings.pinHash)) || (!!c.vault && await verifyPin(pin, c.vault.pinHash)); if (!dead) setPinOk(ok); }); return () => { dead = true; }; }, [pin]);
  if (code) return <div className="p-card" data-testid="recgen-code"><b>新的恢复码（只显示这一次）</b><div className="rec-code" data-testid="rec-code">{code.slice(0, 4)} {code.slice(4)}</div><p className="hint">请抄在纸上或拍照保存，别让孩子看到。旧的恢复码已作废。</p>
    <RecTypeBack code={code} doneId="recgen-done" onConfirmed={() => { setSettings({ ...settings, recConfirmed: true }); setCode(''); }} onLater={() => setCode('')} /></div>;
  const gen = async () => { const c = makeRecoveryCode(); setSettings({ ...settings, pinRec: await makePinHash(c), recPrompted: true, recConfirmed: false }); setCode(c); setPin(''); setKept(true); };   /* r15.4.3 较真家长 P2-3：改密码后「重新生成」并确认了新码，不再弹回「原来的恢复码仍然有效」 */
  const unconfirmed = !!settings.pinRec && !settings.recConfirmed;
  /* r15.4 较真家长 / 策划：改完家长密码后恢复码不变（恢复码只存自己的指纹，和密码无关）——提示一句，默认保留，也可以重新生成（刚输过旧密码和新密码，不用再输）；重新生成后旧码作废，新码照常要抄回确认 */
  if (afterChange && settings.pinRec && !kept) return <div className="p-card rec-after" data-testid="rec-after-change"><p>原来的恢复码仍然有效。如果担心恢复码被别人看到过，可以重新生成。</p>
    <div className="row gap16"><button className="btn" data-testid="rec-keep" autoFocus onClick={() => setKept(true)}>保留</button><button className="btn ghost" data-testid="rec-regen" onClick={() => void gen()}>重新生成</button></div></div>;
  if (prompt) return settings.pinHash && !settings.pinRec && !settings.recPrompted ? <div className="yellow-bar" data-testid="recgen-prompt">🔑 你的家长密码是在有「恢复码」之前设置的。生成一个恢复码，忘记密码时能马上重设。<button className="chip" data-testid="recgen-now" onClick={gen}>现在生成</button><button className="chip" data-testid="recgen-later" onClick={() => setSettings({ ...settings, recPrompted: true })}>以后再说</button></div> : null;
  return <div className="p-card"><b>恢复码</b><p className="hint">{settings.pinRec ? '已设置恢复码（只存了指纹，原文看不到）。忘了或丢了可以重新生成，旧的会作废。' : '还没有恢复码。'}</p>{unconfirmed && !ask && <p className="warn" data-testid="rec-unconfirmed">⚠ 恢复码还没有确认抄好。找不到的话请重新生成一个并抄下来（要先输入现在的家长密码）。</p>}{ask ? <div className="row gap16 wrap" data-testid="recgen-ask"><span className="warn">重新生成：旧的恢复码会立刻作废。请先输入现在的家长密码：</span><input autoComplete="new-password" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input" type="password" inputMode="numeric" data-testid="recgen-pin" value={pin} maxLength={6} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} /><button className="btn danger" data-testid="recgen-confirm" disabled={!pinOk} onClick={() => { setAsk(false); void gen(); }}>确定重新生成</button><button className="btn ghost" data-testid="recgen-cancel" onClick={() => setAsk(false)}>取消</button></div>
    : <button className="btn ghost" data-testid="recgen" onClick={() => settings.pinRec ? setAsk(true) : void gen()}>{settings.pinRec ? '重新生成恢复码' : '生成恢复码'}</button>}</div>;
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
        {/* r15.4.3 小萌新：小班结算页不再写星星规则（孩子看不懂），规则放在家长页 */}
        {profiles.find(x => x.id === pid)?.grade.startsWith('K') && <div className="p-card" data-testid="report-star-rules-k"><b>⭐ {GRADE_LABEL[profiles.find(x => x.id === pid)!.grade].replace('幼儿园', '')}的星星怎么得</b>
          <p className="hint">{STAR_RULES_K.replace(/　/g, '；')}（「第一次就答对」= 这道题第一次就点对；点错后再试对的、看了示范的不算）。</p>
          <p className="hint">同一关每天从第 3 次起不再加星，地图上保留这一关的最佳星星（只升不降）。这时结算页只说一句「{K_NOSTAR_TEXT}」，不写规则；同一关第 2 次玩完照常加星，结算页说「{K_AGAIN_TEXT}」。</p></div>}
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

/** r14 策划 R13-4：密码页 / 忘记密码页上的「从备份恢复」——只能覆盖恢复；要备份时的家长密码或恢复码；和家长页导入共用「连错 5 次锁 24 小时」 */
export function GateRestore() {
  const ref = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<any>(null); const [sec, setSec] = useState(''); const [msg, setMsg] = useState<string>();
  const [lk, setLk] = useState<LockState>({ fails: 0, level: 0, until: 0, remain: 0 });
  useEffect(() => { void loadLock(LK_IMPORT).then(setLk); let last = performance.now(); const t = setInterval(() => { const p = performance.now(), dt = p - last; last = p; setLk(l => { if (!lockLeft(l)) return l; const n = tickLock(l, dt, Date.now()); void saveLock(n, LK_IMPORT); return n; }); }, 1000); return () => clearInterval(t); }, []);
  const left = lockLeft(lk);
  return <div className="gate-restore">
    <input ref={ref} type="file" accept=".json,application/json" hidden data-testid="gate-restore-file" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { const d = JSON.parse(await f.text()); validateBackup(d); setData(d); setMsg(undefined); } catch (er) { setMsg(er instanceof SyntaxError ? '文件无法读取（不是 JSON）' : (er as Error).message); } e.target.value = ''; }} />
    <button className="link-btn" data-testid="gate-restore" onClick={() => ref.current?.click()}>📂 从备份恢复</button>
    <p className="gate-restore-note" data-testid="gate-restore-note">忘了密码也能用：选备份文件，输入备份时的家长密码或恢复码，用备份覆盖这台设备的数据。</p>
    {msg && !data && <p className="warn" data-testid="gate-restore-msg">{msg}</p>}
    {data && <Modal onClose={() => setData(null)}><div data-testid="gate-restore-box"><h2>从备份恢复（覆盖）</h2>
      <p data-testid="gate-restore-when">备份时间：{fmtBackupTime(data.exportedAt)}</p><p><b>会被替换：</b>档案、星星和进度、错题和答题记录、导入的题、时长设置和以前的时长记录、其他设置、家长密码和恢复码（换成备份时的）。<br /><b>会保留：</b>今天已经玩了多久（按这台平板记的）、防改时间记录（游戏自己用来发现平板时间被往回调，家长不用管）。</p><p className="hint">这里只能整份恢复；「合并」要先在家长页里输入现在的家长密码。</p>
      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input restore-bsec" data-testid="gate-restore-sec" disabled={left > 0} placeholder="备份时的密码或恢复码" value={sec} onChange={e => setSec(e.target.value)} />
      {left > 0 && <p className="warn" data-testid="gate-restore-lock">错太多次了，请 {Math.ceil(left / 3600e3)} 小时后再试（只算游戏开着的时间）</p>}
      {msg && <p className="warn" data-testid="gate-restore-msg">{msg}</p>}
      <div className="row gap16"><button className="btn ghost" onClick={() => setData(null)}>取消</button>
        <button className="btn danger" data-testid="gate-restore-go" disabled={!sec || left > 0} onClick={async () => {
          const ok = await backupSecretOk(data, sec); const n = nextLock24(lk, ok, Date.now()); setLk(n); await saveLock(n, LK_IMPORT);
          if (!ok) { setMsg(lockLeft(n) > 0 ? '备份密码 / 恢复码连续错 5 次，已锁定 24 小时' : `备份时的家长密码 / 恢复码不对，还可以试 ${5 - n.fails} 次`); return; }
          try { const snap = await importAll(data, { backupSecret: sec }); download(`知识勇者_恢复前快照_${dayStr()}.json`, JSON.stringify(snap)); logReload('import-restore', 'gate'); setTimeout(() => location.reload(), 800); setMsg('已恢复，正在重新打开…'); } catch (er) { setMsg((er as Error).message); }
        }}>覆盖恢复</button></div></div></Modal>}
  </div>;
}
