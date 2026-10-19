/* 新手引导（策划确认单 D5）。每个档案第一次进战斗时触发；家长页可重新播放 */
import { useEffect, useRef, useState } from 'react';
import type { BandConfig } from '../game/grades';
import type { Character } from '../game/characters';
import { MONSTER_IMG } from '../game/characters';
import { speak, afterVoiceThen } from '../tts';
import { Sprite, useKFit } from './Battle';

export function KinderTutorial({ c, onDone }: { c: Character; onDone: () => void }) {
  // r10：3 道不同的练习题（①点对的卡片 ②爱心 = 开心值 ③小喇叭再听一遍），练习不算星星；练完有「练习完成，开始闯关啦！」过渡
  const QS = [
    { q: '哪个是苹果？', ok: ['🍎', '苹果'], no: ['🚗', '汽车'], say: `我是${c.name}！哪个是苹果？点一点苹果` },
    { q: '哪个是小狗？', ok: ['🐶', '小狗'], no: ['🐱', '小猫'], say: '答对了，爱心亮起来啦！再来：哪个是小狗？' },
    { q: '哪个是红色的？', ok: ['🔴', '红色'], no: ['🔵', '蓝色'], say: '听不清就点小喇叭再听一遍。哪个是红色的？' },
  ];
  const [step, setStep] = useState(1);
  const [lit, setLit] = useState(0);
  const [wig, setWig] = useState(false);
  const [done, setDone] = useState(false);
  const timers = useRef<number[]>([]);
  const kst = useRef<HTMLDivElement>(null); useKFit(kst);
  const later = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)); };
  const offs = useRef<(() => void)[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); offs.current.forEach(f => f()); }, []);
  const cur = QS[step - 1];
  useEffect(() => { if (done) return; timers.current.forEach(clearTimeout); timers.current = []; speak(cur.say); later(7000, () => speak(cur.q)); }, [step, done]);
  const right = () => {
    if (done) return; setLit(l => l + 1);
    if (step < 3) { setStep(step + 1); return; }
    setDone(true); timers.current.forEach(clearTimeout); speak('练习完成，开始闯关啦！'); later(0, () => { offs.current.push(afterVoiceThen(2000, 6000, onDone)); });   // r15.4.4：读完再进关（至少 2 s，最多 6 s）
  };
  const okFirst = step !== 2;   // 正确项位置轮换，不是每次都在左边
  const btnOk = <button key="ok" className="kopt" style={{ background: '#d5f0c4' }} data-testid="tut-apple" onClick={right}>
    <span className="kface"><span className="kface-emo">{cur.ok[0]}</span><span className="kface-txt">{cur.ok[1]}</span></span>{step === 1 && <span className="finger" aria-hidden>👆</span>}</button>;
  const btnNo = <button key="no" className={`kopt ${wig ? 'kwiggle' : ''}`} style={{ background: '#cfe3ff' }} data-testid="tut-car" onClick={() => { if (done) return; setWig(true); speak('嗯～再想想'); later(1000, () => setWig(false)); }}>
    <span className="kface"><span className="kface-emo">{cur.no[0]}</span><span className="kface-txt">{cur.no[1]}</span></span></button>;
  return (
    <div className="kbattle tutorial" data-testid="tutorial-kinder">
      <div className="ktop">
        <span className="tut-steps" data-testid="tut-steps">练习 {step}/3</span>
        <div className="kbubble">
          <button className={`kspeaker ${step === 3 ? 'pointed' : ''}`} aria-label="再听一遍" onClick={() => speak(cur.q)}>🔊</button>
          {step === 3 && <span className="finger at-speaker" aria-hidden>👆</span>}
          <div className="kq" data-testid="tut-q">{cur.q}</div>
        </div>
        <div className="hearts"><span className="hearts-label">开心值</span>{[0, 1, 2].map(i => <span key={i} className={`kheart ${i < lit ? 'on' : 'off'} ${i === lit - 1 ? 'pop' : ''}`}>{i < lit ? '💖' : '♥'}</span>)}<b className="hearts-num">{lit}/3</b></div>
      </div>
      <div className="kstage" ref={kst}>
        <div className={`unit-wrap kpup-wrap ${wig ? 'headshake' : ''}`}><div className="breathe"><Sprite className="kpup" c={c} /></div></div>
        <div className="unit-wrap kmon-wrap"><div className="breathe slow"><img className={`kmon ${lit ? 'smile' : ''}`} src={MONSTER_IMG.kinder} alt="小乌云" /></div></div>
      </div>
      <div className="kopts">{okFirst ? [btnOk, btnNo] : [btnNo, btnOk]}</div>
      {done && <div className="tut-done" data-testid="tut-done">🎉 练习完成，开始闯关啦！</div>}
      <button className="chip skip skip-corner" data-testid="tutorial-skip" onClick={onDone}>跳过练习 ⏭</button>
    </div>
  );
}

/** D5 / D6 规格 §10：轮流回合版引导；onlyCard3 = 老档案补弹第 3 张 */
export function StdTutorial({ cfg, onDone, onlyCard3 }: { cfg: BandConfig; onDone: () => void; onlyCard3?: boolean }) {
  const rounds = cfg.battle === 'full';
  const card3 = !rounds ? '答对后会自动帮你出招'
    : cfg.band === 'G2' || cfg.band === 'G3' ? '⚔ 我方回合答对就攻击，答错会被反击（有机会闪开）；🛡 对方回合答对就能闪避！'
    : '⚔ 我方回合答对就攻击，答错会被反击（有机会闪开）；🛡 对方回合答对就能闪避，答得快还能攒专注！';
  const all = [
    { t: '答对题目就能出手攻击怪物', at: 'q' },
    { t: rounds ? '怪物头上的图标是它下一步要做什么：⚔ 攻击 / ⚡ 蓄力 / 🛡 护盾，点一下能看说明' : '怪物头上的图标是它下一步要做什么：⚔ 攻击 / ⚡ 蓄力 / 🛡 护盾', at: 'm' },
    { t: card3, at: 'a' },
    { t: '血条空了也别怕，答对 2 道错题就能复活', at: 'h' },
    ...(cfg.band === 'H' ? [{ t: '我方回合挑一张题卡，重击伤害高但答错挨打也多；有把握可以打开「押注」，押了答错就闪不开哦', at: 'q' }] : []),
  ];
  const cards = onlyCard3 ? [all[2]] : all;
  const [i, setI] = useState(0);
  useEffect(() => { if (cfg.autoTTS) speak(cards[i].t); }, [i]);
  return (
    <div className="tut-overlay" data-testid="tutorial-std">
      <div className={`tut-hi at-${cards[i].at}`} aria-hidden />
      <div className={`tut-card at-${cards[i].at}`}>
        <button className="chip skip" data-testid="tutorial-skip" onClick={onDone}>跳过</button>
        <small>{i + 1} / {cards.length}</small>
        <p>{cards[i].t}</p>
        <button className="btn" data-testid="tutorial-next" onClick={() => i + 1 < cards.length ? setI(i + 1) : onDone()}>{i + 1 < cards.length ? '下一步' : '开始！'}</button>
      </div>
    </div>
  );
}
