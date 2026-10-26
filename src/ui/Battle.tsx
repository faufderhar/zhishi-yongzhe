import { noAdjacent } from '../game/adaptive';
import { fillKind } from '../game/inputKind';
import { TEST_DOM } from './common';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { usePhonePortrait } from './Rotate';
import { DESIGN } from '../game/config';
import { Tex } from '../Tex';
import { QImage, CountVisual } from './QImage';
import { Bar, Keypad, Modal } from './common';
import { skinFor, softFor, kinderMon, dashScale } from '../game/monsterSkin';
import { roll as rollSkill, newRoll, segOf, skillsFor, type SkillRoll } from '../game/skills';
import { preloadSkillArt } from '../fx/skillFx';
import { choicesOf, correctText, isCorrect, judge, kinderChoices, ttsText, type Question, type Option } from '../game/questions';
import { newBattle, resolveCorrect, resolveWrong, intentOf, outOfQuestions, newKinder, kinderAnswer, autoAction, revive, type BattleState, type Action } from '../game/battle';
import { MONSTERS, MONSTER, AUTO_ATTACK_SECONDS, EXTRA_QUESTION_FACTOR } from '../game/balance';
import { timeLimitFor, type BandConfig, type LevelKind } from '../game/grades';
import { MONSTER_IMG, type Character } from '../game/characters';
import { hasQban, qbanUrl, qbanState, QBAN_CLOUD } from '../game/kinderQban';
import { TERM_TEXT, TERM_KEYS, TERM_IMG, TERM_MEDAL_NAME, TERM_MON_NAME, type TermNo } from '../game/kinderTerm';
import { playTermCelebrate } from '../fx/assets';
import { speak, hasVoice, isSpeaking, voiceKey, expectVoiceText, afterVoice, speechMs } from '../tts';
/* r15.4.4：小班自动跳转等这句读完再走（录音 1.2 倍速变长）。上限（毫秒）：结算 / 时间到 5 s，下一题 3.5 s */
/* r15.4.4：语速 1.2 后表扬+技能名+开心值可到 ~6 s（p:praise + p:sk_k_* + p:happy_*）；nextMax 太短会在开心值读到一半就出下一题把它切掉（voice-timeup N(c)(d)） */
/* r16.3 总管方案 A：答对后只读表扬（+ 触发时的技能名），不再每题读「开心值…」；最后一题直接读「小乌云变成你的好朋友啦！」。
   等待上限（从答对时刻起算）：普通题 3.5 s、最后一题 4 s；这句话（按片长 / 系统朗读估计）更长时放宽到「读完 + margin」，技能名不被下一题切掉。
   endMax 只给时间到的强制收尾用（收尾提示 prio 读完再结算）。 */
export const K_WAIT = { endMax: 10000, nextCap: 3500, endCap: 4000, margin: 600 };
/** 答对后等多久（ms，从答对时刻起算）：max(基础上限, 这句话的时长 + margin) */
export const kWaitCap = (base: number, speechMs: number) => Math.max(base, Math.round(speechMs) > 0 ? Math.round(speechMs) + K_WAIT.margin : 0);
import { HOME_LINE } from '../game/voiceLines';
import { answerFeedback, softBump } from '../feedback';
import { Director } from '../fx/director';
import { loadCharAnims, loadMonsterAnims, SheetPlayer, SUBJECT_FX } from '../fx/sheets';
import type { MonSkin } from '../game/monsterSkin';
import { appReduceMotion, setAppReduceMotion, sleep } from '../fx/motion';
import { setBattlePaused } from '../runtimeFlags';

/** r15.4 安卓平板（华为 MatePad 横屏 + 浏览器栏 / 字体放大）：小班题目气泡变高时战斗区被挤矮，
 *  固定高度的伙伴 / 怪物会往上伸进题目气泡。按战斗区实际高度把立绘（静态图或序列帧）等比缩小，底边对齐不动。 */
export function useKFit(stage: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = stage.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const h = el.clientHeight; let need = 0;
      el.querySelectorAll<HTMLElement>('.kpup-wrap > .breathe, .kmon-wrap > .breathe').forEach(b => { need = Math.max(need, b.offsetHeight); });
      const raw = need > 0 ? Math.max(0, h - 4) / need : 1, k = Math.min(1, Math.max(0.3, raw));
      // 太挤（立绘要缩到 60% 以下）：整场改紧凑排版（题目字 / 数数图 / 选项卡小一号），只加不撤，避免来回跳
      const kb = el.closest('.kbattle'); if (raw < 0.6 && kb && !kb.classList.contains('ktight')) { kb.classList.add('ktight'); requestAnimationFrame(fit); }
      el.style.setProperty('--kfit', k.toFixed(3)); el.dataset.kfit = k.toFixed(2);
    };
    const ro = new ResizeObserver(fit); ro.observe(el);
    const watch = () => el.querySelectorAll<HTMLElement>('.kpup-wrap > .breathe, .kmon-wrap > .breathe').forEach(b => ro.observe(b));
    watch(); const mo = new MutationObserver(() => { watch(); fit(); }); mo.observe(el, { childList: true, subtree: true });
    fit(); return () => { ro.disconnect(); mo.disconnect(); };
  }, [stage]);
}

/** 挂载演出导演（Canvas 粒子层 + 各单位节点） */
export function useDirector(gentle: boolean, c: Character, scale: number, hs = false, mon?: { skin: MonSkin | null; soft: boolean }) {
  const stage = useRef<HTMLDivElement>(null), shake = useRef<HTMLDivElement>(null), hero = useRef<HTMLDivElement>(null);
  const monster = useRef<HTMLDivElement>(null), flash = useRef<HTMLImageElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const dir = useRef<Director | null>(null);
  const alive = useRef(true);
  const [monState, setMonState] = useState<'none' | 'loading' | 'ok' | 'fail'>(mon?.skin?.art ? 'loading' : 'none');   // r11：序列帧是否加载成功（幼儿园失败时回退小乌云并改文案）
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
    // 学科怪物序列帧（懒加载；失败保留静态立绘 + 程序动画）
    const art = mon?.skin?.art;
    if (art && (!d || (__TEST_HOOKS__ && (window as unknown as { __zyNoArt?: boolean }).__zyNoArt))) setMonState('fail');
    if (d && art && !(__TEST_HOOKS__ && (window as unknown as { __zyNoArt?: boolean }).__zyNoArt)) {
      setMonState('loading');
      const names = Object.fromEntries((['idle', 'attack', 'hit', 'defeat'] as const).map(k => [k, mon!.soft ? art.anims[k].soft : art.anims[k].json])) as Record<'idle' | 'attack' | 'hit' | 'defeat', string>;
      void loadMonsterAnims(art.dir, names).then(a => {
        if (!alive.current || dir.current !== d || !monster.current) return;
        if (!a) { setMonState('fail'); return; }
        const holder = monster.current.querySelector('.breathe') as HTMLElement | null; if (!holder) { setMonState('fail'); return; }
        const img = holder.querySelector('img'); const h = img?.offsetHeight || img?.getBoundingClientRect().height || 220;   // r16：用布局高度——手机上幼儿园战斗区整体缩放（--kfit），getBoundingClientRect 已含缩放，序列帧放进同一个缩放容器会再缩一次（小班 / 中班怪物只有 50px）
        // 技术QA R6-2：横屏战斗区窄时怪物序列帧不能伸进右侧答题区/键盘：宽度最多占战斗区 42%
        const sw = (monster.current.closest('.stage') as HTMLElement | null)?.getBoundingClientRect().width || 1e4;
        const pl = new SheetPlayer(Math.min(h / 260, sw * 0.42 / a.idle.meta.frame_width));
        pl.box.dataset.testid = 'monster-sheet'; pl.box.dataset.mon = art.id; pl.box.classList.add('mon-sheet');
        holder.classList.add('has-sheet'); holder.appendChild(pl.box);
        d.monSheets = { player: pl, anims: a, hitFrame: art.anims.attack.hit_frame ?? a.attack.meta.hit_frame ?? 5 };
        void pl.play(a.idle); setMonState('ok');
      });
    }
    const onR = () => dir.current?.resize(); window.addEventListener('resize', onR);
    return () => { alive.current = false; window.removeEventListener('resize', onR); dir.current?.sheets?.player.stop(); dir.current?.sheets?.player.box.remove(); dir.current?.monSheets?.player.stop(); dir.current?.monSheets?.player.box.remove(); dir.current?.destroy(); dir.current = null; };
  }, [gentle, c.id, mon?.skin?.id, mon?.soft]);
  return { stage, shake, hero, monster, flash, canvas, dir, alive, monState };
}

