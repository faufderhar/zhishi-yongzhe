import { ReduceToggle } from './Battle';
import { prefetchAll } from '../fx/sheets';
import { useState as useS } from 'react';
function PrefetchAnim() {
  const [p, setP] = useS('');
  return <button className="chip" data-testid="prefetch-anim" onClick={() => { setP('0%'); void prefetchAll((d, t) => setP(Math.round(d / t * 100) + '%')).then(() => setP('已完成，可离线使用')); }}>⬇ 预下载战斗动画（约 4.3MB）{p && ' · ' + p}</button>;
}
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PinPad, fmtMin } from './common';
import { GRADE_LABEL, loadBank, countStatuses, type Bank, type GradeKey } from '../game/questions';
import { csvToQuestions, toCSV } from '../game/csv';
import { PROFILE_GRADES, bandConfig } from '../game/grades';
import { validPin, remainingSec, addBonus, type Usage } from '../game/playtime';
import { dayStr } from '../game/wrongbook';
import { AVATARS, newProfile, type Profile, type Settings } from '../state';
import { questionsOfGrade, type BankState } from '../bankStore';
import { exportAll, importAll, putImported, clearImported, validateBackup } from '../db';
import { exportQuestion } from '../game/questions';
import { setKV, getKV, answersOf, wrongOf, rollupOf, rollupAdd, type AnswerRecord, type Rollup } from '../db';
import type { WrongEntry } from '../game/wrongbook';
import { DESIGN } from '../game/config';
import { HoldButton } from './Battle';
import { noZhVoice } from '../tts';
import { makePinHash, verifyPin, loadLock, saveLock, nextLock, tickLock, lockLeft, markPinSet, pinWasSet, HINT_QUESTIONS, normAnswer, type LockState } from '../game/pin';
import type { Skills } from '../game/adaptive';

