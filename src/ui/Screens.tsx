import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Tex } from '../Tex';
import { Stars, Keypad, fmtMin } from './common';
import { Sprite } from './Battle';
import { PUPS, SCIFI, type Character } from '../game/characters';
import { GRADE_LABEL, choicesOf, correctText, judge, ttsText, type Question } from '../game/questions';
import { isUnlocked, starOf, STAR_RULES, STAR_RULES_K, type Chapter, type Level } from '../game/levels';
import type { BandConfig } from '../game/grades';
import { newProfile, AVATARS, type Profile, type Progress } from '../state';
import { Modal } from './common';
import type { GradeKey } from '../game/questions';
import { isDue, type WrongEntry } from '../game/wrongbook';
import { speak } from '../tts';
import { answerFeedback } from '../feedback';

/** 首页年级列表：可玩 + 即将开放（灰） */
export const HOME_GRADES: { g: GradeKey; open: boolean }[] = [
  ...(['K1', '1', '2', '3', '4', '5', '6', '7'] as GradeKey[]).map(g => ({ g, open: true })),
  { g: '8' as GradeKey, open: false }, { g: '9' as GradeKey, open: false }, { g: '10' as GradeKey, open: true }, { g: '11' as GradeKey, open: false }, { g: '12' as GradeKey, open: false },
];
const DEFAULT_AVATAR: Record<string, string> = { K1: '🐰', 1: '🐣', 2: '🐥', 3: '🦊', 4: '🐼', 5: '🦁', 6: '🐯', 7: '🧑‍🎓', 10: '🧑‍🔬' };
function AddChild({ onAdd, onClose }: { onAdd: (p: Profile) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  return (
    <Modal onClose={onClose}>
      <h2>添加孩子 · 选年级</h2>
      <input className="name-input" data-testid="add-name" placeholder="名字（可不填）" value={name} maxLength={8} onChange={e => setName(e.target.value)} />
      <div className="grade-grid" data-testid="grade-list">
        {HOME_GRADES.map(({ g, open }) => (
          <button key={g} className="grade-btn" disabled={!open} data-testid={'home-grade-' + g}
            onClick={() => onAdd(newProfile(name.trim() || GRADE_LABEL[g] + '同学', g, DEFAULT_AVATAR[g] ?? AVATARS[0]))}>
            {GRADE_LABEL[g]}{!open && <small>即将开放</small>}
          </button>))}
      </div>
      <p className="hint">之后可在「家长」里改名字、头像和每日时长。</p>
      <button className="btn ghost" onClick={onClose}>取消</button>
    </Modal>
  );
}
/** 安装引导（GDD §9.5 / 技术QA P2-8）：iPad 非主屏幕模式显示「分享 → 添加到主屏幕」；安卓显示〔安装到主屏幕〕 */
let deferredPrompt: { prompt: () => void } | null = null;
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e as unknown as { prompt: () => void }; });
function InstallGuide() {
  const [hide, setHide] = useState(() => !!localStorage.getItem('zy.installHide'));
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
  const ios = /iPad|iPhone/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (standalone || hide || (!ios && !deferredPrompt)) return null;
  const close = () => { localStorage.setItem('zy.installHide', '1'); setHide(true); };
  return <div className="install-guide" data-testid="install-guide">
    {ios ? <><span className="share-arrow" aria-hidden>⬆</span> 点 Safari 顶部的 <b>分享</b> 按钮 → <b>添加到主屏幕</b>，像 App 一样全屏玩</>
      : <button className="btn" onClick={() => { deferredPrompt?.prompt(); close(); }}>📲 安装到主屏幕</button>}
    <button className="chip" onClick={close} aria-label="关闭">✕</button>
  </div>;
}
export function ProfileSelect({ profiles, remaining, onPick, onParent, onAdd, onAddRequest, onAddClose, adding, canAdd }: { profiles: Profile[]; remaining: Record<string, number>; onPick: (p: Profile) => void; onParent: () => void;
  onAdd: (p: Profile) => void; onAddRequest: () => void; onAddClose: () => void; adding: boolean; canAdd: boolean }) {
  return (
    <div className="center-screen">
      <h1 className="title">⚔️ 知识勇者</h1>
      <p className="sub">谁来玩？点自己的头像</p>
      <div className="row gap24 wrap profiles">
        {profiles.map(p => (
          <button key={p.id} className="profile-card" data-testid={'profile-' + p.id} onClick={() => onPick(p)}>
            <span className="big-emoji">{p.avatar}</span><span>{p.name}</span>
            <small>{GRADE_LABEL[p.grade]}</small>
            <small className={`left-time ${remaining[p.id] === 0 ? 'warn' : ''}`}>今天还能玩 {fmtMin(remaining[p.id] ?? Infinity)}</small>
          </button>
        ))}
        {canAdd && <button className="profile-card add-card" data-testid="add-child" onClick={onAddRequest}>
          <span className="big-emoji">➕</span><span>添加孩子</span><small>需要家长密码</small></button>}
      </div>
      {adding && <AddChild onClose={onAddClose} onAdd={onAdd} />}
      <InstallGuide />
      <button className="parent-btn icon-only" data-testid="parent" aria-label="家长" title="家长" onClick={onParent}>🔒</button>
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
      <button className="back" onClick={onBack} aria-label="返回">←</button>
      <h2>{cfg.band === 'K' ? '选一只小狗伙伴' : cfg.band === 'H' ? '选择研究员' : '选择你的勇者'}</h2>
      <div className="row gap24 wrap char-list" data-testid="charlist">
        {list.map(c => (
          <button key={c.id} className={`char-card ${c.id === sel ? 'sel' : ''} ${c.id === current ? 'last' : ''}`} data-testid={'char-' + c.id} aria-pressed={c.id === sel}
            onClick={() => { setSel(c.id); if (cfg.band === 'K' || cfg.band === 'G1') speak(c.name); }}>
            <Sprite className="char-img" c={c} />
            <b>{c.name}</b>
            {cfg.band !== 'K' && rec(c) && <span className="tag rec" data-testid="rec">⭐ 推荐</span>}
            {cfg.band !== 'K' && <span className="tag">主修 {c.major}</span>}
            {cfg.band !== 'K' && <small>{c.desc}</small>}
          </button>
        ))}
      </div>
      <button className="btn big" data-testid="char-confirm" disabled={!chosen} onClick={() => { if (!chosen) return; if (cfg.band === 'K' || cfg.band === 'G1') speak(chosen.name + '，出发！'); onPick(chosen); }}>就选它{chosen ? `：${chosen.name}` : ''}</button>
    </div>
  );
}

