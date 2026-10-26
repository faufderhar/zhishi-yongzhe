/** r17.1 Boss测试解锁_r17 §4：Boss 测试面板（只在测试构建 / 开发服务器里有：App 用 `__TEST_HOOKS__ ? lazy(import('./debug/BossLab'))` 引用，正式构建整块删掉，
 *  scripts/check-prod-hooks.mjs 在 CI 里守着 dist 里搜不到 BossLab / __zyBossLab / __zyBossLog）。
 *  - 🧪 按钮（右下角半透明）；地址带 #bosslab / ?zytest=1 时自动打开
 *  - 按 年级 → 科目 → 册别 → 章 列出 Boss（名字 / 关卡 id / 题池 / 血量和阶段）
 *  - 〔模拟〕不开界面跑一场；〔批量〕种子 1..N；〔进入〕真的打这个 Boss（跳过解锁，测试档案：不写存档 / 错题 / 时长 / 家长统计）
 *  - 结果写 window.__zyBossLog = { summary, rounds[] }，可导出 JSON / CSV（bosslab_<年级>_<关卡>_<时间>） */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Question, GradeKey } from '../game/questions';
import { GRADE_LABEL } from '../game/questions';
import { PROFILE_GRADES, bandConfig } from '../game/grades';
import { roundModeOf } from '../game/rounds';
import { toCSV, logFileName, type BossLog } from '../game/bossLog';
import { TIP_KEYS } from '../ui/rules';
import { RoundBattle } from '../ui/RoundBattle';
import { listBosses, simBoss, batch, batchCSV, bossQuestions, charsFor, seeded, type BossRow, type BatchStat, type CardPlan } from './bossLabSim';