/** 家长密码门（D9 锁定 / X-13 首次设置需提示问题 / P2-1 密码丢失不当首次） */
export function ParentGate({ settings, onSetPin, onOk, onCancel, purpose }: { settings: Settings; onSetPin: (h: string, hint?: { q: string; a: string }) => void; onOk: () => void; onCancel: () => void; purpose?: string }) {
  const [first, setFirst] = useState<string>();
  const [err, setErr] = useState<string>();
  const [lock, setLock] = useState<LockState>({ fails: 0, level: 0, until: 0 });
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState<'pin' | 'hint' | 'forgot' | 'lost'>('pin');
  const [hq, setHq] = useState(HINT_QUESTIONS[0]); const [ha, setHa] = useState('');
  const [pend, setPend] = useState<string>();
  useEffect(() => {
    void loadLock().then(setLock); void (!settings.pinHash && pinWasSet().then(w => w && setMode('lost')));
    let last = performance.now();
    const t = setInterval(() => {   // 只按单调时钟扣锁定时间（技术QA R4-4）
      const p = performance.now(), dt = p - last; last = p; setNow(Date.now());
      setLock(l => { if (!lockLeft(l)) return l; const n = tickLock(l, dt, Date.now()); void saveLock(n); return n; });
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.ceil(lockLeft(lock, now) / 1000);
  const locked = left > 0;
  const lockMsg = locked ? `密码错太多次了，请 ${Math.floor(left / 60)} 分 ${left % 60} 秒后再试` : undefined;
  const note = async (ok: boolean) => { const n = nextLock(lock, ok, Date.now()); setLock(n); await saveLock(n); return n; };
  const finishSet = async (pin: string, hint?: { q: string; a: string }) => { onSetPin(await makePinHash(pin), hint); markPinSet(); onOk(); };
  const sub = purpose ? <p className="parent-hint">{purpose}</p> : null;
  if (mode === 'lost') return (
    <div className="center-screen"><div className="pinpad"><h2>密码数据丢失</h2>
      <p>这台平板上有游戏进度，但家长密码数据不见了。请从备份恢复，或回答找回问题后重设。</p>
      <div className="row gap16"><button className="btn" onClick={() => setMode(settings.pinHint ? 'forgot' : 'pin')}>{settings.pinHint ? '回答找回问题' : '重新设置密码'}</button><button className="btn ghost" onClick={onCancel}>返回</button></div>
      <p className="hint">从备份恢复：设置新密码后在「家长 → 备份」里操作。</p></div></div>);
  if (mode === 'hint' && pend) return (
    <div className="center-screen"><div className="pinpad"><h2>设置找回问题（必填）</h2>
      <div className="col gap8">{HINT_QUESTIONS.map(x => <label key={x} className="toggle-line"><input type="radio" checked={hq === x} onChange={() => setHq(x)} /> {x}</label>)}</div>
      <input className="name-input" data-testid="hint-answer" placeholder="答案" value={ha} onChange={e => setHa(e.target.value)} />
      <button className="btn" data-testid="hint-ok" disabled={!normAnswer(ha)} onClick={async () => finishSet(pend, { q: hq, a: await makePinHash(normAnswer(ha)) })}>完成</button></div></div>);
  if (mode === 'forgot' && settings.pinHint) return (
    <div className="center-screen"><div className="pinpad"><h2>忘记密码</h2><p>{settings.pinHint.q}</p>
      <input className="name-input" data-testid="forgot-answer" value={ha} disabled={locked} onChange={e => setHa(e.target.value)} />
      {(lockMsg || err) && <p className="warn">{lockMsg ?? err}</p>}
      <div className="row gap16"><button className="btn" disabled={locked || !ha} onClick={async () => {
        const ok = await verifyPin(normAnswer(ha), settings.pinHint!.a); const n = await note(ok);
        if (ok) { setMode('pin'); setFirst(undefined); setErr(undefined); onSetPin(''); } else setErr(lockLeft(n) > 0 ? undefined : `答案不对，还可以试 ${5 - n.fails} 次`);
      }}>确定</button><button className="btn ghost" onClick={() => setMode('pin')}>返回</button></div></div></div>);
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
    extra={settings.pinHint && <button className="link-btn" data-testid="forgot" onClick={() => { setHa(''); setErr(undefined); setMode('forgot'); }}>忘记密码</button>}
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
  onClose: () => void; initialTab?: Tab;
}
export function ParentSettings(props: ParentProps) {
  const [tab, setTab] = useState<Tab>(props.initialTab ?? 'profiles');
  const tabs: [Tab, string][] = [['profiles', '👪 孩子档案'], ['report', '📊 学习报告'], ['bank', '📚 题库'], ['time', '⏳ 时长'], ['backup', '💾 备份/恢复'], ['pin', '🔑 密码']];
  return (
    <div className="parent">
      <div className="map-top">
        <button className="back-inline" data-testid="parent-close" onClick={props.onClose} aria-label="退出家长设置">←</button>
        <h2>家长设置</h2><span className="grow" />
        {tabs.map(([k, l]) => <button key={k} className={`chip ${tab === k ? 'on' : ''}`} data-testid={'ptab-' + k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <ParentAlerts goBackup={() => setTab('backup')} />
      <div className="parent-body">
        {tab === 'profiles' && <ProfilesTab {...props} />}
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
    void getKV<number>('lastBackupAt').then(t => { setLast(t ?? null); if (!t || Date.now() - t > 14 * 864e5) setNag(!sessionStorage.getItem('zy.nagged')); });
  }, []);
  const days = last ? Math.floor((Date.now() - last) / 864e5) : null;
  return <>
    {usage !== undefined && usage > 0.8 && <div className="yellow-bar">保存失败风险：平板存储空间快满了（已用 {Math.round(usage * 100)}%），请导出备份</div>}
    <p className="hint backup-age" data-testid="backup-age">上次备份：{last === undefined ? '…' : days === null ? '从未备份' : days === 0 ? '今天' : `${days} 天前`}</p>
    {nag && <Modal onClose={() => { setNag(false); sessionStorage.setItem('zy.nagged', '1'); }}>
      <h2>该备份啦</h2><p>{days === null ? '这台平板还没有备份过。' : `已经 ${days} 天没有备份了。`}清理浏览器或换平板时，没有备份会丢失进度。</p>
      <div className="row gap16"><button className="btn" onClick={() => { setNag(false); sessionStorage.setItem('zy.nagged', '1'); goBackup(); }}>立即备份</button>
        <button className="btn ghost" onClick={() => { setNag(false); sessionStorage.setItem('zy.nagged', '1'); }}>稍后</button></div>
    </Modal>}
  </>;
}
function ProfilesTab({ profiles, setProfiles, bank, skills }: ParentProps) {
  const [edit, setEdit] = useState<Profile | null>(null);
  const [delId, setDelId] = useState<string>();
  const save = (p: Profile) => { setProfiles(profiles.some(x => x.id === p.id) ? profiles.map(x => x.id === p.id ? p : x) : [...profiles, p]); setEdit(null); };
  return (
    <div>
      <div className="row gap16 wrap">
        {profiles.map(p => (
          <div key={p.id} className="p-card">
            <span className="big-emoji">{p.avatar}</span>
            <b>{p.name}</b><small>{GRADE_LABEL[p.grade]} · {p.volumes ? `已学 ${p.volumes.length} 册` : '全部册别'}</small>
            <small>每日 上学日 {p.limit.weekday || '不限'} / 周末 {p.limit.weekend || '不限'} 分钟</small>
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
      {edit && <ProfileEditor p={edit} bank={bank} onSave={save} onCancel={() => setEdit(null)} />}
    </div>
  );
}
function ProfileEditor({ p, bank, onSave, onCancel }: { p: Profile; bank: BankState; onSave: (p: Profile) => void; onCancel: () => void }) {
  const [f, setF] = useState<Profile>(p);
  const vols = useMemo(() => { const m = new Map<string, number>(); for (const q of questionsOfGrade(bank, f.grade)) m.set(q.volume, (m.get(q.volume) ?? 0) + 1); return [...m]; }, [bank, f.grade]);
  const setGrade = (g: GradeKey) => setF({ ...f, grade: g, volumes: null, limit: { ...bandConfig(g).dailyMinutes } });
  const toggleVol = (v: string) => { const cur = f.volumes ?? vols.map(x => x[0]); const nx = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]; setF({ ...f, volumes: nx.length === vols.length ? null : nx }); };
  const step = (k: 'weekday' | 'weekend', d: number) => setF({ ...f, limit: { ...f.limit, [k]: Math.max(0, f.limit[k] + d) } });
  return (
    <Modal onClose={onCancel}>
      <div className="editor" data-testid="profile-editor">
        <h2>编辑档案</h2>
        <label>名字 <input value={f.name} maxLength={8} onChange={e => setF({ ...f, name: e.target.value })} /></label>
        <div className="row gap16 wrap avatars">{AVATARS.map(a => <button key={a} className={`chip ${a === f.avatar ? 'on' : ''}`} onClick={() => setF({ ...f, avatar: a })}>{a}</button>)}</div>
        <div><b>年级</b><div className="row gap16 wrap">{PROFILE_GRADES.map(g => <button key={g} className={`chip ${g === f.grade ? 'on' : ''}`} data-testid={'grade-' + g} onClick={() => setGrade(g)}>{GRADE_LABEL[g]}</button>)}</div></div>
        <div><b>已学册别</b>（只从勾选的册别出题）<div className="row gap16 wrap">{vols.map(([v, n]) =>
          <button key={v} className={`chip ${!f.volumes || f.volumes.includes(v) ? 'on' : ''}`} onClick={() => toggleVol(v)}>{v}（{n}）</button>)}</div></div>
        <div className="row gap16 wrap"><b>每日时长（分钟，0=不限）</b>
          {(['weekday', 'weekend'] as const).map(k => <span key={k} className="stepper">{k === 'weekday' ? '上学日' : '周末'}
            <button className="chip" onClick={() => step(k, -5)}>−5</button><b>{f.limit[k]}</b><button className="chip" onClick={() => step(k, 5)}>＋5</button></span>)}</div>
        <div className="row gap16"><button className="btn ghost" onClick={onCancel}>取消</button><button className="btn" data-testid="profile-save" disabled={!f.name.trim()} onClick={() => onSave(f)}>保存</button></div>
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
          return <tr key={p.id}><td>{p.avatar} {p.name}</td><td>{Math.floor(r.used / 60)} 分 {r.used % 60} 秒</td><td>{fmtMin(remainingSec(p.limit, u, today))}</td><td>{p.limit.weekday || '不限'} / {p.limit.weekend || '不限'}</td>
            <td><button className="chip" data-testid={'bonus-' + p.id} onClick={() => setUsage(p.id, addBonus(u, today, 600))}>＋10 分钟</button></td></tr>; })}</tbody></table>
      <div className="p-card"><b>动画</b> <ReduceToggle /><p className="hint">系统开启「减弱动态效果」时也会自动减少动画。</p><PrefetchAnim /><p className="hint">动画素材平时在第一次进入战斗时下载；离线使用前点一下即可全部缓存。</p></div>
      <p className="hint">上限在「孩子档案 → 编辑」里改。只在答题/复习时计时，切到后台不计；关卡进行中时间到了会让孩子打完这一关。</p>
    </div>
  );
}

function BackupTab() {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string>();
  const [pending, setPending] = useState<any>(null);
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
        <div className="row gap16"><button className="btn ghost" onClick={() => setPending(null)}>取消</button>
          <button className="btn danger" onClick={async () => { try { const snap = await importAll(pending); download(`知识勇者_恢复前快照_${dayStr()}.json`, JSON.stringify(snap)); setTimeout(() => location.reload(), 800); } catch (e) { setMsg((e as Error).message); setPending(null); } }}>覆盖恢复</button></div>
      </Modal>}
      <UndoRestore />
      <p className="hint">iPad：「添加到主屏幕」的 App 与 Safari 的数据是分开的，换设备或清理浏览器前请先导出备份。</p>
    </div>
  );
}

function UndoRestore() {
  const [snap, setSnap] = useState<any>();
  useEffect(() => { void getKV('snapshot:last').then(setSnap); }, []);
  if (!snap) return null;
  return <button className="btn ghost" data-testid="undo-restore" onClick={async () => { if (!confirm('撤销上一次恢复，回到恢复前的数据？')) return; await importAll(snap); await setKV('snapshot:last', undefined); location.reload(); }}>↩ 撤销恢复（回到 {String(snap.exportedAt ?? '').slice(0, 16).replace('T', ' ')} 的数据）</button>;
}
function PinTab({ settings, setSettings }: ParentProps) {
  const [step, setStep] = useState<'old' | 'new' | 'confirm' | 'done'>('old');
  const [n1, setN1] = useState(''); const [err, setErr] = useState<string>();
  if (step === 'done') return <p className="note">✔ 密码已修改</p>;
  return <PinPad title={step === 'old' ? '输入旧密码' : step === 'new' ? '输入新密码' : '再输入一次新密码'} hint="请输入 4–6 位数字" error={err} onSubmit={async p => {
    if (step === 'old') { if (await verifyPin(p, settings.pinHash)) { setStep('new'); setErr(undefined); } else setErr('旧密码不对'); return; }
    if (step === 'new') { if (!validPin(p)) { setErr('4–6 位数字'); return; } setN1(p); setStep('confirm'); setErr(undefined); return; }
    if (p !== n1) { setErr('两次不一致'); setStep('new'); return; }
    setSettings({ ...settings, pinHash: await makePinHash(p) }); markPinSet(); setStep('done');
  }} />;
}


/** 报告 #9：每个孩子的学习报告（复用答题记录 + 错题本；月度汇总后续再做） */
function ReportTab({ profiles, bank }: ParentProps) {
  const [pid, setPid] = useState(profiles[0]?.id);
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
