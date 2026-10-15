import { useEffect, useMemo, useRef, useState } from 'react';
import { Tex } from '../Tex';
import { Bar, Keypad, Modal } from './common';
import { choicesOf, correctText, isCorrect, judge, kinderChoices, ttsText, type Question, type Option } from '../game/questions';
import { newBattle, resolveCorrect, resolveWrong, intentOf, outOfQuestions, newKinder, kinderAnswer, autoAction, revive, type BattleState, type Action } from '../game/battle';
import { MONSTERS, MONSTER, AUTO_ATTACK_SECONDS, EXTRA_QUESTION_FACTOR } from '../game/balance';
import { timeLimitFor, type BandConfig, type LevelKind } from '../game/grades';
import { MONSTER_IMG, type Character } from '../game/characters';
import { speak } from '../tts';
import { answerFeedback } from '../feedback';
import { Director } from '../fx/director';
import { loadCharAnims, SheetPlayer, SUBJECT_FX } from '../fx/sheets';
import { appReduceMotion, setAppReduceMotion } from '../fx/motion';

/** 挂载演出导演（Canvas 粒子层 + 各单位节点） */
function useDirector(gentle: boolean, c: Character, scale: number, hs = false) {
  const stage = useRef<HTMLDivElement>(null), shake = useRef<HTMLDivElement>(null), hero = useRef<HTMLDivElement>(null);
  const monster = useRef<HTMLDivElement>(null), flash = useRef<HTMLImageElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const dir = useRef<Director | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (stage.current && shake.current && hero.current && monster.current && flash.current && canvas.current)
      dir.current = new Director({ stage: stage.current, shake: shake.current, hero: hero.current, monster: monster.current, flash: flash.current, canvas: canvas.current,
        heroImg: hero.current.querySelector('img') ?? undefined }, gentle);
    // 懒加载本角色序列帧 + 特效；失败则保留静态立绘 + 程序特效
    const d = dir.current;
    if (d) {
      void d.preloadFx([...new Set([SUBJECT_FX[c.major], 'hit_spark_light', 'hit_spark_crit', 'heal_star', ...(hs ? ['hs_energy_beam'] : [])].filter(Boolean))]);
      void loadCharAnims(c.id).then(a => {
        if (!a || !alive.current || dir.current !== d || !hero.current) return;
        const pl = new SheetPlayer(scale);
        const holder = hero.current.querySelector('.breathe') as HTMLElement | null;
        if (holder) { holder.classList.add('has-sheet'); holder.appendChild(pl.box); }
        d.sheets = { player: pl, anims: a, hs }; d.r.heroImg = pl.box;
        void pl.play(a.idle);
      });
    }
    const onR = () => dir.current?.resize(); window.addEventListener('resize', onR);
    return () => { alive.current = false; window.removeEventListener('resize', onR); dir.current?.sheets?.player.stop(); dir.current?.sheets?.player.box.remove(); dir.current?.destroy(); dir.current = null; };
  }, [gentle, c.id]);
  return { stage, shake, hero, monster, flash, canvas, dir, alive };
}

export interface BattleResult { win: boolean; correct: number; total: number; revived: boolean; wrongKeys: string[] }
export interface BattleProps {
  cfg: BandConfig; c: Character; kind: LevelKind; title: string;
  questions: Question[]; extra: Question[];         // extra：精英/Boss 题不够时继续出
  g1NoLimit?: boolean;
  onAnswer: (q: Question, correct: boolean, answer: string) => void;
  onEnd: (r: BattleResult) => void; onQuit: () => void; onFlag?: (q: Question) => void;
}

/** 暂停层：所有年级都有；退出需二次确认 */
function PauseOverlay({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal>
      <h2>⏸ 暂停中</h2>
      <p className="sub">计时已停止</p>
      <div className="col gap16">
        <button className="btn" data-testid="resume" onClick={onResume}>▶ 继续</button>
        <ReduceToggle />
        {!confirm ? <button className="btn ghost" data-testid="quit" onClick={() => setConfirm(true)}>退出本关</button>
          : <button className="btn danger" data-testid="quit-confirm" onClick={onQuit}>确定退出？（本关不记星）</button>}
      </div>
    </Modal>
  );
}
export function ReduceToggle() {
  const [on, setOn] = useState(appReduceMotion());
  return <label className="toggle-line"><input type="checkbox" data-testid="reduce-motion" checked={on} onChange={e => { setAppReduceMotion(e.target.checked); setOn(e.target.checked); }} /> 减少动画（不晃屏、不冲刺）</label>;
}
function usePauseOnHide(setPaused: (b: boolean) => void) {
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'hidden') setPaused(true); };
    document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f);
  }, [setPaused]);
}