/** 幼儿园结算页的怪物：名字 + 序列帧目录（idle 柔和版第一帧当立绘）；undefined = 小乌云 */
export interface KMonOut { name: string; dir: string; idle: string; qban?: string /* r17：有 Q版三态的怪物 id */ }
export interface BattleResult { term?: TermNo /* r17 D：小班期末庆祝关 */; kMon?: KMonOut /* r16.1 (c)：幼儿园结算页「X变成你的好朋友啦」用战斗里真正出场的怪物（中班 Boss = 专属 Boss） */; endReason?: 'hp0' | 'reviveFail' /* r15.3 学霸：输掉的原因（结算页显示） */; chalNeed?: boolean /* r15.2：初一普通关且挑战按钮亮过 → 3 星要答对挑战题 */; chalRight?: number /* r15.2：答对的挑战题数 */; exhausted?: boolean /* r15：题出完（每题 2 次）提前撤退 */; half?: number /* r12：半对题数（correct 里按 0.5 计） */; win: boolean; correct: number; total: number; revived: boolean; hpPct?: number /* D14 剩余血量比例 */; wrongKeys: string[]; retreat?: boolean; turns?: number; timeUp?: boolean; quit?: boolean /* 中途退出（学霸报告 #6：显示未通过结算） */; kinder?: { first: number; retry: number; demo: number } }
export interface BattleProps { unit?: string /* r15.3：关卡所在章（Boss 按章取名 / 主色） */; review?: string[] /* r15：错题复习题的 key（卡片显示「复习」） */;
  cfg: BandConfig; c: Character; kind: LevelKind; title: string;
  questions: Question[]; extra: Question[];         // extra：精英/Boss 题不够时继续出
  g1NoLimit?: boolean;
  onAnswer: (q: Question, correct: boolean, answer: string) => void;
  onEnd: (r: BattleResult) => void; onQuit: () => void; onFlag?: (q: Question) => void;
}

/** 暂停层：所有年级都有；退出需二次确认 */
export function PauseOverlay({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal>
      <h2>⏸ 暂停中</h2>
      <p className="sub">计时已停止</p>
      {!confirm ? <div className="row gap24 pause-btns">
        <button className="btn xl-btn" data-testid="resume" onClick={onResume}>▶ 继续玩</button>
        <button className="btn ghost xl-btn" data-testid="quit" onClick={() => setConfirm(true)}>回地图</button>
      </div> : <><p className="pause-q">现在回地图吗？这一关要重新开始哦</p><div className="row gap24 pause-btns">
        <button className="btn xl-btn" data-testid="resume" onClick={() => { setConfirm(false); onResume(); }}>继续玩</button>
        <button className="btn ghost xl-btn" data-testid="quit-confirm" onClick={onQuit}>回地图</button></div></>}
      <ReduceToggle />
    </Modal>
  );
}
export function ReduceToggle() {
  const [on, setOn] = useState(appReduceMotion());
  return <label className="toggle-line"><input type="checkbox" data-testid="reduce-motion" checked={on} onChange={e => { setAppReduceMotion(e.target.checked); setOn(e.target.checked); }} /> 减少动画（不晃屏、不冲刺）</label>;
}
/** 按时间戳计算的倒计时（rAF 驱动，暂停时冻结），返回剩余毫秒；key 变化时重置 */
export function useCountdown(active: boolean, paused: boolean, totalMs: number, key: unknown, onDone: () => void) {
  const [left, setLeft] = useState(totalMs);
  const st = useRef({ remain: totalMs, since: 0, done: false });
  const cb = useRef(onDone); cb.current = onDone;
  useEffect(() => { st.current = { remain: totalMs, since: 0, done: false }; setLeft(totalMs); }, [key, totalMs]);
  useEffect(() => {
    if (!active || paused) return;
    st.current.since = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const r = Math.max(0, st.current.remain - (t - st.current.since));
      setLeft(r);
      if (r <= 0) { if (!st.current.done) { st.current.done = true; cb.current(); } return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); st.current.remain = Math.max(0, st.current.remain - (performance.now() - st.current.since)); };
  }, [active, paused, key]);
  return left;
}
export function usePauseOnHide(setPaused: (b: boolean) => void, paused?: boolean) {
  /* r15.4.2 技术QA P1-1：手机竖屏 → 暂停（盖「请把手机横过来」）；横回来时，如果是竖屏引起的暂停就自动继续 */
  const portrait = usePhonePortrait(); const byRot = useRef(false); const pRef = useRef(paused); pRef.current = paused;
  useEffect(() => { if (portrait) { if (!pRef.current) { byRot.current = true; setPaused(true); } } else if (byRot.current) { byRot.current = false; setPaused(false); } }, [portrait, setPaused]);
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'hidden') setPaused(true); };
    const b = () => setPaused(true);   // r9：安卓返回键 / 返回手势 = 打开暂停
    document.addEventListener('visibilitychange', f); window.addEventListener('zy-back-pause', b);
    return () => { document.removeEventListener('visibilitychange', f); window.removeEventListener('zy-back-pause', b); };
  }, [setPaused]);
}


/** 战斗中保持亮屏（技术QA P3-6a）；不支持时静默 */
export function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null; let dead = false;
    const req = async () => { try { const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock; if (wl && document.visibilityState === 'visible') { lock = await wl.request('screen'); if (dead) void lock.release(); } } catch { /* */ } };
    void req(); const f = () => { if (document.visibilityState === 'visible') void req(); };
    document.addEventListener('visibilitychange', f);
    return () => { dead = true; document.removeEventListener('visibilitychange', f); void lock?.release().catch(() => {}); };
  }, []);
}
/** 暂停超过 5 分钟自动回地图（策划 T-P2-3）；时长到点后的宽限结束时强制结算（T-P2-2） */
/** 暂停：5 分钟无操作回地图；同时把暂停状态同步给 App 的计时器（暂停期间不计时，技术QA R4-2） */
/** r8b：致命一击命中帧后不等受击/收招，120 ms 后直接进怪物 defeat → 结算 */
export function lethalFast(lethal: boolean, run: (hit: () => void) => Promise<void> | undefined): () => Promise<void> | undefined {
  return () => { let hit = () => {}; const p = new Promise<void>(r => { hit = r; }); const a = run(hit); return lethal ? Promise.race([a, p.then(() => sleep(120))]) as Promise<void> : a; };
}
export function usePauseTimeout(paused: boolean, onQuit: () => void) {
  useEffect(() => { setBattlePaused(paused); return () => setBattlePaused(false); }, [paused]);   // r16.2：模块内变量，不挂 window
  // r13（较真家长 / 学霸）：暂停很久也只保持暂停（暂停期间不计时），不再自动离开关卡——以前 5 分钟后自动回地图 / 结算，孩子看到的是「突然回到首页」
  void onQuit;
}
export const FORCE_END = 'zy-force-end';
export function useForceEnd(f: () => void) {
  const r = useRef(f); r.current = f;
  useEffect(() => { const h = () => r.current(); window.addEventListener(FORCE_END, h); return () => window.removeEventListener(FORCE_END, h); }, []);
}

/* ---------------- 幼儿园（不会失败） ---------------- */
const PRAISE = ['真棒！', '太厉害了！', '答对啦！', '你好聪明！', '{mon}笑啦！'];   // r11：{mon} 换成这一关的怪兽名
const KCOLORS = ['#cfe3ff', '#d5f0c4', '#fff0b3'];
/* r15.4 录音退路：题干和每个选项单独的录音（manifest 键：题号#stem / 题号#optN，N = 题目原始选项序号；判断题用共用提示语 p:dui / p:cuo） */
const optVoiceKey = (q: Question, ch: Option) => q.type === '判断' ? (ch.key === '对' ? 'p:dui' : 'p:cuo') : expectVoiceText(voiceKey(q.id, `opt${Math.max(0, q.options.findIndex(o => o.key === ch.key))}`), ch.text);   // r17：登记选项文字，录音文字对不上就不放（tts.ts staleFilter）
const stemVoiceKey = (q: Question) => expectVoiceText(voiceKey(q.id, 'stem'), ttsText(q), q.question);
function speakStem(q: Question, shown?: Option[]) { const t = ttsText(q); if (t) speak(t, 'zh-CN', { id: q.id, keys: [stemVoiceKey(q), ...(shown ?? []).map(ch => optVoiceKey(q, ch))] }); }

