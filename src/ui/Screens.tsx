import { VERSION_LABEL } from '../version';
import { fillKind, sciOf } from '../game/inputKind';
import { TEST_DOM } from './common';
import { KINDER_LOCK_VOICE, HAPPY_TOTAL_LINE } from '../game/voiceLines';
import { skinFor } from '../game/monsterSkin';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Tex } from '../Tex';
import { Stars, Keypad, fmtMin, NameCount, NAME_MAX, pasteTooLong } from './common';
import { Sprite, type KMonOut } from './Battle';
import { qbanUrl, QBAN_CLOUD } from '../game/kinderQban';
import { runKFinale } from './kFinale';
import { TERM_TEXT, TERM_KEYS, TERM_IMG, TERM_NAME, TERM_MEDAL_NAME, termOpen, termBlocker, termSlots, termHintKey, type TermNo } from '../game/kinderTerm';
import { PUPS, SCIFI, MONSTER_IMG, type Character } from '../game/characters';
import { SLEEPY_TEXT, SLEEPY_RESET, SLEEPY_VOICE, TIMEUP_K_TEXT, K_NOSTAR_TEXT, K_AGAIN_TEXT, K_NOSTAR_WHY, K_FIRST_LINE } from '../game/playtime';
import { PROMPT_BY_TEXT } from '../game/voicePrompts';
import { GRADE_LABEL, choicesOf, correctText, judge, ttsText, type Question } from '../game/questions';
import { isUnlocked, missingPrereqs, starOf, STAR_RULES, STAR_RULES_ROUND, CHAL_STAR_HINT, type Chapter, type Level } from '../game/levels';
import type { BandConfig } from '../game/grades';
import { segOf, skillCardLine } from '../game/skills';
import { newProfile, AVATARS, type Profile, type Progress } from '../state';
import { Modal } from './common';
import type { GradeKey } from '../game/questions';
import { isDue, INTERVAL, wrongStale, type WrongEntry } from '../game/wrongbook';
import { speak, hasVoice, afterVoiceThen, voiceManifest } from '../tts';
import { useForceEnd } from './Battle';
import { answerFeedback } from '../feedback';

/** 首页年级列表：可玩 + 即将开放（灰） */
export const HOME_GRADES: { g: GradeKey; open: boolean }[] = [
  ...(['K1', 'K2', '1', '2', '3', '4', '5', '6', '7', '8'] as GradeKey[]).map(g => ({ g, open: true })),   // r16：+中班、初二、高二
  { g: '9' as GradeKey, open: false }, { g: '10' as GradeKey, open: true }, { g: '11' as GradeKey, open: true }, { g: '12' as GradeKey, open: false },
];
const DEFAULT_AVATAR: Record<string, string> = { K1: '🐰', K2: '🐻', 8: '🧑‍🎓', 11: '🧑‍🔬', 1: '🐣', 2: '🐥', 3: '🦊', 4: '🐼', 5: '🦁', 6: '🐯', 7: '🧑‍🎓', 10: '🧑‍🔬' };
function AddChild({ onAdd, onClose }: { onAdd: (p: Profile) => void; onClose: () => void }) {
  const [name, setName] = useState(''); const [cut, setCut] = useState(false);
  return (
    <Modal onClose={onClose}>
      <h2>添加孩子 · 选年级</h2>
      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} className="name-input" data-testid="add-name" placeholder="名字（可不填）" value={name} maxLength={NAME_MAX} onPaste={e => setCut(pasteTooLong(e))} onChange={e => { setName(e.target.value); if (!e.target.value) setCut(false); }} /><NameCount v={name} cut={cut} />
      <div className="grade-grid" data-testid="grade-list">
        {HOME_GRADES.map(({ g, open }) => (
          <button key={g} className="grade-btn" disabled={!open} data-testid={'home-grade-' + g}
            onClick={() => onAdd(newProfile(name.trim() || '小勇者', g, DEFAULT_AVATAR[g] ?? AVATARS[0]))}>
            {GRADE_LABEL[g]}{!open && <small>即将开放</small>}
          </button>))}
      </div>
      <p className="hint">之后可在「家长」里改名字、头像和每日时长。</p>
      <button className="btn ghost" onClick={onClose}>取消</button>
    </Modal>
  );
}
/** r11（较真家长）：剩余时间里含临时加时时写明 */
export const bonusNote = (rem: number | undefined, b: number | undefined) => b && b > 0 && rem !== undefined && Number.isFinite(rem) ? `（含今天临时加时 ${Math.round(b / 60)} 分钟）` : '';
/** r15.4.3 较真家长 P3：用完了还写「还能玩 0 分钟（含今天临时加时 4 分钟）」像是还有时间 → 改成「今天的时间已用完（其中临时加时 4 分钟也已用完）」 */
/** r16.2 较真家长：家长取消了没用的加时之后，首页卡片和地图也写「加时已取消」（以前什么都不写，孩子 / 家长看不出加时没了） */
export const timeLeftText = (rem: number | undefined, b: number | undefined, cancelled?: boolean) => cancelled && !(b && b > 0) && rem !== undefined && Number.isFinite(rem) ? (rem === 0 ? '今天的时间已用完（加时已取消）' : `今天还能玩 ${fmtMin(rem)}（加时已取消）`) : rem === 0 && b && b > 0 ? `今天的时间已用完（其中临时加时 ${Math.max(1, Math.round(b / 60))} 分钟也已用完）` : `今天还能玩 ${fmtMin(rem ?? Infinity)}${bonusNote(rem, b)}`;
/** 安装引导（GDD §9.5 / 技术QA P2-8）：iPad 非主屏幕模式显示「分享 → 添加到主屏幕」；安卓显示〔安装到主屏幕〕 */
type BIP = { prompt: () => Promise<void> | void; userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferredPrompt: BIP | null = null;
let installDismissed = false;   // r11：桌面 Chrome 点了「取消」：横幅留着，改成手动步骤
const ipListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e as unknown as BIP; ipListeners.forEach(f => f()); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; ipListeners.forEach(f => f()); });
}
/** r10：beforeinstallprompt 往往在首页渲染之后才到，订阅后重新渲染（以前错过就永远不显示） */
export function useInstallPrompt() { const [, f] = useState(0); useEffect(() => { const g = () => f(x => x + 1); ipListeners.add(g); return () => { ipListeners.delete(g); }; }, []); return deferredPrompt; }
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** r11：弹出安装框；返回是否装上。用过的事件作废（Chrome 之后会再发一次 beforeinstallprompt） */
export async function promptInstall(): Promise<boolean> { const d = deferredPrompt; if (!d) return false; deferredPrompt = null; ipListeners.forEach(f => f());
  try { await d.prompt(); const c = await d.userChoice; if (c?.outcome === 'dismissed') { installDismissed = true; ipListeners.forEach(f => f()); return false; } return true; } catch { return false; } }