/* ---------------- 幼儿园（不会失败） ---------------- */
const PRAISE = ['真棒！', '太厉害了！', '答对啦！', '你好聪明！', '小乌云笑啦！'];
const KCOLORS = ['#cfe3ff', '#d5f0c4', '#fff0b3'];
function speakStem(q: Question) { const t = ttsText(q); if (t) speak(t); }

export function KinderBattle({ cfg, c, kind, questions, onAnswer, onEnd, onQuit }: BattleProps) {
  const hearts = Math.min(questions.length, cfg.questions[kind]);
  const [idx, setIdx] = useState(0);
  const [ks, setKs] = useState(newKinder(hearts));
  const [fx, setFx] = useState<'' | 'star' | 'shake' | 'demo'>('');
  const [paused, setPaused] = useState(false);
  usePauseOnHide(setPaused);
  const lock = useRef(false);
  const D = useDirector(true, c, 0.95);
  const ksRef = useRef(ks); ksRef.current = ks;
  const firstTry = useRef(0), wrong = useRef<string[]>([]);
  const q = questions[idx];
  const choices = useMemo(() => q ? kinderChoices(q) : [], [q]);
  useEffect(() => { if (q && cfg.autoTTS) speakStem(q); }, [q, cfg.autoTTS]);
  if (!q) return null;
  const visible = choices.filter(ch => !ks.removed.includes(ch.key));
  const answer = (ch: Option) => {
    if (lock.current || paused) return;
    lock.current = true;
    const cur = ksRef.current;
    const ok = isCorrect(q, ch.key);
    if (cur.attempt === 0) { onAnswer(q, ok, ch.key); if (ok) firstTry.current++; else wrong.current.push(q.key); }
    const wrongVisible = choices.filter(x => !q.answer.includes(x.key) && !cur.removed.includes(x.key)).map(x => x.key);
    const [ns, r] = kinderAnswer(cur, ok, wrongVisible);
    answerFeedback(ok);
    if (r === 'retry') {
      setKs(ns); D.dir.current?.kinderRetry(); speak('再想想哦');
      setTimeout(() => { setFx(''); lock.current = false; }, 900);
      return;
    }
    if (r === 'demo') { setFx('demo'); speak('看，是这个哦！'); }   // 不朗读选项内容
    else { setFx('star'); D.dir.current?.kinderCorrect(); speak(PRAISE[Math.floor(Math.random() * PRAISE.length)]); }
    setKs({ ...ns, removed: cur.removed });
    setTimeout(async () => {
      setFx('');
      if (ns.done || idx + 1 >= questions.length) {
        speak('小乌云变成你的好朋友啦！');
        await D.dir.current?.kinderFinale();
        if (!D.alive.current) return;
        onEnd({ win: true, correct: firstTry.current, total: idx + 1, revived: false, wrongKeys: wrong.current }); return;
      }
      setKs(ns); setIdx(i => i + 1); lock.current = false;
    }, r === 'demo' ? 2000 : 1400);
  };
  return (
    <div className="kbattle">
      <div className="ktop">
        <div className="row gap16 kleft">
          <button className="pause-btn" aria-label="暂停" data-testid="pause" onClick={() => setPaused(true)}>⏸</button>
          <div className="kstars">⭐ {ks.stars}</div>
        </div>
        <div className="kbubble">
          <button className="kspeaker" aria-label="再听一遍" data-testid="speak" onClick={() => speakStem(q)}>🔊</button>
          <div className="kq">{q.question}</div>
        </div>
        <div className="hearts" data-testid="hearts">{Array.from({ length: ks.hearts }, (_, i) => <span key={i}>{i < ks.lit ? '💖' : '🤍'}</span>)}</div>
      </div>
      <div className="kstage" ref={D.stage}>
        <div className="fx-shake" ref={D.shake}>
          <div className="unit-wrap kpup-wrap" ref={D.hero}><div className="breathe"><Sprite className="kpup" c={c} /></div></div>
          <div className="unit-wrap kmon-wrap" ref={D.monster}><div className="breathe slow">
            <img className={`kmon ${ks.lit >= 2 ? 'smile' : ''}`} src={MONSTER_IMG.kinder} alt="小乌云" draggable={false} />
            <img className="kmon white-flash" ref={D.flash} src={MONSTER_IMG.kinder} alt="" aria-hidden draggable={false} /></div></div>
        </div>
        <canvas className="fx-canvas" ref={D.canvas} />
      </div>
      <div className="kopts" data-testid="kopts">
        {visible.map(ch => (
          <button key={ch.key} style={{ background: KCOLORS[choices.indexOf(ch) % 3] }}
            className={`kopt ${fx === 'demo' && q.answer.includes(ch.key) ? 'reveal' : ''} ${fx === 'demo' && !q.answer.includes(ch.key) ? 'dim' : ''}`}
            data-testid={'opt-' + ch.key} data-correct={q.answer.includes(ch.key) ? '1' : '0'} onClick={() => answer(ch)}>
            {ch.image ? <img src={ch.image} alt="" /> : <span className={`kopt-text ${[...ch.text].length <= 3 ? 'short' : ''}`}>{ch.text}</span>}
          </button>
        ))}
      </div>
      {paused && <PauseOverlay onResume={() => setPaused(false)} onQuit={onQuit} />}
    </div>
  );
}