/** 题干拆分：连续 emoji 作为「可数的物品」放大显示（较真家长 J-1：题干里的 🍎 不能当普通文字小字显示） */
const EMO = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*)/u;
export function splitStem(t: string): { text: string; items: string[] }[] {
  const out: { text: string; items: string[] }[] = [];
  for (const part of t.split(EMO)) {
    if (!part) continue;
    if (EMO.test(part) && part.match(EMO)![0] === part) { const last = out[out.length - 1]; if (last && !last.text) last.items.push(part); else out.push({ text: '', items: [part] }); }
    else if (/^\s+$/.test(part) && out.length && !out[out.length - 1].text) continue;
    else out.push({ text: part, items: [] });
  }
  return out;
}
function KStem({ q }: { q: Question }) {
  const segs = splitStem(q.question);
  const [lit, setLit] = useState(0);
  useEffect(() => setLit(0), [q.key]);
  const counting = /数一数|有几/.test(q.question);
  let n = 0;
  if (q.visual) return <div className="kq">{segs.filter(sg => sg.text).map((sg, i) => <span key={i}>{sg.text}</span>)}<CountVisual v={q.visual} />{q.question_image && <QImage image={q.question_image} cls="q-img" fallback={null} />}</div>;
  return <div className="kq">{q.question_image && <QImage image={q.question_image} cls="q-img" fallback={null} />}{segs.map((sg, i) => sg.text ? <span key={i}>{sg.text}</span> :
    <div key={i} className={`kitems ${sg.items.length > 5 ? 'two' : ''}`} data-testid="kitems" data-count={sg.items.length}>
      {sg.items.map((e, j) => { const k = ++n; return <button key={j} className={`kitem ${counting && k <= lit ? 'on' : ''}`} aria-label={e}
        onClick={() => { if (!counting) return; const v = Math.max(lit, k); setLit(v); speak(String(v)); }}>{e}</button>; })}
    </div>)}</div>;
}