export const wasInstallDismissed = () => installDismissed;
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || !!(navigator as unknown as { standalone?: boolean }).standalone;
function InstallGuide() {
  useInstallPrompt();
  // r10：关掉后 30 天内不再显示；r11：点安装后又在系统框里取消，横幅不消失，改成手动步骤；家长页「安装到主屏幕」随时能再装
  const [hide, setHide] = useState(() => { const t = Number(localStorage.getItem('zy.installHide')); return t > 1 && Date.now() - t < 30 * 864e5; });
  const ios = isIOS();
  if (isStandalone() || hide || (!ios && !deferredPrompt && !installDismissed)) return null;
  const close = () => { localStorage.setItem('zy.installHide', String(Date.now())); setHide(true); };
  return <div className="install-guide" data-testid="install-guide">
    {ios ? <IosSteps />
      : deferredPrompt ? <button className="btn" data-testid="install-btn" onClick={() => { void promptInstall().then(ok => { if (ok) close(); }); }}>📲 安装到主屏幕</button>
      : <span data-testid="install-manual">没装上也没关系：点地址栏右侧的安装图标 ⊕，或菜单 ⋮ →「投放、保存和分享」→「安装页面…」。家长设置 →「备份/恢复」里也能再装。</span>}
    <button className="chip" onClick={close} aria-label="关闭">✕</button>
  </div>;
}
/** iPad / iPhone Safari 没有安装弹框：文字 + 分享图标引导 */
export function IosSteps() {
  return <span className="ios-steps" data-testid="ios-steps">点 Safari 的 <b className="share-ic" aria-label="分享"><svg width="22" height="26" viewBox="0 0 22 26" aria-hidden><path d="M11 1v15M6 6l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 10H2v15h18V10h-2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /></svg> 分享</b> → 往下找 <b>「添加到主屏幕」</b> ➕ → 右上角〔添加〕，像 App 一样全屏玩</span>;
}
export function ProfileSelect({ profiles, remaining, bonus = {}, bonusCancelled = {}, onPick, onParent, onAdd, onAddRequest, onAddClose, adding, canAdd }: { profiles: Profile[]; remaining: Record<string, number>; bonus?: Record<string, number>; bonusCancelled?: Record<string, boolean>; onPick: (p: Profile) => void; onParent: () => void;
  onAdd: (p: Profile) => void; onAddRequest: () => void; onAddClose: () => void; adding: boolean; canAdd: boolean }) {
  const lpDel = useRef(0); const [delAsk, setDelAsk] = useState<Profile | null>(null);   // r10：长按档案 → 删除说明（要家长密码）
  return (
    <div className="center-screen">
      <h1 className="title">⚔️ 知识勇者</h1>
      <p className="sub">谁来玩？点自己的头像</p>
      <div className="row gap24 wrap profiles">
        {profiles.map(p => (
          <button key={p.id} className="profile-card" data-testid={'profile-' + p.id} onClick={() => { if (lpDel.current === -1) { lpDel.current = 0; return; } onPick(p); }}
            onPointerDown={() => { lpDel.current = window.setTimeout(() => { lpDel.current = -1; setDelAsk(p); }, 800); }} onPointerUp={() => { if (lpDel.current > 0) clearTimeout(lpDel.current); }} onPointerLeave={() => { if (lpDel.current > 0) clearTimeout(lpDel.current); }}
            onContextMenu={e => e.preventDefault()}>
            <span className="big-emoji">{p.avatar}</span><span>{p.name}</span>
            <small>{GRADE_LABEL[p.grade]}</small>
            {(() => { const same = profiles.filter(x => x.name === p.name && x.avatar === p.avatar); if (same.length < 2) return null; const i = same.indexOf(p);   // r14 小萌新：同名同头像的档案加编号和颜色区分
              return <small className="dup-tag" data-testid={'dup-' + p.id} style={{ background: ['#4cc9f0', '#f72585', '#ffd23f', '#80ed99'][i % 4] }}>{p.name} {i + 1} 号</small>; })()}
            <small className={`left-time ${remaining[p.id] === 0 ? 'warn' : ''}`}>{timeLeftText(remaining[p.id], bonus[p.id], bonusCancelled[p.id])}</small>
          </button>
        ))}
        {canAdd && <button className="profile-card add-card" data-testid="add-child" onClick={onAddRequest}>
          <span className="big-emoji">➕</span><span>添加孩子</span><small>需要家长密码</small></button>}
      </div>
      {adding && <AddChild onClose={onAddClose} onAdd={onAdd} />}
      {delAsk && <div className="modal-back" data-testid="del-ask"><div className="modal"><h2>要删除「{delAsk.name}」的档案吗？</h2><p>删除档案需要家长密码，会进入家长设置的「孩子档案」页，在那里点〔删除〕并长按确认。</p>
        <div className="row gap16"><button className="btn ghost" onClick={() => setDelAsk(null)}>取消</button><button className="btn" data-testid="del-ask-go" onClick={() => { setDelAsk(null); onParent(); }}>去家长设置</button></div></div></div>}
      <InstallGuide />
      <button className="parent-btn icon-only" data-testid="parent" aria-label="家长" title="家长" onClick={onParent}>🔒</button>
      <span className="ver-corner" data-testid="version-label">{VERSION_LABEL}</span>
    </div>
  );
}

export function CharSelect({ cfg, current, subjects, onPick, onBack }: { cfg: BandConfig; current?: string; subjects?: string[]; onPick: (c: Character) => void; onBack: () => void }) {
  // 报告 #13：全部角色可选；本年级风格且主修科目在本年级题库里的标「推荐」，排在前面
  const own = cfg.chars === 'scifi' ? SCIFI : PUPS;
  const rec = (c: Character) => own.includes(c) && (!subjects?.length || subjects.some(s => s.includes(c.major)));
  const list = cfg.band === 'K' ? own : [...own.filter(rec), ...own.filter(c => !rec(c)), ...(cfg.chars === 'scifi' ? PUPS : SCIFI)];
  // D10：点卡片只是选中，点〔就选它〕才保存；〔返回〕不改动
  const [sel, setSel] = useState<string | undefined>(current);
  const chosen = list.find(c => c.id === sel);
  return (
    <div className="center-screen">
      <button className="back labeled" data-testid="back-char" onClick={() => { speak("返回"); onBack(); }} aria-label="返回">← <small>返回</small></button>
      <h2>{cfg.band === 'K' ? '选角色 · 选一只小狗伙伴' : cfg.band === 'H' ? '选角色 · 选择研究员' : '选角色 · 选择你的勇者'}</h2>
      <div className="row gap24 wrap char-list" data-testid="charlist">
        {list.map(c => (
          <button key={c.id} className={`char-card ${c.id === sel ? 'sel' : ''} ${c.id === current ? 'last' : ''}`} data-testid={'char-' + c.id} aria-pressed={c.id === sel}
            onClick={() => { setSel(c.id); if (cfg.band === 'K' || cfg.band === 'G1') speak(c.name); }}>
            <Sprite className="char-img" c={c} />
            <b>{c.name}</b>
            {cfg.band !== 'K' && rec(c) && <span className="tag rec" data-testid="rec">⭐ 推荐</span>}
            {cfg.band !== 'K' && <span className="tag">主修 {c.major}</span>}
            {cfg.band !== 'K' && <small>{c.desc}</small>}
            {cfg.band !== 'K' && (() => { const t = skillCardLine(segOf(cfg.band), c.major, c.id); return t ? <small className="char-skill" data-testid={'char-skill-' + c.id}>{t}</small> : null; })()}   {/* r16.1 (y) Boss补测裁定_r17 §3 */}
          </button>
        ))}
      </div>
      <button className="btn big" data-testid="char-confirm" disabled={!chosen} onClick={() => { if (!chosen) return; if (cfg.band === 'K' || cfg.band === 'G1') speak(chosen.name + '，出发！'); onPick(chosen); }}>就选它{chosen ? `：${chosen.name}` : ''}</button>
    </div>
  );
}

