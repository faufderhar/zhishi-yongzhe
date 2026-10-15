import { useMemo, useRef, useState } from 'react';
import { Modal, PinPad, fmtMin } from './common';
import { GRADE_LABEL, loadBank, countStatuses, type Bank, type GradeKey } from '../game/questions';
import { csvToQuestions, toCSV } from '../game/csv';
import { PROFILE_GRADES, bandConfig } from '../game/grades';
import { hashPin, validPin, remainingSec, addBonus, type Usage } from '../game/playtime';
import { dayStr } from '../game/wrongbook';
import { AVATARS, newProfile, type Profile, type Settings } from '../state';
import { questionsOfGrade, type BankState } from '../bankStore';
import { exportAll, importAll, putImported, clearImported } from '../db';
import type { Skills } from '../game/adaptive';

/** 家长密码门：首次设置（输两次），之后验证 */
export function ParentGate({ settings, onSetPin, onOk, onCancel }: { settings: Settings; onSetPin: (h: string) => void; onOk: () => void; onCancel: () => void }) {
  const [first, setFirst] = useState<string>();
  const [err, setErr] = useState<string>();
  if (!settings.pinHash) return (
    <div className="center-screen">
      <PinPad title={first ? '再输入一次确认' : '第一次使用：设置家长密码'} error={err} onCancel={onCancel} onSubmit={p => {
        if (!validPin(p)) { setErr('请输入 4–6 位数字'); return; }
        if (!first) { setFirst(p); setErr(undefined); return; }
        if (p !== first) { setFirst(undefined); setErr('两次不一致，请重新设置'); return; }
        onSetPin(hashPin(p)); onOk();
      }} />
    </div>
  );
  return <div className="center-screen"><PinPad title="输入家长密码" error={err} onCancel={onCancel} onSubmit={p => hashPin(p) === settings.pinHash ? onOk() : setErr('密码不对')} /></div>;
}