/** 角色图：WebP 优先，PNG 兜底（旧 Safari） */
export function Sprite({ c, className }: { c: Character; className?: string }) {
  return <picture>{c.webp && <source srcSet={c.webp} type="image/webp" />}<img className={className} src={c.img} alt={c.name} draggable={false} /></picture>;
}

/* ---------------- 小学 / 初一 / 高一 ---------------- */
type Phase = 'question' | 'action' | 'feedback' | 'revive-ask' | 'revive-q' | 'anim';
export function StdBattle({ cfg, c, kind, title, questions, extra, g1NoLimit, onAnswer, onEnd, onQuit, onFlag }: BattleProps) {
  const mode = cfg.stats;
  const mon = MONSTERS[mode][kind];
  const [queue, setQueue] = useState<Question[]>(questions);
  const extraLeft = useRef(extra.filter(q => !questions.some(x => x.key === q.key)).slice(0, Math.ceil(questions.length * EXTRA_QUESTION_FACTOR)));
  const [idx, setIdx] = useState(0);
  const [bs, setBs] = useState<BattleState>(() => newBattle(mode, kind, !cfg.canFail));
  const [phase, setPhase] = useState<Phase>('question');
  const [fb, setFb] = useState<{ ok: boolean; text: string; dealt?: number; taken?: number }>();
  const [canNext, setCanNext] = useState(true);
  const [paused, setPaused] = useState(false);
  usePauseOnHide(setPaused);
  const [input, setInput] = useState('');
  const [multi, setMulti] = useState<string[]>([]);
  const [picked, setPicked] = useState<string>();
  const [flagged, setFlagged] = useState(false);
  const stats = useRef({ correct: 0, total: 0, wrong: [] as string[] });
  // 复活挑战（GDD §4.4）：答对 2 道本关错题
  const [rv, setRv] = useState<{ list: Question[]; i: number; right: number } | null>(null);
  const q: Question | undefined = phase === 'revive-q' && rv ? rv.list[rv.i] : queue[idx];
  const limit = q ? timeLimitFor(q, cfg.band, { g1NoLimit }) : 0;
  const [timeLeft, setTimeLeft] = useState(limit);
  const [actLeft, setActLeft] = useState(AUTO_ATTACK_SECONDS);
  const intent = intentOf(bs.turn);
  const D = useDirector(false, c, 0.75, mode === 'hs');
  const [view, setView] = useState({ p: bs.playerHp, m: bs.monsterHp, c: bs.combo });   // 血条按命中时刻扣减
  const [ending, setEnding] = useState(false);

  useEffect(() => { setTimeLeft(limit); }, [q?.key, phase === 'question' || phase === 'revive-q']);
  useEffect(() => { if (q && cfg.autoTTS && (phase === 'question' || phase === 'revive-q')) { const t = ttsText(q); if (t) speak(t, q.subject === '英语' ? 'en' : 'zh-CN'); } }, [q?.key, phase]);
  useEffect(() => {
    if ((phase !== 'question' && phase !== 'revive-q') || paused || !limit) return;
    if (timeLeft <= 0) { submit(''); return; }
    const t = setTimeout(() => setTimeLeft(x => x - 1), 1000); return () => clearTimeout(t);
  }, [phase, timeLeft, paused, limit]);
  useEffect(() => {
    if (phase !== 'action' || paused) return;
    if (actLeft <= 0) { act('attack'); return; }
    const t = setTimeout(() => setActLeft(x => x - 1), 1000); return () => clearTimeout(t);
  }, [phase, actLeft, paused]);

  if (!q) return null;
  const finish = async (s: BattleState) => {
    if (ending) return; setEnding(true);
    const win = s.over === 'win' || (!s.over && outOfQuestions(s) === 'win') || (!cfg.canFail);
    setPhase('anim');
    await (win ? D.dir.current?.victory() : D.dir.current?.defeat());
    if (!D.alive.current) return;
    onEnd({ win, correct: stats.current.correct, total: stats.current.total, revived: s.revived, wrongKeys: stats.current.wrong });
  };
  /** 先播演出，命中瞬间扣血条，演完再进入反馈 */
  async function play(ns: BattleState, show: () => Promise<void> | undefined) {
    setPhase('anim');
    try { await show(); } catch { /* 动画失败不影响流程 */ }
    if (!D.alive.current) return;
    setView({ p: ns.playerHp, m: ns.monsterHp, c: ns.combo }); setBs(ns);
  }

  function submit(val: string) {
    if (!q) return;
    if (phase === 'revive-q' && rv) {
      const ok = val !== '' && judge(q, q.type === '多选' ? val.split('') : val) === 'full';
      answerFeedback(ok);
      const right = rv.right + (ok ? 1 : 0);
      setPicked(val);
      if (right >= 2) { const ns = revive(bs); setBs(ns); setView({ p: ns.playerHp, m: ns.monsterHp, c: ns.combo }); setRv(null); setFb({ ok: true, text: '复活成功！回到 50% 血量' }); setPhase('feedback'); return; }
      if (rv.i + 1 >= rv.list.length || (rv.list.length - rv.i - 1) < 2 - right) { setRv(null); finish(bs); return; }
      setRv({ ...rv, i: rv.i + 1, right }); setInput(''); setMulti([]); setTimeLeft(limit);
      return;
    }
    if (phase !== 'question') return;
    const g = val === '' ? 'wrong' : judge(q, q.type === '多选' ? val.split('') : val);
    const ok = g !== 'wrong';
    setPicked(val); answerFeedback(ok); setFlagged(false);
    stats.current.total++;
    if (g === 'full') stats.current.correct++; else stats.current.wrong.push(q.key);
    onAnswer(q, g === 'full', val);
    if (g === 'partial') {   // 多选漏选：半伤害、不受击、自动攻击
      const [ns, r] = resolveCorrect(bs, c, 'attack', q.subject, q.difficulty, 0.5);
      const qq = q;
      void play(ns, () => D.dir.current?.playerAttack({ subject: qq.subject, major: c.major, dealt: r.dealt, crit: false, dodge: false, onImpact: () => setView(v => ({ ...v, m: ns.monsterHp, c: ns.combo })) }))
        .then(() => { setFb({ ok: true, text: '漏选了，半伤害', dealt: r.dealt, taken: 0 }); setPhase('feedback'); setCanNext(true); });
      return;
    }
    if (ok) {
      if (cfg.battle === 'simple') { act(autoAction(bs), true); return; }
      setActLeft(AUTO_ATTACK_SECONDS); setPhase('action'); return;
    }
    const [ns, r] = resolveWrong(bs, c);
    setCanNext(false);
    void play(ns, () => D.dir.current?.monsterAttack(r.taken, () => setView(v => ({ ...v, p: ns.playerHp, c: ns.combo })))).then(() => {
      setFb({ ok: false, text: val === '' ? '⏰ 超时了' : '答错了', taken: r.taken }); setPhase('feedback');
      setTimeout(() => setCanNext(true), 1200);   // 解析至少停留一会儿
    });   // 解析至少停留一会儿
  }
  function act(a: Action, auto = false) {
    if (!q) return;
    const [ns, r] = resolveCorrect(bs, c, a, q.subject, q.difficulty);
    const crit = a === 'attack' && ns.combo >= 3;   // 3 连击起的攻击算「暴击」演出（数值仍按 battle.ts）
    setCanNext(true);
    void play(ns, () => D.dir.current?.playerAttack({ subject: q.subject, major: c.major, dealt: r.dealt, crit, dodge: a === 'dodge', healed: r.healed, taken: r.taken,
      onImpact: () => setView(v => ({ ...v, m: ns.monsterHp, c: ns.combo })), onCounter: () => setView(v => ({ ...v, p: ns.playerHp, c: ns.combo })) })).then(() => setFb({ ok: true, text: (auto ? '✔ 正确！自动' : '') + (a === 'attack' ? (crit ? '💥 连击暴击！' : '⚔ 攻击！') : '🛡 闪避反击！'), dealt: r.dealt, taken: r.taken })).then(() => setPhase('feedback'));
  }
  function next() {
    const s = bs;
    if (s.over === 'lose') {
      const wrongQs = queue.filter(x => stats.current.wrong.includes(x.key));
      if (cfg.canFail && !s.revived && wrongQs.length >= 2) { setPhase('revive-ask'); return; }
      finish(s); return;
    }
    if (s.over === 'win') { finish(s); return; }
    if (idx + 1 >= queue.length) {
      if (kind !== 'normal' && extraLeft.current.length) { const more = extraLeft.current.splice(0, 3); setQueue(qq => [...qq, ...more]); }
      else { finish(s); return; }
    }
    setIdx(i => i + 1); setPhase('question'); setInput(''); setMulti([]); setPicked(undefined); setFb(undefined);
  }
  const isEn = q.subject === '英语';
  const letters = q.answer.some(a => /[a-z]/i.test(a));
  const tts = ttsText(q);
  const asking = phase === 'question' || phase === 'revive-q';
  const optCls = cfg.band === 'G1' ? 'opts big' : 'opts';
  return (
    <div className={`battle ${cfg.theme} ${mode}`}>
      <div className="hud">
        <Bar label="❤" v={view.p} max={bs.playerMax} cls="hp" />
        {limit ? <span className={`timer ${asking && timeLeft <= 5 ? 'low' : ''}`} data-testid="timer">⏱ {asking ? timeLeft : '—'}s</span> : <span>⏱ 不限时</span>}
        <span data-testid="combo">连击 x{view.c}</span>
        {cfg.battle === 'full' && <span>专注 {'◆'.repeat(bs.focus)}{'◇'.repeat(2 - bs.focus)}</span>}
        <span className="grow" />
        <span className="lvl-title">{title}</span>
        <span>{Math.min(idx + 1, queue.length)}/{queue.length}</span>
        <button className="pause-btn" aria-label="暂停" data-testid="pause" onClick={() => setPaused(true)}>⏸</button>
      </div>
      <div className="arena">
        <div className="mon-info">
          <b>{kind === 'boss' ? '👑 ' : kind === 'elite' ? '⚡ ' : ''}{mon.name}</b>
          <Bar label="" v={view.m} max={bs.monsterMax} cls="mhp" />
          <span className="intent">{intent === 'attack' ? `⚔ 意图：攻击 ${bs.monsterAtk}` : `🛡 意图：护盾 ${bs.shieldAmt}`}{bs.monsterShield > 0 && ` · 护盾 ${bs.monsterShield}`}</span>
        </div>
        <div className="stage" ref={D.stage}>
          <div className="fx-shake" ref={D.shake}>
            <div className="unit-wrap hero-wrap" ref={D.hero}><div className="breathe"><Sprite className="unit hero" c={c} /></div></div>
            <div className={`unit-wrap mon-wrap ${kind}`} ref={D.monster}><div className="breathe slow">
              <img className={`unit monster ${kind}`} src={MONSTER_IMG[mon.img]} alt={mon.name} draggable={false} />
              <img className={`unit monster ${kind} white-flash`} ref={D.flash} src={MONSTER_IMG[mon.img]} alt="" aria-hidden draggable={false} /></div></div>
          </div>
          <canvas className="fx-canvas" ref={D.canvas} />
        </div>
        <div className="hero-name">{c.name}{cfg.battle === 'simple' && ' · 简易模式'}{!cfg.canFail && ' · 不会失败'}</div>
      </div>
      <div className="quiz">
        {phase === 'revive-q' && <div className="revive-banner">复活挑战：答对 2 题（已对 {rv?.right ?? 0}）</div>}
        <div className="qmeta">{q.subject} · {q.type} · 难度{q.difficulty}
          {q.status !== '已通过' && q.status !== 'AI初审通过' && <span className="pending">{q.status}</span>}
          {tts && (cfg.manualTTS || isEn) && <button className="mini" aria-label="朗读" data-testid="tts" onClick={() => speak(tts, isEn ? 'en' : 'zh-CN')}>🔊</button>}</div>
        <div className="qtext" data-ans={import.meta.env.DEV || (window as unknown as { __zyTest?: boolean }).__zyTest ? q.answer[0] : undefined}><Tex text={q.question} /></div>
        {asking && q.type === '多选' && (
          <div className="opts">
            {q.options.map(ch => <button key={ch.key} className={`opt ${multi.includes(ch.key) ? 'sel' : ''}`} data-testid={'opt-' + ch.key}
              onClick={() => setMulti(m => m.includes(ch.key) ? m.filter(x => x !== ch.key) : [...m, ch.key].sort())}><i>{multi.includes(ch.key) ? '✔' : ch.key}</i><Tex text={ch.text} /></button>)}
            <button className="next multi-ok" disabled={!multi.length} data-testid="ok" onClick={() => submit(multi.join(''))}>确定（多选）</button>
          </div>
        )}
        {asking && (q.type === '选择' || q.type === '判断') && (
          <div className={`${optCls} ${q.type === '判断' ? 'tf' : ''}`}>
            {choicesOf(q).map(ch => (
              <div key={ch.key} className="opt-wrap">
                <button className="opt" data-testid={'opt-' + ch.key} data-correct={q.answer.includes(ch.key) ? '1' : '0'} onClick={() => submit(ch.key)}>
                  {q.type === '选择' && <i>{ch.key}</i>}{ch.image ? <img src={ch.image} alt="" className="opt-img" /> : <Tex text={ch.text} />}</button>
                {cfg.optionSpeaker && q.type === '选择' && !ch.text.includes('$') && <button className="opt-spk" aria-label="读选项" onClick={() => speak(ch.text)}>🔈</button>}
              </div>))}
          </div>
        )}
        {asking && q.type === '填空' && <Keypad key={q.key} letters={letters} sci={cfg.band === 'H'} value={input} onChange={setInput} onOk={() => submit(input)} />}
        {phase === 'action' && (
          <div className="actions">
            <div className="countbar" key={idx}><div style={{ animationDuration: AUTO_ATTACK_SECONDS + 's', animationPlayState: paused ? 'paused' : 'running' }} /></div>
            <p className="good">✔ 正确！选择行动（{actLeft}s 后自动攻击）</p>
            <div className="row gap16 grow">
              <button className="act atk" data-testid="act-attack" onClick={() => act('attack')}>⚔<br />攻击</button>
              <button className="act dodge" data-testid="act-dodge" onClick={() => act('dodge')}>🛡<br />闪避</button>
            </div>
          </div>
        )}
        {phase === 'anim' && <div className="anim-wait" data-testid="anim">⚔ 战斗中…</div>}
        {phase === 'feedback' && fb && (
          <div className={`feedback ${fb.ok ? 'ok' : 'bad'}`}>
            <h3>{fb.text}{fb.taken ? ` 受到 ${fb.taken} 伤害` : ''}{fb.dealt ? ` 造成 ${fb.dealt} 伤害` : ''}</h3>
            {!fb.ok && <>
              {picked && <p>你的答案：{q.type === '选择' || q.type === '多选' ? picked.split('').map(k => <span key={k}>{k}. <Tex text={q.options.find(o => o.key === k)?.text ?? ''} />　</span>) : picked}</p>}
              <p>正确答案：<b><Tex text={correctText(q)} /></b></p>
              {q.explanation && <p className="expl">💡 <Tex text={q.explanation} /></p>}
              {q.textbook_note && <p className="tbnote">📘 {q.textbook}：{q.textbook_note}</p>}
            </>}
            <div className="row gap16 fb-btns">
              {!fb.ok && onFlag && <button className="flag" disabled={flagged} onClick={() => { onFlag(q); setFlagged(true); }}>{flagged ? '已告诉家长' : '⚠ 我觉得这题有错'}</button>}
              <button className="next" data-testid="next" disabled={!canNext} onClick={next}>{bs.over ? '查看结果 ▶' : '继续 ▶'}</button>
            </div>
          </div>
        )}
        {phase === 'revive-ask' && (
          <div className="feedback bad">
            <h3>💫 血量归零</h3>
            <p>复活挑战：答对 2 道本关错题，回到 50% 血量（每关 1 次）。</p>
            <div className="row gap16 fb-btns">
              <button className="btn ghost" data-testid="revive-no" onClick={() => finish(bs)}>放弃</button>
              <button className="btn" data-testid="revive-yes" onClick={() => {
                const list = queue.filter(x => stats.current.wrong.includes(x.key));
                setRv({ list, i: 0, right: 0 }); setPhase('revive-q'); setInput(''); setMulti([]);
              }}>挑战复活</button>
            </div>
          </div>
        )}
      </div>
      {paused && <PauseOverlay onResume={() => setPaused(false)} onQuit={onQuit} />}
    </div>
  );
}
export { MONSTER };