const KIND_LABEL = { normal: '', elite: '精英', boss: 'Boss' };
/* r17 策划：小班期末关放在主地图上——每个学科章里，大乌云 = 上学期最后一个节点、彩虹云 = 下学期最后一个节点（同一关）。
   没解锁 = 灰色小云剪影；解锁后第一次看到 = 轻轻弹一下 + 朗读开场白（每档案每学期一次） */
const termNodeImg = (t: TermNo) => (import.meta.env?.BASE_URL ?? './') + (t === 1 ? qbanUrl(QBAN_CLOUD, 'default').replace(/^\.\//, '') : TERM_IMG.intro2);
function TermNode({ l, open, s, hint, nudge, onClick }: { l: Level; open: boolean; s: number; hint: boolean; nudge: boolean; onClick: () => void }) {
  const t = l.term!; const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (hint) ref.current?.scrollIntoView?.({ block: 'nearest' }); }, [hint]);   // 刚解锁：节点可能在下面，滚进视野再弹
  return <button ref={ref} className={`level kterm-node ${open ? '' : 'locked'} ${s ? 'done' : ''} ${hint ? 'khint' : ''} ${nudge ? 'nudge' : ''}`} data-testid={`term-node-${t}`} data-locked={open ? '0' : '1'} data-hint={hint ? '1' : '0'} aria-disabled={!open} aria-label={open ? TERM_NAME[t] : `${TERM_NAME[t]}（还没打开）`} onClick={onClick}>
    <img className={`kterm-node-img ${open ? '' : 'silhouette'}`} src={termNodeImg(t)} alt="" draggable={false} data-testid={`term-node-img-${t}`} />
    <span className="lv-name">{open ? TERM_NAME[t] : '🔒 ' + TERM_NAME[t]}</span>
    {s > 0 ? <img className="kterm-map-medal" src={(import.meta.env?.BASE_URL ?? './') + TERM_IMG.medal[t]} alt={TERM_MEDAL_NAME[t]} data-testid={`term-medal-${t}`} draggable={false} /> : null}<Stars n={s} />
  </button>;
}
export function MapScreen({ p, cfg, chapters, termLevels = [], progress, wrong, remaining, bonus = 0, bonusCancelled = false, c, onLevel, onBack, onWrongBook, onReview, onChar, chapterIdx, setChapterIdx }: {
  p: Profile; cfg: BandConfig; chapters: Chapter[]; termLevels?: Level[]; progress: Progress; wrong: WrongEntry[]; remaining: number; bonus?: number; bonusCancelled?: boolean; c: Character | undefined;
  onLevel: (l: Level) => void; onBack: () => void; onWrongBook: () => void; onReview: () => void; onChar: () => void;
  chapterIdx: number; setChapterIdx: (i: number) => void;
}) {
  const ch = chapters[Math.min(chapterIdx, chapters.length - 1)];
  // r14.2 小萌新：顶部总星 = 各学科卡片上的星之和（和地图显示的同一算法：锁着的关算 0、拆关前留下的旧关卡号不算）；错题掌握星另外显示
  const shownStars = (ls: Level[]) => ls.reduce((a, l, i) => a + (l.redirect || !isUnlocked(ls, i, progress.stars) ? 0 : starOf(l, progress.stars)), 0);
  const unlockAll = __TEST_HOOKS__ && !!(window as unknown as { __zyUnlockAll?: boolean }).__zyUnlockAll;   // 仅测试构建：全解锁
  // r17：期末关「真的」打开了（这学期每个单元都打过一关）；测试构建可用 __zyTestTermOpen 模拟（全解锁时节点能点，但不弹不读）
  const termReal = (t: TermNo) => termOpen(chapters, t, progress.stars) || (__TEST_HOOKS__ && !!(window as unknown as { __zyTestTermOpen?: number[] }).__zyTestTermOpen?.includes(t));
  const termIsOpen = (t: TermNo) => unlockAll || termReal(t);
  const termStars = termLevels.reduce((a, l) => a + (termIsOpen(l.term!) ? starOf(l, progress.stars) : 0), 0);
  const levelStarsTotal = chapters.reduce((a, x) => a + shownStars(x.levels), 0) + termStars;
  const totalStars = levelStarsTotal + progress.masteredStars;
  const due = wrong.filter(e => isDue(e)).length;
  // 地图提示气泡（策划 X-11 / J-7）：锁定关卡说明、长按看全称、首次出现精英/Boss
  const [tip, setTip] = useState<string>(); const [shake, setShake] = useState<string>();
  const [lockHint, setLockHint] = useState<string>(); const lockHintT = useRef(0);   // r16 小萌新：点锁住的关 → 要先打的关跳动 + 👆
  const lp = useRef(0);
  const tipOff = useRef<(() => void) | undefined>(undefined); useEffect(() => () => tipOff.current?.(), []);
  /* r15.4.4：提示条（未解锁、Boss 提示）至少 4 秒，读完再收起（最多 9 秒） */
  const say = (t: string, voice: boolean) => { setTip(t); if (voice) speak(t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim()); tipOff.current?.(); tipOff.current = afterVoiceThen(4000, 9000, () => setTip(x => x === t ? undefined : x)); };
  useEffect(() => {
    const k = 'zy.bossTip.' + p.id;
    if (ch?.levels.some(l => l.kind !== 'normal') && !localStorage.getItem(k)) { localStorage.setItem(k, '1'); say(cfg.band === 'K' ? '这里有小怪兽等你交朋友！' : '这里有厉害的大怪兽！', cfg.band === 'K'); }
  }, [ch?.subject]);
  const timeUp = remaining <= 0;
  const [termHint, setTermHint] = useState<TermNo>();
  useEffect(() => {   // r17：期末关刚解锁 → 节点轻轻弹一下 + 读开场白（每档案每学期一次，记住了下次不再来）
    if (timeUp) return; const t = termLevels.map(l => l.term!).find(t => termReal(t) && !localStorage.getItem(termHintKey(p.id, t))); if (!t) return;
    try { localStorage.setItem(termHintKey(p.id, t), '1'); } catch { /* */ }
    setTermHint(t); speak(TERM_TEXT.intro[t], 'zh-CN', { keys: [TERM_KEYS.intro[t]] }); const id = window.setTimeout(() => setTermHint(undefined), 1600); return () => clearTimeout(id);
  }, [termLevels, progress.stars, p.id, timeUp]);
  /* r15.4 小萌新：时间用完后点关卡以前什么反应都没有——改成弹出睡着的小怪兽（小班同时朗读），点一下或 4 秒后关掉 */
  const [sleepy, setSleepy] = useState(false);
  const sleepyOff = useRef<(() => void) | undefined>(undefined);   // r15.4.4：至少 4 秒，读完再收起（最多 9 秒）
  const showSleepy = () => { setSleepy(true); if (cfg.band === 'K') speak(SLEEPY_VOICE); sleepyOff.current?.(); sleepyOff.current = afterVoiceThen(4000, 9000, () => setSleepy(false)); };
  useEffect(() => () => sleepyOff.current?.(), []);
  /** r17：这一章第 i 关后面要不要接期末节点（上学期节点在本章最后一个上学期关后面，下学期节点在最后） */
  const termAfter = (i: number) => { if (!termLevels.length) return null; const slot = termSlots(ch); const ts = termLevels.filter(tl => (tl.term === 1 && i === slot.after1) || (tl.term === 2 && i === ch.levels.length - 1));
            return ts.map(tl => { const t = tl.term!, op = termIsOpen(t), st = op ? starOf(tl, progress.stars) : 0;
              return <TermNode key={tl.id} l={tl} open={op} s={st} hint={termHint === t} nudge={shake === tl.id} onClick={() => {
                if (timeUp) { showSleepy(); return; }
                if (!op) { setShake(tl.id); setTimeout(() => setShake(undefined), 500); const b = termBlocker(chapters, t, progress.stars); say(`🔒 ${t === 1 ? '上' : '下'}学期的每一课都打一关，就能来这里庆祝啦${b ? `（还差：${b.chapter} · ${b.unit}）` : ''}`, false); speak(KINDER_LOCK_VOICE); return; }
                onLevel(tl); }} />; }); };
  return (
    <div className="map">
      <div className="map-top">
        <button className="back-inline labeled" data-testid="map-back" onClick={() => { speak('返回选年级'); onBack(); }} aria-label="返回选年级">← <small>返回</small></button>
        {/* r15.4 学霸：在别的年级玩时写明这是哪个年级的档案（「初一同学 · 初一档案 · 在玩高一的关卡」），不会被当成高一档案名取错 */}<span className="who" data-testid="map-who">{p.avatar} {p.name} · {(() => { const hg = (p as { homeGrade?: GradeKey }).homeGrade; return hg && hg !== p.grade ? `${GRADE_LABEL[hg]}档案 · 在玩${GRADE_LABEL[p.grade]}的关卡` : GRADE_LABEL[p.grade]; })()}</span>
        <span className="star-total" data-testid="star-total" title={progress.masteredStars ? `关卡 ${levelStarsTotal} + 错题掌握 ${progress.masteredStars}` : undefined}>★ {levelStarsTotal}{progress.masteredStars ? <small> ＋掌握 {progress.masteredStars}</small> : null}</span>
        <span className={`time-left ${timeUp ? 'warn' : ''}`} data-testid="time-left">⏳ {timeLeftText(remaining, bonus, bonusCancelled)}</span>
        <span className="grow" />
        <button className="chip" onClick={onChar} data-testid="change-char">{c ? <Sprite className="chip-img" c={c} /> : '🐶'} 选角色</button>
        {cfg.band !== 'K' && <button className="chip" data-testid="wrongbook" onClick={onWrongBook}>📕 错题本 {wrong.length}</button>}
        {cfg.band !== 'K' && <button className={`chip ${due ? 'hot' : ''}`} data-testid="review" disabled={!due || timeUp} onClick={onReview}>🔁 今日复习 {Math.min(due, 10)}</button>}
      </div>
      {!chapters.length ? <div className="center-screen"><p>这个年级还没有可玩的题。请家长在「家长 → 题库」导入题目或打开「显示待审核题」。</p></div> :
      <div className="map-body">
        <div className="chapters">
          {chapters.map((x, i) => {
            const got = shownStars(x.levels);
            return <button key={x.subject} className={`chapter ${i === chapterIdx ? 'on' : ''}`} data-testid={'chapter-' + x.subject} onClick={() => setChapterIdx(i)}>
              <span className="ch-icon">{x.icon}</span><span><b>{x.name}</b><small>{x.subject} · {x.count} 题 · ★{got}/{x.levels.length * 3}</small></span></button>;
          })}
        </div>
        <div className="levels" data-testid="levels">
          {ch.levels.map((l, i) => {
            const open = unlockAll || isUnlocked(ch.levels, i, progress.stars);
            const s0 = l.redirect ? starOf(chapters.flatMap(c => c.levels).find(x => x.id === l.redirect) ?? l, progress.stars) : starOf(l, progress.stars);
            const s = open ? s0 : 0;   // r14 小萌新：锁着的关不显示星星（Boss 合并单元时从其他小节 Boss 继承来的星，没解锁前不显示）
            const prev = ch.levels[i - 1];
            const head = !prev || prev.unit !== l.unit || prev.volume !== l.volume;
            return (<Fragment key={l.id}>
              {head && <div className="unit-head" data-testid="unit-head"><small>{l.volume}</small> {l.unit}</div>}
              <button key={l.id} className={`level ${l.kind} ${open ? '' : 'locked'} ${s ? 'done' : ''} ${shake === l.id ? 'nudge' : ''} ${lockHint === l.id ? 'lock-target' : ''}`} aria-disabled={!open || timeUp}
                data-testid={`level-${i + 1}`} data-locked={open ? '0' : '1'}
                onPointerDown={() => { lp.current = window.setTimeout(() => { lp.current = -1; say('📖 ' + l.name, false); }, 550); }}
                onPointerUp={() => { if (lp.current > 0) clearTimeout(lp.current); }} onPointerLeave={() => { if (lp.current > 0) clearTimeout(lp.current); }}
                onContextMenu={e => e.preventDefault()}
                onClick={() => {
                  if (lp.current === -1) { lp.current = 0; return; }   // 长按看全称，不进关
                  if (timeUp) { showSleepy(); return; }
                  if (!open) { setShake(l.id); setTimeout(() => setShake(undefined), 500); { const miss = missingPrereqs(ch.levels, i, progress.stars), need = miss.map(x => x.name); if (need.length && cfg.band === 'K') { say(`🔒 还要先打赢（共 ${need.length} 关）：${need.join('、')}`, false); speak(KINDER_LOCK_VOICE);
                    setLockHint(miss[0].id); clearTimeout(lockHintT.current); lockHintT.current = window.setTimeout(() => setLockHint(undefined), 3500); /* r16 小萌新：要先打的那一关跳动 + 👆 */ } else say(need.length ? `🔒 还要先打赢（共 ${need.length} 关）：${need.join('、')}` : '🔒 先打赢前一关，就能打开这一关哦', true); } return; }   // r15.4：小班朗读不念关名（关名没录音），屏幕上照样写
                  onLevel(l);
                }}>
                {lockHint === l.id && <span className="lock-hint" data-testid="lock-hint" aria-hidden>👆</span>}
                <span className="lv-no">{open ? (l.kind === 'boss' ? '👑' : l.kind === 'elite' ? '⚡' : i + 1) : '🔒'}</span>
                {l.kind === 'normal' ? <span className={`lv-name ${l.name.length > 10 ? 'long' : ''}`} title={l.name}>{l.name}</span>
                  : (() => { const bk = l.kind === 'boss' ? skinFor(ch.subject, 'boss', cfg.band, l.unit, { grade: l.pool[0]?.split(':')[0], volume: l.volume }) : null;   /* r15.3 学霸：Boss 标签（含锁着时）用这只 Boss 自己的主色，和战斗里的怪物同一个 hue-rotate */
                    return <span className={`kind-tag ${l.kind}`} data-testid="kind-tag" data-hue={bk?.hue ?? ''} style={bk?.hue ? { filter: `hue-rotate(${bk.hue}deg)` } : undefined}>{l.kind === 'elite' ? '精英挑战' : `${l.name === '本册 Boss' ? '本册' : '章节'} Boss · ${bk?.name ?? ch.subject}`}</span>; })()}
<Stars n={s} />
              </button>{termAfter(i)}</Fragment>
            );
          })}
        </div>
      </div>}
      {tip && <div className="map-tip" data-testid="map-tip" role="status">{tip}</div>}
      {sleepy && <div className="sleepy-pop" data-testid="sleepy" role="dialog" aria-label={SLEEPY_TEXT} onClick={() => setSleepy(false)}><div className="sleepy-card">
        <div className="sleepy-mon"><img src={MONSTER_IMG.kinder} alt="" draggable={false} /><span className="zzz" aria-hidden>💤</span></div>
        <h2>{SLEEPY_TEXT}</h2><p data-testid="sleepy-reset">{SLEEPY_RESET}</p></div></div>}
      {timeUp && <div className="timeup-bar" data-testid="timeup-bar">今天的时间用完啦。<br />明天 0:00 重新计时。<br /><small>（家长可在设置里加时间）</small></div>}
    </div>
  );
}