const KIND_LABEL = { normal: '', elite: '精英', boss: 'Boss' };
export function MapScreen({ p, cfg, chapters, progress, wrong, remaining, c, onLevel, onBack, onWrongBook, onReview, onChar, chapterIdx, setChapterIdx }: {
  p: Profile; cfg: BandConfig; chapters: Chapter[]; progress: Progress; wrong: WrongEntry[]; remaining: number; c: Character | undefined;
  onLevel: (l: Level) => void; onBack: () => void; onWrongBook: () => void; onReview: () => void; onChar: () => void;
  chapterIdx: number; setChapterIdx: (i: number) => void;
}) {
  const ch = chapters[Math.min(chapterIdx, chapters.length - 1)];
  const totalStars = Object.values(progress.stars).reduce((a, b) => a + b, 0) + progress.masteredStars;
  const due = wrong.filter(e => isDue(e)).length;
  // 地图提示气泡（策划 X-11 / J-7）：锁定关卡说明、长按看全称、首次出现精英/Boss
  const [tip, setTip] = useState<string>(); const [shake, setShake] = useState<string>();
  const lp = useRef(0);
  const say = (t: string, voice: boolean) => { setTip(t); if (voice) speak(t); window.setTimeout(() => setTip(x => x === t ? undefined : x), 2500); };
  useEffect(() => {
    const k = 'zy.bossTip.' + p.id;
    if (ch?.levels.some(l => l.kind !== 'normal') && !localStorage.getItem(k)) { localStorage.setItem(k, '1'); say('这里有厉害的大怪兽！', cfg.band === 'K'); }
  }, [ch?.subject]);
  const timeUp = remaining <= 0;
  return (
    <div className="map">
      <div className="map-top">
        <button className="back-inline" onClick={onBack} aria-label="换人">←</button>
        <span className="who">{p.avatar} {p.name} · {GRADE_LABEL[p.grade]}</span>
        <span className="star-total">★ {totalStars}</span>
        <span className={`time-left ${timeUp ? 'warn' : ''}`} data-testid="time-left">⏳ 今天还能玩 {fmtMin(remaining)}</span>
        <span className="grow" />
        <button className="chip" onClick={onChar} data-testid="change-char">{c ? <Sprite className="chip-img" c={c} /> : '🐶'} 换角色</button>
        {cfg.band !== 'K' && <button className="chip" data-testid="wrongbook" onClick={onWrongBook}>📕 错题本 {wrong.length}</button>}
        {cfg.band !== 'K' && <button className={`chip ${due ? 'hot' : ''}`} data-testid="review" disabled={!due || timeUp} onClick={onReview}>🔁 今日复习 {Math.min(due, 10)}</button>}
      </div>
      {!chapters.length ? <div className="center-screen"><p>这个年级还没有可玩的题。请家长在「家长 → 题库」导入题目或打开「显示待审核题」。</p></div> :
      <div className="map-body">
        <div className="chapters">
          {chapters.map((x, i) => {
            const got = x.levels.reduce((a, l) => a + starOf(l, progress.stars), 0);
            return <button key={x.subject} className={`chapter ${i === chapterIdx ? 'on' : ''}`} data-testid={'chapter-' + x.subject} onClick={() => setChapterIdx(i)}>
              <span className="ch-icon">{x.icon}</span><span><b>{x.name}</b><small>{x.subject} · {x.count} 题 · ★{got}/{x.levels.length * 3}</small></span></button>;
          })}
        </div>
        <div className="levels" data-testid="levels">
          {ch.levels.map((l, i) => {
            const open = isUnlocked(ch.levels, i, progress.stars);
            const s = l.redirect ? starOf(chapters.flatMap(c => c.levels).find(x => x.id === l.redirect) ?? l, progress.stars) : starOf(l, progress.stars);
            const prev = ch.levels[i - 1];
            const head = !prev || prev.unit !== l.unit || prev.volume !== l.volume;
            return (<Fragment key={l.id}>
              {head && <div className="unit-head" data-testid="unit-head"><small>{l.volume}</small> {l.unit}</div>}
              <button key={l.id} className={`level ${l.kind} ${open ? '' : 'locked'} ${s ? 'done' : ''} ${shake === l.id ? 'nudge' : ''}`} aria-disabled={!open || timeUp}
                data-testid={`level-${i + 1}`} data-locked={open ? '0' : '1'}
                onPointerDown={() => { lp.current = window.setTimeout(() => { lp.current = -1; say(l.name, false); }, 550); }}
                onPointerUp={() => { if (lp.current > 0) clearTimeout(lp.current); }} onPointerLeave={() => { if (lp.current > 0) clearTimeout(lp.current); }}
                onContextMenu={e => e.preventDefault()}
                onClick={() => {
                  if (lp.current === -1) { lp.current = 0; return; }   // 长按看全称，不进关
                  if (timeUp) return;
                  if (!open) { setShake(l.id); setTimeout(() => setShake(undefined), 500); say('先通过前一关就能打开哦', cfg.band === 'K'); return; }
                  onLevel(l);
                }}>
                <span className="lv-no">{open ? (l.kind === 'boss' ? '👑' : l.kind === 'elite' ? '⚡' : i + 1) : '🔒'}</span>
                {l.kind === 'normal' ? <span className={`lv-name ${l.name.length > 10 ? 'long' : ''}`} title={l.name}>{l.name}</span>
                  : <span className={`kind-tag ${l.kind}`}>{l.kind === 'elite' ? '精英挑战' : '章节 Boss'}</span>}
                <Stars n={s} />
              </button></Fragment>
            );
          })}
        </div>
      </div>}
      {tip && <div className="map-tip" data-testid="map-tip" role="status">{tip}</div>}
      {timeUp && <div className="timeup-bar">今天的时间用完啦，明天再来！（家长可在设置里加时间）</div>}
    </div>
  );
}