type W = { __zyBossLab?: boolean; __zyBossLog?: BossLog };
const win = () => window as unknown as W;
export const LAB_GRADES = PROFILE_GRADES.filter(g => !!roundModeOf(bandConfig(g).band));
const S = { box: { position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(16,20,40,.97)', color: '#fff', overflow: 'auto', padding: 12, fontSize: 13, textAlign: 'left' },
  btn: { padding: '2px 8px', fontSize: 12, margin: '0 2px', minHeight: 0 }, row: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0' } } as const;
const download = (name: string, body: string, type: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const fname = (row: BossRow) => row.level.id.replace(/[^\w\u4e00-\u9fff-]+/g, '_');
export function summaryText(L: BossLog): string {
  const s = L.summary;
  return `${s.result} · ${s.turns} 回合 · 对 ${s.correct} 错 ${s.wrong} 漏选 ${s.partial}` + (s.correctToKill != null ? ` · 答对 ${s.correctToKill} 题击杀` : '') + (s.correctByPhase.length > 1 ? `（分阶段 ${s.correctByPhase.join(' + ')}）` : '')
    + ` · 总伤害 ${s.totalDealt}，平均 ${s.avgPerQ} · 技能 ${s.skills} 封顶 ${s.caps} · 剩余血量 ${s.playerHp}${s.revived ? ' · 复活过' : ''} · 用时 ${s.seconds}s`;
}

const allTips = Object.fromEntries([...TIP_KEYS, 'betHint'].map(k => [k, true]));
type Auto = 'manual' | 'auto';
interface Fight { row: BossRow; qs: Question[]; extra: Question[]; lab: { rng: () => number; rnd: () => number; cur?: Question }; nonce: number; auto: Auto; p: number; card: 'manual' | CardPlan; wager: boolean; seed: number }

/** 自动答题（面板里用，不用 Playwright）：按 p 用种子流答对 / 答错；题卡 / 押注按策略点 */
function useAutoDriver(f: Fight | null, root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!f || f.auto !== 'auto') return; const pa = seeded(f.seed * 2 + 1); let lastQ: string | undefined; let ok = true; let typed = false;
    const q = (sel: string) => root.current?.querySelector<HTMLElement>(sel) ?? null;
    const click = (sel: string) => { const e = q(sel) as HTMLButtonElement | null; if (e && !e.disabled) { e.click(); return true; } return false; };
    const t = setInterval(() => {
      if (!root.current) return;
      for (const x of root.current.querySelectorAll<HTMLElement>('.first-tip')) x.click();
      if (click('[data-testid=chal-normal]')) return;
      if (q('[data-testid=card-std]')) { if (f.card === 'manual') return; const b = q('[data-testid=bet-toggle]'); if (b && (b.dataset.on === '1') !== f.wager) { b.click(); return; } click(`[data-testid=card-${f.card === 'heavy' ? 'heavy' : 'std'}]`); return; }
      if (q('[data-testid=bet-go]')) { if (f.card === 'manual') return; const b = q('[data-testid=bet-toggle]'); if (b && (b.dataset.on === '1') !== f.wager) { b.click(); return; } click('[data-testid=bet-go]'); return; }
      if (click('[data-testid=wager-sure]')) return;
      if (click('[data-testid=revive-yes]')) return;
      const cur = f.lab.cur;
      if (cur) {
        const id = cur.key + ':' + (root.current.querySelector('.revive-banner')?.textContent ?? ''); if (id !== lastQ) { lastQ = id; ok = pa() < f.p; typed = false; }
        const opts = [...root.current.querySelectorAll<HTMLButtonElement>('.quiz .opt[data-testid^=opt-]')];
        if (opts.length) {
          const key = (b: HTMLElement) => b.dataset.testid!.slice(4), right = opts.filter(b => cur.answer.includes(key(b))), wrongs = opts.filter(b => !cur.answer.includes(key(b)));
          const okBtn = q('.multi-ok') as HTMLButtonElement | null;
          if (okBtn) { const want = ok ? right : wrongs.slice(0, 1); for (const b of opts) if ((b.getAttribute('aria-pressed') === 'true') !== want.includes(b)) { b.click(); return; } if (!okBtn.disabled) okBtn.click(); return; }
          (ok ? right[0] : wrongs[0] ?? right[0])?.click(); return;
        }
        const a = ok ? String(cur.answer[0]) : String(cur.answer[0]) + '7';
        const inp = root.current.querySelector<HTMLInputElement>('.quiz input');
        if (inp) { if (inp.value !== a) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(inp, a); inp.dispatchEvent(new Event('input', { bubbles: true })); return; } click('[data-testid=ok]'); return; }
        if (q('.keypad')) { if (!typed) { typed = true; for (const ch of a) (q(`.keypad [data-key="${CSS.escape(ch)}"]`) as HTMLButtonElement | null)?.click(); return; } click('[data-testid=ok]'); return; }   // 打字和点〔确定〕分两拍（确定键要等重绘才可点）
      }
      click('[data-testid=next]');
    }, 250);
    return () => clearInterval(t);
  }, [f?.nonce]);
}