/** r10：关内星星和结算同一个规则（⭐ 过关；第一次就答对 ≥6 成 ⭐⭐；≥8 成 ⭐⭐⭐），还没答完时按已答的题算 */
export function kStarsNow(k: { first: number; retry: number; demo: number }) { const n = k.first + k.retry + k.demo; if (!n) return 0; const a = k.first / n; return a >= 0.8 - 1e-9 ? 3 : a >= 0.6 - 1e-9 ? 2 : 1; }
const termUrl = (p: string) => (import.meta.env?.BASE_URL ?? './') + p;
/** r17 D：期末关的一排爱心（空心 / 点亮两张图原地互换：0.15 s 交叉淡化 + 0.3 s 1→1.15→1；减少动态 = 只淡化） */
function TermHearts({ n, lit, pop }: { n: number; lit: number; pop: number }) {
  return <div className="hearts kterm-hearts" data-testid="hearts" data-term="1" aria-live="polite" aria-label={`爱心 ${lit}/${n}`}>{Array.from({ length: n }, (_, i) => { const on = i < lit || i === pop;
    return <span key={i} className={`kheart ${on ? 'on' : ''} ${i === pop ? 'pop' : ''}`} data-on={on ? '1' : '0'} data-testid="term-heart"><img className="kh-empty" src={termUrl(TERM_IMG.heartEmpty)} alt="" draggable={false} /><img className="kh-lit" src={termUrl(TERM_IMG.heartLit)} alt="" draggable={false} /></span>; })}</div>;
}
export function KinderBattle({ unit, cfg, c, kind, questions, onAnswer, onEnd, onQuit, term, termLit0 = 0, onTermLit, demoReward = DESIGN.kinderDemoReward }: BattleProps & { demoReward?: boolean; term?: TermNo; termLit0?: number /* r17：上次已点亮的爱心 */; onTermLit?: (t: TermNo, lit: number) => void /* r17：每点亮一颗就记下来 */ }) {
  const skRoll = useRef<SkillRoll>(newRoll()); const lastSkill = useRef('');
  useEffect(() => { preloadSkillArt(skillsFor('K', c.major)); }, [c.major]);
  useEffect(() => { if (__TEST_HOOKS__) (window as unknown as { __zyLastSkill?: () => string }).__zyLastSkill = () => lastSkill.current; }, []);   // r16.1 (k)：只在测试包
  // r10 策划裁定：小班精英 / Boss = 温和战斗（柔和版怪物跳进来、3 / 5 颗小星星、不掉血不攻击，最后变成朋友挥手回家）
  const gentle = !term && kind !== 'normal';
  const hearts = term ? questions.length + termLit0 : Math.min(questions.length, gentle ? (kind === 'elite' ? 3 : 5) : cfg.questions[kind]);   // r17 D：期末关爱心数 = 题数
  // r16：按关卡类型选怪物；中班 Boss 有专属美术（不放大、不戴王冠），没有专属美术的 Boss = 本科目柔和版 + 王冠 + 放大 1.15
  const km = kinderMon(questions[0]?.subject, term ? 'normal' : kind, { grade: questions[0]?.grade, unit: unit ?? questions[0]?.unit });
  const gskin0 = gentle ? km.skin : null;
  // r17：Q版三态（有图就用静态三态图，不再加载序列帧；图读不出来 → 退回原来的序列帧 / 小乌云）
  const qid = gskin0?.id ?? QBAN_CLOUD; const [qFail, setQFail] = useState(false); const useQ = hasQban(qid) && !qFail;
  useEffect(() => { if (!useQ) return; for (const s of ['default', 'happy', 'mischief'] as const) { const im = new Image(); im.src = qbanUrl(qid, s); } }, [qid, useQ]);
  const [idx, setIdx] = useState(0);
  const [ks, setKs] = useState(() => term ? { ...newKinder(hearts), lit: Math.min(termLit0, hearts) } : newKinder(hearts));   // r17：期末关接着上次点亮的爱心
  const [fx, setFx] = useState<'' | 'star' | 'shake' | 'demo' | 'ok'>('');
  const [justLit, setJustLit] = useState(-1);
  const [tilt, setTilt] = useState(false);
  const [wig, setWig0] = useState<string | null>(null);
  // r13 小萌新：连续点错同一张卡也要重新摇；上一次的「1 秒后清掉」不能把这一次的摇晃提前切断
  const wigT = useRef(0);
  const setWig = (k: string | null) => { clearTimeout(wigT.current); if (k === null) { setWig0(null); return; } setWig0(null); requestAnimationFrame(() => setWig0(k)); wigT.current = window.setTimeout(() => setWig0(null), 1000); };   // r9：点错的卡片轻摇（≤2 Hz，0.5 s）+ 伙伴摇头
  const [paused, setPaused] = useState(false);
  usePauseOnHide(setPaused, paused);
  const lock = useRef(false);
  const D = useDirector(true, c, 0.95, false, gskin0 && !useQ ? { skin: gskin0, soft: true } : undefined);
  useKFit(D.stage);
  useEffect(() => { if (D.dir.current) D.dir.current.dashK = dashScale(km.aspect); }, [D.monState, km.aspect]);   // 宽 Boss：走近主角的距离按宽度缩短
  // 宽 Boss 跳进来（hop-in 从右边 160px 处进场）：按实际右侧空间缩短，整只（序列帧框）不出战斗区
  // r17：Q版图（宽高比各不相同）一律按实际右侧空间算；图片加载完再算一次
  useLayoutEffect(() => { const wrap = D.monster.current, st = D.stage.current; if (!wrap || !st || (!useQ && km.aspect <= 0.85)) return;
    const fit = () => { const box = (wrap.querySelector('[data-testid=monster-sheet], img.kmon.qban') as HTMLElement | null) ?? wrap; const tx = new DOMMatrix(getComputedStyle(wrap).transform === 'none' ? undefined : getComputedStyle(wrap).transform).m41;
      const sc = parseFloat(getComputedStyle(wrap).scale) || 1;   // --kfit 缩放也作用在 translateX 上
      const room = st.getBoundingClientRect().right - (box.getBoundingClientRect().right - tx * sc) - 6;
      wrap.style.setProperty('--kdash', String(Math.max(0, Math.min(useQ ? 1 : dashScale(km.aspect), room / (160 * sc))))); };
    fit(); const q = useQ ? wrap.querySelector('img.kmon.qban') as HTMLImageElement | null : null; if (q && !q.complete) { q.addEventListener('load', fit, { once: true }); return () => q.removeEventListener('load', fit); } }, [D.monState, km.aspect, useQ, qid]);
  const gskin = gskin0 && (useQ || D.monState !== 'fail') ? gskin0 : null;   // 柔和版怪兽没加载出来 → 小乌云，文字也跟着说小乌云
  const monName = term ? TERM_MON_NAME[term] : gskin?.name ?? '小乌云';
  const kMon: KMonOut | undefined = gskin ? { name: gskin.name, dir: gskin.art.dir, idle: gskin.art.anims.idle.soft, ...(useQ ? { qban: qid } : {}) } : useQ ? { name: '小乌云', dir: '', idle: '', qban: qid } : undefined;
  const [say, setSay] = useState<string | null>(null);   // r10：伙伴说的话（文字 + 朗读）
  const [busyLow, setBusyLow] = useState(false);   // r16.3：这次有技能横幅 →「在说话」提示固定排在横幅下面
  const [busy, setBusy] = useState(false);                // r10：锁定期间（伙伴在说话）给可见提示
  const [nudge, setNudge] = useState(0);
  const [monFace, setMonFace] = useState<string | null>(null);
  const [home, setHome] = useState(false);
  /* r17 D：期末关——开场白读完才出第一题；答完：结局图（下学期 intro→end 0.4 s 交叉淡化 / 上学期小乌云后面淡入彩虹层）+ 结尾语 → 奖章 + 庆祝乐句 + 奖章语 */
  const [introDone, setIntroDone] = useState(!term); const [ended, setEnded] = useState(false); const [medal, setMedal] = useState(false);
  useEffect(() => { if (!term) return; let live = true; setSay(TERM_TEXT.intro[term]); speak(TERM_TEXT.intro[term], 'zh-CN', { keys: [TERM_KEYS.intro[term]] });
    void afterVoice(600, 9000).then(() => { if (!live) return; setSay(x => x === TERM_TEXT.intro[term] ? null : x); setIntroDone(true); }); return () => { live = false; }; }, [term]);
  const talk = (t: string, ms = 1600, o?: { keys?: string[]; alt?: string[] }) => { setSay(t); speak(t, 'zh-CN', o); window.setTimeout(() => setSay(x => x === t ? null : x), ms); };
  const ksRef = useRef(ks); ksRef.current = ks;
  const wrong = useRef<string[]>([]);
  const down = useRef<string | null>(null);
  // r12 小萌新：暂停超时不再丢弃——已经答对过就按已答结算（全答完 = 胜利），一题没答才直接回地图
  /* r17 策划：期末关时间到 / 暂停超时 = 不算完成、不给奖章（爱心已经一颗颗记下了）：「大乌云要睡觉啦，下次再来玩～」→ 回地图；爱心都亮了才算完成 */
  const [sleepy, setSleepy] = useState(false);
  const termSleep = async () => { if (!term) return; lock.current = true; setBusy(true); setPaused(false); setSleepy(true); setSay(null);
    speak(TERM_TEXT.sleep[term], 'zh-CN', { keys: [TERM_KEYS.sleep[term]] });   // r17.1 已录音（p:k_term*_sleep @1.1）；没下载到时 speak() 退回 TTS，字幕照旧
    await sleep(400); await afterVoice(2500, 8000); if (D.alive.current) onQuit(); };
  const termDone = (k: typeof ks) => onEnd({ win: true, term, correct: k.first, total: Math.max(1, k.first + k.retry + k.demo), revived: false, wrongKeys: wrong.current, kinder: { first: k.first, retry: k.retry, demo: k.demo }, kMon });
  const kQuit = () => { const k = ksRef.current; if (term) { if (k.done) termDone(k); else void termSleep(); return; }   // r17：期末关不失败——没点完爱心 = 睡觉去，下次接着点
    if (k.done) { onEnd({ win: true, correct: k.first, total: Math.max(1, k.first + k.retry + k.demo), revived: false, wrongKeys: wrong.current, kinder: { first: k.first, retry: k.retry, demo: k.demo }, kMon }); return; }
    if (!(k.first + k.retry + k.demo)) { onQuit(); return; } onEnd({ win: false, quit: true, correct: k.first, total: k.first + k.retry + k.demo, revived: false, wrongKeys: wrong.current, kinder: { first: k.first, retry: k.retry, demo: k.demo }, kMon }); };
  useWakeLock(); usePauseTimeout(paused, kQuit);
  const forced = useRef(false);
  useForceEnd(async () => { if (forced.current) return; forced.current = true; lock.current = true; setBusy(true); await afterVoice(0, K_WAIT.endMax); if (!D.alive.current) return; const k = ksRef.current; if (term) { if (k.done) termDone(k); else await termSleep(); return; } onEnd({ win: false, timeUp: true, correct: k.first, total: Math.max(1, k.first + k.retry + k.demo), revived: false, wrongKeys: wrong.current, kinder: { first: k.first, retry: k.retry, demo: k.demo }, kMon }); });
  const q = questions[idx];
  const choices = useMemo(() => q ? kinderChoices(q) : [], [q]);
  useEffect(() => { if (q && cfg.autoTTS && introDone) speakStem(q, choices); }, [q, cfg.autoTTS, introDone]);
  if (!q) return null;
  const T = DESIGN.kinder;
  const answer = (ch: Option) => {
    if (paused || ksRef.current.removed.includes(ch.key)) return;
    if (lock.current || !introDone) { setNudge(n => n + 1); return; }   // r17 D：期末关开场白读完前不答题。r10：锁定时点了也有反馈（提示框轻跳一下）
    lock.current = true; setBusy(true);
    const cur = ksRef.current;
    const ok = isCorrect(q, ch.key);
    if (cur.attempt === 0) { onAnswer(q, ok, ch.key); if (!ok) wrong.current.push(q.key); }
    const wrongVisible = choices.filter(x => !q.answer.includes(x.key) && !cur.removed.includes(x.key)).map(x => x.key);
    const [ns, r] = kinderAnswer(cur, ok, ch.key, wrongVisible, demoReward);
    if (ok) answerFeedback(true); else softBump();
    if (r === 'retry') {
      setKs(ns); setTilt(true); setWig(ch.key); if (term) talk(TERM_TEXT.retry, T.retryUnlockMs, { keys: [TERM_KEYS.retry] }); else { D.dir.current?.kinderRetry(); talk(gentle ? '再试试～' : '嗯～再想想', T.retryUnlockMs); }
      if (gentle) { setMonFace('😜'); setTimeout(() => setMonFace(null), 1100); }
      setTimeout(() => { setTilt(false); lock.current = false; setBusy(false); }, T.retryUnlockMs);
      return;
    }
    if (term) onTermLit?.(term, ns.lit);   // r17：点亮一颗就记一颗（时间到 / 暂停超时 / 刷新都不丢）
    const last = ns.done || idx + 1 >= questions.length;
    const friendLine = gentle ? HOME_LINE(monName) : '小乌云变成你的好朋友啦！';
    let spoken: string; let spokenKeys: { keys?: string[] } = {};
    if (r === 'demo') {
      setFx('demo'); setTilt(true); setWig(ch.key);
      const right = choices.find(x => q.answer.includes(x.key));
      spoken = `我来帮你看看！是${right?.text || '这个'}哦！`; if (right) spokenKeys = { keys: ['p:demo_pre', optVoiceKey(q, right), 'p:demo_post'] };
      talk(spoken, T.demoMs, right ? { keys: ['p:demo_pre', optVoiceKey(q, right), 'p:demo_post'], alt: ['p:demo_this'] } : undefined);   // r15.4 录音：前半句 + 这个选项的录音 + 「哦！」；选项没录音（符号）就说「是这个哦」   // r9/r10：自己演示
      if (gentle) { setMonFace('😜'); setTimeout(() => setMonFace(null), 1100); }
    } else if (term) {   // r17 D：期末关答对 = 点亮一颗爱心（不放技能、不闪白）
      setFx('ok'); spoken = TERM_TEXT.heart; spokenKeys = { keys: [TERM_KEYS.heart] }; speak(spoken, 'zh-CN', spokenKeys);
    } else {
      setFx('ok'); const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)].replace('{mon}', monName);
      // 小班技能：35% 触发，连续 3 次没触发第 4 次必触发；纯演出，替换本题「星星攻击」，≤1.0 s（整体仍 1.2 s 内进下一题）
      const [nr, k] = rollSkill(skRoll.current, { seg: 'K', major: c.major, side: 'P', correct: true, rng: Math.random }); skRoll.current = nr;
      const k2 = k ?? (gentle ? (() => { const ks2 = skillsFor('K', c.major); return ks2[Math.floor(Math.random() * ks2.length)]; })() : null);   // 温和战斗：每次答对都放一个可爱技能
      if (gentle) { setMonFace('😆'); setTimeout(() => setMonFace(null), 1100); }
      const skillLine = k2 ? `${k2.char}的${k2.name}！` : '';   // r10：技能名也朗读
      // r16.3 方案 A：普通题 = 表扬 + 技能名；最后一题 = （技能名 +）「变成好朋友」，不先读表扬；「开心值…」挪到结算页读一次
      spoken = last ? skillLine + friendLine : praise + skillLine;
      if (last && gentle) setSay(friendLine); speak(spoken);
      if (k2 && D.dir.current) { const k = k2; lastSkill.current = k.id; void D.dir.current.playSkill(k, { kinder: true, maxMs: 1000 }); } else D.dir.current?.kinderCorrect();
      if (k2) setBusyLow(true);   // 技能横幅在顶上：「在说话」提示排在横幅下面，横幅收起后也不挪位置
    }
    setKs({ ...ns, removed: r === 'demo' ? choices.filter(x => !q.answer.includes(x.key)).map(x => x.key) : cur.removed });
    setTimeout(() => setJustLit(ns.lit - 1), r === 'demo' ? 1800 : 600);
    /* r15.4.4：从答对时刻起算最长等待（含 correctMs 动画）。r16.3：上限 = max(3.5 / 4 s, 这句话时长 + margin) */
    const waitFrom = performance.now(); const animMs = r === 'demo' ? T.demoMs : T.correctMs;
    const capOf = (base: number, text: string, o: { keys?: string[] } = {}) => speechMs(text, 'zh-CN', o).then(ms => kWaitCap(base, ms), () => base);
    const capP = capOf(last && r !== 'demo' ? K_WAIT.endCap : K_WAIT.nextCap, spoken, spokenKeys);
    setTimeout(async () => {
      setTilt(false);
      let cap = await capP; let from = waitFrom;
      const left = () => Math.max(0, cap - (performance.now() - from));
      if (last && term) {   // r17 D：结局图 + 结尾语 → 奖章 + 庆祝乐句 + 奖章语 → 结算（结算页写结尾语和奖章，不写「打败 / 胜利」）
        await afterVoice(0, left()); if (!D.alive.current || forced.current) return;
        setEnded(true); setSay(TERM_TEXT.end[term]); speak(TERM_TEXT.end[term], 'zh-CN', { keys: [TERM_KEYS.end[term]] });
        await sleep(400); await afterVoice(1200, 8000); if (!D.alive.current || forced.current) return;
        setMedal(true); setSay(TERM_TEXT.medal[term]); void playTermCelebrate(); speak(TERM_TEXT.medal[term], 'zh-CN', { keys: [TERM_KEYS.medal[term]] });
        await sleep(600); await afterVoice(1800, 9000); if (!D.alive.current || forced.current) return;
        onEnd({ win: true, term, correct: ns.first, total: idx + 1, revived: false, wrongKeys: wrong.current, kinder: { first: ns.first, retry: ns.retry, demo: ns.demo }, kMon }); return;
      }
      if (last) {
        if (r === 'demo') {   // 演示学会的最后一题：演示那句读完，再说「变成好朋友」
          await afterVoice(0, left()); if (!D.alive.current || forced.current) return;
          from = performance.now(); cap = await capOf(K_WAIT.endCap, friendLine);
          if (gentle) setSay(friendLine); speak(friendLine);
        }
        if (gentle) { setMonFace('👋'); await sleep(Math.min(400, left())); setHome(true); await sleep(Math.min(1600, left())); }
        else await Promise.race([D.dir.current?.kinderFinale(), sleep(Math.min(2500, left()))]);   // r12：演出有上限，后台/卡住也照样结算
        await afterVoice(0, left());   // 这句读完再进结算页（结算页的朗读排在它后面）
        if (!D.alive.current || forced.current) return;
        onEnd({ win: true, correct: ns.first, total: idx + 1, revived: false, wrongKeys: wrong.current, kinder: { first: ns.first, retry: ns.retry, demo: ns.demo }, kMon }); return;
      }
      await afterVoice(0, left());   // 表扬 + 技能名读完再出下一题（✓ 一直亮到这里）
      if (!D.alive.current || forced.current) return;
      setFx(''); setBusyLow(false); setKs(ns); setIdx(i => i + 1); setJustLit(-1); lock.current = false; setBusy(false);
    }, animMs);
  };
  return (
    <div className="kbattle">
      <div className="ktop">
        <div className="row gap16 kleft">
          <HoldButton className="pause-btn" label="暂停（按住）" testid="pause" ms={2000} onDone={() => setPaused(true)}>⏸</HoldButton>
        </div>
        <div className="kbubble">
          {hasVoice() && <button className="kspeaker" aria-label="再听一遍" data-testid="speak" onClick={() => speakStem(q, choices)}>🔊</button>}
          <KStem q={q} />
        </div>
        {/* r11：普通 / 精英 / Boss 统一：淡淡的笑脸轮廓，每答对一题亮一个 +「开心值 n/N」；关内不显示星星（星星只在结算给） */}
        {term ? <TermHearts n={ks.hearts} lit={ks.lit} pop={justLit} /> :
        <div className="hearts smiles" data-testid="hearts" data-gentle={gentle ? '1' : undefined} aria-live="polite" aria-label={`开心值 ${ks.lit}/${ks.hearts}`}><span className="hearts-label">开心值</span>{Array.from({ length: ks.hearts }, (_, i) => { const on = i < ks.lit || i === justLit; return <span key={i} className={`ksmile ${on ? 'on' : 'off'} ${i === justLit ? 'pop' : ''}`} data-on={on ? '1' : '0'}>😊</span>; })}<b className="hearts-num" data-testid="hearts-num">{Math.max(ks.lit, justLit + 1)}/{ks.hearts}</b></div>}
      </div>
      <div className="kstage" ref={D.stage}>
        <div className="fx-shake" ref={D.shake}>
          <div className={`unit-wrap kpup-wrap ${wig ? 'headshake' : ''}`} ref={D.hero} data-testid="kpup"><div className="breathe"><Sprite className="kpup" c={c} /></div>
            {say && <div key={say + nudge} className={`ksay ${nudge ? 'nudge' : ''}`} data-testid="ksay">{say}</div>}</div>
          {term ? <div className="unit-wrap kmon-wrap kterm-wrap" ref={D.monster} data-testid="term-mon" data-term={term} data-end={ended ? '1' : '0'}>
            {term === 1 ? <div className={`kterm1 ${ended ? 'end' : ''}`}><img className="kterm-overlay" src={termUrl(TERM_IMG.overlay1)} alt="" aria-hidden draggable={false} data-testid="term-overlay" />
                <img className="kmon qban kterm1-mon" src={qbanUrl(QBAN_CLOUD, ended ? 'happy' : qbanState({ tilt, face: monFace, ok: fx === 'ok', home: false }))} alt={monName} data-testid="kmon" data-mon="term1" draggable={false} /></div>
              : <div className={`kterm2 ${ended ? 'end' : ''}`}><img className="kmon kterm2-intro" src={termUrl(TERM_IMG.intro2)} alt={monName} data-testid="kmon" data-mon="term2" draggable={false} /><img className="kterm2-end" src={termUrl(TERM_IMG.end2)} alt="" aria-hidden draggable={false} /></div>}
            <img className="kmon white-flash" ref={D.flash} src={termUrl(TERM_IMG.heartEmpty)} alt="" aria-hidden draggable={false} /></div> :
          <div className={`unit-wrap kmon-wrap ${gentle ? 'gentle hop-in' : ''} ${home ? 'go-home' : ''}`} ref={D.monster} data-testid={gentle ? 'gentle-mon' : undefined}><div className={`breathe slow ${tilt ? 'ktilt' : ''} ${D.monState === 'ok' ? 'has-sheet' : ''}`} data-kboss={kind === 'boss' ? (km.crown ? 'fallback' : 'art') : undefined} style={km.scale !== 1 ? { scale: String(km.scale), transformOrigin: '50% 100%' } : undefined}>{kind === 'boss' && km.crown && <svg className="boss-crown in-mon" data-testid="boss-crown" viewBox="0 0 64 40" aria-hidden="true"><path d="M4 36 L8 10 L22 24 L32 4 L42 24 L56 10 L60 36 Z" fill="#ffd23f" stroke="#b8860b" strokeWidth="3" strokeLinejoin="round" /><circle cx="32" cy="26" r="4" fill="#e63946" /><circle cx="16" cy="29" r="3" fill="#4cc9f0" /><circle cx="48" cy="29" r="3" fill="#4cc9f0" /></svg>}
            {useQ ? <img className="kmon qban" src={qbanUrl(qid, qbanState({ tilt, face: monFace, ok: fx === 'ok', home }))} alt={monName} data-testid="kmon" data-mon={gskin?.id ?? 'cloud'} data-qban={qbanState({ tilt, face: monFace, ok: fx === 'ok', home })} draggable={false} onError={() => setQFail(true)} />
              : <img className={`kmon ${ks.lit >= 2 || gentle ? 'smile' : ''} ${gskin ? 'under-sheet' : ''}`} src={MONSTER_IMG.kinder} alt={monName} data-testid="kmon" data-mon={gskin?.id ?? 'cloud'} draggable={false} />}
            <img className={`kmon white-flash ${gskin && !useQ ? 'under-sheet' : ''}`} ref={D.flash} src={useQ ? qbanUrl(qid, 'default') : MONSTER_IMG.kinder} alt="" aria-hidden draggable={false} /></div>
            {monFace && !useQ && <div className="mon-face" data-testid="mon-face">{monFace}</div>}</div>}
        </div>
        <canvas className="fx-canvas" ref={D.canvas} />
        {term && sleepy && <div className="sleepy-pop kterm-sleep" data-testid="term-sleep" role="dialog" aria-label={TERM_TEXT.sleep[term]} onClick={() => onQuit()}><div className="sleepy-card">
          <div className="sleepy-mon"><img src={term === 1 ? qbanUrl(QBAN_CLOUD, 'default') : termUrl(TERM_IMG.intro2)} alt="" draggable={false} /><span className="zzz" aria-hidden>💤</span></div>
          <h2 data-testid="term-sleep-text">{TERM_TEXT.sleep[term]}</h2></div></div>}
        {term && medal && <div className="kterm-medal" data-testid="term-medal" data-term={term} role="status"><img src={termUrl(TERM_IMG.medal[term])} alt={TERM_MEDAL_NAME[term]} draggable={false} /><b>{TERM_MEDAL_NAME[term]}</b></div>}
        {/* r15.4.1 小萌新：「在说话」提示放在战斗区顶部（题目气泡下面），不再压住题干气泡上沿 */}
        {/* r15.4.2 小萌新：伙伴头顶有说话气泡（如「小七变成你的好朋友…」）时不再叠一个「在说话」提示（两个气泡在顶部压在一起）——气泡本身就说明在说话，点屏时气泡会晃一下 */}
        {busy && !say && <div key={nudge} className={`kbusy ${busyLow ? 'low' : ''} ${nudge ? 'nudge' : ''}`} data-testid="kbusy">🐶 {c.name}在说话，等一下下哦</div>}
      </div>
      <div className={`kopts ${busy || !introDone ? 'kwait' : ''}`} data-testid="kopts">
        {choices.map((ch, _i, all) => { const fit = all.map(x => gridOf(emojiOnlyN(x.text))).reduce((a, g) => [Math.max(a[0], g[0]), Math.max(a[1], g[1])], [1, 1]);
          const gone = ks.removed.includes(ch.key), right = q.answer.includes(ch.key);
          return (
            <button key={ch.key} style={{ background: KCOLORS[choices.indexOf(ch) % 3] }} aria-pressed={fx === 'ok' && right} disabled={gone}
              className={`kopt ${gone ? 'dim' : ''} ${wig === ch.key ? 'kwiggle' : ''} ${fx === 'demo' && right ? 'reveal soft-pulse' : ''} ${fx === 'ok' && right ? 'okmark' : ''}`}
              data-testid={'opt-' + ch.key} data-correct={TEST_DOM ? (right ? '1' : '0') : undefined}
              onPointerDown={() => { if (lock.current || paused) { down.current = null; setNudge(n => n + 1); return; } down.current = ch.key; }}   /* r11：锁定期间按下的也作废（以前锁内按下、锁后松开会算第二次答错） */
              onPointerUp={() => { if (down.current === ch.key) answer(ch); down.current = null; }}
              onPointerCancel={() => { down.current = null; }}
              onClick={e => { if (e.detail === 0) answer(ch); /* 键盘/读屏 */ }}>
              <QImage image={ch.image} cls="kopt-img" fallback={<KOptFace text={ch.text} fit={fit} />} />
            </button>
          );
        })}
      </div>
      {paused && <PauseOverlay onResume={() => setPaused(false)} onQuit={onQuit} />}
    </div>
  );
}
/** 小班选项（策划 X-6）：上方 emoji 区 70%，下方文字 30%，不重叠 */
/** 只有 emoji 的选项有几个 emoji（有文字 → 0） */
const emojiOnlyN = (t: string) => { const segs = t.split(EMO).filter(Boolean); return segs.some(x => !EMO.test(x) && x.trim()) ? 0 : segs.filter(x => EMO.test(x)).length; };
const gridOf = (n: number) => { const cols = n <= 3 ? Math.max(1, n) : n === 4 ? 2 : 3; return [cols, Math.ceil(Math.max(1, n) / cols)]; };
function KOptFace({ text, fit = [1, 1] }: { text: string; fit?: number[] }) {
  const segs = text.split(EMO).filter(Boolean);
  const emos = segs.filter(x => EMO.test(x)), emo = emos.join(''), rest = segs.filter(x => !EMO.test(x)).join('').trim();
  /* r15.4.1 小萌新：只有 emoji 的选项（「哪一组是 3 个」🍎🍎🍎）按个数排成固定网格（1–3 个一排、4 个 2×2、5–6 个两排 3+2 / 3+3），
     每个 emoji 的大小按卡片宽高（容器查询 cqw/cqh）算，整组总在卡片里；以前 110px 大字自动换行，竖着摞出卡片底 / 屏幕 */
  /* 同一题各选项的 emoji 一样大：按本题各组网格里最多的列数、最多的行数算（K-039：4 个排 2×2、3 个一排——以前只按 4 个的 2 列算，3 个一排伸出卡片右边） */
  if (emos.length && !rest) { const n = emos.length, [cols] = gridOf(n), [fc, fr] = [Math.max(fit[0], cols), Math.max(fit[1], gridOf(n)[1])];
    return <span className="kcount" data-testid="kcount" data-n={n} style={{ '--cols': cols, '--fc': fc, '--fr': fr } as CSSProperties}>{emos.map((e, i) => <span key={i} className="kcount-i">{e}</span>)}</span>; }
  if (emo && rest) return <span className="kface"><span className="kface-emo">{emo}</span><span className={`kface-txt ${[...rest].length > 4 ? 'small' : ''}`}>{rest}</span></span>;
  return <span className={`kopt-text ${[...text].length <= 3 ? 'short' : ''}`} style={{ '--len': Math.max(1, [...text].length) } as CSSProperties}>{text}</span>;
}
/** 长按按钮（小班暂停防误触，X-10）：按住时圆环进度 */
export function HoldButton({ ms, onDone, children, className, label, testid }: { ms: number; onDone: () => void; children: ReactNode; className?: string; label: string; testid?: string }) {
  const [p, setP] = useState(0); const t = useRef<number>(0); const st = useRef(0);
  const stop = () => { cancelAnimationFrame(t.current); setP(0); };
  const done = useRef(false);
  // r9：短按不暂停，但显示圆环并朗读「按住不放就能暂停」
  const release = () => { const held = st.current ? performance.now() - st.current : 0; const was = done.current; stop(); st.current = 0; if (!was && held > 0 && held < ms) { speak('按住不放就能暂停'); setHint(true); setTimeout(() => setHint(false), 1800); } };
  const [hint, setHint] = useState(false);
  const tick = () => { const v = Math.min(1, (performance.now() - st.current) / ms); setP(v); if (v >= 1) { done.current = true; stop(); onDone(); } else t.current = requestAnimationFrame(tick); };
  return <button className={`${className ?? ''} hold`} aria-label={label} data-testid={testid} style={{ ['--p' as string]: p }}
    onPointerDown={() => { done.current = false; st.current = performance.now(); t.current = requestAnimationFrame(tick); }} onPointerUp={release} onPointerLeave={() => { stop(); st.current = 0; }} onPointerCancel={() => { stop(); st.current = 0; }}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onDone(); }}><span className="hold-ring" aria-hidden />{children}{hint && <span className="hold-hint" data-testid="hold-hint">按住不放就能暂停</span>}</button>;
}

