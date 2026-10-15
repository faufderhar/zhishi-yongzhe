/* 新手引导（策划确认单 D5）。每个档案第一次进战斗时触发；家长页可重新播放 */
import { useEffect, useRef, useState } from 'react';
import type { BandConfig } from '../game/grades';
import type { Character } from '../game/characters';
import { MONSTER_IMG } from '../game/characters';
import { speak } from '../tts';
import { Sprite } from './Battle';

export function KinderTutorial({ c, onDone }: { c: Character; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [lit, setLit] = useState(false);
  const timers = useRef<number[]>([]);
  const later = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    if (step === 1) { speak(`我是你的伙伴${c.name}，我们一起帮小怪兽开心起来吧！`); later(4000, () => setStep(2)); }
    if (step === 2) { speak('哪个是苹果？点一点苹果'); later(5000, () => speak('点一点苹果')); }
    if (step === 3) { speak('帮小怪兽答对题目，它就会开心，爱心就亮起来啦！'); later(5000, () => setStep(4)); }
    if (step === 4) { speak('听不清就点小喇叭'); later(3500, onDone); }
  }, [step]);
  return (
    <div className="kbattle tutorial" data-testid="tutorial-kinder">
      <div className="ktop">
        <button className="chip skip" data-testid="tutorial-skip" onClick={onDone}>跳过</button>
        <div className="kbubble">
          <button className={`kspeaker ${step === 4 ? 'pointed' : ''}`} aria-label="再听一遍" onClick={() => speak('哪个是苹果？')}>🔊</button>
          {step === 4 && <span className="finger at-speaker" aria-hidden>👆</span>}
          <div className="kq">{step === 1 ? `我是${c.name}！` : '哪个是苹果？'}</div>
        </div>
        <div className="hearts"><span className="hearts-label">开心值</span><span className={lit ? 'pop' : ''}>{lit ? '💖' : '🤍'}</span></div>
      </div>
      <div className="kstage">
        <div className="unit-wrap kpup-wrap"><div className="breathe"><Sprite className="kpup" c={c} /></div></div>
        <div className="unit-wrap kmon-wrap"><div className="breathe slow"><img className={`kmon ${lit ? 'smile' : ''}`} src={MONSTER_IMG.kinder} alt="小乌云" /></div></div>
      </div>
      {step >= 2 && <div className="kopts">
        <button className="kopt" style={{ background: '#d5f0c4' }} data-testid="tut-apple" onClick={() => { if (step === 2) { setLit(true); setStep(3); } }}>
          <span className="kface"><span className="kface-emo">🍎</span><span className="kface-txt">苹果</span></span>{step === 2 && <span className="finger" aria-hidden>👆</span>}</button>
        <button className="kopt" style={{ background: '#cfe3ff' }} onClick={() => step === 2 && speak('点一点苹果')}>
          <span className="kface"><span className="kface-emo">🚗</span><span className="kface-txt">汽车</span></span></button>
      </div>}
    </div>
  );
}

export function StdTutorial({ cfg, onDone }: { cfg: BandConfig; onDone: () => void }) {
  const cards = [
    { t: '答对题目就能出手攻击怪物', at: 'q' },
    { t: '怪物头上的图标是它下一步要做什么：⚔ 攻击 / ⚡ 蓄力 / 🛡 护盾', at: 'm' },
    { t: cfg.band === 'G1' ? '答对后会自动帮你出招' : '答对后选〔攻击〕或〔闪避〕：怪物要攻击时选闪避更安全', at: 'a' },
    { t: '血条空了也别怕，答对 2 道错题就能复活', at: 'h' },
    ...(cfg.band === 'H' ? [{ t: '每回合挑一张题卡，重击伤害高但答错受伤也多', at: 'q' }] : []),
  ];
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