export default function BossLab({ qsOf }: { qsOf: (g: GradeKey) => Question[] }) {
  const auto0 = useMemo(() => location.hash === '#bosslab' || /[?&]zytest=1\b/.test(location.search), []);   // __zyBossLab 只开战斗里的导出按钮（r171-bosslog），不自动开面板
  const [open, setOpen] = useState(auto0);
  const [grade, setGrade] = useState<GradeKey>('11'); const [subj, setSubj] = useState('数学');
  const [charId, setCharId] = useState(''); const [major, setMajor] = useState('');
  const [card, setCard] = useState<'manual' | CardPlan>('std'); const [wager, setWager] = useState(false);
  const [auto, setAuto] = useState<Auto>('auto'); const [p, setP] = useState(1); const [seed, setSeed] = useState(1); const [n, setN] = useState(20);
  const [last, setLast] = useState<{ row: BossRow; log: BossLog; how: string } | null>(null);
  const [bat, setBat] = useState<{ row: BossRow; b: BatchStat } | null>(null);
  const [fight, setFight] = useState<Fight | null>(null);
  const froot = useRef<HTMLDivElement>(null); useAutoDriver(fight, froot);
  const qs = useMemo(() => open ? qsOf(grade) : [], [open, grade, qsOf]);
  const rows = useMemo(() => qs.length ? listBosses(grade, qs) : [], [qs, grade]);
  const subjects = useMemo(() => [...new Set(rows.map(r => r.subject))], [rows]);
  const shown = rows.filter(r => !subj || r.subject === subj);
  const chars = charsFor(grade), ch0 = chars.find(c => c.id === charId) ?? chars[0], ch = major ? { ...ch0, major } : ch0;
  const opts = () => ({ charId: ch0.id, major: major || undefined, card: card === 'manual' ? 'std' as const : card, wager, p: auto === 'auto' ? p : 1 });
  const show = (row: BossRow, log: BossLog, how: string) => { win().__zyBossLog = log; setLast({ row, log, how }); };
  const enter = (row: BossRow) => {
    const lab = { rng: seeded(seed * 2 + 2), rnd: seeded(seed * 2 + 3) };
    const { start, pool } = bossQuestions(row, qs, seeded(seed * 2 + 4));
    setLast(null); win().__zyBossLog = undefined;
    setFight({ row, qs: start, extra: pool.filter(x => !start.includes(x)), lab, nonce: Date.now(), auto, p, card, wager, seed });
  };
  const endFight = () => { const f = fight; setFight(null); const L = win().__zyBossLog; if (f && L) show(f.row, L, `进入 · 种子 ${f.seed}${f.auto === 'auto' ? ` · 自动 p=${f.p}` : ' · 手动'}`); };
  if (!open) return <button data-testid="bosslab-btn" title="Boss 测试面板（仅测试版）" onClick={() => setOpen(true)} style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 80, opacity: .45, fontSize: 18, padding: '2px 6px', minHeight: 0 }}>🧪</button>;
  if (fight) return <div ref={froot} data-testid="bosslab-fight" style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#1d2340' }}>
    <RoundBattle key={fight.nonce} cfg={bandConfig(grade)} c={ch} kind="boss" unit={fight.row.level.unit} title={fight.row.level.name} questions={fight.qs} extra={fight.extra} review={[]}
      reserve={[]} adj={[]} prior={[]} seen={new Set()} wrongHist={new Set()} tips={allTips} wagerOn lowGrade={grade === '3' || grade === '4'} labRng={fight.lab}
      onAnswer={() => {}} onEnd={endFight} onQuit={endFight} onFlag={() => {}} />
    <button data-testid="bosslab-abort" onClick={endFight} style={{ ...S.btn, position: 'fixed', right: 6, top: 6, zIndex: 95, opacity: .6 }}>✕ 回面板</button>
  </div>;
  return <div data-testid="bosslab-panel" style={S.box}>
    <div style={S.row}><b>🧪 Boss 测试面板</b><span style={{ opacity: .6 }}>（仅测试版；不写存档）</span><span style={{ flex: 1 }} /><button style={S.btn} data-testid="bosslab-close" onClick={() => setOpen(false)}>关闭</button></div>
    <div style={S.row}>
      <label>年级 <select data-testid="bosslab-grade" value={grade} onChange={e => { setGrade(e.target.value as GradeKey); setSubj(''); setCharId(''); setMajor(''); }}>{LAB_GRADES.map(g => <option key={g} value={g}>{GRADE_LABEL[g] ?? g}</option>)}</select></label>
      <label>科目 <select data-testid="bosslab-subj" value={subj} onChange={e => setSubj(e.target.value)}><option value="">全部</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>角色 <select data-testid="bosslab-char" value={ch0.id} onChange={e => setCharId(e.target.value)}>{chars.map(c => <option key={c.id} value={c.id}>{c.name}（{c.major}）</option>)}</select></label>
      <label>主修 <select data-testid="bosslab-major" value={major} onChange={e => setMajor(e.target.value)}><option value="">角色默认</option>{[...new Set(chars.map(c => c.major))].map(m => <option key={m}>{m}</option>)}</select></label>
    </div>
    <div style={S.row}>
      <label>题卡 <select data-testid="bosslab-card" value={card} onChange={e => setCard(e.target.value as typeof card)}><option value="manual">手动</option><option value="std">固定标准</option><option value="heavy">固定重击</option></select></label>
      <label><input type="checkbox" data-testid="bosslab-wager" checked={wager} onChange={e => setWager(e.target.checked)} /> 押注</label>
      <label>答题 <select data-testid="bosslab-auto" value={auto} onChange={e => setAuto(e.target.value as Auto)}><option value="auto">自动（正确率 p）</option><option value="manual">手动</option></select></label>
      <label>p <input data-testid="bosslab-p" type="number" min={0} max={1} step={0.05} value={p} onChange={e => setP(Math.max(0, Math.min(1, Number(e.target.value))))} style={{ width: 60 }} /></label>
      <label>种子 <input data-testid="bosslab-seed" type="number" min={1} value={seed} onChange={e => setSeed(Math.max(1, Math.floor(Number(e.target.value) || 1)))} style={{ width: 60 }} /></label>
      <label>N <input data-testid="bosslab-n" type="number" min={1} max={500} value={n} onChange={e => setN(Math.max(1, Math.min(500, Math.floor(Number(e.target.value) || 1))))} style={{ width: 60 }} /></label>
    </div>
    {last && <div data-testid="bosslab-result" style={{ background: '#2b3a78', padding: 8, borderRadius: 6, margin: '6px 0' }}>
      <div><b>{last.row.name}</b> {last.row.level.id} · {last.how}</div><div data-testid="bosslab-summary">{summaryText(last.log)}</div>
      <button style={S.btn} data-testid="bosslab-export-json" onClick={() => download(logFileName(grade, fname(last.row), 'json'), JSON.stringify(last.log, null, 1), 'application/json')}>导出 JSON</button>
      <button style={S.btn} data-testid="bosslab-export-csv" onClick={() => download(logFileName(grade, fname(last.row), 'csv'), '\ufeff' + toCSV(last.log.rounds), 'text/csv')}>导出 CSV</button></div>}
    {bat && <div data-testid="bosslab-batch-result" style={{ background: '#3a2b78', padding: 8, borderRadius: 6, margin: '6px 0' }}>
      <div><b>{bat.row.name}</b> 批量 {bat.b.n} 场（种子 1..{bat.b.n}）：击杀 {bat.b.kills} 场 · 答对击杀 均值 <b data-testid="bosslab-batch-mean">{bat.b.mean ?? '-'}</b> 中位数 {bat.b.median ?? '-'} 最大 {bat.b.max ?? '-'} 最小 {bat.b.min ?? '-'}</div>
      <button style={S.btn} data-testid="bosslab-batch-csv" onClick={() => download(logFileName(grade, fname(bat.row) + '_批量' + bat.b.n, 'csv'), '\ufeff' + batchCSV(bat.b), 'text/csv')}>导出汇总 CSV</button></div>}
    <table data-testid="bosslab-list" style={{ borderCollapse: 'collapse', width: '100%' }}><thead><tr style={{ opacity: .7 }}><th>科目</th><th>册别</th><th>章</th><th>Boss</th><th>关卡 id</th><th>题池</th><th>血量（阶段）</th><th /></tr></thead>
      <tbody>{shown.map((r, i) => <tr key={r.id} data-testid={'bosslab-row-' + i} data-level={r.id} style={{ borderTop: '1px solid #445' }}>
        <td>{r.subject}</td><td>{r.volume}</td><td>{r.unit}</td><td data-testid="bosslab-name">{r.name}</td><td style={{ opacity: .7 }}>{r.id}</td><td>{r.pool}{r.bossOnly ? `（Boss 题 ${r.bossOnly}）` : ''}</td><td>{r.hp}{r.phases.length > 1 ? `（${r.phases.join(' + ')}）` : ''}</td>
        <td style={{ whiteSpace: 'nowrap' }}><button style={S.btn} data-testid="bosslab-enter" onClick={() => enter(r)}>进入</button>
          <button style={S.btn} data-testid="bosslab-sim" onClick={() => show(r, simBoss(r, qs, { ...opts(), seed }), `模拟 · 种子 ${seed} · p=${opts().p}`)}>模拟</button>
          <button style={S.btn} data-testid="bosslab-batch" onClick={() => setBat({ row: r, b: batch(r, qs, n, opts()) })}>批量 {n}</button></td></tr>)}</tbody></table>
    {!shown.length && <p data-testid="bosslab-empty">这个年级{subj ? ` / ${subj}` : ''}没有 Boss（或题库还没载入）。</p>}
  </div>;
}