/** 角色图：WebP 优先，PNG 兜底（旧 Safari） */
export function Sprite({ c, className }: { c: Character; className?: string }) {
  return <picture>{c.webp && <source srcSet={c.webp} type="image/webp" />}<img className={className} src={c.img} alt={c.name} draggable={false} /></picture>;
}

/* ---------------- 小学 / 初一 / 高一 ---------------- */
type Phase = 'question' | 'action' | 'feedback' | 'revive-ask' | 'revive-q' | 'anim';
export function StdBattle({ unit, cfg, c, kind, title, questions, extra, review, g1NoLimit, onAnswer, onEnd, onQuit, onFlag }: BattleProps) {
  const skRoll = useRef<SkillRoll>(newRoll());
  const skSeg = segOf(cfg.band);
  useEffect(() => { preloadSkillArt(skillsFor(skSeg, c.major)); }, [c.major, skSeg]);
  const mode = cfg.stats;
  const mon0 = MONSTERS[mode][kind];
  const skin = skinFor(questions[0]?.subject, kind, cfg.band, unit ?? questions[0]?.unit, { grade: questions[0]?.grade, volume: questions[0]?.volume });   // 按科目换怪物外观（数值不变，策划 r6 裁定 3）
  const mon = skin ? { ...mon0, name: skin.name, img: skin.img } : mon0;
  const [queue, setQueue] = useState<Question[]>(questions);
  const extraLeft = useRef(extra.filter(q => !questions.some(x => x.key === q.key)).slice(0, Math.ceil(questions.length * EXTRA_QUESTION_FACTOR)));
  const [idx, setIdx] = useState(0);
  const [bs, setBs] = useState<BattleState>(() => newBattle(mode, kind, !cfg.canFail));
  const [phase, setPhase] = useState<Phase>('question');
  const [fb, setFb] = useState<{ ok: boolean; text: string; dealt?: number; taken?: number }>();
  const [canNext, setCanNext] = useState(true);
  // r9：暂停 5 分钟自动退出时也按「已答的题」结算，不再静默丢进度
  const quitNow = () => { const st = stats.current; if (!st.total) { onQuit(); return; } onEnd({ win: false, quit: true, correct: st.correct, half: st.half, total: st.total, revived: bsRef.current.revived, wrongKeys: st.wrong }); };
  const [paused, setPaused] = useState(false);
  const [intentPop, setIntentPop] = useState(false);   // 报告 #7：点意图看说明
  usePauseOnHide(setPaused, paused);
  const [input, setInput] = useState('');
  const [multi, setMulti] = useState<string[]>([]);
  const [picked, setPicked] = useState<string>();
  const [flagged, setFlagged] = useState(false);
  const stats = useRef({ correct: 0, half: 0, total: 0, wrong: [] as string[] });
  const bsRef = useRef(bs); bsRef.current = bs;
  useWakeLock(); usePauseTimeout(paused, quitNow);
  useForceEnd(() => { const st = stats.current; onEnd({ win: false, timeUp: true, correct: st.correct, half: st.half, total: st.total, revived: bsRef.current.revived, wrongKeys: st.wrong }); });
  // 复活挑战（GDD §4.4）：答对 2 道本关错题
  const [rv, setRv] = useState<{ list: Question[]; i: number; right: number } | null>(null);
  const q: Question | undefined = phase === 'revive-q' && rv ? rv.list[rv.i] : queue[idx];
  const limit = q ? timeLimitFor(q, cfg.band, { g1NoLimit }) : 0;
  const [timeLeft, setTimeLeft] = useState(limit);
  const [ttsTick, setTtsTick] = useState(0);
  const [actKey, setActKey] = useState(0);
  const intent = intentOf(bs.turn);
  const D = useDirector(false, c, 0.75, mode === 'hs', { skin, soft: softFor(cfg.band) });
  const [view, setView] = useState({ p: bs.playerHp, m: bs.monsterHp, c: bs.combo });   // 血条按命中时刻扣减
  const [ending, setEnding] = useState(false);
  const falling = view.p <= 0 || view.m <= 0;   // 已被打到 0 血：直接倒地/defeat，不显示「战斗中…」（策划 r7）

  useEffect(() => { setTimeLeft(limit); }, [q?.key, phase === 'question' || phase === 'revive-q']);
  useEffect(() => { if (q && cfg.autoTTS && (phase === 'question' || phase === 'revive-q')) { const t = ttsText(q); if (t) speak(t, q.subject === '英语' ? 'en' : 'zh-CN', { id: q.id, keys: [stemVoiceKey(q), ...(q.type === '选择' || q.type === '判断' ? choicesOf(q).map(ch => optVoiceKey(q, ch)) : [])] }); } }, [q?.key, phase]);
  useEffect(() => {
    if ((phase !== 'question' && phase !== 'revive-q') || paused || !limit) return;
    if (timeLeft <= 0) { submit(''); return; }
    const t = setTimeout(() => { if (isSpeaking()) setTtsTick(x => x + 1); else setTimeLeft(x => x - 1); }, 1000); return () => clearTimeout(t);   // 朗读时不计时
  }, [phase, timeLeft, paused, limit, ttsTick]);
  // D6 已取消（待策划新方案）：保持原流程，答对后 AUTO_ATTACK_SECONDS 秒自动攻击
  const actTotal = AUTO_ATTACK_SECONDS * 1000;
  const actMs = useCountdown(phase === 'action' && actTotal > 0, paused, actTotal || 1, actKey, () => act('attack'));
  const actLeft = Math.ceil(actMs / 1000);

  if (!q) return null;
  const finish = async (s: BattleState, played = false) => {
    if (ending) return; setEnding(true);
    const win = s.over === 'win' || (!s.over && outOfQuestions(s) === 'win') || (!cfg.canFail);
    setPhase('anim');
    // 胜负演出最多 0.8s（策划 r7），之后直接进结算或复活
    if (!played) await Promise.race([win ? D.dir.current?.victory() : D.dir.current?.defeat(), sleep(600)]);
    if (!D.alive.current) return;
    onEnd({ win, correct: stats.current.correct, half: stats.current.half, total: stats.current.total, revived: s.revived, wrongKeys: stats.current.wrong });
  };
  /** 先播演出，命中瞬间扣血条，演完再进入反馈 */
  async function play(ns: BattleState, show: () => Promise<void> | undefined) {
    setPhase('anim');
    try { await Promise.race([show(), sleep(3000)]); } catch { /* 动画失败或卡住都不影响流程 */ }
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
      if (right >= 2) { const ns = revive(bs); D.dir.current?.recover(); setBs(ns); setView({ p: ns.playerHp, m: ns.monsterHp, c: ns.combo }); setRv(null); setFb(undefined); D.dir.current?.float(D.dir.current.r.hero, '复活！50% 血量', 'heal');   // 学霸报告 #7：复活后直接出新题
        if (idx + 1 >= queue.length) { if (extraLeft.current.length) { const more = extraLeft.current.splice(0, 3); setQueue(qq => [...qq, ...noAdjacent(more, qq[qq.length - 1])]);   /* r15.1：续题也不和上一题同题干 */ } else { finish(ns); return; } }
        setIdx(i => i + 1); setPhase('question'); setInput(''); setMulti([]); setPicked(undefined); return; }
      if (rv.i + 1 >= rv.list.length || (rv.list.length - rv.i - 1) < 2 - right) { setRv(null); finish(bs); return; }
      setRv({ ...rv, i: rv.i + 1, right }); setInput(''); setMulti([]); setTimeLeft(limit);
      return;
    }
    if (phase !== 'question') return;
    const g = val === '' ? 'wrong' : judge(q, q.type === '多选' ? val.split('') : val);
    const ok = g !== 'wrong';
    setPicked(val); answerFeedback(ok); setFlagged(false);
    stats.current.total++;
    if (g === 'full') stats.current.correct++; else { if (g === 'partial') { stats.current.correct += 0.5; stats.current.half++; } stats.current.wrong.push(q.key); }   // r14.1 学霸：结算页要显示「半对 Y 题」
    onAnswer(q, g === 'full', val);
    if (g === 'partial') {   // 多选漏选：半伤害、不受击、自动攻击
      const [ns, r] = resolveCorrect(bs, c, 'attack', q.subject, q.difficulty, 0.5);
      const qq = q;
      void play(ns, () => D.dir.current?.playerAttack({ subject: qq.subject, major: c.major, dealt: r.dealt, crit: false, dodge: false, onImpact: () => setView(v => ({ ...v, m: ns.monsterHp, c: ns.combo })) }))
        .then(() => { if (ns.over === 'win') { void finish(ns); return; } setFb({ ok: true, text: '漏选了，半伤害', dealt: r.dealt, taken: 0 }); setPhase('feedback'); setCanNext(true); });
      return;
    }
    if (ok) {
      if (cfg.battle === 'simple') { act(autoAction(bs), true); return; }
      setActKey(k => k + 1); setPhase('action'); return;
    }
    const [ns, r] = resolveWrong(bs, c);
    setCanNext(false);
    void play(ns, () => D.dir.current?.monsterAttack(r.taken, () => setView(v => ({ ...v, p: ns.playerHp, c: ns.combo })))).then(() => {
      if (ns.over === 'lose') {   // 0 血：倒地 ≤0.8 s 后直接复活挑战或结算（策划 r7）
        
        void Promise.race([D.dir.current?.defeat(), sleep(600)]).then(() => { const wq = queue.filter(x => stats.current.wrong.includes(x.key));
          if (cfg.canFail && !ns.revived && wq.length >= 2) setPhase('revive-ask'); else void finish(ns, true); });
        return;
      }
      setFb({ ok: false, text: val === '' ? '⏰ 超时了' : '答错了', taken: r.taken }); setPhase('feedback');
      setTimeout(() => setCanNext(true), 1200);   // 解析至少停留一会儿
    });   // 解析至少停留一会儿
  }
  function act(a: Action, auto = false) {
    if (!q) return;
    const [ns, r] = resolveCorrect(bs, c, a, q.subject, q.difficulty);
    const crit = a === 'attack' && ns.combo >= 3;   // 3 连击起的攻击算「暴击」演出（数值仍按 battle.ts）
    setCanNext(true);
    // 小学 1–2 年级技能：纯演出，附加在自动出招上（≤1.0 s）
    if (skSeg === 'P12') { const [nr, k] = rollSkill(skRoll.current, { seg: 'P12', major: c.major, side: 'P', correct: true, rng: Math.random }); skRoll.current = nr; if (k) void D.dir.current?.playSkill(k, { maxMs: 1000 }); }
    void play(ns, lethalFast(ns.over === 'win', hit => D.dir.current?.playerAttack({ subject: q.subject, major: c.major, dealt: r.dealt, crit, dodge: a === 'dodge', healed: r.healed, taken: r.taken,
      onImpact: () => { hit(); setView(v => ({ ...v, m: ns.monsterHp, c: ns.combo })); }, onCounter: () => setView(v => ({ ...v, p: ns.playerHp, c: ns.combo })) }))).then(() => setFb({ ok: true, text: (auto ? '✔ 正确！自动' : '') + (a === 'attack' ? (crit ? '💥 连击暴击！' : '⚔ 攻击！') : '🛡 闪避反击！'), dealt: r.dealt, taken: r.taken })).then(() => { if (ns.over === 'win') void finish(ns); else setPhase('feedback'); });
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
      if (kind !== 'normal' && extraLeft.current.length) { const more = extraLeft.current.splice(0, 3); setQueue(qq => [...qq, ...noAdjacent(more, qq[qq.length - 1])]);   /* r15.1：续题也不和上一题同题干 */ }
      else { finish(s); return; }
    }
    setIdx(i => i + 1); setPhase('question'); setInput(''); setMulti([]); setPicked(undefined); setFb(undefined);
  }
  const isEn = q.subject === '英语';
  const fk = fillKind(q, cfg.band === 'H'); const letters = fk === 'letters';   // r16.1：键盘按答案选（game/inputKind.ts）
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
          <b>{kind === 'boss' ? '👑 ' : kind === 'elite' ? '⚡ ' : ''}<span data-testid="monster-name">{mon.name}</span></b>
          <Bar label="" v={view.m} max={bs.monsterMax} cls="mhp" />
          <button className="intent" data-testid="intent" aria-label="怪物意图说明" onClick={() => setIntentPop(true)}>{intent === 'attack' ? `⚔ 要攻击 ${bs.monsterAtk}` : `🛡 要加盾 +${bs.shieldAmt}`}{bs.monsterShield > 0 && <span data-testid="mshield">（已有护盾 {bs.monsterShield}）</span>} ⓘ</button>
        </div>
        <div className="stage" ref={D.stage}>
          <div className="fx-shake" ref={D.shake}>
            <div className="unit-wrap hero-wrap" ref={D.hero}><div className="breathe"><Sprite className="unit hero" c={c} /></div></div>
            <div className={`unit-wrap mon-wrap ${kind}`} ref={D.monster}><div className="breathe slow">{kind === 'boss' && <svg className="boss-crown in-mon" data-testid="boss-crown" viewBox="0 0 64 40" aria-hidden="true"><path d="M4 36 L8 10 L22 24 L32 4 L42 24 L56 10 L60 36 Z" fill="#ffd23f" stroke="#b8860b" strokeWidth="3" strokeLinejoin="round" /><circle cx="32" cy="26" r="4" fill="#e63946" /><circle cx="16" cy="29" r="3" fill="#4cc9f0" /><circle cx="48" cy="29" r="3" fill="#4cc9f0" /></svg>}
              <img className={`unit monster ${kind}`} src={MONSTER_IMG[mon.img]} alt={mon.name} data-testid="monster-img" draggable={false} />
              <img className={`unit monster ${kind} white-flash`} ref={D.flash} src={MONSTER_IMG[mon.img]} alt="" aria-hidden draggable={false} /></div></div>
          </div>
          <canvas className="fx-canvas" ref={D.canvas} />
        </div>
        <div className="hero-name">{c.name}{cfg.battle === 'simple' && ' · 简易模式'}{!cfg.canFail && ' · 不会失败'}</div>
      </div>
      <div className="quiz">
        {phase === 'revive-q' && <div className="revive-banner">复活挑战：答对 2 题（已对 {rv?.right ?? 0}）</div>}
        <div className="qmeta">{review?.includes(q.key) && <span className="review-tag" data-testid="review-tag">复习</span>}{q.subject} · {q.type} · 难度{q.difficulty}
          {q.status !== '已通过' && q.status !== 'AI初审通过' && <span className="pending">{q.status}</span>}
          {tts && (cfg.manualTTS || isEn) && <button className="mini" aria-label="朗读" data-testid="tts" onClick={() => speak(tts, isEn ? 'en' : 'zh-CN')}>🔊</button>}</div>
        <div className="qtext" data-ans={import.meta.env.DEV || (__TEST_HOOKS__ && (window as unknown as { __zyTest?: boolean }).__zyTest) ? q.answer[0] : undefined}><Tex text={q.question} /></div>
        {asking && q.type === '多选' && (
          <div className="opts">
            {q.options.map(ch => <button key={ch.key} className={`opt ${multi.includes(ch.key) ? 'sel' : ''}`} aria-pressed={multi.includes(ch.key)} data-testid={'opt-' + ch.key}
              onClick={() => setMulti(m => m.includes(ch.key) ? m.filter(x => x !== ch.key) : [...m, ch.key].sort())}><i>{multi.includes(ch.key) ? '✔' : ch.key}</i><span className="opt-txt"><Tex text={ch.text} /></span></button>)}
            <button className="next multi-ok" disabled={!multi.length} data-testid="ok" onClick={() => submit(multi.join(''))}>确定（多选）</button>
          </div>
        )}
        {asking && (q.type === '选择' || q.type === '判断') && (
          <div className={`${optCls} ${q.type === '判断' ? 'tf' : ''}`}>
            {choicesOf(q).map(ch => (
              <div key={ch.key} className="opt-wrap">
                <button className="opt" data-testid={'opt-' + ch.key} data-correct={TEST_DOM ? (q.answer.includes(ch.key) ? '1' : '0') : undefined} onClick={() => submit(ch.key)}>
                  {q.type === '选择' && <i>{ch.key}</i>}<QImage image={ch.image} cls="opt-img" fallback={<span className="opt-txt"><Tex text={ch.text} /></span>} /></button>
                {cfg.optionSpeaker && q.type === '选择' && !ch.text.includes('$') && <button className="opt-spk" aria-label="读选项" onClick={() => speak(ch.text, 'zh-CN', { keys: [optVoiceKey(q, ch)] })}>🔈</button>}
              </div>))}
          </div>
        )}
        {asking && q.type === '填空' && <Keypad key={q.key} letters={letters} ime={fk === 'ime'} sci={cfg.band === 'H'} value={input} onChange={setInput} onOk={v => submit(v)} />}
        {phase === 'action' && (
          <div className="actions">
            {actTotal > 0 && <div className="countbar smooth"><div style={{ transform: `scaleX(${actMs / actTotal})` }} /></div>}
            <p className="good">✔ 正确！选择行动{actTotal > 0 ? `（${actLeft}s 后自动攻击）` : ''}</p>
            <div className="row gap16 grow">
              <button className="act atk" data-testid="act-attack" onClick={() => act('attack')}>⚔<br />攻击</button>
              <button className="act dodge" data-testid="act-dodge" onClick={() => act('dodge')}>🛡<br />闪避</button>
            </div>
          </div>
        )}
        {phase === 'anim' && !ending && !falling && <div className="anim-wait" data-testid="anim">⚔ 战斗中…</div>}
        {phase === 'feedback' && fb && (
          <div className={`feedback ${fb.ok ? 'ok' : 'bad'}`}>
            <h3>{fb.text}{fb.taken ? ` 受到 ${fb.taken} 伤害` : ''}{fb.dealt ? ` 造成 ${fb.dealt} 伤害` : ''}</h3>
            {!fb.ok && <>
              {picked && <p>你的答案：{q.type === '选择' || q.type === '多选' ? picked.split('').map(k => <span key={k}>{k}. <Tex text={q.options.find(o => o.key === k)?.text ?? ''} />　</span>) : picked}</p>}
              <p>正确答案：<b><Tex text={correctText(q)} /></b></p>
              {q.explanation && <p className="expl">💡 <Tex text={q.explanation} /></p>}
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
            <p>复活挑战：答对 2 道题，回到 50% 血量（每关 1 次）。</p>
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
      {intentPop && <Modal onClose={() => setIntentPop(false)}><h2>怪物意图</h2>
        <p className="intent-long" data-testid="intent-pop">{intent === 'attack' ? `下回合攻击 ${bs.monsterAtk} 点` : `护盾，挡 ${bs.shieldAmt} 点伤害`}</p>
        <p className="hint">⚔ 攻击：数字是它这回合打你的伤害 · 🛡 护盾：先挡掉你的一部分伤害</p>
        <button className="btn" data-testid="intent-ok" onClick={() => setIntentPop(false)}>知道了</button></Modal>}
      {paused && <PauseOverlay onResume={() => setPaused(false)} onQuit={quitNow} />}
    </div>
  );
}
export { MONSTER };
