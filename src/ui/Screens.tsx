import { useMemo, useState } from 'react';
import { Tex } from '../Tex';
import { Stars, Keypad, fmtMin } from './common';
import { Sprite } from './Battle';
import { PUPS, SCIFI, type Character } from '../game/characters';
import { GRADE_LABEL, choicesOf, correctText, judge, ttsText, type Question } from '../game/questions';
import { isUnlocked, type Chapter, type Level } from '../game/levels';
import type { BandConfig } from '../game/grades';
import type { Profile, Progress } from '../state';
import { isDue, type WrongEntry } from '../game/wrongbook';
import { speak } from '../tts';
import { answerFeedback } from '../feedback';

export function ProfileSelect({ profiles, remaining, onPick, onParent }: { profiles: Profile[]; remaining: Record<string, number>; onPick: (p: Profile) => void; onParent: () => void }) {
  return (
    <div className="center-screen">
      <h1 className="title">⚔️ 知识勇者</h1>
      <p className="sub">谁来玩？点自己的头像</p>
      <div className="row gap24 wrap profiles">
        {profiles.map(p => (
          <button key={p.id} className="profile-card" data-testid={'profile-' + p.id} onClick={() => onPick(p)}>
            <span className="big-emoji">{p.avatar}</span><span>{p.name}</span>
            <small>{GRADE_LABEL[p.grade]}</small>
            <small className={remaining[p.id] === 0 ? 'warn' : ''}>今天还能玩 {fmtMin(remaining[p.id] ?? Infinity)}</small>
          </button>
        ))}
      </div>
      <button className="parent-btn" data-testid="parent" onClick={onParent}>🔒 家长</button>
    </div>
  );
}

export function CharSelect({ cfg, current, onPick, onBack }: { cfg: BandConfig; current?: string; onPick: (c: Character) => void; onBack: () => void }) {
  const list = cfg.chars === 'scifi' ? SCIFI : PUPS;
  return (
    <div className="center-screen">
      <button className="back" onClick={onBack} aria-label="返回">←</button>
      <h2>{cfg.band === 'K' ? '选一只小狗伙伴' : cfg.band === 'H' ? '选择研究员' : '选择你的勇者'}</h2>
      <div className="row gap24 wrap">
        {list.map(c => (
          <button key={c.id} className={`char-card ${c.id === current ? 'last' : ''}`} data-testid={'char-' + c.id}
            onClick={() => { if (cfg.band === 'K' || cfg.band === 'G1') speak(c.name + '，出发！'); onPick(c); }}>
            <Sprite className="char-img" c={c} />
            <b>{c.name}</b>
            {cfg.band !== 'K' && <span className="tag">主修 {c.major}</span>}
            {cfg.band !== 'K' && <small>{c.desc}</small>}
          </button>
        ))}
      </div>
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
            const got = x.levels.reduce((a, l) => a + (progress.stars[l.id] ?? 0), 0);
            return <button key={x.subject} className={`chapter ${i === chapterIdx ? 'on' : ''}`} data-testid={'chapter-' + x.subject} onClick={() => setChapterIdx(i)}>
              <span className="ch-icon">{x.icon}</span><span><b>{x.name}</b><small>{x.subject} · {x.count} 题 · ★{got}/{x.levels.length * 3}</small></span></button>;
          })}
        </div>
        <div className="levels" data-testid="levels">
          {ch.levels.map((l, i) => {
            const open = isUnlocked(ch.levels, i, progress.stars);
            const s = progress.stars[l.id] ?? 0;
            return (
              <button key={l.id} className={`level ${l.kind} ${open ? '' : 'locked'} ${s ? 'done' : ''}`} disabled={!open || timeUp}
                data-testid={`level-${i + 1}`} onClick={() => onLevel(l)}>
                <span className="lv-no">{open ? (l.kind === 'boss' ? '👑' : l.kind === 'elite' ? '⚡' : i + 1) : '🔒'}</span>
                <span className="lv-name">{KIND_LABEL[l.kind] ? `${KIND_LABEL[l.kind]}` : l.name}</span>
                <Stars n={s} />
              </button>
            );
          })}
        </div>
      </div>}
      {timeUp && <div className="timeup-bar">今天的时间用完啦，明天再来！（家长可在设置里加时间）</div>}
    </div>
  );
}

export function ResultScreen({ cfg, c, win, stars, correct, total, newlyMastered, timeUp, onAgain, onNext, onMap }: {
  cfg: BandConfig; c: Character; win: boolean; stars: number; correct: number; total: number; newlyMastered: number; timeUp: boolean;
  onAgain: () => void; onNext?: () => void; onMap: () => void;
}) {
  const acc = total ? Math.round(correct / total * 100) : 0;
  return (
    <div className="center-screen">
      {cfg.band === 'K' ? <>
        <div className="row friends"><Sprite c={c} /><span className="big-emoji">🤝</span><img src={`${import.meta.env.BASE_URL}art/monsters/mon_k_naughty_cloud_sprite.png`} alt="" /></div>
        <h1>小乌云变成你的好朋友啦！</h1>
      </> : <>
        <div className="big-emoji xl">{win ? '🏆' : '💫'}</div>
        <h1>{win ? '胜利！' : '这次差一点'}</h1>
        {!win && <p>失败也能拿一半经验，错题已放进错题本，下次再来！</p>}
      </>}
      <Stars n={stars} size={72} />
      <p className="sub" data-testid="result-stats">{cfg.band === 'H' ? `正确 ${correct}/${total} · 正确率 ${acc}%` : `答对 ${correct} / ${total} 题`}{newlyMastered ? ` · 掌握错题 +${newlyMastered}★` : ''}</p>
      {timeUp && <p className="warn">今天的时间用完啦，休息一下吧！</p>}
      <div className="row gap24">
        {!timeUp && <button className="btn ghost" data-testid="again" onClick={onAgain}>再玩一次</button>}
        {!timeUp && onNext && <button className="btn" data-testid="next-level" onClick={onNext}>下一关 ▶</button>}
        <button className={`btn ${timeUp || !onNext ? '' : 'ghost'}`} data-testid="to-map" onClick={onMap}>回地图</button>
      </div>
    </div>
  );
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
        {!res && q.type === '填空' && <Keypad key={q.key} letters={q.answer.some(a => /[a-z]/i.test(a))} value={input} onChange={setInput} onOk={() => submit(input)} />}
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