/* r16.3 总管方案 A：结算页自动朗读 =「开心值一共 m 个」+ 原来的那几句，拼成一次 speak()（一段接一段，不会两句同时响）；
   要等战斗里「变成好朋友」那句（以及任何正在读的话、🔊 重播）读完才开始（afterVoiceThen，排队不打断）。
   录音键：p:happy_total_m 还没录 → 用已有的 p:happy_m_m（「开心值m个，一共m个」）；某句没有登记的提示语 → 不给键，按文字读（同 r16） */
export const K_RESULT_AUTO = { minMs: 800, maxMs: 15000 };
export function kResultAuto(happy: number, parts: { text: string; key?: string }[], hasClip: (k: string) => boolean): { text: string; keys?: string[] } {
  const all = [...(happy > 0 ? [{ text: HAPPY_TOTAL_LINE(happy), key: hasClip(`p:happy_total_${happy}`) || !hasClip(`p:happy_${happy}_${happy}`) ? `p:happy_total_${happy}` : `p:happy_${happy}_${happy}` }] : []), ...parts];
  const text = all.map(x => x.text.replace(/[。．.]$/, '')).join('。');
  const known = all.every(x => x.key && (!x.key.startsWith('p:happy_total_') || PROMPT_BY_TEXT[HAPPY_TOTAL_LINE(happy)]));
  return known ? { text, keys: all.map(x => x.key!) } : { text };
}
/** 等前面的话读完再自动朗读（卸载就取消）；返回清理函数 */
function useKAuto(on: boolean, say: (hasClip: (k: string) => boolean) => void, deps: unknown[]) {
  useEffect(() => { if (!on) return; let live = true;
    const off = afterVoiceThen(K_RESULT_AUTO.minMs, K_RESULT_AUTO.maxMs, () => { void voiceManifest().then(m => { if (live) say(k => !!m.items?.[k]); }); });
    return () => { live = false; off(); }; }, deps);   // eslint-disable-line react-hooks/exhaustive-deps
}
/** r16.1 (c)：幼儿园结算页的「X变成你的好朋友啦！」 */
export const kFriendLine = (m?: { name: string }) => `${m?.name ?? '小乌云'}变成你的好朋友啦！`;
/** 怪物立绘：idle 柔和版序列帧的第一帧（读不到 json / 图 → 小乌云静态图） */
/** r17：结算动画里的怪物：Q版默认 + 开心两张叠在一起（kFinale 交叉淡化），头顶小爱心；没有 Q版 → 原来的立绘 */
function KMonFinale({ m }: { m?: KMonOut }) {
  if (!m?.qban) return <KMonFace m={m} />;
  return <span className="kfin-q" data-testid="result-k-mon" data-mon={m.name} role="img" aria-label={m.name}><img className="kmon-q kfin-def" src={qbanUrl(m.qban, 'default')} alt="" draggable={false} /><img className="kmon-q kfin-happy" src={qbanUrl(m.qban, 'happy')} alt="" draggable={false} /><span className="kfin-up" aria-hidden>💗</span></span>;
}
export function KMonFace({ m }: { m?: KMonOut }) {
  if (m?.qban) return <img className="kmon-q" src={qbanUrl(m.qban, 'happy')} alt="" data-testid="result-k-mon" data-mon={m.name} data-qban="happy" draggable={false} />;   // r17：Q版「开心 / 变朋友」
  return <KMonSheetFace m={m} />;
}
function KMonSheetFace({ m }: { m?: KMonOut }) {
  const base = import.meta.env.BASE_URL; const [sh, setSh] = useState<{ img: string; cols: number; rows: number; ar: number } | null>(null); const [bad, setBad] = useState(false);
  useEffect(() => { if (!m) return; let live = true; setSh(null); setBad(false);
    fetch(`${base}${m.dir}/${m.idle}.json`).then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status)))).then((j: { image: string; columns: number; rows: number; frame_width: number; frame_height: number }) => {
      if (!live) return; const img = new Image(); img.onload = () => { if (live) setSh({ img: img.src, cols: j.columns, rows: j.rows, ar: j.frame_width / j.frame_height }); }; img.onerror = () => { if (live) setBad(true); }; img.src = `${base}${m.dir}/${j.image}`; })
      .catch(() => { if (live) setBad(true); }); return () => { live = false; }; }, [m?.dir, m?.idle]);
  if (m && sh && !bad) return <div className="kmon-face" data-testid="result-k-mon" data-mon={m.name} role="img" aria-label={m.name} style={{ backgroundImage: `url(${sh.img})`, backgroundSize: `${sh.cols * 100}% ${sh.rows * 100}%`, aspectRatio: String(sh.ar) }} />;
  return <img src={`${base}art/monsters/mon_k_naughty_cloud_sprite.png`} alt="" data-testid="result-k-mon" data-mon={m && !bad ? m.name : '小乌云'} />;
}
export function ResultScreen({ kTerm, kMon, playN, endReason, chalHint = false, cfg, c, win, stars, correct, total, newlyMastered, timeUp, forcedTimeUp, quit, onAgain, onNext, onMap, kinder, retreat, turns, best, prevBest, exhausted = false, half = 0, capped = false }: { kTerm?: TermNo; endReason?: 'hp0' | 'reviveFail'; chalHint?: boolean; capped?: boolean; playN?: number; prevBest?: number; exhausted?: boolean;
  half?: number; best?: number; cfg: BandConfig; c: Character; win: boolean; stars: number; correct: number; total: number; newlyMastered: number; timeUp: boolean; forcedTimeUp?: boolean; quit?: boolean; kinder?: { first: number; retry: number; demo: number }; kMon?: KMonOut; retreat?: boolean; turns?: number;
  onAgain: () => void; onNext?: () => void; onMap: () => void;
}) {
  const acc = total ? Math.round(correct / total * 100) : 0;
  /* r15.4.1 较真家长：小班时间到（强制结算或在收尾里打完）——自动朗读「今天玩够啦，明天见」，不显示「这次 0★，没有超过最佳…」这类给大人看的星星比较 */
  const kTime = cfg.band === 'K' && (timeUp || !!forcedTimeUp);
  /* r15.4.3 小萌新：小班这次没加星（今天第 3 次起，或没超过最佳）→ 只放一个图标 + 一句「今天玩得真棒，明天再来吧」（自动朗读、可重播）；
     不再写「同一关每天从第 3 次起不再加星……」这类给大人看的长句，规则说明挪到家长页。其他年级不变 */
  /* r15.4.4：只有今天第 3 次起（capped，真的不加星）才说「明天再来吧」。第 2 次照规则加星：显示这次得的星星，朗读「真棒！再玩一关吧」。
     以前「没超过最佳」也走这一页（r14.1 起重玩没超过最佳就不显示大星星），第 2 次全对也看不到星星 */
  const kNoStar = cfg.band === 'K' && !kTime && capped;
  const kAgain = cfg.band === 'K' && !kTime && !capped && playN === 2;
  const noStarSay = () => speak(`${K_NOSTAR_TEXT}。${K_NOSTAR_WHY}`, 'zh-CN', { keys: ['p:res_k_done', 'p:res_k_why'] });   // r16 小萌新：接着说原因
  const kHappy = cfg.band === 'K' && win && kinder ? kinder.first + kinder.retry + kinder.demo : 0;   // r16.3：开心值总数（每题亮一个）
  useKAuto(kNoStar, has => { const a = kResultAuto(kHappy, [{ text: K_NOSTAR_TEXT, key: 'p:res_k_done' }, { text: K_NOSTAR_WHY, key: 'p:res_k_why' }], has); speak(a.text, 'zh-CN', a.keys ? { keys: a.keys } : {}); }, [kNoStar]);
  // r17：闯关成功动画（小班 / 中班赢了、这次加星的正常结算；时间到 / 不加星 / 强制结算不演）
  const kFin = cfg.band === 'K' && win && !kNoStar && !kTime && !forcedTimeUp && !kTerm;   // r17 D：期末关结算页是奖章，不演「变朋友」
  const rootRef = useRef<HTMLDivElement>(null); const finRef = useRef<ReturnType<typeof runKFinale> | null>(null);
  useLayoutEffect(() => { if (!kFin || !rootRef.current) return; const f = runKFinale(rootRef.current, hasVoice()); finRef.current = f; return () => { f.stop(); finRef.current = null; }; }, [kFin]);
  useEffect(() => { if (cfg.band === 'K' && forcedTimeUp) { const id = setTimeout(() => speak(TIMEUP_K_TEXT), 800); return () => clearTimeout(id); } }, [cfg.band, forcedTimeUp]);
  return (
    <div className={`center-screen result-screen ${kFin ? 'kfin' : ''}`} data-ktime={kTime ? '1' : undefined} ref={rootRef} data-testid="result-screen">
      {kFin && <div className="kfin-layer" data-kfin="layer" aria-hidden />}
      {cfg.band === 'K' && forcedTimeUp ? <><div className="big-emoji xl" aria-hidden>😴</div><div className="row gap16 kt-title"><h1 data-testid="result-title">{TIMEUP_K_TEXT}</h1>{hasVoice() && <button className="kspeaker" aria-label="再听一遍" data-testid="timeup-replay" onClick={() => speak(TIMEUP_K_TEXT)}>🔊</button>}</div><p data-testid="timeup">⏰ 今天的时间到啦</p></>
      : kNoStar ? <><div className="big-emoji xl" aria-hidden data-testid="result-k-icon">🌈</div><div className="row gap16 kt-title"><h1 data-testid="result-k-done">{K_NOSTAR_TEXT}</h1>{hasVoice() && <button className="kspeaker" aria-label="再听一遍" data-testid="result-k-replay" onClick={noStarSay}>🔊</button>}</div>
        {/* r16 小萌新：不认字也看得懂——今天玩了 3 次 → 月亮（睡一觉）→ 明天的星星 */}
        <div className="knostar-why" data-testid="result-k-why" role="img" aria-label={K_NOSTAR_WHY}><span className="kplays">{[1, 2, 3].map(n => <b key={n}>{n}</b>)}</span><span className="karrow">➜</span><span>🌙</span><span className="karrow">➜</span><span className="kstar-tmr">⭐</span></div></>
      : cfg.band === 'K' ? <>
        {/* r16.1 (c) 小萌新：打的是「点点数星熊」，结算页却写「小乌云…」——用战斗里真正出场的怪物（名字 + 立绘）；普通关 / 没加载出来 = 小乌云 */}
        {/* r17：闯关成功动画（kFinale.ts）：小狗 + 怪物（Q版默认 → 开心）+ 拥抱爱心；不动画时（时间到）照旧是 🤝 */}
        {kTerm ? <div className="row friends kterm-res"><Sprite c={c} /><img className="kterm-res-medal" src={(import.meta.env?.BASE_URL ?? './') + TERM_IMG.medal[kTerm]} alt={TERM_MEDAL_NAME[kTerm]} data-testid="result-term-medal" draggable={false} /></div>
        : kFin ? <div className="row friends kfin-stage"><div className="kfin-pup" data-kfin="pup"><Sprite c={c} /></div><div className="kfin-mon" data-kfin="mon"><span className="kfin-heart" data-kfin="heart" aria-hidden>💗</span><KMonFinale m={kMon} /></div></div>
          : <div className="row friends"><Sprite c={c} /><span className="big-emoji">🤝</span><KMonFace m={kMon} /></div>}
        {kTerm ? <h1 data-testid="result-term-title">{TERM_TEXT.end[kTerm]} {TERM_MEDAL_NAME[kTerm]}</h1> : <h1 data-testid="result-k-friend">{kFriendLine(kMon)}</h1>}
        <KinderSub k={kinder} total={total} happy={kHappy} extra={kTime ? TIMEUP_K_TEXT : kAgain ? K_AGAIN_TEXT : undefined} onSeg={kFin ? i => finRef.current?.seg(i) : undefined} />
        {kAgain && <p className="ksub" data-testid="result-k-again">{K_AGAIN_TEXT}</p>}
      </> : <>
        <div className="big-emoji xl">{forcedTimeUp || timeUp ? '⏰' : win ? '🏆' : '💫'}</div>
        <h1 data-testid="result-title">{forcedTimeUp ? '⏰ 时间到' : timeUp && win ? '时间到啦，这一关在收尾时间里打完了' : timeUp ? '⏰ 时间到' : quit ? '中途退出' : retreat ? (win ? '怪物撤退了！' : '未通关 · 怪物溜走了，再来一次吧！') : win ? '胜利！' : `未通关 · ${endReason === 'reviveFail' ? '复活失败' : endReason === 'hp0' ? '血量归零' : '怪物还在'}`}</h1>
        {/* r15.3 学霸：输了写清原因；鼓励语按正确率（低正确率不再说「这次差一点」） */}
        {!win && !forcedTimeUp && !timeUp && !quit && !retreat && <p data-testid="lose-why">{endReason === 'reviveFail' ? '复活挑战没成功。' : endReason === 'hp0' ? '血量打光了。' : ''}{(() => { const a = total ? correct / total : 0; return a >= 0.6 ? `答对 ${correct}/${total}，这次差一点！` : a >= 0.3 ? `答对 ${correct}/${total}，再练练就能过。` : `答对 ${correct}/${total}。先去错题本看看错的题，再来挑战。`; })()}</p>}
        {(forcedTimeUp || timeUp) && <p data-testid="timeup">今天的游戏时间到啦，明天接着打！</p>}
        {retreat && !forcedTimeUp && exhausted && <p data-testid="retreat-exhausted">题都答过两遍了，怪物提前撤退（这一关题比较少，每道题一局最多出 2 次）：{win ? '正确率够四成，算通关，最多 ★。' : '正确率不到四成，这次不算通关、不得星。'}</p>}
        {retreat && !forcedTimeUp && !exhausted && <p data-testid="retreat">{win ? '到了回合上限，怪物逃走了：正确率够四成，算通关，但最多 ★。下次试试更快打倒它！' : '到了回合上限，怪物溜走了：正确率不到四成，这次不算通关、不得星；答对的题照常算经验。'}</p>}
        {quit && !forcedTimeUp && <p data-testid="quit">本关未通过，不得星。</p>}
        {!win && !forcedTimeUp && <p>答对的题都算经验，错题已放进错题本，下次再来！</p>}
        {forcedTimeUp && <p className="hint">本关不算通关、不得星；已答对的题照常算经验。</p>}
      </>}
      {/* r14 小萌新：不加星时不显示大星星，只写原因和最佳 */}
      {/* r14.1 小萌新：重玩没拿到新星也不显示大星星 */}
      {!(cfg.band === 'K' && forcedTimeUp) && !capped && (cfg.band === 'K' || !(prevBest !== undefined && prevBest > 0 && stars <= prevBest)) && (kFin ? <span className="kfin-stars" data-kfin="stars" data-testid="result-k-stars"><Stars n={stars} size={72} /></span> : <Stars n={stars} size={72} />)}
      {/* r15.4.2 小萌新：小班普通结算页也不显示这句给大人看的星星比较 */}
      {!kTime && cfg.band !== 'K' && !capped && prevBest !== undefined && prevBest > 0 && stars <= prevBest && <p className="sub" data-testid="result-nonew">这次 {'★'.repeat(stars) || '0★'}，没有超过最佳 {'★'.repeat(prevBest)}，地图上的星星不变。</p>}
      {!kTime && !kNoStar && capped && <p className="sub" data-testid="result-capped">这是今天第 {playN ?? 3} 次玩这一关（同一关每天从第 3 次起不再加星），这次不加星（本次按规则可得 {'★'.repeat(stars)}）；地图上保留最佳 {'★'.repeat(best ?? 0) || '0★'}。明天再来挑战吧！</p>}
      {!kTime && cfg.band !== 'K' && !capped && best !== undefined && best < stars && <p className="sub" data-testid="result-capped">这是今天第 {playN ?? 3} 次玩这一关（同一关每天从第 3 次起不再加星）；地图上保留最佳 {'★'.repeat(best)}。明天再来挑战吧！</p>}
      {!kTime && !kNoStar && best !== undefined && best > stars && !(prevBest && stars <= prevBest) && <p className="sub" data-testid="result-best">本次 {'★'.repeat(stars) || '0★'} · 最佳 {'★'.repeat(best)}（地图上显示历史最佳，星星只升不降）</p>}
      {chalHint && <p className="sub" data-testid="result-chal-hint">🔥 {CHAL_STAR_HINT}</p>}   {/* r15.2：只因没答对挑战题拿 2 星 */}
      {!kTime && cfg.band !== 'K' && <p className="star-rules" data-testid="star-rules">{cfg.battle === 'full' ? STAR_RULES_ROUND : STAR_RULES}</p>}   {/* r15.4.3 小萌新：小班不显示「第一次就答对六成 / 八成」图例（规则在家长页） */}
      {kNoStar ? null : cfg.band === 'K' ? <KinderLines k={kinder} /> : <p className="sub" data-testid="result-stats">{half ? `答对 ${Math.round(correct - half / 2)} 题、半对 ${half} 题，共 ${total} 题` : `答对 ${Math.round(correct)} / ${total} 题`}{` · 正确率 ${acc}%`}{turns ? ` · 共 ${turns} 回合` : ''}{newlyMastered ? ` · 掌握错题 +${newlyMastered}★` : ''}</p>}
      {timeUp && !(cfg.band === 'K' && forcedTimeUp) && <p className="warn">{kTime ? <>😴 {TIMEUP_K_TEXT}</> : '今天的时间用完啦，休息一下吧！明天 0:00 重新计时。'}</p>}
      {/* r16 小萌新：按钮带图标；按钮行贴在屏幕底部（窗口矮时不用往下滚） */}
      <div className="row gap24 result-actions" data-testid="result-actions">
        {!timeUp && <button className="btn ghost" data-testid="again" onClick={onAgain}><span className="bicon" aria-hidden>🔁</span>再玩一次</button>}
        {!timeUp && onNext && <button className="btn" data-testid="next-level" onClick={onNext}><span className="bicon" aria-hidden>⏩</span>下一关</button>}
        <button className={`btn ${timeUp || !onNext ? '' : 'ghost'}`} data-testid="to-map" onClick={onMap}><span className="bicon" aria-hidden>🗺️</span>回地图</button>
      </div>
    </div>
  );
}