function download(name: string, text: string, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
type Tab = 'profiles' | 'bank' | 'time' | 'backup' | 'pin';
export interface ParentProps {
  settings: Settings; setSettings: (s: Settings) => void;
  profiles: Profile[]; setProfiles: (p: Profile[]) => void;
  bank: BankState; reloadBank: () => Promise<void>;
  usage: Record<string, Usage>; setUsage: (pid: string, u: Usage) => void;
  skills: Record<string, Skills>; flags: Record<string, number>;
  onClose: () => void; initialTab?: Tab;
}
export function ParentSettings(props: ParentProps) {
  const [tab, setTab] = useState<Tab>(props.initialTab ?? 'profiles');
  const tabs: [Tab, string][] = [['profiles', '👪 孩子档案'], ['bank', '📚 题库'], ['time', '⏳ 时长'], ['backup', '💾 备份/恢复'], ['pin', '🔑 密码']];
  return (
    <div className="parent">
      <div className="map-top">
        <button className="back-inline" data-testid="parent-close" onClick={props.onClose} aria-label="退出家长设置">←</button>
        <h2>家长设置</h2><span className="grow" />
        {tabs.map(([k, l]) => <button key={k} className={`chip ${tab === k ? 'on' : ''}`} data-testid={'ptab-' + k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="parent-body">
        {tab === 'profiles' && <ProfilesTab {...props} />}
        {tab === 'bank' && <BankTab {...props} />}
        {tab === 'time' && <TimeTab {...props} />}
        {tab === 'backup' && <BackupTab />}
        {tab === 'pin' && <PinTab {...props} />}
      </div>
    </div>
  );
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
            {skills[p.id] && <small>难度：{Object.entries(skills[p.id]).map(([s, v]) => `${s}${v.level}`).join(' · ')}</small>}
            <div className="row gap16"><button className="chip" data-testid={'edit-' + p.id} onClick={() => setEdit(p)}>编辑</button>
              {delId === p.id ? <button className="chip danger" onClick={() => setProfiles(profiles.filter(x => x.id !== p.id))}>确定删除</button>
                : <button className="chip" onClick={() => setDelId(p.id)}>删除</button>}</div>
          </div>
        ))}
        <button className="p-card add" data-testid="add-profile" onClick={() => setEdit(newProfile('新同学', '1', '👧'))}>＋ 添加孩子</button>
      </div>
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
function BankTab({ settings, setSettings, bank, reloadBank, flags }: ParentProps) {
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
    if (fmt === 'json') download(`题库导出_${GRADE_LABEL[g]}.json`, JSON.stringify({ bank_name: `导出-${GRADE_LABEL[g]}`, version: 'export', questions: qs.map(({ key, gradeNum, order, ...q }) => ({ ...q, options: q.options.map(o => ({ text: o.text, image: o.image, audio: o.audio })), answer: q.type === '填空' ? q.answer : q.answer.join('') })) }, null, 1));
    else {
      const head = ['id', 'status', 'subject', 'grade', 'textbook', 'unit', 'volume', 'type', 'question', 'tts_text', 'A', 'B', 'C', 'D', 'E', 'F', 'answer', 'tolerance', 'explanation', 'difficulty', 'tag', 'time', 'source', 'review_note'];
      download(`题库导出_${GRADE_LABEL[g]}.csv`, toCSV(head, qs.map(q => ({ ...q, ...Object.fromEntries(q.options.map(o => [o.key, o.text])), answer: q.type === '填空' ? q.answer.join('|') : q.answer.join(''), tag: q.tags.join('|') }))), 'text/csv');
    }
  };
  const flagged = Object.entries(flags).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return (
    <div className="col gap16">
      <div className="row gap16 wrap">
        <label className="toggle"><input type="checkbox" data-testid="toggle-pending" checked={settings.includePending} onChange={e => setSettings({ ...settings, includePending: e.target.checked })} />
          也出「待审核 / 需家长确认」的题（停用的题永远不出）</label>
        <label className="toggle"><input type="checkbox" checked={settings.g1NoLimit} onChange={e => setSettings({ ...settings, g1NoLimit: e.target.checked })} /> 1–2 年级不限时</label>
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

function TimeTab({ profiles, usage, setUsage }: ParentProps) {
  const today = dayStr();
  return (
    <div className="col gap16">
      <table className="tbl"><thead><tr><th>孩子</th><th>今日已玩</th><th>今日剩余</th><th>每日上限（上学日/周末）</th><th>临时加时</th></tr></thead>
        <tbody>{profiles.map(p => { const u = usage[p.id] ?? {}; const r = u[today] ?? { used: 0, bonus: 0 };
          return <tr key={p.id}><td>{p.avatar} {p.name}</td><td>{Math.round(r.used / 60)} 分钟</td><td>{fmtMin(remainingSec(p.limit, u, today))}</td><td>{p.limit.weekday || '不限'} / {p.limit.weekend || '不限'}</td>
            <td><button className="chip" data-testid={'bonus-' + p.id} onClick={() => setUsage(p.id, addBonus(u, today, 600))}>＋10 分钟</button></td></tr>; })}</tbody></table>
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
        <button className="btn" data-testid="backup-export" onClick={async () => { const d = await exportAll(); download(`知识勇者备份_${dayStr()}.json`, JSON.stringify(d)); setMsg('已导出备份文件'); }}>💾 导出备份</button>
        <input ref={ref} type="file" accept=".json,application/json" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { setPending(JSON.parse(await f.text())); } catch { setMsg('文件无法读取'); } e.target.value = ''; }} />
        <button className="btn ghost" onClick={() => ref.current?.click()}>📂 从备份恢复</button>
      </div>
      {msg && <p className="note">{msg}</p>}
      {pending && <Modal onClose={() => setPending(null)}>
        <h2>确定恢复？</h2><p>会用备份（{pending.exportedAt ?? '未知时间'}）<b>覆盖</b>这台平板上的全部数据。</p>
        <div className="row gap16"><button className="btn ghost" onClick={() => setPending(null)}>取消</button>
          <button className="btn danger" onClick={async () => { try { await importAll(pending); location.reload(); } catch (e) { setMsg((e as Error).message); setPending(null); } }}>覆盖恢复</button></div>
      </Modal>}
      <p className="hint">iPad：「添加到主屏幕」的 App 与 Safari 的数据是分开的，换设备或清理浏览器前请先导出备份。</p>
    </div>
  );
}

function PinTab({ settings, setSettings }: ParentProps) {
  const [step, setStep] = useState<'old' | 'new' | 'confirm' | 'done'>('old');
  const [n1, setN1] = useState(''); const [err, setErr] = useState<string>();
  if (step === 'done') return <p className="note">✔ 密码已修改</p>;
  return <PinPad title={step === 'old' ? '输入旧密码' : step === 'new' ? '输入新密码' : '再输入一次新密码'} error={err} onSubmit={p => {
    if (step === 'old') { if (hashPin(p) === settings.pinHash) { setStep('new'); setErr(undefined); } else setErr('旧密码不对'); return; }
    if (step === 'new') { if (!validPin(p)) { setErr('4–6 位数字'); return; } setN1(p); setStep('confirm'); setErr(undefined); return; }
    if (p !== n1) { setErr('两次不一致'); setStep('new'); return; }
    setSettings({ ...settings, pinHash: hashPin(p) }); setStep('done');
  }} />;
}
