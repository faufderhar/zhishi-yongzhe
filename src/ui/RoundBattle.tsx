import { TEST_DOM } from './common';
/* D6 轮流回合战斗界面（实现规格 v0.3.6）：我方回合 / 对方回合交替，每回合 1 题；小学 3–6、初一、高一 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Tex } from '../Tex';
import { TIP_TEXT, rulesFor, playRageDrum, type TipKey } from './rules';
import { QImage, CountVisual } from './QImage';
import { Bar, Keypad, Modal } from './common';
import { choicesOf, correctText, judge, ttsText, type Question } from '../game/questions';
import { drawNext, normStem } from '../game/draw';
import { pickHarder } from '../game/harder';
import { unseen, refill } from '../game/draw';
import { multiRule, pickWithMulti, isMultiSel, type MultiCtx } from '../game/multi';
import { newRound, resolveRound, reviveRound, intentLabel, nextIntent, roundModeOf, roundsLeft, weakOf, phaseOf, type RState, type CardKind, type Wager, type ROut } from '../game/rounds';
import { skillsFor, skillById } from '../game/skills';
import { preloadSkillArt, skillIconUrl } from '../fx/skillFx';
import { cardOut } from '../game/balance';
import { MONSTERS, CARDS, PERFECT_FRACTION, PERFECT_NOLIMIT_SEC, REVIVE, ENERGY_CAP, FOCUS_MAX } from '../game/balance';
import { timeLimitFor } from '../game/grades';
import { MONSTER_IMG } from '../game/characters';
import { speak, isSpeaking } from '../tts';
import { answerFeedback } from '../feedback';
import { sleep } from '../fx/motion';
import { skinFor, softFor } from '../game/monsterSkin';
import { newTier, nextTier, pickByTier, isConsolidating, showConsolidateTag, type Tier } from '../game/consolidate';
import { useDirector, PauseOverlay, Sprite, usePauseOnHide, useWakeLock, usePauseTimeout, useForceEnd, type BattleProps } from './Battle';

type Phase = 'pre' | 'chal' | 'cards' | 'wager' | 'question' | 'anim' | 'feedback' | 'revive-ask' | 'revive-q' | 'retreat';
const normQ = normStem;
const isMulti = (q: Question) => (q as Question & { steps?: unknown[] }).steps?.length;   // 多步题（题库字段 steps；当前题库没有）

export function RoundBattle({ cfg, c, kind, title, questions, extra, onAnswer, onEnd, onQuit, onFlag, wagerOn = true, lowGrade = false, tips, onTip, seen, prior, reserve, adj }: BattleProps & { prior?: Question[]; reserve?: Question[]; adj?: Question[][]; wagerOn?: boolean; lowGrade?: boolean; tips?: Record<string, boolean>; onTip?: (k: string) => void; seen?: Set<string> }) {
  const mode = roundModeOf(cfg.band)!; const hs = mode === 'h';
  const mon0 = MONSTERS[cfg.stats][kind];
  const skin = skinFor(questions[0]?.subject, kind, cfg.band);   // 按科目换怪物外观（数值不变，策划 r6 裁定 3）
  const mon = skin ? { ...mon0, name: skin.name, img: skin.img } : mon0;
  // r10 同一局不重复：按题号和题面（去空格）去重；关外出过的题排在后面（Boss 优先没出过的）
  const pool = useRef<Question[]>((() => { const ks = new Set<string>(), ts = new Set<string>(), out: Question[] = [];
    const ex = [...extra].sort((a, b) => +!!seen?.has(a.key) - +!!seen?.has(b.key));
    for (const q of [...questions, ...ex]) { const t = normQ(q); if (ks.has(q.key) || ts.has(t)) continue; ks.add(q.key); ts.add(t); out.push(q); } return out; })());
  const curated = useRef(new Set(questions.map(q => q.key))).current;
  const [bs, setBs] = useState<RState>(() => {
    const s0 = newRound(mode, kind, { lowGrade, noDeath: !cfg.canFail });
    const th = (__TEST_HOOKS__ && (window as unknown as { __zyTest?: boolean; __zyTestHp?: number }).__zyTest) ? (window as unknown as { __zyTestHp?: number }).__zyTestHp : undefined;   // 仅自动化测试
    const tm = (__TEST_HOOKS__ && (window as unknown as { __zyTest?: boolean; __zyTestMonHp?: number }).__zyTest) ? (window as unknown as { __zyTestMonHp?: number }).__zyTestMonHp : undefined;   // 仅自动化测试：怪物血量
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
  const quitRef = useRef(() => {});
  const stats = useRef({ half: 0, correct: 0, total: 0, wrong: [] as string[], wrongQs: [] as Question[] });
  const [chalNone, setChalNone] = useState(false); const [chalWhy, setChalWhy] = useState('');
  // r14 策划：挑战灰着时写清原因（如初一 1.3、2.1-1：本课和前面小节最难只有当前难度，题库没有更难的）
  const maxD = useRef(Math.max(0, ...[...questions, ...extra, ...(reserve ?? []), ...(prior ?? [])].filter(x => !isMultiSel(x)).map(x => x.difficulty))).current;
  const whyNoHarder = (cur: number) => maxD <= cur ? `这一课（含前面学过的小节）最难的题就是难度 ${maxD}，现在已经在这个难度，没有更难的了` : '比现在更难的题这一局都出过了';
  const [rv, setRv] = useState<{ list: Question[]; i: number; right: number; tries: number } | null>(null);
  const D = useDirector(false, c, 0.75, hs, { skin, soft: softFor(cfg.band) });
  const [view, setView] = useState({ p: bs.playerHp, m: bs.monsterHp });
  const [ending, setEnding] = useState(false);
  const falling = view.p <= 0 || view.m <= 0;   // 已被打到 0 血：直接倒地/defeat，不显示「战斗中…」（策划 r7）
  useWakeLock(); usePauseTimeout(paused, () => quitRef.current());
  const result = (s: RState) => ({ win: s.over !== 'lose' || !cfg.canFail, retreat: s.over === 'retreat', turns: s.turn, correct: stats.current.correct, half: stats.current.half, total: stats.current.total, revived: s.revived, hpPct: s.playerMax ? s.playerHp / s.playerMax : 1, wrongKeys: stats.current.wrong });
  // r9：暂停超时 / 暂停里点回地图：按已答的题结算，不静默丢进度
  const quitNow = () => { if (!stats.current.total) { onQuit(); return; } onEnd({ ...result(bsRef.current), win: false, retreat: false, quit: true }); };
  quitRef.current = quitNow;
  useForceEnd(() => { const s = bsRef.current; onEnd({ ...result(s), win: false, retreat: false, timeUp: true }); });   // 到时强制结算：与回合上限撤退分开（技术QA R4-3）
  const mySkills = useMemo(() => skillsFor(bs.seg, c.major), [bs.seg, c.major]);
  useEffect(() => { preloadSkillArt(mySkills); }, [mySkills]);
  useEffect(() => {   // 仅自动化测试：直接播放任意技能特效（图集 / 护眼逐个检查）
    const w = window as unknown as { __zyTest?: boolean; __zyPlaySkill?: (id: string) => Promise<void> | undefined };
    if ((__TEST_HOOKS__ && w.__zyTest)) w.__zyPlaySkill = id => { const k = skillById(id); return k ? D.dir.current?.playSkill(k, { kinder: k.seg === 'K' }) : undefined; };
  }, []);   // 只懒加载本角色本学段的技能素材
  // 技术QA R6-4：答完到点〔继续〕之前，横幅/题目标签/意图都按「刚答的这一回合」显示；下一回合开始（phase=pre）才切换
  const [ansSide, setAnsSide] = useState<'P' | 'M' | null>(null);
  const P = (phase === 'anim' || phase === 'feedback') && ansSide ? ansSide === 'P' : bs.side === 'P';
  const il = intentLabel(bs);
  // D14 首次提示（每个档案每种 1 次，2.5 秒自动消失或点一下关闭，不暂停计时）
  const [tipNow, setTipNow] = useState<{ k: TipKey; t: string } | null>(null);
  const seenTip = useRef<Record<string, boolean>>({ ...(tips ?? {}) });
  const tip = (k: TipKey) => { if (seenTip.current[k]) return; seenTip.current[k] = true; onTip?.(k); setTipNow({ k, t: TIP_TEXT[k] }); setTimeout(() => setTipNow(x => x?.k === k ? null : x), 2500); };
  const [rules, setRules] = useState(false);
  const [rageAnim, setRageAnim] = useState(false);
  // D14 初一挑战题：只在初一我方回合，默认普通题，每回合结束回到普通题
  const [chal, setChal] = useState(false);
  const [chalMsg, setChalMsg] = useState('');
  const normalQ = useRef<Question | undefined>(undefined);
  // r10（D14 修正 1）：我方回合先选「普通 / 挑战」，选完才出题、开始计时；出题后锁定；3 秒不选默认普通（这 3 秒不计时）
  // r12（策划）：难一档相对当前自适应难度（tierRef），本小节没有就放宽到同单元前序小节；没有才灰
  const priorQs = useRef<Question[]>(prior ?? []);
  const harder = (base: Question | undefined, exclude: string[] = []) => { if (!base) return undefined;
    const q = pickHarder({ cur: tierRef.current.tier, lesson: pool.current, prior: priorQs.current, used: [...used.current, base], exclude: [base.key, ...exclude], subject: base.subject, skip: x => !!isMultiSel(x) || !!isMulti(x) })?.q;
    if (q) return q;
    // r14.1 学霸：更难的新题出完了 → 先用本局答错过的更难题，再用出过的更难题（不是挑战过的），都没有才灰
    const cur = tierRef.current.tier, wr = new Set(stats.current.wrong);
    const back = used.current.filter(x => x.difficulty > cur && x.key !== base.key && !exclude.includes(x.key) && !chalKeys.current.has(x.key) && !isMultiSel(x) && !isMulti(x) && x.subject === base.subject);
    return back.find(x => wr.has(x.key)) ?? back[0]; };
  const chalPick = (base: Question | undefined) => harder(base);
  const hardQ = useRef<Question | undefined>(undefined);
  const chooseChal = (on: boolean) => {
    if (phase !== 'chal') return;
    if (on && !hardQ.current) { setChalMsg((normalQ.current?.difficulty ?? 0) >= 5 ? '已经是最难的题了' : '这一关没有更难的题了'); setTimeout(() => setChalMsg(''), 2000); return; }
    const x = on ? hardQ.current : normalQ.current; reveal(x); setQ(x); setChal(on); setConsol(!!x && x.difficulty < tierRef.current.base);   /* r12：标签按实际出的题 */ setPhase('question');
  };
  // r11（策划，GDD §6）：不再 3 秒自动选普通；默认普通（高亮、标「默认」），不限时，点了才出题、才开始计时
  useEffect(() => { if (phase !== 'chal') return; tip('challenge'); }, [phase, bs.turn]);

  /** 取下一题：对方回合排除多步题；高一对方回合出标准难度（不选卡） */
  // 关内难度回落（裁定 4）：连错 2 题降 1 档，降档后连对 2 题恢复
  const chalKeys = useRef(new Set<string>()); const [tierNow, setTierNow] = useState(0);
  const tierTrace = useRef<{ d: number; ok: boolean; extra: boolean; before: number; after: number }[]>([]);
  const tierRef = useRef<Tier>(newTier(Math.round(questions.reduce((a, q) => a + q.difficulty, 0) / Math.max(1, questions.length)) || 2));
  const [consol, setConsol] = useState(false);
  const poolHasMulti = useRef(pool.current.some(isMultiSel)).current;
  const multiCtx = (): MultiCtx => ({ band: cfg.band, side: bs.side as 'P' | 'M', turn: bs.turn + 1, used: usedMulti.current, poolHas: poolHasMulti });
  const usedMulti = useRef(0);   // 本局已出多选数（复用已答题时也不清零）
  const take = (pred: (x: Question) => boolean = () => true) => {
    const fq = (__TEST_HOOKS__ && (window as unknown as { __zyTest?: boolean; __zyForceQ?: string }).__zyTest) ? pool.current.find(x => x.id === (window as unknown as { __zyForceQ?: string }).__zyForceQ) : undefined;   /* 仅测试构建：指定题 */
    // r8：多选规则优先于「最接近难度」（只初一/高一、我方回合、第 1 回合不出、每局 1–2 道）
    // r11：统一走 drawNext（去重 + 难度回落 + 多选规则）；只有本关题全部出过才重复
    const q = fq ?? drawNext(pool.current, used.current, { pred, curated, seen, tier: tierRef.current, multi: (xs, pk) => pickWithMulti(xs, multiCtx(), pk) }).q;
    if (q && isMultiSel(q)) usedMulti.current++;
    setConsol(isConsolidating(tierRef.current) && !!q && q.difficulty < tierRef.current.base); return q; };
  /** r10：题一出现就算出过（不能靠切换刷题） */
  /** r12：本局出过的题（题号 + 规范化题干）——所有取题路径都经过 reveal 记进来 */
  const unseenOf = (xs: Question[]) => unseen(xs, used.current);
  const reveal = (x: Question | undefined) => { if (!x) return x; pool.current = pool.current.filter(y => y.key !== x.key); priorQs.current = priorQs.current.filter(y => y.key !== x.key); if (!used.current.includes(x)) used.current.push(x); return x; };
  const cards = useMemo(() => {
    if (!hs || phase !== 'cards') return null;
    const rest = pool.current.filter(x => !isMultiSel(x)); const base = pickByTier(rest.filter(x => !isMulti(x)), tierRef.current) ?? rest[0]; if (!base) return null;
    const near = (d: number, used: string[]) => rest.filter(x => !used.includes(x.key) && !isMulti(x)).sort((a, b) => Math.abs(a.difficulty - d) - Math.abs(b.difficulty - d))[0];
    const light = near(base.difficulty - 1, [base.key]) ?? base;
    // r12：重击卡不再因没有更难题而缺位：先多步题，再更难一档（含前序小节），都没有就用当前难度的题（倍率按难度挂钩公式自然变小）
    const heavy = rest.find(x => isMulti(x) && x.key !== base.key) ?? harder(base, [light.key]) ?? rest.find(x => !isMulti(x) && x.key !== base.key && x.key !== light.key && x.difficulty === base.difficulty) ?? base;
    return { light, std: base, heavy } as Record<CardKind, Question>;
  }, [phase, hs]);
  // 进入每个回合：高一我方先选卡；押注；其他直接出题
  useEffect(() => {
    if (phase !== 'pre' || bs.over) return;
    setCard('std'); setWager(null); setChal(false); normalQ.current = undefined; setInput(''); setMulti([]); setPicked(undefined); setFb(undefined);
    if (!pool.current.length) {   // 本关题不够撑满回合上限：重复使用已答过的题（错题优先）
      // r12 学霸：先补本关（Boss 为整单元）里本局还没出过的题（按题号 + 题干去重）；真的全部出过才重复，并记日志
      // r13 技术QA R12-3 / 策划：本关出完 → 同单元相邻小节（前面的先）→ 都出完才重复 1 道；不再清空「本局出过」
      const r = refill(used.current, reserve ?? [], adj ?? [], new Set(stats.current.wrong), chalKeys.current); pool.current = r.pool; used.current = r.used;
      const w = window as unknown as { __zyAdj?: number; __zyRepeats?: number };
      if (r.kind === 'adj') { w.__zyAdj = (w.__zyAdj ?? 0) + 1; console.info('[zy] 本关题池出完，补同单元相邻小节', r.pool.length); }
      if (r.kind === 'repeat') { w.__zyRepeats = (w.__zyRepeats ?? 0) + 1; console.warn('[zy] 本关和相邻小节都出完了，开始重复', used.current.length); }
      if (!pool.current.length) { void retreat(bs); return; }
    }
    if (hs && P && !multiRule(multiCtx()).force) { setPhase('cards'); return; }   // 必出多选的回合跳过选卡（按标准卡），保证出到
    if (bs.mode === 'j' && bs.side === 'P') { const n = take(); normalQ.current = n; hardQ.current = chalPick(n);
      // r11：出选择前就定好有没有挑战题；没有就直接出普通题，挑战按钮灰着并写明原因（不再等 3 秒、不会像被吞掉）
      setChalNone(!hardQ.current); setChalWhy(hardQ.current ? '' : whyNoHarder(tierRef.current.tier)); setQ(undefined); setPhase('chal'); return; }   // 没有更难的题：挑战按钮灰着写明原因，照样等点〔普通〕
    setChalNone(false);
    setQ(reveal(take(x => P || !isMulti(x))));
    setPhase(hs && wagerOn ? 'wager' : 'question');
  }, [phase, bs.turn]);

  const cq = phase === 'revive-q' && rv ? rv.list[rv.i] : q;
  // r12（策划）：闪避题时限 = 我方回合同样的时限（按年级、计算 / 填空 ×1.5），最少 15 秒；完美闪避窗口 = 时限的一半
  const limit0 = cq ? timeLimitFor(cq, cfg.band, {}) : 0; const limit = limit0 && phase !== 'revive-q' && bs.side === 'M' ? Math.max(15, limit0) : limit0;
  const [timeLeft, setTimeLeft] = useState(limit);
  const [ttsTick, setTtsTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const asking = phase === 'question' || phase === 'revive-q';
  useEffect(() => { if (asking) { setTimeLeft(limit); setElapsed(0); } }, [cq?.key, asking, rv?.i]);
  useEffect(() => { if (cq && cfg.autoTTS && asking) { const t = ttsText(cq); if (t) speak(t, cq.subject === '英语' ? 'en' : 'zh-CN'); } }, [cq?.key, asking]);
  useEffect(() => {
    if (!asking || paused) return;
    const t = setTimeout(() => { if (isSpeaking()) { setTtsTick(x => x + 1); return; }   // 朗读时不计时
      if (limit && timeLeft <= 1) { setTimeLeft(0); submit(''); return; } setElapsed(e => e + 1); if (limit) setTimeLeft(x => x - 1); }, 1000); return () => clearTimeout(t);
  }, [asking, timeLeft, elapsed, paused, limit, ttsTick]);

  // 0 血（策划 r7）：不再停在「结算中…」；倒地 / 怪物 defeat 动作最多 0.8 s，然后直接复活或结算
  const END_MS = 450;   // r13 技术QA R12-5：高一最慢 1069 ms，留出渲染余量（原 600）；r10 R8-2：0 血 → 结算 ≤ 0.8 s（含渲染余量）
  const finish = async (s: RState, played = false) => {
    if (ending) return; setEnding(true);
    const r = result(s); setPhase('anim');
    if (s.over !== 'retreat' && !played) await Promise.race([r.win ? D.dir.current?.victory() : D.dir.current?.defeat(), sleep(END_MS)]);
    if (!D.alive.current) return;
    onEnd(r);
  };
  async function retreat(s: RState) { setBs({ ...s, over: 'retreat' }); setPhase('retreat'); await sleep(1200); if (D.alive.current) void finish({ ...s, over: 'retreat' }); }
  async function play(show: () => Promise<unknown> | undefined) {
    setPhase('anim');
    try { await Promise.race([show(), sleep(1500)]); } catch { /* 动画失败不影响流程 */ }
  }
  const pickCard = (k: CardKind) => { if (!cards) return; setCard(k); setQ(reveal(cards[k])); setConsol(isConsolidating(tierRef.current) && cards[k].difficulty < tierRef.current.base); setPhase(wagerOn ? 'wager' : 'question'); };

  function submit(val: string) {
    if (phase === 'question') setAnsSide(bs.side as 'P' | 'M');
    const qq = cq!;
    if (phase === 'revive-q' && rv) {
      const ok = val !== '' && judge(qq, qq.type === '多选' ? val.split('') : val) === 'full';
      answerFeedback(ok); const right = rv.right + (ok ? 1 : 0), tries = rv.tries + 1; setPicked(val);
      if (right >= REVIVE.need) { const ns = reviveRound(bs); D.dir.current?.recover(); setBs(ns); setView({ p: ns.playerHp, m: ns.monsterHp }); setRv(null); setFb(undefined); D.dir.current?.float(D.dir.current.r.hero, '复活！50% 血量', 'heal'); setPhase('pre'); return; }   // 学霸报告 #7：复活后直接出新题，不再停在刚答错的题上
      if (tries >= REVIVE.tries || REVIVE.tries - tries < REVIVE.need - right) { setRv(null); void finish(bs); return; }
      setRv({ list: rv.list, i: (rv.i + 1) % rv.list.length, right, tries }); setInput(''); setMulti([]);
      return;
    }
    if (phase !== 'question') return;
    const g = val === '' ? 'wrong' : judge(qq, qq.type === '多选' ? val.split('') : val);
    const ok = g !== 'wrong';
    setPicked(val); answerFeedback(g === 'full'); setFlagged(false);
    stats.current.total++;
    // r14：挑战题、重击卡（主动 +1 档）不改动当前难度计数——只有普通出题（含闪避题）计入连对 / 连错
    if (chal && bs.side === 'P') chalKeys.current.add(qq.key);
    const extraHard = (chal && bs.side === 'P') || (hs && P && card === 'heavy');
    const t0 = tierRef.current; if (!extraHard) tierRef.current = nextTier(tierRef.current, g === 'full'); setTierNow(tierRef.current.tier);
    tierTrace.current.push({ d: qq.difficulty, ok: g === 'full', extra: extraHard, before: t0.tier, after: tierRef.current.tier }); if (__TEST_HOOKS__) (window as unknown as { __zyTier?: unknown }).__zyTier = tierTrace.current;
    if (g === 'full') stats.current.correct++; else if (g === 'partial') { stats.current.correct += 0.5; stats.current.half++; stats.current.wrong.push(qq.key); stats.current.wrongQs.push(qq); } else {   // 漏选算 0.5（裁定 1）
     stats.current.wrong.push(qq.key); stats.current.wrongQs.push(qq); }
    onAnswer(qq, g === 'full', val);
    pool.current = pool.current.filter(x => x.key !== qq.key); if (!used.current.includes(qq)) used.current.push(qq);
    const fast = elapsed <= (limit ? limit * PERFECT_FRACTION : PERFECT_NOLIMIT_SEC);
    const [ns, o] = resolveRound(bs, c, { correct: ok, partial: g === 'partial', subject: qq.subject, difficulty: qq.difficulty, fast, card: hs && P ? card : 'std', wager: hs ? wager : null, challenge: chal && bs.side === 'P' && bs.mode === 'j' });
    if (o.partial) tip('partial'); if (o.energyGain) tip('energy'); if (o.perfect && bs.perfectOn) tip('focus'); if (o.dodged && o.side === 'M') tip('dodge');   /* r12：「运气好闪开」只在怪物回合 */ if (o.perfect) tip('perfect'); if (o.guardUsed) tip('guard'); if (o.capped) tip('cap');
    if (o.rage) { tip('rage'); setRageAnim(true); playRageDrum(); setTimeout(() => setRageAnim(false), 1400); }
    const k = o.skill;
    const d = D.dir.current;
    // r8b：致命一击在命中帧之后不再等受击/收招动作，直接进怪物 defeat（≤0.8 s）→ 结算
    let hitDone = () => {}; const hitP = new Promise<void>(r => { hitDone = r; });
    const show = k && d && o.side === 'P'   // 攻击技能：横幅 + 技能特效替代普攻演出，命中帧结算数字（≤1.5 s）
      ? async () => { await d.playSkill(k, { maxMs: 1450, onImpact: () => { hitDone(); setView(v => ({ ...v, m: ns.monsterHp })); d.float(d.r.monster, o.hits.length > 1 ? o.hits.map(x => '-' + x).join(' ') : '-' + o.dealt, 'crit'); } }); }
      : k && d ? async () => { await sleep(250); await d.playSkill(k, { maxMs: 1000, onImpact: () => { setView(v => ({ ...v, p: ns.playerHp })); if (o.healed) d.float(d.r.hero, '+' + o.healed, 'heal'); } }); }   // 守护技能：闪避后 ≤1.0 s
      : o.side === 'P'
      ? ok ? () => D.dir.current?.playerAttack({ subject: qq.subject, major: c.major, dealt: o.dealt, crit: ns.combo >= 3, dodge: false, healed: o.healed, onImpact: () => { hitDone(); setView(v => ({ ...v, m: ns.monsterHp })); } })
        : o.taken ? () => D.dir.current?.monsterAttack(o.taken, () => setView(v => ({ ...v, p: ns.playerHp }))) : () => sleep(500)
      : o.taken ? () => D.dir.current?.monsterAttack(o.taken, () => setView(v => ({ ...v, p: ns.playerHp }))) : () => sleep(500);
    const lethal = o.side === 'P' && ns.over === 'win';
    void play(lethal ? () => Promise.race([show(), hitP.then(() => sleep(120))]) : show).then(() => {
      if (!D.alive.current) return;
      setView({ p: ns.playerHp, m: ns.monsterHp }); setBs(ns);
      const full = g === 'full';   // 漏选不算答对（策划裁定 6）：显示解析，至少停 2 秒
      setFb({ ok: full, o, partial: g === 'partial', text: (full ? '✔ 正确！' : g === 'partial' ? '◐ 漏选了！' : val === '' ? '⏰ 超时了！' : '✘ 答错了！') + o.text + (k ? ` ✨${k.name}：${k.effectText}` : '') + (o.guardUsed ? '（护体抵挡 30%）' : '') });
      if (ns.over === 'win') { void finish(ns); return; }
      if (ns.over === 'lose') {   // 直接倒地 → 复活挑战 / 结算
        
        void Promise.race([D.dir.current?.defeat(), sleep(END_MS)]).then(() => {
          if (!D.alive.current) return;
          
          if (cfg.canFail && !ns.revived && stats.current.wrongQs.length >= 1) { setPhase('revive-ask'); return; }
          void finish(ns, true);
        });
        return;
      }
      setCanNext(full); setPhase('feedback');
      if (!full) setTimeout(() => setCanNext(true), 2000);   // 解析至少停 2 秒（规格 §1）
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
  if ((__TEST_HOOKS__ && (window as unknown as { __zyTest?: boolean }).__zyTest)) (window as unknown as { __zyAnswer?: () => string | undefined }).__zyAnswer = () => cq?.answer[0];   // 仅自动化测试
  const isEn = cq?.subject === '英语';
  const letters = cq?.subject === '英语' || !!cq?.answer.some(a => /[a-df-z]/i.test(a));   // 英语 / 文字答案用字母键盘；数字里的 e 是科学计数
  const tts = cq ? ttsText(cq) : '';
  const showQ = cq && !ending && (asking || phase === 'feedback' || phase === 'anim');
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
        <span className="lvl-title" title={title} data-testid="lvl-title">{title}</span>
        <button className="rules-btn" aria-label="规则说明" data-testid="rules" onClick={() => setRules(true)}>？</button>
        <button className="pause-btn" aria-label="暂停" data-testid="pause" onClick={() => setPaused(true)}>⏸</button>
      </div>
      {tipNow && <div className="first-tip" data-testid={'tip-' + tipNow.k} onClick={() => setTipNow(null)}>💡 {tipNow.t}</div>}
      {!bs.over && phase !== 'revive-ask' && phase !== 'revive-q' && <div key={P ? 'P' : 'M'} className={`side-banner ${P ? 'p' : 'm'}`} data-testid="banner" data-side={P ? 'P' : 'M'}>{P ? '⚔ 我方回合：答对就攻击！' : '🛡 对方回合：答对就闪避！'}</div>}
      <div className="arena">
        <div className="mon-info">
          <b>{kind === 'boss' ? '👑 ' : kind === 'elite' ? '⚡ ' : ''}<span data-testid="monster-name">{mon.name}</span>{bs.def.phases && ` · 第 ${phaseOf(bs) + 1} 阶段${weakOf(bs) ? `（弱点 ${weakOf(bs)}）` : ''}${bs.rage ? ' · 怒' : ''}`}</b>
          {bs.def.phases ? (() => { const f = bs.def.phases[1].hp, p0 = view.m > f; return <div className="seg-bar" data-testid="boss-bar" style={{ ['--seg' as string]: `${(f / bs.monsterMax) * 100}%` }}><Bar label="" v={view.m} max={bs.monsterMax} cls={`mhp ${p0 ? '' : 'phase2'}`} /><i className="seg-mark" aria-hidden /></div>; })()   /* r10：两阶段 Boss 一条总血条分两段，进二阶段不回满 */
            : <Bar label="" v={view.m} max={bs.monsterMax} cls="mhp" />}
          <button className={`intent intent-${nextIntent(bs)} ${il.grey ? 'grey' : ''} ${!P && asking ? 'now' : ''}`} data-testid="intent" data-intent={nextIntent(bs)} onClick={() => setIntentPop(true)} aria-label={'怪物意图：' + il.long}>
            {il.short} ⓘ{bs.shield > 0 && <span data-testid="mshield">（已有护盾 {bs.shield}）</span>}</button>
          {!P && asking && <div className="intent-now" data-testid="intent-now">{il.long}</div>}
        </div>
        <div className="stage" ref={D.stage}>
          <div className="fx-shake" ref={D.shake}>
            {bs.guard && <div className="guard-badge" data-testid="guard" title="护体：下一次受伤 ×0.7">🛡️</div>}
            <div className={`unit-wrap hero-wrap ${fb?.o?.dodged || fb?.o?.perfect ? 'sidestep' : ''}`} ref={D.hero}><div className="breathe"><Sprite className="unit hero" c={c} /></div></div>
            <div className={`unit-wrap mon-wrap ${kind} ${phase === 'retreat' ? 'retreating' : ''} ${rageAnim ? 'rage-pop' : ''} ${bs.rage ? 'raged' : ''}`} ref={D.monster}><div className="breathe slow">{kind === 'boss' && <svg className="boss-crown in-mon" data-testid="boss-crown" viewBox="0 0 64 40" aria-hidden="true"><path d="M4 36 L8 10 L22 24 L32 4 L42 24 L56 10 L60 36 Z" fill="#ffd23f" stroke="#b8860b" strokeWidth="3" strokeLinejoin="round" /><circle cx="32" cy="26" r="4" fill="#e63946" /><circle cx="16" cy="29" r="3" fill="#4cc9f0" /><circle cx="48" cy="29" r="3" fill="#4cc9f0" /></svg>}
              <img className={`unit monster ${kind}`} src={MONSTER_IMG[mon.img]} alt={mon.name} data-testid="monster-img" draggable={false} />
              <img className={`unit monster ${kind} white-flash`} ref={D.flash} src={MONSTER_IMG[mon.img]} alt="" aria-hidden draggable={false} /></div></div>
          </div>
          {rageAnim && <div className="rage-banner" data-testid="rage">Boss 怒了！攻击 +20%</div>}   {/* r10 R9-6：放在怪物区，不压题干 */}
          {fb?.o?.phaseShift && phase === 'feedback' && <div className="perfect-pop phase-pop" data-testid="phase-shift">{fb.o.rage ? 'Boss 怒了！攻击 +20%' : '第二阶段！'}</div>}
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
              <small data-testid={'card-mult-' + k}>伤害 ×{+cardOut(CARDS[k].out, cards[k].difficulty).toFixed(2)} · 答错反击 ×{CARDS[k].ctr}</small></button>)}
          </div></div>
        )}
        {phase === 'wager' && <WagerTip P={P} tip={tip} />}
        {phase === 'wager' && (
          <div className="cards" data-testid="wager"><p>看题前押注：有把握吗？</p><div className="row gap16">
            <button className="qcard" data-testid="wager-sure" onClick={() => { setWager('sure'); setPhase('question'); }}><b>确定</b>
              <small>{P ? '答对伤害 ×1.2；答错反击 ×1.3 且不能闪避' : '答对必定完美闪避；答错受击 ×1.3'}</small></button>
            <button className="qcard" data-testid="wager-unsure" onClick={() => { setWager('unsure'); setPhase('question'); }}><b>不太确定</b>
              <small>{P ? '答错反击 ×0.5，标记重点复习' : '答错照常受击，标记重点复习'}</small></button>
          </div></div>
        )}
        {phase === 'chal' && <div className="cards chal-pick" data-testid="chal-toggle" role="group" aria-label="选题难度"><p>这一回合出什么题？<small>（选好才出题、才开始计时）</small></p>
          <div className="row gap16">
            <button className="qcard default" data-testid="chal-normal" autoFocus onClick={() => chooseChal(false)}><b>普通题 <span className="def-tag">默认</span></b><small>照常出题</small></button>
            <button className={`qcard hot ${hardQ.current ? '' : 'grey'}`} data-testid="chal-on" aria-disabled={!hardQ.current} onClick={() => chooseChal(true)}><b>挑战题 🔥</b><small>{chalMsg || (hardQ.current ? '更难一档：答对伤害 ×1.5；答错反击 ×1.5，闪不开' : (chalWhy || '这一回合没有更难的题'))}</small></button>
          </div></div>}
        {showQ && <>
          {phase === 'revive-q' && <div className="revive-banner">复活挑战：答对 2 题（已对 {rv?.right ?? 0}，剩 {REVIVE.tries - (rv?.tries ?? 0)} 次机会）</div>}
          <div className="qmeta">{phase !== 'revive-q' && (P ? '⚔ 攻击题' : '🛡 闪避题')} · {cq.subject} · {cq.type} · 难度{cq.difficulty}{phase !== 'revive-q' ? <span data-testid="tier-now">（当前难度 {tierNow || tierRef.current.tier}{cq.difficulty > (tierNow || tierRef.current.tier) ? '，这题更难' : cq.difficulty < (tierNow || tierRef.current.tier) ? '，这题更容易' : ''}）</span> : null}{hs && P && phase !== 'revive-q' ? ` · ${CARDS[card].label}` : ''}{wager ? ` · 押${wager === 'sure' ? '确定' : '不太确定'}` : ''}{chal && P && phase !== 'revive-q' && <span className="chal-tag" data-testid="chal-tag"> · 🔥 挑战题</span>}{chalNone && P && phase !== 'revive-q' && <span className="chal-none" data-testid="chal-none" aria-disabled="true"> · <s>挑战题 🔥</s> 这一回合没有更难的题</span>}
            {cq.status !== '已通过' && cq.status !== 'AI初审通过' && <span className="pending">{cq.status}</span>}
            {tts && (cfg.manualTTS || isEn) && <button className="mini" aria-label="朗读" data-testid="tts" onClick={() => speak(tts, isEn ? 'en' : 'zh-CN')}>🔊</button>}</div>
          {consol && showConsolidateTag(cfg.band) && phase !== 'revive-q' && <span className="consol-tag" data-testid="consol-tag">巩固题</span>}
          <div className="qtext" data-ans={import.meta.env.DEV || (__TEST_HOOKS__ && (window as unknown as { __zyTest?: boolean }).__zyTest) ? cq.answer[0] : undefined}><Tex text={cq.question} /></div>
        </>}
        {asking && cq && cq.type === '多选' && (
          <div className="opts">
            {cq.options.map(ch => <button key={ch.key} className={`opt ${multi.includes(ch.key) ? 'sel' : ''}`} aria-pressed={multi.includes(ch.key)} data-testid={'opt-' + ch.key} data-correct={TEST_DOM ? (cq.answer.includes(ch.key) ? '1' : '0') : undefined}
              onClick={() => setMulti(m => m.includes(ch.key) ? m.filter(x => x !== ch.key) : [...m, ch.key].sort())}><i>{multi.includes(ch.key) ? '✔' : ch.key}</i><Tex text={ch.text} /></button>)}
            <button className="next multi-ok" disabled={!multi.length} data-testid="ok" onClick={() => submit(multi.join(''))}>确定（多选）</button>
          </div>
        )}
        {asking && cq && (cq.type === '选择' || cq.type === '判断') && (
          <div className={`opts ${cq.type === '判断' ? 'tf' : ''}`}>
            {choicesOf(cq).map(ch => <div key={ch.key} className="opt-wrap">
              <button className="opt" data-testid={'opt-' + ch.key} data-correct={TEST_DOM ? (cq.answer.includes(ch.key) ? '1' : '0') : undefined} onClick={() => submit(ch.key)}>
                {cq.type === '选择' && <i>{ch.key}</i>}<QImage image={ch.image} cls="opt-img" fallback={<Tex text={ch.text} />} /></button></div>)}
          </div>
        )}
        {asking && cq && cq.type === '填空' && <Keypad key={cq.key} letters={letters} sci={hs} value={input} onChange={setInput} onOk={() => submit(input)} />}
        {phase === 'anim' && !ending && !falling && <div className="anim-wait" data-testid="anim">⚔ 战斗中…</div>}
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
          <div className="feedback bad"><h3>💫 血量归零</h3><p>复活挑战：最多 4 次机会答对 2 道题（本关的新题），回到 50% 血量（每关 1 次，不计回合）。</p>
            <div className="row gap16 fb-btns">
              <button className="btn ghost" data-testid="revive-no" onClick={() => { setEnding(true); onEnd(result(bs)); }}>放弃</button>
              <button className="btn" data-testid="revive-yes" onClick={() => { setRv({ list: (() => { const f = unseenOf([...pool.current, ...priorQs.current.filter(x => x.difficulty <= tierRef.current.tier), ...(reserve ?? []), ...(adj ?? []).flat()]).filter(x => !isMultiSel(x)).filter((x, i, arr) => arr.findIndex(y => y.key === x.key) === i && !chalKeys.current.has(x.key)).slice(0, REVIVE.tries); f.forEach(reveal);   /* r14 技术QA R13-2：按题号去重，不够 4 道才补本局错题 */
                const w = stats.current.wrongQs.filter((x, i, arr) => arr.findIndex(y => y.key === x.key) === i && !f.some(y => y.key === x.key)); return [...f, ...w].slice(0, REVIVE.tries); })(), i: 0, right: 0, tries: 0 })   /* r12：复活题也走本局去重（不再复用出过的题） */; setPhase('revive-q'); setInput(''); setMulti([]); setPicked(undefined); }}>挑战复活</button>
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
      {rules && <Modal onClose={() => setRules(false)}><h2>规则说明</h2>
        <ol className="rules-list" data-testid="rules-pop">{rulesFor(bs.mode).map((r, i) => <li key={i}><b>{r[0]}</b>：{r[1]}</li>)}</ol>
        <button className="btn" data-testid="rules-ok" onClick={() => setRules(false)}>知道了</button></Modal>}
      {paused && <PauseOverlay onResume={() => setPaused(false)} onQuit={quitNow} />}
    </div>
  );
}

/** r10：押注首次提示（按当前规则写明得失） */
function WagerTip({ P, tip }: { P: boolean; tip: (k: TipKey) => void }) { useEffect(() => { tip(P ? 'wagerP' : 'wagerM'); }, [P]); return null; }