/** D2：小班结算副标题（自动朗读）与三类明细（只显示 >0 的类别，不出现分数） */
export function kinderSubtitle(k: { first: number } | undefined, total: number) {
  const f = k?.first ?? 0;
  return f === 0 ? '每道题都认真学会啦！下次试试第一次就答对哦' : f / Math.max(1, total) < 0.6 ? '越来越棒啦！' : '太厉害啦！';
}
function KinderSub({ k, total, extra, happy = 0, onSeg }: { k?: { first: number }; total: number; extra?: string; happy?: number; onSeg?: (i: number) => void }) {
  const t = kinderSubtitle(k, total);
  /* r15.4.1：时间到时接着读「今天玩够啦，明天见」（录音：两段拼起来；系统朗读：一句读完） */
  // r16 小萌新：接着读「自己答对 N 题」（时间到时不读）
  const first = !extra || extra !== TIMEUP_K_TEXT ? (k?.first ?? 0) : 0;
  // r16.3：前面加「开心值一共 m 个」；等「变成好朋友」读完再开始（不再固定 1.5 s 后打断它）
  useKAuto(true, has => { const parts = [t, ...(extra ? [extra] : []), ...(first > 0 ? [K_FIRST_LINE(first)] : [])].map(x => ({ text: x, key: PROMPT_BY_TEXT[x] ? 'p:' + PROMPT_BY_TEXT[x] : undefined }));
    if (parts.length === 1 && !happy) { speak(t, 'zh-CN', { onSeg }); return; } const a = kResultAuto(happy, parts, has);
    const segTexts = [...(happy > 0 ? [HAPPY_TOTAL_LINE(happy)] : []), ...parts.map(x => x.text)];   // r17：每段开始 → 结算动画的节拍（onSeg）
    speak(a.text, 'zh-CN', a.keys ? { keys: a.keys, onSeg, segTexts } : { onSeg, segTexts }); }, [t, extra, first, happy]);
  /* r15.4.2 较真家长 A：小班结算（含时间到）也有 🔊 再听一遍，和题目页的喇叭同款 */
  const again = () => { if (!extra) { speak(t); return; } const ks = [PROMPT_BY_TEXT[t], PROMPT_BY_TEXT[extra]]; speak(`${t}。${extra}`, 'zh-CN', ks.every(Boolean) ? { keys: ks.map(x => 'p:' + x) } : {}); };
  return <div className="row gap16 kt-title"><p className="ksub" data-testid="kinder-sub">{t}</p>{hasVoice() && extra && <button className="kspeaker" aria-label="再听一遍" data-testid="timeup-replay" onClick={again}>🔊</button>}</div>;
}
function KinderLines({ k }: { k?: { first: number; retry: number; demo: number } }) {
  if (!k) return null;
  const rows: [number, string][] = [[k.first, '🌟 自己答对'], [k.retry, '💪 再试一次答对'], [k.demo, '👀 看演示学会']];
  /* r16 小萌新：「自己答对 N 题」画成 N 颗星（不认字也数得出来），点一下朗读；自动朗读接在结算副标题后面（KinderSub） */
  const sayFirst = () => speak(K_FIRST_LINE(k.first), 'zh-CN', k.first <= 10 ? { keys: ['p:res_k_first_' + k.first] } : {});
  return <div className="klines" data-testid="result-stats">{rows.filter(([n]) => n > 0).map(([n, l]) => l.startsWith('🌟')
    ? <button key={l} className="kfirst" data-testid="result-k-first" data-n={n} aria-label={K_FIRST_LINE(n)} onClick={sayFirst}><span className="kfirst-icons" aria-hidden>{'⭐'.repeat(Math.min(n, 10))}</span><span>{l} {n} 题</span><span className="kfirst-spk" aria-hidden>🔊</span></button>
    : <div key={l}>{l} {n} 题</div>)}</div>;
}