export function ResultScreen({ cfg, c, win, stars, correct, total, newlyMastered, timeUp, forcedTimeUp, onAgain, onNext, onMap, kinder, retreat, turns }: {
  cfg: BandConfig; c: Character; win: boolean; stars: number; correct: number; total: number; newlyMastered: number; timeUp: boolean; forcedTimeUp?: boolean; kinder?: { first: number; retry: number; demo: number }; retreat?: boolean; turns?: number;
  onAgain: () => void; onNext?: () => void; onMap: () => void;
}) {
  const acc = total ? Math.round(correct / total * 100) : 0;
  return (
    <div className="center-screen">
      {cfg.band === 'K' && forcedTimeUp ? <><div className="big-emoji xl">⏰</div><h1>时间到</h1><p data-testid="timeup">今天的游戏时间到啦，明天接着打！</p></>
      : cfg.band === 'K' ? <>
        <div className="row friends"><Sprite c={c} /><span className="big-emoji">🤝</span><img src={`${import.meta.env.BASE_URL}art/monsters/mon_k_naughty_cloud_sprite.png`} alt="" /></div>
        <h1>小乌云变成你的好朋友啦！</h1>
        <KinderSub k={kinder} total={total} />
      </> : <>
        <div className="big-emoji xl">{win ? '🏆' : '💫'}</div>
        <h1>{forcedTimeUp ? '⏰ 时间到' : retreat ? '怪物撤退了！' : win ? '胜利！' : '这次差一点'}</h1>
        {forcedTimeUp && <p data-testid="timeup">今天的游戏时间到啦，明天接着打！</p>}
        {retreat && !forcedTimeUp && <p data-testid="retreat">到了回合上限，怪物逃走了：算通关，但最多 ★。下次试试更快打倒它！</p>}
        {!win && !forcedTimeUp && <p>答对的题都算经验，错题已放进错题本，下次再来！</p>}
        {forcedTimeUp && <p className="hint">本关不算通关、不得星；已答对的题照常算经验。</p>}
      </>}
      <Stars n={stars} size={72} />
      <p className="star-rules" data-testid="star-rules">{cfg.band === 'K' ? STAR_RULES_K : STAR_RULES}</p>
      {cfg.band === 'K' ? <KinderLines k={kinder} /> : <p className="sub" data-testid="result-stats">{`答对 ${correct} / ${total} 题`}{` · 正确率 ${acc}%`}{turns ? ` · 共 ${turns} 回合` : ''}{newlyMastered ? ` · 掌握错题 +${newlyMastered}★` : ''}</p>}
      {timeUp && <p className="warn">今天的时间用完啦，休息一下吧！</p>}
      <div className="row gap24">
        {!timeUp && <button className="btn ghost" data-testid="again" onClick={onAgain}>再玩一次</button>}
        {!timeUp && onNext && <button className="btn" data-testid="next-level" onClick={onNext}>下一关 ▶</button>}
        <button className={`btn ${timeUp || !onNext ? '' : 'ghost'}`} data-testid="to-map" onClick={onMap}>回地图</button>
      </div>
    </div>
  );
}

