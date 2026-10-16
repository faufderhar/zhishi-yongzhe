/* D6 轮流回合战斗界面（实现规格 v0.3.6）：我方回合 / 对方回合交替，每回合 1 题；小学 3–6、初一、高一 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Tex } from '../Tex';
import { Bar, Keypad, Modal } from './common';
import { choicesOf, correctText, judge, ttsText, type Question } from '../game/questions';
import { newRound, resolveRound, reviveRound, intentLabel, nextIntent, roundModeOf, roundsLeft, weakOf, phaseOf, type RState, type CardKind, type Wager, type ROut } from '../game/rounds';
import { skillsFor, skillById } from '../game/skills';
import { preloadSkillArt, skillIconUrl } from '../fx/skillFx';
import { MONSTERS, CARDS, PERFECT_FRACTION, PERFECT_NOLIMIT_SEC, REVIVE, ENERGY_CAP, FOCUS_MAX } from '../game/balance';
import { timeLimitFor } from '../game/grades';
import { MONSTER_IMG } from '../game/characters';
import { speak } from '../tts';
import { answerFeedback } from '../feedback';
import { sleep } from '../fx/motion';
import { useDirector, PauseOverlay, Sprite, usePauseOnHide, useWakeLock, usePauseTimeout, useForceEnd, type BattleProps } from './Battle';

type Phase = 'pre' | 'cards' | 'wager' | 'question' | 'anim' | 'feedback' | 'revive-ask' | 'revive-q' | 'retreat';
const isMulti = (q: Question) => (q as Question & { steps?: unknown[] }).steps?.length;   // 多步题（题库字段 steps；当前题库没有）

export function RoundBattle({ cfg, c, kind, title, questions, extra, onAnswer, onEnd, onQuit, onFlag, wagerOn = true, lowGrade = false }: BattleProps & { wagerOn?: boolean; lowGrade?: boolean }) {
  const mode = roundModeOf(cfg.band)!; const hs = mode === 'h';
  const mon = MONSTERS[cfg.stats][kind];
  const pool = useRef<Question[]>([...questions, ...extra.filter(q => !questions.some(x => x.key === q.key))]);
  const [bs, setBs] = useState<RState>(() => {
    const s0 = newRound(mode, kind, { lowGrade, noDeath: !cfg.canFail });
    const th = (window as unknown as { __zyTest?: boolean; __zyTestHp?: number }).__zyTest ? (window as unknown as { __zyTestHp?: number }).__zyTestHp : undefined;   // 仅自动化测试
    const tm = (window as unknown as { __zyTest?: boolean; __zyTestMonHp?: number }).__zyTest ? (window as unknown as { __zyTestMonHp?: number }).__zyTestMonHp : undefined;   // 仅自动化测试：怪物血量
    const s1 = tm ? { ...s0, monsterHp: tm, monsterMax: tm } : s0;
    return th ? { ...s1, playerHp: th } : s1;
  });
  const bsRef = useRef(bs); bsRef.current = bs;
  const used = useRef<Question[]>([]);
  const [phase, setPhase] = useState<Phase>('pre');
  const [ringPop, setRingPop] = useState(false);
  const [card, setCard] = useState<CardKind>('std');
  const [wager, setWager] = useState<Wager>(null);
  const [q, setQ] = useState<Question | undefined>();
  const [fb, setFb] = useState<{ ok: boolean; o?: ROut; text: string; partial?: boolean }>();
  const [canNext, setCanNext] = useState(true);
  const [paused, setPaused] = useState(false);
  const [intentPop, setIntentPop] = useState(false);
  usePauseOnHide(setPaused);
  const [input, setInput] = useState(''); const [multi, setMulti] = useState<string[]>([]); const [picked, setPicked] = useState<string>();
  const [flagged, setFlagged] = useState(false);
  const stats = useRef({ correct: 0, total: 0, wrong: [] as string[], wrongQs: [] as Question[] });
  const [rv, setRv] = useState<{ list: Question[]; i: number; right: number; tries: number } | null>(null);
  const D = useDirector(false, c, 0.75, hs);
  const [view, setView] = useState({ p: bs.playerHp, m: bs.monsterHp });
  const [ending, setEnding] = useState(false);
  useWakeLock(); usePauseTimeout(paused, onQuit);
  const result = (s: RState) => ({ win: s.over !== 'lose' || !cfg.canFail, retreat: s.over === 'retreat', turns: s.turn, correct: stats.current.correct, total: stats.current.total, revived: s.revived, wrongKeys: stats.current.wrong });
  useForceEnd(() => { const s = bsRef.current; onEnd({ ...result(s), win: s.monsterHp < s.monsterMax / 2, retreat: true }); });
  const mySkills = useMemo(() => skillsFor(bs.seg, c.major), [bs.seg, c.major]);
  useEffect(() => { preloadSkillArt(mySkills); }, [mySkills]);
  useEffect(() => {   // 仅自动化测试：直接播放任意技能特效（图集 / 护眼逐个检查）
    const w = window as unknown as { __zyTest?: boolean; __zyPlaySkill?: (id: string) => Promise<void> | undefined };
    if (w.__zyTest) w.__zyPlaySkill = id => { const k = skillById(id); return k ? D.dir.current?.playSkill(k, { kinder: k.seg === 'K' }) : undefined; };
  }, []);   // 只懒加载本角色本学段的技能素材
  const P = bs.side === 'P';
  const il = intentLabel(bs);

  /** 取下一题：对方回合排除多步题；高一对方回合出标准难度（不选卡） */
  const take = (pred: (x: Question) => boolean = () => true) => pool.current.find(x => pred(x)) ?? pool.current[0];
  const cards = useMemo(() => {
    if (!hs || phase !== 'cards') return null;
    const rest = pool.current; const base = rest.find(x => !isMulti(x)) ?? rest[0]; if (!base) return null;
    const near = (d: number, used: string[]) => rest.filter(x => !used.includes(x.key) && !isMulti(x)).sort((a, b) => Math.abs(a.difficulty - d) - Math.abs(b.difficulty - d))[0];
    const light = near(base.difficulty - 1, [base.key]) ?? base;
    const heavy = rest.find(x => isMulti(x) && x.key !== base.key) ?? near(base.difficulty + 1, [base.key, light.key]) ?? base;
    return { light, std: base, heavy } as Record<CardKind, Question>;
  }, [phase, hs]);
  // 进入每个回合：高一我方先选卡；押注；其他直接出题
  useEffect(() => {
    if (phase !== 'pre' || bs.over) return;
    setCard('std'); setWager(null); setInput(''); setMulti([]); setPicked(undefined); setFb(undefined);
    if (!pool.current.length) {   // 本关题不够撑满回合上限：重复使用已答过的题（错题优先）
      const wk = new Set(stats.current.wrong); pool.current = [...used.current].sort((a, b) => +wk.has(b.key) - +wk.has(a.key)); used.current = [];
      if (!pool.current.length) { void retreat(bs); return; }
    }
    if (hs && P) { setPhase('cards'); return; }
    setQ(take(x => P || !isMulti(x)));
    setPhase(hs && wagerOn ? 'wager' : 'question');
  }, [phase, bs.turn]);

  const cq = phase === 'revive-q' && rv ? rv.list[rv.i] : q;
  const limit = cq ? timeLimitFor(cq, cfg.band, {}) : 0;
  const [timeLeft, setTimeLeft] = useState(limit);
  const [elapsed, setElapsed] = useState(0);
  const asking = phase === 'question' || phase === 'revive-q';
  useEffect(() => { if (asking) { setTimeLeft(limit); setElapsed(0); } }, [cq?.key, asking, rv?.i]);
  useEffect(() => { if (cq && cfg.autoTTS && asking) { const t = ttsText(cq); if (t) speak(t, cq.subject === '英语' ? 'en' : 'zh-CN'); } }, [cq?.key, asking]);
  useEffect(() => {
    if (!asking || paused) return;
    const t = setTimeout(() => { if (limit && timeLeft <= 1) { setTimeLeft(0); submit(''); return; } setElapsed(e => e + 1); if (limit) setTimeLeft(x => x - 1); }, 1000); return () => clearTimeout(t);
  }, [asking, timeLeft, elapsed, paused, limit]);

  const finish = async (s: RState) => {
    if (ending) return; setEnding(true);
    const r = result(s); setPhase('anim');
    if (s.over !== 'retreat') await Promise.race([r.win ? D.dir.current?.victory() : D.dir.current?.defeat(), sleep(1200)]);
    if (!D.alive.current) return;
    onEnd(r);
  };
  async function retreat(s: RState) { setBs({ ...s, over: 'retreat' }); setPhase('retreat'); await sleep(1200); if (D.alive.current) void finish({ ...s, over: 'retreat' }); }
  async function play(show: () => Promise<unknown> | undefined) {
    setPhase('anim');
    try { await Promise.race([show(), sleep(1500)]); } catch { /* 动画失败不影响流程 */ }
  }
  const pickCard = (k: CardKind) => { if (!cards) return; setCard(k); setQ(cards[k]); setPhase(wagerOn ? 'wager' : 'question'); };

  function submit(val: string) {
    const qq = cq!;
    if (phase === 'revive-q' && rv) {
      const ok = val !== '' && judge(qq, qq.type === '多选' ? val.split('') : val) === 'full';
      answerFeedback(ok); const right = rv.right + (ok ? 1 : 0), tries = rv.tries + 1; setPicked(val);
      if (right >= REVIVE.need) { const ns = reviveRound(bs); setBs(ns); setView({ p: ns.playerHp, m: ns.monsterHp }); setRv(null); setFb({ ok: true, text: '复活成功！回到 50% 血量' }); setCanNext(true); setPhase('feedback'); return; }
      if (tries >= REVIVE.tries || REVIVE.tries - tries < REVIVE.need - right) { setRv(null); void finish(bs); return; }
      setRv({ list: rv.list, i: (rv.i + 1) % rv.list.length, right, tries }); setInput(''); setMulti([]);
      return;
    }
    if (phase !== 'question') return;
    const g = val === '' ? 'wrong' : judge(qq, qq.type === '多选' ? val.split('') : val);
    const ok = g !== 'wrong';
    setPicked(val); answerFeedback(ok); setFlagged(false);
    stats.current.total++;
    if (g === 'full') stats.current.correct++; else { stats.current.wrong.push(qq.key); stats.current.wrongQs.push(qq); }
    onAnswer(qq, g === 'full', val);
    pool.current = pool.current.filter(x => x.key !== qq.key); used.current.push(qq);
    const fast = elapsed <= (limit ? limit * PERFECT_FRACTION : PERFECT_NOLIMIT_SEC);
    const [ns, o] = resolveRound(bs, c, { correct: ok, partial: g === 'partial', subject: qq.subject, difficulty: qq.difficulty, fast, card: hs && P ? card : 'std', wager: hs ? wager : null });
    const k = o.skill;
    const d = D.dir.current;
    const show = k && d && o.side === 'P'   // 攻击技能：横幅 + 技能特效替代普攻演出，命中帧结算数字（≤1.5 s）
      ? async () => { await d.playSkill(k, { maxMs: 1450, onImpact: () => { setView(v => ({ ...v, m: ns.monsterHp })); d.float(d.r.monster, o.hits.length > 1 ? o.hits.map(x => '-' + x).join(' ') : '-' + o.dealt, 'crit'); } }); }
      : k && d ? async () => { await sleep(250); await d.playSkill(k, { maxMs: 1000, onImpact: () => { setView(v => ({ ...v, p: ns.playerHp })); if (o.healed) d.float(d.r.hero, '+' + o.healed, 'heal'); } }); }   // 守护技能：闪避后 ≤1.0 s
      : o.side === 'P'
      ? ok ? () => D.dir.current?.playerAttack({ subject: qq.subject, major: c.major, dealt: o.dealt, crit: ns.combo >= 3, dodge: false, healed: o.healed, onImpact: () => setView(v => ({ ...v, m: ns.monsterHp })) })
        : o.taken ? () => D.dir.current?.monsterAttack(o.taken, () => setView(v => ({ ...v, p: ns.playerHp }))) : () => sleep(500)
      : o.taken ? () => D.dir.current?.monsterAttack(o.taken, () => setView(v => ({ ...v, p: ns.playerHp }))) : () => sleep(500);
    void play(show).then(() => {
      if (!D.alive.current) return;
      setView({ p: ns.playerHp, m: ns.monsterHp }); setBs(ns);
      setFb({ ok, o, partial: g === 'partial', text: (ok ? '✔ 正确！' : val === '' ? '⏰ 超时了！' : '✘ 答错了！') + (g === 'partial' ? '（漏选，半伤害）' : '') + o.text + (k ? ` ✨${k.name}：${k.effectText}` : '') + (o.guardUsed ? '（护体抵挡 30%）' : '') });
      if (ns.over === 'win') { void finish(ns); return; }
      setCanNext(ok); setPhase('feedback');
      if (!ok) setTimeout(() => setCanNext(true), 2000);   // 解析至少停 2 秒（规格 §1）
    });
  }
  function next() {
    const s = bs;
    if (s.over === 'lose') {
      const list = stats.current.wrongQs;
      if (cfg.canFail && !s.revived && list.length >= 1) { setPhase('revive-ask'); return; }
      void finish(s); return;
    }
    if (s.over === 'retreat') { void retreat(s); return; }
    if (s.over) { void finish(s); return; }
    setPhase('pre');
  }
  const isEn = cq?.subject === '英语';
  const letters = !!cq?.answer.some(a => /[a-z]/i.test(a));
  const tts = cq ? ttsText(cq) : '';
  const showQ = cq && (asking || phase === 'feedback' || phase === 'anim');
  const left = roundsLeft(bs);
  const curTurn = Math.min(bs.turn + (phase === 'feedback' || bs.over ? 0 : 1), bs.cap);
  return (
    <div className={`battle ${cfg.theme} ${cfg.stats} rounds side-${bs.side}`}>
      <div className="hud">
        <Bar label="❤" v={view.p} max={bs.playerMax} cls="hp" />
        {asking && (limit ? <span className={`timer ${timeLeft <= 5 ? 'low' : ''}`} data-testid="timer">⏱ {timeLeft}s</span> : <span>⏱ 不限时</span>)}
        <span data-testid="combo">连击 x{bs.combo}</span>
        {bs.perfectOn && <span data-testid="focus">专注 {'◆'.repeat(bs.focus)}{'◇'.repeat(FOCUS_MAX - bs.focus)}</span>}
        <button className="energy-ring" data-testid="energy" aria-label={`能量 ${bs.energy}/${ENERGY_CAP}，点开看技能说明`} onClick={() => setRingPop(true)}>
          <svg viewBox="0 0 40 40" aria-hidden>{Array.from({ length: ENERGY_CAP }, (_, i) => { const a0 = (i / ENERGY_CAP) * 2 * Math.PI - Math.PI / 2 + 0.08, a1 = ((i + 1) / ENERGY_CAP) * 2 * Math.PI - Math.PI / 2 - 0.08;
            return <path key={i} d={`M ${20 + 16 * Math.cos(a0)} ${20 + 16 * Math.sin(a0)} A 16 16 0 0 1 ${20 + 16 * Math.cos(a1)} ${20 + 16 * Math.sin(a1)}`} fill="none" strokeWidth="5" strokeLinecap="round" stroke={i < bs.energy ? '#ffd54a' : 'rgba(255,255,255,.25)'} />; })}
            <text x="20" y="25" textAnchor="middle" fontSize="13" fill="#fff">⚡</text></svg>{bs.energy}/{ENERGY_CAP}</button>
        <span className="grow" />
        <span data-testid="turn" className={`turn-no ${left <= 2 ? 'warn' : ''}`}>第 {curTurn} 回合 / {bs.cap}</span>
        <span className="grow" />
        <span className="lvl-title">{title}</span>
        <button className="pause-btn" aria-label="暂停" data-testid="pause" onClick={() => setPaused(true)}>⏸</button>
      </div>
      {!bs.over && phase !== 'revive-ask' && phase !== 'revive-q' && <div key={bs.turn} className={`side-banner ${P ? 'p' : 'm'}`} data-testid="banner">{P ? '⚔ 我方回合：答对就攻击！' : '🛡 对方回合：答对就闪避！'}</div>}
      <div className="arena">
        <div className="mon-info">
          <b>{kind === 'boss' ? '👑 ' : kind === 'elite' ? '⚡ ' : ''}{mon.name}{bs.def.phases && ` · 第 ${phaseOf(bs) + 1} 阶段（弱点 ${weakOf(bs)}）`}</b>
          <Bar label="" v={view.m} max={bs.monsterMax} cls="mhp" />
          <button className={`intent intent-${nextIntent(bs)} ${il.grey ? 'grey' : ''} ${!P && asking ? 'now' : ''}`} data-testid="intent" data-intent={nextIntent(bs)} onClick={() => setIntentPop(true)} aria-label={'怪物意图：' + il.long}>
            {il.short} ⓘ{bs.shield > 0 && <span data-testid="mshield"> · 护盾 {bs.shield}</span>}</button>
          {!P && asking && <div className="intent-now" data-testid="intent-now">{il.long}</div>}
        </div>
        <div className="stage" ref={D.stage}>
          <div className="fx-shake" ref={D.shake}>
            {bs.guard && <div className="guard-badge" data-testid="guard" title="护体：下一次受伤 ×0.7">🛡️</div>}
            <div className={`unit-wrap hero-wrap ${fb?.o?.dodged || fb?.o?.perfect ? 'sidestep' : ''}`} ref={D.hero}><div className="breathe"><Sprite className="unit hero" c={c} /></div></div>
            <div className={`unit-wrap mon-wrap ${kind} ${phase === 'retreat' ? 'retreating' : ''}`} ref={D.monster}><div className="breathe slow">
              <img className={`unit monster ${kind}`} src={MONSTER_IMG[mon.img]} alt={mon.name} draggable={false} />
              <img className={`unit monster ${kind} white-flash`} ref={D.flash} src={MONSTER_IMG[mon.img]} alt="" aria-hidden draggable={false} /></div></div>
          </div>
          {fb?.o?.perfect && phase === 'feedback' && <div className="perfect-pop" data-testid="perfect">完美闪避！</div>}
          <canvas className="fx-canvas" ref={D.canvas} />
        </div>
        <div className="hero-name">{c.name}</div>
      </div>
      <div className="quiz">
        {phase === 'cards' && cards && (
          <div className="cards" data-testid="cards"><p>选一张题卡</p><div className="row gap16">
            {(['light', 'std', 'heavy'] as CardKind[]).map(k => <button key={k} className={`qcard ${k}`} data-testid={'card-' + k} onClick={() => pickCard(k)}>
              <b>{CARDS[k].label}</b><span>{cards[k].subject} · 难度 {cards[k].difficulty}{isMulti(cards[k]) ? ' · 多步题' : ''}</span>
              <small>伤害 ×{CARDS[k].out} · 答错反击 ×{CARDS[k].ctr}</small></button>)}
          </div></div>
        )}
        {phase === 'wager' && (
          <div className="cards" data-testid="wager"><p>看题前押注：有把握吗？</p><div className="row gap16">
            <button className="qcard" data-testid="wager-sure" onClick={() => { setWager('sure'); setPhase('question'); }}><b>确定</b>
              <small>{P ? '答对伤害 ×1.2；答错反击 ×1.3 且不能闪避' : '答对必定完美闪避；答错受击 ×1.3'}</small></button>
            <button className="qcard" data-testid="wager-unsure" onClick={() => { setWager('unsure'); setPhase('question'); }}><b>不太确定</b>
              <small>{P ? '答错反击 ×0.5，标记重点复习' : '答错照常受击，标记重点复习'}</small></button>
          </div></div>
        )}
        {showQ && <>
          {phase === 'revive-q' && <div className="revive-banner">复活挑战：答对 2 题（已对 {rv?.right ?? 0}，剩 {REVIVE.tries - (rv?.tries ?? 0)} 次机会）</div>}
          <div className="qmeta">{phase !== 'revive-q' && (P ? '⚔ 攻击题' : '🛡 闪避题')} · {cq.subject} · {cq.type} · 难度{cq.difficulty}{hs && P && phase !== 'revive-q' ? ` · ${CARDS[card].label}` : ''}{wager ? ` · 押${wager === 'sure' ? '确定' : '不太确定'}` : ''}
            {cq.status !== '已通过' && cq.status !== 'AI初审通过' && <span className="pending">{cq.status}</span>}
            {tts && (cfg.manualTTS || isEn) && <button className="mini" aria-label="朗读" data-testid="tts" onClick={() => speak(tts, isEn ? 'en' : 'zh-CN')}>🔊</button>}</div>
          <div className="qtext" data-ans={import.meta.env.DEV || (window as unknown as { __zyTest?: boolean }).__zyTest ? cq.answer[0] : undefined}><Tex text={cq.question} /></div>
        </>}
        {asking && cq && cq.type === '多选' && (
          <div className="opts">
            {cq.options.map(ch => <button key={ch.key} className={`opt ${multi.includes(ch.key) ? 'sel' : ''}`} aria-pressed={multi.includes(ch.key)} data-testid={'opt-' + ch.key} data-correct={cq.answer.includes(ch.key) ? '1' : '0'}
              onClick={() => setMulti(m => m.includes(ch.key) ? m.filter(x => x !== ch.key) : [...m, ch.key].sort())}><i>{multi.includes(ch.key) ? '✔' : ch.key}</i><Tex text={ch.text} /></button>)}
            <button className="next multi-ok" disabled={!multi.length} data-testid="ok" onClick={() => submit(multi.join(''))}>确定（多选）</button>
          </div>
        )}
        {asking && cq && (cq.type === '选择' || cq.type === '判断') && (
          <div className={`opts ${cq.type === '判断' ? 'tf' : ''}`}>
            {choicesOf(cq).map(ch => <div key={ch.key} className="opt-wrap">
              <button className="opt" data-testid={'opt-' + ch.key} data-correct={cq.answer.includes(ch.key) ? '1' : '0'} onClick={() => submit(ch.key)}>
                {cq.type === '选择' && <i>{ch.key}</i>}{ch.image ? <img src={ch.image} alt="" className="opt-img" /> : <Tex text={ch.text} />}</button></div>)}
          </div>
        )}
        {asking && cq && cq.type === '填空' && <Keypad key={cq.key} letters={letters} sci={hs} value={input} onChange={setInput} onOk={() => submit(input)} />}
        {phase === 'anim' && <div className="anim-wait" data-testid="anim">结算中…</div>}
        {phase === 'retreat' && <div className="feedback ok" data-testid="retreating"><h3>回合用完，怪物撤退了！</h3></div>}
        {phase === 'feedback' && fb && cq && (
          <div className={`feedback ${fb.ok ? 'ok' : 'bad'}`} data-testid="feedback">
            <h3>{fb.text}{fb.o?.dealt ? ` 造成 ${fb.o.hits.length > 1 ? fb.o.hits.join('+') : fb.o.dealt}` : ''}{fb.o?.taken ? ` · 受到 ${fb.o.taken}` : ''}{fb.o?.healed ? ` · 回复 ${fb.o.healed}` : ''}{fb.o?.energyGain ? ` · 能量 +${fb.o.energyGain}` : ''}</h3>
            {!fb.ok && <>
              {picked && <p>你的答案：{cq.type === '选择' || cq.type === '多选' ? picked.split('').map(k => <span key={k}>{k}. <Tex text={cq.options.find(o => o.key === k)?.text ?? ''} />　</span>) : picked}</p>}
              <p>正确答案：<b><Tex text={correctText(cq)} /></b></p>
              {cq.explanation && <p className="expl">💡 <Tex text={cq.explanation} /></p>}
              {fb.o?.review && <p className="hint">已标记「重点复习」</p>}
            </>}
            <div className="row gap16 fb-btns">
              {!fb.ok && onFlag && <button className="flag" disabled={flagged} onClick={() => { onFlag(cq); setFlagged(true); }}>{flagged ? '已告诉家长' : '⚠ 我觉得这题有错'}</button>}
              <button className="next" data-testid="next" disabled={!canNext} onClick={next}>{bs.over === 'lose' ? '继续 ▶' : bs.over ? '查看结果 ▶' : '继续 ▶'}</button>
            </div>
          </div>
        )}
        {phase === 'revive-ask' && (
          <div className="feedback bad"><h3>💫 血量归零</h3><p>复活挑战：最多 4 次机会答对 2 道本关错题，回到 50% 血量（每关 1 次，不计回合）。</p>
            <div className="row gap16 fb-btns">
              <button className="btn ghost" data-testid="revive-no" onClick={() => void finish(bs)}>放弃</button>
              <button className="btn" data-testid="revive-yes" onClick={() => { setRv({ list: stats.current.wrongQs.slice(), i: 0, right: 0, tries: 0 }); setPhase('revive-q'); setInput(''); setMulti([]); setPicked(undefined); }}>挑战复活</button>
            </div></div>
        )}
      </div>
      {ringPop && <Modal onClose={() => setRingPop(false)}><h2>⚡ 能量与技能</h2>
        <p data-testid="ring-pop">技能会在<b>答对</b>时随机触发：每次答对 20%；能量攒满 5 点必定触发；连续 4 次答对没触发，第 5 次必定触发。触发后能量清零。答错、超时不会触发。</p>
        <p className="hint">我方回合答对 → 攻击技能；对方回合答对 → 防护 / 恢复 / 控制技能{bs.mode === 'h' ? '（高一有冷却）' : ''}</p>
        <ul className="skill-list">{mySkills.map(k => <li key={k.id}><img src={skillIconUrl(k.id)} alt="" width={32} height={32} style={{ verticalAlign: 'middle' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> {k.icon} <b>{k.name}</b>：{k.effectText}{k.cd ? `（冷却 ${k.cd} 回合${bs.sk.cd[k.id] ? `，还剩 ${bs.sk.cd[k.id]}` : ''}）` : ''}</li>)}</ul>
        <button className="btn" data-testid="ring-ok" onClick={() => setRingPop(false)}>知道了</button></Modal>}
      {intentPop && <Modal onClose={() => setIntentPop(false)}><h2>怪物意图</h2><p className="intent-long" data-testid="intent-pop">{il.long}</p>
        <p className="hint">⚔ 攻击 · ⚡ 蓄力（下次重击 ×2）· 💥 重击 · 🛡 护盾</p>
        <button className="btn" data-testid="intent-ok" onClick={() => setIntentPop(false)}>知道了</button></Modal>}
      {paused && <PauseOverlay onResume={() => setPaused(false)} onQuit={onQuit} />}
    </div>
  );
}