/* ---------------- 错题本 ---------------- */
export function WrongBookScreen({ wrong, byKey, onBack, onReview , timeUp = false }: { wrong: WrongEntry[]; byKey: Map<string, Question>; onBack: () => void; onReview: (keys: string[]) => void ; timeUp?: boolean }) {
  const subjects = useMemo(() => [...new Set(wrong.map(w => w.subject))], [wrong]);
  const [sub, setSub] = useState<string>('全部'); const [boxInfo, setBoxInfo] = useState(false);
  const list = wrong.filter(w => sub === '全部' || w.subject === sub).sort((a, b) => a.due.localeCompare(b.due));
  const due = list.filter(e => isDue(e));
  return (
    <div className="wrongbook">
      <div className="map-top">
        <button className="back-inline labeled" onClick={onBack} aria-label="返回">← <small>返回</small></button>
        <h2>📕 错题本</h2>
        <span className="sub">共 {wrong.length} 题 · 今天到期 {wrong.filter(e => isDue(e)).length} 题</span>
        <button className="chip" data-testid="wb-box-info" aria-label="盒子是什么" onClick={() => setBoxInfo(x => !x)}>ⓘ 盒子是什么</button>
        <span className="grow" />
        <button className="chip hot" data-testid="wb-review-due" disabled={timeUp || !due.length} onClick={() => onReview(due.slice(0, 10).map(e => e.qkey))}>🔁 复习到期 {Math.min(due.length, 10)}</button>
        <button className="chip" data-testid="wb-review-all" disabled={timeUp || !list.length} onClick={() => onReview(list.slice(0, 10).map(e => e.qkey))}>✍ 练习这些 {Math.min(list.length, 10)}</button>
      </div>
      {timeUp && <div className="sys-bar warn-bar static" data-testid="wb-timeup">⏰ 今天的时间用完啦：错题本可以看，但不能练习和复习。<br />明天 0:00 重新计时。（家长可在设置里加时间）</div>}
      {boxInfo && <p className="p-card hint" data-testid="wb-box-pop">📦 「第 N 盒」是间隔复习的盒子：答错的题放进第 1 盒，隔 1 天复习；复习答对就升一盒，隔的天数变长（第 2 盒隔 {INTERVAL[2]} 天，第 3 盒隔 {INTERVAL[3]} 天）；第 3 盒再答对就算掌握，从错题本移走。复习答错会回到第 1 盒。</p>}
      <div className="row gap16 wrap wb-tabs">
        {['全部', ...subjects].map(s => <button key={s} className={`chip ${s === sub ? 'on' : ''}`} onClick={() => setSub(s)}>{s}</button>)}
      </div>
      <div className="wb-list">
        {!list.length && <p className="sub center">还没有错题，太棒了！</p>}
        {list.map(e => {
          const q = byKey.get(e.qkey);
          if (!q) return null;
          return (
            <div key={e.id} className="wb-item">
              <div className="wb-meta"><span className="tag">{q.subject}</span> 第 {e.box} 盒 · {isDue(e) ? <b className="hot-text">今天复习</b> : `下次 ${e.due}`} · 错 {e.wrongCount} 次</div>
              <div className="wb-q"><Tex text={q.question} /></div>
              <div className="wb-a">你的答案：{wrongStale(e, q) ? <span className="hint" data-testid="wb-stale">（这题后来更新过，当时的答案不再显示）</span> : !e.lastAnswer ? '（超时）' : (q.type === '选择' || q.type === '多选') ? <Tex text={e.lastAnswer.split('').map(k => `${k}. ${q.options.find(o => o.key === k)?.text ?? ''}`).join('；')} /> : e.lastAnswer} · 正确答案：<b><Tex text={correctText(q)} /></b></div>
              {q.explanation && <div className="expl">💡 <Tex text={q.explanation} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 复习模式：不战斗，逐题作答，按盒子法更新 */
export function ReviewSession({ questions, onAnswer, onDone }: { questions: Question[]; onAnswer: (q: Question, correct: boolean, ans: string) => void; onDone: (right: number, total: number) => void }) {
  const [i, setI] = useState(0);
  useForceEnd(() => onDone(right.n, i));   // r10：复习也受时长限制（到时 + 3 分钟收尾后强制结束）
  const [res, setRes] = useState<null | { ok: boolean; ans: string }>(null);
  const [input, setInput] = useState('');
  const [multi, setMulti] = useState<string[]>([]);
  const right = useMemo(() => ({ n: 0 }), []);
  const q = questions[i];
  if (!q) return null;
  const submit = (v: string) => {
    if (res) return;
    const ok = judge(q, q.type === '多选' ? v.split('') : v) === 'full';
    if (ok) right.n++;
    answerFeedback(ok); onAnswer(q, ok, v); setRes({ ok, ans: v });
  };
  const next = () => { if (i + 1 >= questions.length) onDone(right.n, questions.length); else { setI(i + 1); setRes(null); setInput(''); setMulti([]); } };
  const tts = ttsText(q);
  return (
    <div className="review">
      <div className="hud"><b>🔁 错题复习</b><span>{i + 1}/{questions.length}</span><span>答对 {right.n}</span><span className="grow" />
        <button className="pause-btn" aria-label="结束" data-testid="review-exit" onClick={() => onDone(right.n, i + (res ? 1 : 0))}>✕</button></div>
      <div className="review-card">
        <div className="qmeta">{q.subject} · {q.type}{tts && <button className="mini" onClick={() => speak(tts, q.subject === '英语' ? 'en' : 'zh-CN')}>🔊</button>}</div>
        <div className="qtext"><Tex text={q.question} /></div>
        {!res && (q.type === '选择' || q.type === '判断') && <div className={`opts ${q.type === '判断' ? 'tf' : ''}`}>{choicesOf(q).map(ch =>
          <button key={ch.key} className="opt" data-testid={'opt-' + ch.key} data-correct={TEST_DOM ? (q.answer.includes(ch.key) ? '1' : '0') : undefined} onClick={() => submit(ch.key)}>{q.type === '选择' && <i>{ch.key}</i>}<span className="opt-txt"><Tex text={ch.text} /></span></button>)}</div>}
        {!res && q.type === '多选' && <div className="opts">{q.options.map(ch =>
          <button key={ch.key} className={`opt ${multi.includes(ch.key) ? 'sel' : ''}`} onClick={() => setMulti(m => m.includes(ch.key) ? m.filter(x => x !== ch.key) : [...m, ch.key].sort())}><i>{ch.key}</i><span className="opt-txt"><Tex text={ch.text} /></span></button>)}
          <button className="next multi-ok" disabled={!multi.length} onClick={() => submit(multi.join(''))}>确定</button></div>}
        {!res && q.type === '填空' && <Keypad key={q.key} letters={fillKind(q, sciOf(q.grade)) === 'letters'} ime={fillKind(q, sciOf(q.grade)) === 'ime'} sci={sciOf(q.grade)} value={input} onChange={setInput} onOk={v => submit(v)} />}
        {res && <div className={`feedback ${res.ok ? 'ok' : 'bad'}`}>
          <h3>{res.ok ? '✔ 答对了！这题升一个盒子' : '✘ 还没记住，明天再复习'}</h3>
          <p>正确答案：<b><Tex text={correctText(q)} /></b></p>
          {q.explanation && <p className="expl">💡 <Tex text={q.explanation} /></p>}
          <button className="next" data-testid="next" onClick={next}>{i + 1 >= questions.length ? '完成' : '下一题 ▶'}</button>
        </div>}
      </div>
    </div>
  );
}