/** D2：小班结算副标题（自动朗读）与三类明细（只显示 >0 的类别，不出现分数） */
export function kinderSubtitle(k: { first: number } | undefined, total: number) {
  const f = k?.first ?? 0;
  return f === 0 ? '每道题都认真学会啦！下次试试第一次就答对哦' : f / Math.max(1, total) < 0.6 ? '越来越棒啦！' : '太厉害啦！';
}
function KinderSub({ k, total }: { k?: { first: number }; total: number }) {
  const t = kinderSubtitle(k, total);
  useEffect(() => { const id = setTimeout(() => speak(t), 1500); return () => clearTimeout(id); }, [t]);
  return <p className="ksub" data-testid="kinder-sub">{t}</p>;
}
function KinderLines({ k }: { k?: { first: number; retry: number; demo: number } }) {
  if (!k) return null;
  const rows: [number, string][] = [[k.first, '🌟 自己答对'], [k.retry, '💪 再试一次答对'], [k.demo, '👀 看演示学会']];
  return <div className="klines" data-testid="result-stats">{rows.filter(([n]) => n > 0).map(([n, l]) => <div key={l}>{l} {n} 题</div>)}</div>;
}

/* ---------------- 错题本 ---------------- */
export function WrongBookScreen({ wrong, byKey, onBack, onReview }: { wrong: WrongEntry[]; byKey: Map<string, Question>; onBack: () => void; onReview: (keys: string[]) => void }) {
  const subjects = useMemo(() => [...new Set(wrong.map(w => w.subject))], [wrong]);
  const [sub, setSub] = useState<string>('全部');
  const list = wrong.filter(w => sub === '全部' || w.subject === sub).sort((a, b) => a.due.localeCompare(b.due));
  const due = list.filter(e => isDue(e));
  return (
    <div className="wrongbook">
      <div className="map-top">
        <button className="back-inline" onClick={onBack} aria-label="返回">←</button>
        <h2>📕 错题本</h2>
        <span className="sub">共 {wrong.length} 题 · 今天到期 {wrong.filter(e => isDue(e)).length} 题</span>
        <span className="grow" />
        <button className="chip hot" data-testid="wb-review-due" disabled={!due.length} onClick={() => onReview(due.slice(0, 10).map(e => e.qkey))}>🔁 复习到期 {Math.min(due.length, 10)}</button>
        <button className="chip" data-testid="wb-review-all" disabled={!list.length} onClick={() => onReview(list.slice(0, 10).map(e => e.qkey))}>✍ 练习这些 {Math.min(list.length, 10)}</button>
      </div>
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
              <div className="wb-meta"><span className="tag">{q.subject}</span> 盒子 {e.box} · {isDue(e) ? <b className="hot-text">今天复习</b> : `下次 ${e.due}`} · 错 {e.wrongCount} 次</div>
              <div className="wb-q"><Tex text={q.question} /></div>
              <div className="wb-a">你的答案：{!e.lastAnswer ? '（超时）' : (q.type === '选择' || q.type === '多选') ? <Tex text={e.lastAnswer.split('').map(k => `${k}. ${q.options.find(o => o.key === k)?.text ?? ''}`).join('；')} /> : e.lastAnswer} · 正确答案：<b><Tex text={correctText(q)} /></b></div>
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
          <button key={ch.key} className="opt" data-testid={'opt-' + ch.key} data-correct={q.answer.includes(ch.key) ? '1' : '0'} onClick={() => submit(ch.key)}>{q.type === '选择' && <i>{ch.key}</i>}<Tex text={ch.text} /></button>)}</div>}
        {!res && q.type === '多选' && <div className="opts">{q.options.map(ch =>
          <button key={ch.key} className={`opt ${multi.includes(ch.key) ? 'sel' : ''}`} onClick={() => setMulti(m => m.includes(ch.key) ? m.filter(x => x !== ch.key) : [...m, ch.key].sort())}><i>{ch.key}</i><Tex text={ch.text} /></button>)}
          <button className="next multi-ok" disabled={!multi.length} onClick={() => submit(multi.join(''))}>确定</button></div>}
        {!res && q.type === '填空' && <Keypad key={q.key} letters={q.subject === '英语' || q.answer.some(a => /[a-df-z]/i.test(a))} value={input} onChange={setInput} onOk={() => submit(input)} />}
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
