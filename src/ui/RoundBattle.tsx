import { chalNeedOf } from '../game/levels';
import { tierCap } from '../game/consolidate';
import { fillKind } from '../game/inputKind';
import { stemOf, reviewGate } from '../game/adaptive';
import { TEST_DOM } from './common';
/* D6 轮流回合战斗界面（实现规格 v0.3.6）：我方回合 / 对方回合交替，每回合 1 题；小学 3–6、初一、高一 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Tex } from '../Tex';
import { TIP_TEXT, rulesFor, playRageDrum, type TipKey } from './rules';
import { QImage, CountVisual } from './QImage';
import { Bar, Keypad, Modal } from './common';
import { choicesOf, correctText, judge, ttsText, type Question } from '../game/questions';
import { drawNext, normStem, bossTiered } from '../game/draw';
import { pickHarder, anyHarder } from '../game/harder';
import { unseen, refill, REPEAT_CAP } from '../game/draw';
import { DmgSum } from './DmgSum';
import { reviewAllowed } from '../game/adaptive';
import { multiRule, pickWithMulti, isMultiSel, type MultiCtx } from '../game/multi';
import { calcD, estimateDealt, estimateInfo, estimateOverflow, phaseOverflow, newRound, resolveRound, reviveRound, intentLabel, nextIntent, roundModeOf, roundsLeft, weakOf, shortName, phaseOf, bossWeak, type Electives, type RState, type CardKind, type Wager, type ROut } from '../game/rounds';
import { skillsFor, skillById, triggerWhy, TRIGGER_TAG, ringTag, RING_TAG } from '../game/skills';
import { SkillDetail } from './SkillDetail';
import { guardText, phaseCapText } from '../game/dmgText';
import { logRound, summarize, toCSV, logFileName, type BossLogRound, type BossLogSummary } from '../game/bossLog';   // r17.1：只在 __TEST_HOOKS__ 分支里用，正式版摇掉
import { preloadSkillArt } from '../fx/skillFx';
import { cardOut } from '../game/balance';
import { MONSTERS, CARDS, PERFECT_FRACTION, PERFECT_NOLIMIT_SEC, REVIVE, ENERGY_CAP, FOCUS_MAX, HURT_CAP } from '../game/balance';
import { timeLimitFor } from '../game/grades';
import { MONSTER_IMG } from '../game/characters';
import { speak, isSpeaking } from '../tts';
import { answerFeedback } from '../feedback';
import { sleep } from '../fx/motion';
import { skinFor, softFor } from '../game/monsterSkin';
import { newTier, nextTier, pickByTier, isConsolidating, showConsolidateTag, type Tier } from '../game/consolidate';
import { useDirector, PauseOverlay, Sprite, usePauseOnHide, useWakeLock, usePauseTimeout, useForceEnd, type BattleProps } from './Battle';

type Phase = 'pre' | 'chal' | 'cards' | 'bet' | 'question' | 'anim' | 'feedback' | 'revive-ask' | 'revive-q' | 'retreat';
const normQ = normStem;
const isMulti = (q: Question) => (q as Question & { steps?: unknown[] }).steps?.length;   // 多步题（题库字段 steps；当前题库没有）

export function RoundBattle({ unit, cfg, c, kind, title, questions, extra, review, onAnswer, onEnd, onQuit, onFlag, wagerOn = true, lowGrade = false, tips, onTip, seen, prior, reserve, adj, prevStem, electives, wrongHist, labRng }: BattleProps & { labRng?: { rng: () => number; rnd: () => number; cur?: Question } /* r17.1 BossLab（仅测试构建）：固定种子（伤害 / 闪避 / 技能、首题随机）；cur = 当前题，给面板自动答题 */; wrongHist?: Set<string> /* r17.1 R3：本档案以前答错过的题（Boss 同档降级第 2 层） */; electives?: Electives | null /* r16 R-13：档案选科 */; prevStem?: string; prior?: Question[]; reserve?: Question[]; adj?: Question[][]; wagerOn?: boolean; lowGrade?: boolean; tips?: Record<string, boolean>; onTip?: (k: string) => void; seen?: Set<string> }) {
  const mode = roundModeOf(cfg.band)!; const hs = mode === 'h';
  const mon0 = MONSTERS[cfg.stats][kind];
  const skin = skinFor(questions[0]?.subject, kind, cfg.band, unit ?? questions[0]?.unit, { grade: questions[0]?.grade, volume: questions[0]?.volume });   // 按科目换怪物外观（数值不变，策划 r6 裁定 3）
  const mon = skin ? { ...mon0, name: skin.name, img: skin.img } : mon0;
  // r10 同一局不重复：按题号和题面（去空格）去重；关外出过的题排在后面（Boss 优先没出过的）
  const pool = useRef<Question[]>((() => { const ks = new Set<string>(), ts = new Set<string>(), out: Question[] = [];
    const ex = [...extra].sort((a, b) => +!!seen?.has(a.key) - +!!seen?.has(b.key));
    /* r17.1 学霸 r17-9 R2：Boss 每题都从「整章 + Boss 专用题、本局没出过」里挑——候选 = 开局题单 + 后备 + 整章（reserve），不再只看开局约 40 道 */
    for (const q of [...questions, ...ex, ...(kind === 'boss' ? reserve ?? [] : [])]) { const t = normQ(q); if (ks.has(q.key) || ts.has(t)) continue; ks.add(q.key); ts.add(t); out.push(q); } return out; })());
  /* r17.1 R4：一局 Boss 最多用掉本章「本档案没见过的难度 ≥3 题」的一半（至少 2 道） */
  const fresh3Quota = useRef(Math.max(2, Math.floor(pool.current.filter(x => x.difficulty >= 3 && !seen?.has(x.key)).length / 2))).current;
  const fresh3Left = () => fresh3Quota - used.current.filter(x => x.difficulty >= 3 && !seen?.has(x.key)).length;
  const bossOpt = () => kind === 'boss' ? { wrong: wrongHist ?? new Set<string>(), fresh3Left: fresh3Left() } : undefined;
  /* r17.1 R5：这道题是不是「≤ 当前档的题这局都出过了」才取的更难题（题头只在这时说） */
  const overRef = useRef(false);
  const curated = useRef(new Set(questions.map(q => q.key))).current;
  /* r15.1 学霸：本关（含后备 / 相邻小节）去重后的题数 × 2 = 最多能打的回合数；题少时回合上限显示真实值 */
  const maxTurns = useMemo(() => new Set([...questions, ...extra, ...(reserve ?? []), ...(adj ?? []).flat()].map(q => q.key)).size * 2, []);
  const [bs, setBs] = useState<RState>(() => {
    const s0 = newRound(mode, kind, { lowGrade, noDeath: !cfg.canFail, weak: bossWeak(questions[0]?.grade, questions[0]?.subject, electives), grade: questions[0]?.grade });   // r16 R-13
    const th = (__TEST_HOOKS__ && (window as unknown as { __zyTest?: boolean; __zyTestHp?: number }).__zyTest) ? (window as unknown as { __zyTestHp?: number }).__zyTestHp : undefined;   // 仅自动化测试
    const tm = (__TEST_HOOKS__ && (window as unknown as { __zyTest?: boolean; __zyTestMonHp?: number }).__zyTest) ? (window as unknown as { __zyTestMonHp?: number }).__zyTestMonHp : undefined;   // 仅自动化测试：怪物血量
    const s1 = tm ? { ...s0, monsterHp: tm, monsterMax: tm } : s0;
    return th ? { ...s1, playerHp: th } : s1;
  });
  const bsRef = useRef(bs); bsRef.current = bs;
  const lab = __TEST_HOOKS__ ? labRng : undefined;
  /* r17.1 Boss测试解锁_r17 §4.2-3/4/5（r16.1 延后项）：仅测试构建——本场统计 + 逐回合伤害日志写到 window.__zyBossLog = { summary, rounds[] }（数值取 ROut / ROut.dmg） */
  const bossLog = useRef<{ rounds: BossLogRound[]; t0: number } | null>(__TEST_HOOKS__ ? { rounds: [], t0: Date.now() } : null);
  const writeBossLog = (s: RState, end?: BossLogSummary['result']) => {
    if (!__TEST_HOOKS__ || !bossLog.current) return;
    const L = bossLog.current; (window as unknown as { __zyBossLog?: unknown }).__zyBossLog = { summary: summarize(L.rounds, s, { level: unit ?? title ?? '', monster: mon.name, seconds: Math.round((Date.now() - L.t0) / 100) / 10, end }), rounds: L.rounds };
  };
  const exportBossLog = (ext: 'json' | 'csv') => {
    if (!__TEST_HOOKS__ || !bossLog.current) return;
    const log = (window as unknown as { __zyBossLog?: { rounds: BossLogRound[] } }).__zyBossLog; if (!log) return;
    const body = ext === 'json' ? JSON.stringify(log, null, 1) : '\ufeff' + toCSV(log.rounds);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: ext === 'json' ? 'application/json' : 'text/csv' }));
    a.download = logFileName(questions[0]?.grade ?? '', String(unit ?? title ?? 'level').replace(/[^\w\u4e00-\u9fff-]+/g, '_'), ext); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const used = useRef<Question[]>([]);
  const [phase, setPhase] = useState<Phase>('pre');
  const [ringPop, setRingPop] = useState(false); const [ringE, setRingE] = useState<number | null>(null);   // r16.1 (y)：演出期间能量环显示结算后的值（以前停在答题前的旧值）
  const [card, setCard] = useState<CardKind>('std');
  const [wager, setWager] = useState<Wager>(false);   // r15.4.2：押注开关（我方回合看题前，默认不押）
  const [q, setQ] = useState<Question | undefined>();
  const [fb, setFb] = useState<{ ok: boolean; o?: ROut; text: string; partial?: boolean }>();
  const [canNext, setCanNext] = useState(true);
  const [paused, setPaused] = useState(false);
  const [intentPop, setIntentPop] = useState(false);
  usePauseOnHide(setPaused, paused);
  const [input, setInput] = useState(''); const [multi, setMulti] = useState<string[]>([]); const [picked, setPicked] = useState<string>();
  const [flagged, setFlagged] = useState(false);
  const quitRef = useRef(() => {});
  const stats = useRef({ half: 0, correct: 0, total: 0, wrong: [] as string[], wrongQs: [] as Question[] });
  const [chalNone, setChalNone] = useState(false); const [chalWhy, setChalWhy] = useState('');
  // r14 策划：挑战灰着时写清原因（如初一 1.3、2.1-1：本课和前面小节最难只有当前难度，题库没有更难的）
  const maxD = useRef(Math.max(0, ...[...questions, ...extra, ...(reserve ?? []), ...(prior ?? [])].filter(x => !isMultiSel(x)).map(x => x.difficulty))).current;
  const whyNoHarder = (cur: number) => `这一课（含前面学过的小节）最难的题就是难度 ${Math.max(maxD, cur)}，没有更难的了`;
  const [rv, setRv] = useState<{ list: Question[]; i: number; right: number; tries: number } | null>(null);
  const D = useDirector(false, c, 0.75, hs, { skin, soft: softFor(cfg.band) });
  const [view, setView] = useState({ p: bs.playerHp, m: bs.monsterHp });
  const [ending, setEnding] = useState(false);
  const falling = view.p <= 0 || view.m <= 0;   // 已被打到 0 血：直接倒地/defeat，不显示「战斗中…」（策划 r7）
  useWakeLock(); usePauseTimeout(paused, () => quitRef.current());
  const exhausted = useRef(false); const shownN = useRef(0), lastRev = useRef(-1); const revSet = useMemo(() => new Set(review ?? []), []);
  const reviveFailed = useRef(false); const [reviveMsg, setReviveMsg] = useState('');
  const result = (s: RState) => ({ endReason: s.over === 'lose' ? (reviveFailed.current ? 'reviveFail' as const : 'hp0' as const) : undefined, exhausted: s.over === 'retreat' && exhausted.current, win: s.over !== 'lose' || !cfg.canFail, retreat: s.over === 'retreat', turns: s.turn, correct: stats.current.correct, half: stats.current.half, total: stats.current.total, revived: s.revived, hpPct: s.playerMax ? s.playerHp / s.playerMax : 1, wrongKeys: stats.current.wrong, chalNeed: chalNeedOf(mode, kind, chalSeen.current), chalRight: chalRight.current });
  // r9：暂停超时 / 暂停里点回地图：按已答的题结算，不静默丢进度
  const quitNow = () => { if (__TEST_HOOKS__) writeBossLog(bsRef.current, '退出'); if (!stats.current.total) { onQuit(); return; } onEnd({ ...result(bsRef.current), win: false, retreat: false, quit: true }); };
  quitRef.current = quitNow;
  useForceEnd(() => { const s = bsRef.current; if (__TEST_HOOKS__) writeBossLog(s, '超时'); onEnd({ ...result(s), win: false, retreat: false, timeUp: true }); });   // 到时强制结算：与回合上限撤退分开（技术QA R4-3）
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
  const markTip = (k: string) => { if (seenTip.current[k]) return; seenTip.current[k] = true; onTip?.(k as TipKey); };
  /* r15.4.2 游戏策划：押注开关第一次出现时在开关下面给一句短提示（每个档案 1 次）。提示就放在开关旁边、这一步一直显示到出题，
     不是 2.5 秒自己消失的气泡，所以不会被别的东西盖住 / 错过；显示出来那一刻才记「看过」 */
  const [betHint, setBetHint] = useState(false);
  /* r15.1 学霸：技能让连击一次 +2 时标出「+1 技能」，不再像是 x0 直接跳到 x2 */
  const prevCombo = useRef(0); const [comboTag, setComboTag] = useState(false);
  useEffect(() => { if (bs.combo - prevCombo.current >= 2) { setComboTag(true); const t = setTimeout(() => setComboTag(false), 1800); prevCombo.current = bs.combo; return () => clearTimeout(t); } prevCombo.current = bs.combo; }, [bs.combo]);
  const tip = (k: TipKey) => { if (seenTip.current[k]) return; seenTip.current[k] = true; onTip?.(k); setTipNow({ k, t: TIP_TEXT[k] }); setTimeout(() => setTipNow(x => x?.k === k ? null : x), 2500); };
  const [rules, setRules] = useState(false);
  useEffect(() => { const show = (phase === 'cards' || phase === 'bet') && hs && wagerOn && bs.side === 'P';
    /* r15.4.3 学霸：以前是开关下面一行黄字、显示那一刻就记「看过」，测试员档案里记了看过却没注意到。现在改成弹窗，点〔知道了〕才记看过
       （选卡 / 押注这一步还没出题、不计时，弹窗不影响答题时间）；中途刷新 / 退出没点的，下次第一次出开关时再弹 */
    /* 旧的自动化脚本不认识这个弹窗：测试构建里设了 __zyTest 却没设 __zyTestBetPop 时不弹（正式构建没有这段） */
    const testSkip = __TEST_HOOKS__ && !!(window as unknown as { __zyTest?: boolean }).__zyTest && !(window as unknown as { __zyTestBetPop?: boolean }).__zyTestBetPop;
    if (show && !seenTip.current.betHint && !testSkip) setBetHint(true); }, [phase]);
  const closeBetHint = () => { setBetHint(false); markTip('betHint'); };
  const [rageAnim, setRageAnim] = useState(false);
  // D14 初一挑战题：只在初一我方回合，默认普通题，每回合结束回到普通题
  const [chal, setChal] = useState(false);
  const [chalMsg, setChalMsg] = useState('');
  const normalQ = useRef<Question | undefined>(undefined);
  // r10（D14 修正 1）：我方回合先选「普通 / 挑战」，选完才出题、开始计时；出题后锁定（r11 起不再自动选）
  // r12（策划）：难一档相对当前自适应难度（tierRef），本小节没有就放宽到同单元前序小节；没有才灰
  const priorQs = useRef<Question[]>(prior ?? []);
  const harder = (base: Question | undefined, exclude: string[] = []) => { if (!base) return undefined;
    /* r15.3 策划 A：没见过的先，再以前答错的，再见过的（pickHarder 同难度取第一个） */
    const hr = (x: Question) => !seen?.has(x.key) ? 0 : stats.current.wrong.includes(x.key) ? 1 : 2; const byHist = (xs: Question[]) => [...xs].sort((a, b) => hr(a) - hr(b));
    const q = pickHarder({ cur: tierRef.current.tier, lesson: byHist(pool.current), prior: byHist(priorQs.current), used: [...used.current, base], exclude: [base.key, ...exclude, ...(reviewAllowed(shownN.current, lastRev.current) ? [] : [...revSet])], subject: base.subject, skip: x => !!isMultiSel(x) || !!isMulti(x) })?.q;   /* r15.1 R15-2：挑战 / 重击也守复习间隔 */
    if (q) return q;
    // r14.1 学霸：更难的新题出完了 → 先用本局答错过的更难题，再用出过的更难题（不是挑战过的），都没有才灰
    const cur = tierRef.current.tier, wr = new Set(stats.current.wrong);
    const back = used.current.filter(x => x.difficulty > cur && x.key !== base.key && !exclude.includes(x.key) && !chalKeys.current.has(x.key) && (repCount.current.get(x.key) ?? 0) < REPEAT_CAP - 1 && !isMultiSel(x) && !isMulti(x) && x.subject === base.subject);
    const b1 = back.find(x => wr.has(x.key)) ?? back[0]; if (b1) return b1;
    /* r15.3 策划 A：只要本课 / 题池里还有比当前档更难的题（含出过的、挑战过的），挑战按钮就能点；顺序：没见过 → 以前答错 → 见过。真的一道都没有才灰 */
    return anyHarder([...pool.current, ...priorQs.current, ...(reserve ?? []), ...(adj ?? []).flat(), ...used.current], cur, { baseKey: base.key, subject: base.subject, exclude, skip: x => !!isMultiSel(x) || !!isMulti(x), seen, wrongRun: wr }); };
  const chalPick = (base: Question | undefined) => harder(base);
  const hardQ = useRef<Question | undefined>(undefined);
  const chalSeen = useRef(false), chalRight = useRef(0);   // r15.2：挑战按钮亮过没有、答对几道挑战题（初一普通关 3 星条件）
  const chooseChal = (on: boolean) => {
    if (phase !== 'chal') return;
    if (on && !hardQ.current) { setChalMsg((normalQ.current?.difficulty ?? 0) >= 5 ? '已经是最难的题了' : '这一关没有更难的题了'); setTimeout(() => setChalMsg(''), 2000); return; }
    const x = on ? hardQ.current : normalQ.current; reveal(x); setQ(x); setChal(on); setConsol(!!x && x.difficulty < tierRef.current.base);   /* r12：标签按实际出的题 */ setPhase('question');
  };
  // r11（策划，GDD §6）：不再 3 秒自动选普通；默认普通（高亮、标「默认」），不限时，点了才出题、才开始计时
  useEffect(() => { if (phase !== 'chal') return; tip('challenge'); }, [phase, bs.turn]);

  /** 取下一题：对方回合排除多步题；高一对方回合出标准难度（不选卡） */
  // 关内难度回落（裁定 4）：连错 2 题降 1 档，降档后连对 2 题恢复
  const chalKeys = useRef(new Set<string>()); const repCount = useRef(new Map<string, number>()); const [tierNow, setTierNow] = useState(0);
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
    // r15 策划：复习题前 2 题不出，之后每 4 题最多 1 道（只剩复习题时才放宽）
    const dn = (pr: (x: Question) => boolean) => { const r = drawNext(pool.current, used.current, { pred: pr, curated, seen, tier: tierRef.current, multi: (xs, pk) => pickWithMulti(xs, multiCtx(), pk), force: multiRule(multiCtx()).force ? isMultiSel : undefined, first: shownN.current === 0 && !used.current.length, boss: bossOpt(), rnd: lab?.rnd }); overRef.current = !!r.over; return r.q; };
    const revOk = reviewAllowed(shownN.current, lastRev.current);
    /* r15.1 技术QA R15-2：本关题池里非复习题出完时，先从同单元后备题 / 相邻小节补一道非复习题，实在没有才出复习题（以前直接连出 4 道复习） */
    const nonRev = (x: Question) => pred(x) && !revSet.has(x.key);
    /* r15.3 小萌新：这一局第一题不和上一局最后一题同题干（有别的题可出时） */
    const first = shownN.current === 0 && prevStem ? dn(x => (revOk || !revSet.has(x.key)) && pred(x) && stemOf(x) !== prevStem) : undefined;
    let q = fq ?? first ?? (revOk || !revSet.size ? dn(pred) : dn(nonRev));
    if (!q && !revOk && revSet.size) { const add = unseenOf([...(reserve ?? []), ...(adj ?? []).flat()]).filter(x => nonRev(x) && !pool.current.some(y => y.key === x.key) && !isMultiSel(x)); if (add.length) { pool.current = [...pool.current, add[0]]; q = dn(nonRev); } }
    if (!q) q = dn(pred);
    if (q && isMultiSel(q)) usedMulti.current++;
    setConsol(isConsolidating(tierRef.current) && !!q && q.difficulty < tierRef.current.base); return q; };
  /** r10：题一出现就算出过（不能靠切换刷题） */
  /** r12：本局出过的题（题号 + 规范化题干）——所有取题路径都经过 reveal 记进来 */
  const unseenOf = (xs: Question[]) => unseen(xs, used.current);
  const reveal = (x: Question | undefined) => { if (!x) return x; if (revSet.has(x.key)) lastRev.current = shownN.current; shownN.current++; pool.current = pool.current.filter(y => y.key !== x.key); priorQs.current = priorQs.current.filter(y => y.key !== x.key); if (!used.current.includes(x)) used.current.push(x); else repCount.current.set(x.key, (repCount.current.get(x.key) ?? 0) + 1); /* r15：复用本局出过的题（挑战回退等）也计入重复次数 */ return x; };
  const cards = useMemo(() => {
    if (!hs || phase !== 'cards') return null;
    /* r15.3 技术QA R152-1：高一选卡以前不看复习间隔（错题几乎覆盖整关时，复习题挤在前几题）；现在三张卡都守「前 2 题不出、每 4 题最多 1 道」，
       本关没有非复习题先借后备 / 相邻小节的，真的只剩复习题才放宽；同档里本档案没见过的先 */
    const g = reviewGate(pool.current.filter(x => !isMultiSel(x)), x => revSet.has(x.key), reviewAllowed(shownN.current, lastRev.current), unseenOf([...(reserve ?? []), ...(adj ?? []).flat()]).filter(x => !isMultiSel(x) && !isMulti(x)));
    if (g.borrowed) pool.current = [...pool.current, g.borrowed];
    const rest = g.list; const unseenH = (xs: Question[]) => { const u = xs.filter(x => !seen?.has(x.key)); return u.length ? u : xs; };
    const fq = (__TEST_HOOKS__ && (window as unknown as { __zyTest?: boolean; __zyForceQ?: string }).__zyTest) ? pool.current.find(x => x.id === (window as unknown as { __zyForceQ?: string }).__zyForceQ) : undefined;   /* 仅测试构建：指定题也走选卡（r15.4.4：以前高一选卡不看指定题，C10-044 难度 4 出不成） */
    /* r17.1 R1：标准卡普通题 ≤ tierCap、同样近取低档；Boss 按 R3 / R4 同档降级 */
    const cap = tierCap(tierRef.current.base), nm = rest.filter(x => !isMulti(x)), capped = nm.filter(x => x.difficulty <= cap);
    const bt = !fq && kind === 'boss' ? bossTiered(nm, { seen, curated, tier: tierRef.current, boss: bossOpt()! }) : undefined;
    const base = fq ?? bt?.q ?? pickByTier(unseenH(capped.length ? capped : nm), tierRef.current, true) ?? rest[0]; if (!base) return null;
    overRef.current = bt ? bt.over : !fq && base.difficulty > tierRef.current.tier && !capped.some(x => x.difficulty <= tierRef.current.tier);
    const near = (d: number, used: string[]) => rest.filter(x => !used.includes(x.key) && !isMulti(x)).sort((a, b) => Math.abs(a.difficulty - d) - Math.abs(b.difficulty - d))[0];
    const light = near(base.difficulty - 1, [base.key]) ?? base;
    // r12：重击卡不再因没有更难题而缺位：先多步题，再更难一档（含前序小节），都没有就用当前难度的题（倍率按难度挂钩公式自然变小）
    const heavy = rest.find(x => isMulti(x) && x.key !== base.key) ?? harder(base, [light.key]) ?? rest.find(x => !isMulti(x) && x.key !== base.key && x.key !== light.key && x.difficulty === base.difficulty) ?? base;
    return { light, std: base, heavy } as Record<CardKind, Question>;
  }, [phase, hs]);
  // 进入每个回合：高一我方先选卡；押注；其他直接出题
  useEffect(() => {
    if (phase !== 'pre' || bs.over) return;
    setCard('std'); setWager(false); setChal(false); normalQ.current = undefined; setInput(''); setMulti([]); setPicked(undefined); setFb(undefined);
    if (!pool.current.length) {   // 本关题不够撑满回合上限：重复使用已答过的题（错题优先）
      // r12 学霸：先补本关（Boss 为整单元）里本局还没出过的题（按题号 + 题干去重）；真的全部出过才重复，并记日志
      // r13 技术QA R12-3 / 策划：本关出完 → 同单元相邻小节（前面的先）→ 都出完才重复 1 道；不再清空「本局出过」
      const r = refill(used.current, reserve ?? [], adj ?? [], new Set(stats.current.wrong), chalKeys.current, repCount.current); pool.current = r.pool; used.current = r.used;
      const w = window as unknown as { __zyAdj?: number; __zyRepeats?: number };
      if (r.kind === 'adj') { if (__TEST_HOOKS__) w.__zyAdj = (w.__zyAdj ?? 0) + 1; console.info('[zy] 本关题池出完，补同单元相邻小节', r.pool.length); }
      if (r.kind === 'repeat') { if (__TEST_HOOKS__) w.__zyRepeats = (w.__zyRepeats ?? 0) + 1; console.warn('[zy] 本关和相邻小节都出完了，开始重复', used.current.length); }
      if (!pool.current.length) { exhausted.current = true; void retreat(bs); return; }   // r15：题都出满 2 次 → 怪物提前撤退，按撤退规则结算
    }
    if (hs && P && !multiRule(multiCtx()).force) { setPhase('cards'); return; }   // 必出多选的回合跳过选卡（按标准卡），保证出到
    if (bs.mode === 'j' && bs.side === 'P') { const n = take(); normalQ.current = n; hardQ.current = chalPick(n);
      // r11：出选择前就定好有没有挑战题；没有就直接出普通题，挑战按钮灰着并写明原因（不再等 3 秒、不会像被吞掉）
      if (hardQ.current) chalSeen.current = true; setChalNone(!hardQ.current); setChalWhy(hardQ.current ? '' : whyNoHarder(tierRef.current.tier)); setQ(undefined); setPhase('chal'); return; }   // 没有更难的题：挑战按钮灰着写明原因，照样等点〔普通〕
    setChalNone(false);
    setQ(reveal(take(x => P || !isMulti(x))));
    setPhase(hs && wagerOn && P ? 'bet' : 'question');   // r15.4.2：必出多步题的我方回合不选卡，但看题前照样能押注；对方回合没有押注
  }, [phase, bs.turn]);

  const cq = phase === 'revive-q' && rv ? rv.list[rv.i] : q;
  // r12（策划）：闪避题时限 = 我方回合同样的时限（按年级、计算 / 填空 ×1.5），最少 15 秒；完美闪避窗口 = 时限的一半
  const limit0 = cq ? timeLimitFor(cq, cfg.band, {}) : 0; const limit = limit0 && phase !== 'revive-q' && bs.side === 'M' ? Math.max(15, limit0) : limit0;
  const [timeLeft, setTimeLeft] = useState(limit);
  const [ttsTick, setTtsTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const asking = phase === 'question' || phase === 'revive-q';
  if (lab) lab.cur = asking ? cq : undefined;   // r17.1 BossLab（仅测试构建）
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
    const r = result(s); setPhase('anim'); if (__TEST_HOOKS__) writeBossLog(s);
    if (s.over !== 'retreat' && !played) await Promise.race([r.win ? D.dir.current?.victory() : D.dir.current?.defeat(), sleep(END_MS)]);
    if (!D.alive.current) return;
    onEnd(r);
  };
  async function retreat(s: RState) { setBs({ ...s, over: 'retreat' }); setPhase('retreat'); await sleep(1200); if (D.alive.current) void finish({ ...s, over: 'retreat' }); }
  async function play(show: () => Promise<unknown> | undefined) {
    setPhase('anim');
    try { await Promise.race([show(), sleep(1500)]); } catch { /* 动画失败不影响流程 */ }
  }
  const pickCard = (k: CardKind) => { if (!cards) return; setCard(k); setQ(reveal(cards[k])); setConsol(isConsolidating(tierRef.current) && cards[k].difficulty < tierRef.current.base); setPhase('question'); };

  function submit(val: string) {
    if (phase === 'question') setAnsSide(bs.side as 'P' | 'M');
    const qq = cq!;
    if (phase === 'revive-q' && rv) {
      const ok = val !== '' && judge(qq, qq.type === '多选' ? val.split('') : val) === 'full';
      answerFeedback(ok); const right = rv.right + (ok ? 1 : 0), tries = rv.tries + 1; setPicked(val);
      if (right >= REVIVE.need) { const ns = reviveRound(bs); D.dir.current?.recover(); setBs(ns); setView({ p: ns.playerHp, m: ns.monsterHp }); setRv(null); setFb(undefined); D.dir.current?.float(D.dir.current.r.hero, '复活！50% 血量', 'heal'); setPhase('pre'); return; }   // 学霸报告 #7：复活后直接出新题，不再停在刚答错的题上
      /* r15.3 学霸：4 次机会答对 2 道——剩下的机会已经不够答对 2 道时提前结束（规则没变），并在屏幕上说清楚，不再像是少算了一次 */
      if (tries >= REVIVE.tries || REVIVE.tries - tries < REVIVE.need - right) { reviveFailed.current = true;
        setReviveMsg(tries >= REVIVE.tries ? `复活失败：${REVIVE.tries} 次机会用完，只答对 ${right} 道` : `复活失败：剩下 ${REVIVE.tries - tries} 次机会，已经不够答对 ${REVIVE.need} 道了`);
        setRv(null); setPhase('anim'); window.setTimeout(() => { if (D.alive.current) void finish(bs); }, 2200); return; }
      setRv({ list: rv.list, i: (rv.i + 1) % rv.list.length, right, tries }); setInput(''); setMulti([]);
      return;
    }
    if (phase !== 'question') return;
    const g = val === '' ? 'wrong' : judge(qq, qq.type === '多选' ? val.split('') : val);
    const ok = g !== 'wrong';
    setPicked(val); answerFeedback(g === 'full'); setFlagged(false);
    stats.current.total++;
    // r14：挑战题、重击卡（主动 +1 档）不改动当前难度计数——只有普通出题（含闪避题）计入连对 / 连错
    if (chal && bs.side === 'P') { chalKeys.current.add(qq.key); if (g === 'full') chalRight.current++; }
    const extraHard = (chal && bs.side === 'P') || (hs && P && card === 'heavy');
    const t0 = tierRef.current; if (!extraHard) tierRef.current = nextTier(tierRef.current, g === 'full'); else if (g === 'full') tierRef.current = { ...tierRef.current, wrong: 0 }; /* r14.1 学霸：挑战 / 重击答对也打断「连错」，不然 错-挑战对-错 会降档 */ setTierNow(tierRef.current.tier);
    tierTrace.current.push({ d: qq.difficulty, ok: g === 'full', extra: extraHard, before: t0.tier, after: tierRef.current.tier }); setTierNow(tierRef.current.tier);   /* r15 学霸：顶栏显示实时当前难度 */ if (__TEST_HOOKS__) (window as unknown as { __zyTier?: unknown }).__zyTier = tierTrace.current;
    if (g === 'full') stats.current.correct++; else if (g === 'partial') { stats.current.correct += 0.5; stats.current.half++; stats.current.wrong.push(qq.key); stats.current.wrongQs.push(qq); } else {   // 漏选算 0.5（裁定 1）
     stats.current.wrong.push(qq.key); stats.current.wrongQs.push(qq); }
    onAnswer(qq, g === 'full', val);
    pool.current = pool.current.filter(x => x.key !== qq.key); if (!used.current.includes(qq)) used.current.push(qq);
    const fast = elapsed <= (limit ? limit * PERFECT_FRACTION : PERFECT_NOLIMIT_SEC);
    const [ns, o] = resolveRound(bs, c, { correct: ok, partial: g === 'partial', subject: qq.subject, difficulty: qq.difficulty, fast, card: hs && P ? card : 'std', wager: hs && P && wagerOn ? wager : false, challenge: chal && bs.side === 'P' && bs.mode === 'j', rng: lab?.rng });
    if (__TEST_HOOKS__ && bossLog.current) { bossLog.current.rounds.push(logRound(bs, ns, o, qq, { card: hs && P ? card : 'std', wager: !!(hs && P && wagerOn && wager), challenge: !!(chal && bs.side === 'P' && bs.mode === 'j'), grade: g })); writeBossLog(ns); }
    if (o.partial) tip('partial'); if (o.energyGain) tip('energy'); if (o.perfect && bs.perfectOn) tip('focus'); if (o.dodged && o.side === 'M') tip('dodge');   /* r12：「运气好闪开」只在怪物回合 */ if (o.perfect) tip('perfect'); if (o.guardUsed) tip('guard'); if (o.capped) tip('cap');
    if (o.rage) { tip('rage'); setRageAnim(true); playRageDrum(); setTimeout(() => setRageAnim(false), 1400); }
    const k = o.skill;
    /* r16.1 (y) Boss补测裁定_r17 §3：横幅小字说明这次是「幸运触发」「能量满」还是「保底触发」（同 roll 的判定，只是文案）；能量环马上显示结算后的值 */
    const skTag = k ? TRIGGER_TAG[triggerWhy(bs.sk, bs.seg, bs.energy + o.energyGain)] : undefined; setRingE(ns.energy);
    const d = D.dir.current;
    // r8b：致命一击在命中帧之后不再等受击/收招动作，直接进怪物 defeat（≤0.8 s）→ 结算
    /* r15.4.2 学霸：护盾挡掉的点数在命中时飘字显示——这一击打死怪物（直接去结算、看不到反馈文字）时也能看到 */
    const shieldFloat = () => { if (o.absorbed) setTimeout(() => D.dir.current?.float(D.dir.current.r.monster, `🛡 护盾挡掉 ${o.absorbed}`, 'soft'), 120); };
    /* r16.1 (w) Boss补测裁定_r17 §2：打穿第一阶段线时飘字说明多出的不会带到下一阶段（溢出不带入，数值不变；r17-5 文案「🚧 阶段线」） */
    const ovN = phaseOverflow(o); const guardFloat = () => { if (ovN > 0) setTimeout(() => D.dir.current?.float(D.dir.current.r.monster, guardText(ovN), 'soft'), o.absorbed ? 420 : 160); };
    let hitDone = () => {}; const hitP = new Promise<void>(r => { hitDone = r; });
    const show = k && d && o.side === 'P'   // 攻击技能：横幅 + 技能特效替代普攻演出，命中帧结算数字（≤1.5 s）
      ? async () => { await d.playSkill(k, { maxMs: 1450, tag: skTag, onImpact: () => { hitDone(); setView(v => ({ ...v, m: ns.monsterHp })); d.float(d.r.monster, `✨${k.name} ` + (o.hits.length > 1 ? o.hits.map(x => '-' + x).join(' ') : '-' + o.dealt), 'crit'); shieldFloat(); guardFloat(); } }); }   /* r15.4.2 学霸：技能打出来的数字前写技能名（预计伤害不含技能，以前看不出为什么多了） */
      : k && d ? async () => { await sleep(250); await d.playSkill(k, { maxMs: 1000, tag: skTag, onImpact: () => { setView(v => ({ ...v, p: ns.playerHp })); if (o.healed) d.float(d.r.hero, '+' + o.healed, 'heal'); } }); }   // 守护技能：闪避后 ≤1.0 s
      : o.side === 'P'
      ? ok ? () => D.dir.current?.playerAttack({ subject: qq.subject, major: c.major, dealt: o.dealt, crit: ns.combo >= 3, dodge: false, healed: o.healed, onImpact: () => { hitDone(); setView(v => ({ ...v, m: ns.monsterHp })); shieldFloat(); guardFloat(); } })
        : o.taken ? () => D.dir.current?.monsterAttack(o.taken, () => setView(v => ({ ...v, p: ns.playerHp }))) : () => sleep(500)
      : o.taken ? () => D.dir.current?.monsterAttack(o.taken, () => setView(v => ({ ...v, p: ns.playerHp }))) : () => sleep(500);
    const lethal = o.side === 'P' && ns.over === 'win';
    void play(lethal ? () => Promise.race([show(), hitP.then(() => sleep(120))]) : show).then(() => {
      if (!D.alive.current) return;
      setView({ p: ns.playerHp, m: ns.monsterHp }); setBs(ns); setRingE(null);
      const full = g === 'full';   // 漏选不算答对（策划裁定 6）：显示解析，至少停 2 秒
      setFb({ ok: full, o, partial: g === 'partial', text: (full ? '✔ 正确！' : g === 'partial' ? '◐ 漏选了！' : val === '' ? '⏰ 超时了！' : '✘ 答错了！') + o.text + (k ? ` ✨${k.name}：${k.effectText}` : '') + (o.guardUsed ? '（护体：只受 70%）' : '') });
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
  const fk = cq ? fillKind(cq, hs) : 'num'; const letters = fk === 'letters';   // r16.1：键盘按答案选（game/inputKind.ts）：纯数 → 数字键盘，字母 → 字母键盘，其余 → 系统输入法
  const tts = cq ? ttsText(cq) : '';
  const showQ = cq && !ending && (asking || phase === 'feedback' || phase === 'anim');
  const left = roundsLeft(bs);
  const curTurn = Math.min(bs.turn + (phase === 'feedback' || bs.over ? 0 : 1), bs.cap);
  return (
    <div className={`battle ${cfg.theme} ${cfg.stats} rounds side-${bs.side}`}>
      <div className="hud">
        <Bar label="❤" v={view.p} max={bs.playerMax} cls="hp" />
        {asking ? (limit ? <span className={`timer ${timeLeft <= 5 ? 'low' : ''}`} data-testid="timer">⏱ {timeLeft}s</span> : <span>⏱ 不限时</span>) : <span className="timer-slot" aria-hidden>⏱ 00s</span>}{/* r17.1 N2：选卡时给计时留位，顶栏不跳 */}
        <span data-testid="combo">连击 x{bs.combo}{comboTag && <small className="combo-tag" data-testid="combo-skill" title="技能让这次连击多 +1，前面的数字已经算进去了">含技能 +1</small>}{/* r15.4 学霸：数字已包含技能那 1 次（答对 +1、技能再 +1） */}</span>
        {bs.perfectOn && <span data-testid="focus">专注 {'◆'.repeat(bs.focus)}{'◇'.repeat(FOCUS_MAX - bs.focus)}</span>}
        {(() => { const rt = ringTag(bs.sk, bs.seg, c.major, bs.side as 'P' | 'M', ringE ?? bs.energy); return (   /* r17-6：标签「满5必放」/「答对必放」 */
        <button className={`energy-ring${rt === 'must' ? ' must' : ''}`} data-testid="energy" aria-label={`能量 ${ringE ?? bs.energy}/${ENERGY_CAP}（${RING_TAG[rt]}），点开看技能说明`} data-e={ringE ?? bs.energy} data-tag={rt} onClick={() => setRingPop(true)}>
          <svg viewBox="0 0 40 40" aria-hidden>{Array.from({ length: ENERGY_CAP }, (_, i) => { const a0 = (i / ENERGY_CAP) * 2 * Math.PI - Math.PI / 2 + 0.08, a1 = ((i + 1) / ENERGY_CAP) * 2 * Math.PI - Math.PI / 2 - 0.08;
            return <path key={i} d={`M ${20 + 16 * Math.cos(a0)} ${20 + 16 * Math.sin(a0)} A 16 16 0 0 1 ${20 + 16 * Math.cos(a1)} ${20 + 16 * Math.sin(a1)}`} fill="none" strokeWidth="5" strokeLinecap="round" stroke={i < (ringE ?? bs.energy) ? '#ffd54a' : 'rgba(255,255,255,.25)'} />; })}
            <text x="20" y="25" textAnchor="middle" fontSize="13" fill="#fff">⚡</text></svg>{ringE ?? bs.energy}/{ENERGY_CAP}<small className="ring-tag" data-testid="energy-tag">{RING_TAG[rt]}</small></button>); })()}
        <span className="grow" />
        <span data-testid="turn" className={`turn-no ${left <= 2 ? 'warn' : ''}`} aria-label={`第 ${curTurn} 回合，最多 ${Math.min(bs.cap, maxTurns)} 回合`}>第 {curTurn} 回合{maxTurns < bs.cap ? <small className="turn-note" data-testid="turn-note">（题少，最多 {maxTurns} 回合）</small> : <small className="turn-cap" data-testid="turn-cap">（最多 {bs.cap}）</small>}</span>   {/* r17.4 学霸 L1：以前「第 1 回合 / 14」像进度（要打满 14 回合），其实 14 是上限，3 回合打死就结束 → 写成「第 1 回合（最多 14）」 */}
        <span className="grow" />
        <span className="lvl-title" title={title} data-testid="lvl-title">{title}</span>
        <button className="rules-btn" aria-label="规则说明" data-testid="rules" onClick={() => setRules(true)}>？</button>
        <button className="pause-btn" aria-label="暂停" data-testid="pause" onClick={() => setPaused(true)}>⏸</button>
      </div>
      {tipNow && !(tipNow.k === 'challenge' && phase === 'chal') && <div className="first-tip" data-testid={'tip-' + tipNow.k} onClick={() => setTipNow(null)}>💡 {tipNow.t}</div>}
      {!bs.over && phase !== 'revive-ask' && phase !== 'revive-q' && <div key={P ? 'P' : 'M'} className={`side-banner ${P ? 'p' : 'm'}`} data-testid="banner" data-side={P ? 'P' : 'M'}>{P ? '⚔ 我方回合：答对就攻击！' : '🛡 对方回合：答对就闪避！'}</div>}
      <div className="arena">
        <div className="mon-info">
          <b>{kind === 'boss' ? '👑 ' : kind === 'elite' ? '⚡ ' : ''}<span data-testid="monster-name">{mon.name}</span>{bs.def.phases && ` · 第 ${phaseOf(bs) + 1} 阶段${weakOf(bs) ? `（弱点 ${weakOf(bs)}）` : ''}${bs.rage ? ' · 怒' : ''}`}</b>
          {bs.def.phases ? (() => { const f = bs.def.phases[1].hp, p0 = view.m > f; return <div className="seg-bar" data-testid="boss-bar" style={{ ['--seg' as string]: `${(f / bs.monsterMax) * 100}%` }}><Bar label="" v={view.m} max={bs.monsterMax} cls={`mhp ${p0 ? '' : 'phase2'}`} /><i className="seg-mark" aria-hidden /></div>; })()   /* r10：两阶段 Boss 一条总血条分两段，进二阶段不回满 */
            : <Bar label="" v={view.m} max={bs.monsterMax} cls="mhp" />}
          <button className={`intent intent-${nextIntent(bs)} ${il.grey ? 'grey' : ''} ${!P && asking ? 'now' : ''}`} data-testid="intent" data-intent={nextIntent(bs)} onClick={() => setIntentPop(true)} aria-label={'怪物意图：' + il.long}>
            {il.short} ⓘ{bs.shield > 0 && <span data-testid="mshield">（怪物护盾 {bs.shield}：挡你下一击）</span>}{/* r15.4 学霸：护盾是怪物挡你的攻击，不减你受到的伤害——写在标签上，免得以为能替你挡 */}</button>
          {!P && asking && <div className="intent-now" data-testid="intent-now">{il.long}</div>}
        </div>
        <div className="stage" ref={D.stage}>
          <div className="fx-shake" ref={D.shake}>
            {bs.guard && <div className="guard-badge" data-testid="guard" title="护体：下一次受伤只受 70%" aria-label="护体：下一次受伤只受 70%">🛡️</div>}
            <div className={`unit-wrap hero-wrap ${fb?.o?.dodged || fb?.o?.perfect ? 'sidestep' : ''}`} ref={D.hero}><div className="breathe"><Sprite className="unit hero" c={c} /></div></div>
            <div className={`unit-wrap mon-wrap ${kind} ${phase === 'retreat' ? 'retreating' : ''} ${rageAnim ? 'rage-pop' : ''} ${bs.rage ? 'raged' : ''}`} ref={D.monster} style={skin?.hue ? { filter: `hue-rotate(${skin.hue}deg)` } : undefined}><div className="breathe slow">{kind === 'boss' && <svg className="boss-crown in-mon" data-testid="boss-crown" viewBox="0 0 64 40" aria-hidden="true"><path d="M4 36 L8 10 L22 24 L32 4 L42 24 L56 10 L60 36 Z" fill="#ffd23f" stroke="#b8860b" strokeWidth="3" strokeLinejoin="round" /><circle cx="32" cy="26" r="4" fill="#e63946" /><circle cx="16" cy="29" r="3" fill="#4cc9f0" /><circle cx="48" cy="29" r="3" fill="#4cc9f0" /></svg>}
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
          <div className="cards card-pick" data-testid="cards"><p>选一张题卡</p><div className="row gap16">
            {(['light', 'std', 'heavy'] as CardKind[]).map(k => <button key={k} className={`qcard ${k}`} data-testid={'card-' + k} onClick={() => pickCard(k)}>
              <b>{CARDS[k].label}</b><span>{cards[k].subject}{cards[k].subject === c.major ? <em className="card-major" data-testid={'card-major-' + k}>（主修 ×1.2{PASSIVE_MATH(c) ? ` · ${shortName(c)} ×1.1` : ''}）</em> : null} · 难度 {cards[k].difficulty}{isMulti(cards[k]) ? ' · 多步题' : ''}</span>
              <small data-testid={'card-mult-' + k}>伤害 ×{CARDS[k].out} · 答错反击 ×{CARDS[k].ctr}</small>{CARDS[k].out !== 1 && <small className="card-note" data-testid={'card-note-' + k}>题越难效果越足{cardOut(CARDS[k].out, cards[k].difficulty) !== CARDS[k].out ? ` · 本题 ×${+cardOut(CARDS[k].out, cards[k].difficulty).toFixed(2)}` : ''}</small>}{/* r17.1 D15 §6.2 A：第一行基础值，第二行灰色写本题生效值 */}
              <small className="card-dmg" data-testid={'card-dmg-' + k}>本题预计伤害 ≈ {estimateDealt(bs, c, { subject: cards[k].subject, difficulty: cards[k].difficulty, card: k })}{wagerOn ? `（押注 ≈ ${estimateDealt(bs, c, { subject: cards[k].subject, difficulty: cards[k].difficulty, card: k, wager: true })}）` : ''}</small><DmgSum d={estimateInfo(bs, c, { subject: cards[k].subject, difficulty: cards[k].difficulty, card: k })} detail={false} tid={'card-sum-' + k} onCard /></button>)}   {/* r15.2 策划：高一题卡显示预计伤害（不含技能、护盾、押注；数值不变） */}
          </div></div>
        )}
        {(phase === 'cards' || phase === 'bet') && hs && wagerOn && P && <BetToggle on={wager} set={setWager} />}
        {phase === 'bet' && <div className="cards" data-testid="bet-phase"><p>这一回合是多步题</p><button className="next" data-testid="bet-go" onClick={() => setPhase('question')}>出题 ▶</button></div>}
        {phase === 'chal' && <div className="cards chal-pick" data-testid="chal-toggle" role="group" aria-label="选题难度"><p>这一回合出什么题？<small>（选好才出题、才开始计时）</small></p>
          {/* r16 技术QA P4-b：挑战题的 💡 提示放在选题区里（卡片上面一行），不再浮在「普通题」卡上挡第一下点击 */}
          {tipNow?.k === 'challenge' && <div className="first-tip inline" data-testid="tip-challenge" onClick={() => setTipNow(null)}>💡 {tipNow.t}</div>}
          <div className="row gap16">
            <button className="qcard default" data-testid="chal-normal" autoFocus onClick={() => chooseChal(false)}><b>普通题 <span className="def-tag">默认</span></b><small>照常出题</small></button>
            <button className={`qcard hot ${hardQ.current ? '' : 'grey'}`} data-testid="chal-on" aria-disabled={!hardQ.current} onClick={() => chooseChal(true)}><b>挑战题 🔥</b><small>{chalMsg || (hardQ.current ? '更难：对 ×1.5 / 错反击 ×1.5' : (chalWhy || '这一回合没有更难的题'))}</small></button>
          </div></div>}
        {showQ && <>
          {phase === 'revive-q' && <div className="revive-banner">复活挑战：答对 2 题（已对 {rv?.right ?? 0}，剩 {REVIVE.tries - (rv?.tries ?? 0)} 次机会）</div>}
          <div className="qmeta"><span className="qmeta-txt">{review?.includes(cq.key) && <span className="review-tag" data-testid="review-tag">复习</span>}{phase !== 'revive-q' && (P ? '⚔ 攻击题' : '🛡 闪避题')} · {cq.subject} · {cq.type} · 难度{cq.difficulty}{phase !== 'revive-q' ? <span data-testid="tier-now">（当前难度 {tierNow || tierRef.current.tier}{(tierNow || tierRef.current.tier) >= tierCap(tierRef.current.base) ? '，普通题最高' : ''}{cq.difficulty > (tierNow || tierRef.current.tier) ? (chal || card === 'heavy' ? '，这题难一档' : overRef.current ? `，这${kind === 'boss' ? '一章' : '一关'}难度 ${tierNow || tierRef.current.tier} 及以下的题这局都出过了，这题更难` : '') : cq.difficulty < (tierNow || tierRef.current.tier) ? '，这题更容易' : ''}）</span> : null}{hs && P && phase !== 'revive-q' ? ` · ${CARDS[card].label}` : ''}{wager && P && phase !== 'revive-q' ? ' · 押注' : ''}{chal && P && phase !== 'revive-q' && <span className="chal-tag" data-testid="chal-tag"> · 🔥 挑战题</span>}{/* r15.3 学霸：选了普通题后，题卡标题不再写「挑战题 · 这一回合没有更难的题」 */}
            {cq.status !== '已通过' && cq.status !== 'AI初审通过' && <span className="pending">{cq.status}</span>}
            </span>{tts && (cfg.manualTTS || isEn) && <button className="mini" aria-label="朗读" data-testid="tts" onClick={() => speak(tts, isEn ? 'en' : 'zh-CN')}>🔊</button>}</div>
          {P && phase === 'question' && (() => { const inp = { subject: cq.subject, difficulty: cq.difficulty, card: hs ? card : 'std' as CardKind, wager: hs && wagerOn ? wager : false, challenge: chal && bs.mode === 'j' }; const est = estimateDealt(bs, c, inp), raw = bs.shield > 0 ? estimateDealt({ ...bs, shield: 0 }, c, inp) : est;
            /* r15.4.1 学霸：有护盾时写明「护盾挡掉 n」——预计伤害一直是挡完以后的数，以前只写「已含护盾」，看起来像护盾没挡 */
            const ov = estimateOverflow(bs, c, inp);
            return <small className="q-dmg" data-testid="q-dmg" data-raw={raw} data-est={est} data-over={ov}>本题答对预计伤害 ≈ {est}{ov > 0 && <b data-testid="q-dmg-phase">（{phaseCapText(est)}）</b>}{raw > est && <b data-testid="q-dmg-shield">（护盾挡掉 {raw - est}，没有护盾是 {raw}）</b>}<em className="q-dmg-sk" data-testid="q-dmg-sk">技能另算</em><span className="hint">（已含连击{hs ? '、押注' : ''}{bs.mode === 'j' ? '、挑战' : ''}、被动、护盾；技能触发时另外乘）</span><DmgSum d={estimateInfo(bs, c, inp)} detail={false} tid="q-sum" /></small>; })()}   {/* r15.3 学霸：和 resolveRound 同一套结算 */}
          {consol && showConsolidateTag(cfg.band) && phase !== 'revive-q' && <span className="consol-tag" data-testid="consol-tag">巩固题</span>}
          <div className="qtext" data-ans={import.meta.env.DEV || (__TEST_HOOKS__ && (window as unknown as { __zyTest?: boolean }).__zyTest) ? cq.answer[0] : undefined}><Tex text={cq.question} /></div>
        </>}
        {asking && cq && cq.type === '多选' && (
          <div className="opts">
            {cq.options.map(ch => <button key={ch.key} className={`opt ${multi.includes(ch.key) ? 'sel' : ''}`} aria-pressed={multi.includes(ch.key)} data-testid={'opt-' + ch.key} data-correct={TEST_DOM ? (cq.answer.includes(ch.key) ? '1' : '0') : undefined}
              onClick={() => setMulti(m => m.includes(ch.key) ? m.filter(x => x !== ch.key) : [...m, ch.key].sort())}><i>{multi.includes(ch.key) ? '✔' : ch.key}</i><span className="opt-txt"><Tex text={ch.text} /></span></button>)}
            <button className="next multi-ok" disabled={!multi.length} data-testid="ok" onClick={() => submit(multi.join(''))}>确定（多选）</button>
          </div>
        )}
        {asking && cq && (cq.type === '选择' || cq.type === '判断') && (
          <div className={`opts ${cq.type === '判断' ? 'tf' : ''}`}>
            {choicesOf(cq).map(ch => <div key={ch.key} className="opt-wrap">
              <button className="opt" data-testid={'opt-' + ch.key} data-correct={TEST_DOM ? (cq.answer.includes(ch.key) ? '1' : '0') : undefined} onClick={() => submit(ch.key)}>
                {cq.type === '选择' && <i>{ch.key}</i>}<QImage image={ch.image} cls="opt-img" fallback={<span className="opt-txt"><Tex text={ch.text} /></span>} /></button></div>)}
          </div>
        )}
        {asking && cq && cq.type === '填空' && <Keypad key={cq.key} letters={letters} ime={fk === 'ime'} sci={hs} value={input} onChange={setInput} onOk={v => submit(v)} />}
        {reviveMsg && <div className="feedback bad" data-testid="revive-fail"><h3>{reviveMsg}</h3></div>}
        {phase === 'anim' && !ending && !falling && !reviveMsg && <div className="anim-wait" data-testid="anim">⚔ 战斗中…</div>}
        {phase === 'retreat' && <div className="feedback ok" data-testid="retreating"><h3>回合用完，怪物撤退了！</h3></div>}
        {phase === 'feedback' && fb && cq && (
          <div className={`feedback ${fb.ok ? 'ok' : 'bad'}`} data-testid="feedback">
            <h3>{fb.text}{fb.o?.dealt ? ` 造成 ${fb.o.hits.length > 1 ? fb.o.hits.join('+') : fb.o.dealt}` : ''}{fb.o?.taken ? ` · 受到 ${fb.o.taken}${hurtNote(fb.o)}` : ''}{fb.o?.healed ? ` · 回复 ${fb.o.healed}` : ''}{fb.o?.energyGain ? ` · 能量 +${fb.o.energyGain}${fb.o.bet && fb.o.energyGain >= 2 ? '（含押注额外 +1）' : ''}` : ''}</h3>
            {fb.o?.dmg && fb.o.dealt > 0 && <DmgSum d={fb.o.dmg} dealt={fb.o.dealt} absorbed={fb.o.absorbed} />}   {/* r16 D15：加成摘要 + 明细（原来的长括号说明删掉） */}
            {!fb.ok && <>
              {picked && <p>你的答案：{cq.type === '选择' || cq.type === '多选' ? picked.split('').map(k => <span key={k}>{k}. <Tex text={cq.options.find(o => o.key === k)?.text ?? ''} />　</span>) : picked}</p>}
              <p>正确答案：<b><Tex text={correctText(cq)} /></b></p>
              {/* r14.1 学霸：多选因多选了错误选项而错时，点名是哪几个 */}
              {picked && cq.type === '多选' && (() => { const ex = picked.split('').filter(k => !cq.answer.includes(k)); const miss = cq.answer.filter(k => !picked.includes(k));
                return ex.length || miss.length ? <p className="expl" data-testid="multi-why">{ex.length ? <>多选了不该选的：{ex.map(k => <span key={k}>{k}. <Tex text={cq.options.find(o => o.key === k)?.text ?? ''} />　</span>)}</> : null}{miss.length ? <>{ex.length ? '；' : ''}漏选了：{miss.map(k => <span key={k}>{k}. <Tex text={cq.options.find(o => o.key === k)?.text ?? ''} />　</span>)}</> : null}</p> : null; })()}
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
              <button className="btn" data-testid="revive-yes" onClick={() => { setRv({ list: (() => { const f = unseenOf([...pool.current, ...priorQs.current.filter(x => x.difficulty <= tierRef.current.tier), ...(reserve ?? []), ...(adj ?? []).flat()]).filter(x => !isMultiSel(x)).filter((x, i, arr) => arr.findIndex(y => y.key === x.key) === i && !chalKeys.current.has(x.key)).sort((a, b) => +revSet.has(a.key) - +revSet.has(b.key)).slice(0, REVIVE.tries);   /* r15.1 R15-2：复活题非复习优先 */ f.forEach(reveal);   /* r14 技术QA R13-2：按题号去重，不够 4 道才补本局错题 */
                const capOk = (x: Question) => (repCount.current.get(x.key) ?? 0) < REPEAT_CAP - 1 && !chalKeys.current.has(x.key) && !isMultiSel(x);   /* r15：复活题重复也受「一局最多 2 次」限制，错题先 */
                const w0 = [...stats.current.wrongQs, ...used.current].filter((x, i, arr) => arr.findIndex(y => y.key === x.key) === i && !f.some(y => y.key === x.key) && capOk(x));
                const out = [...f, ...w0].slice(0, REVIVE.tries); out.filter(x => !f.includes(x)).forEach(x => repCount.current.set(x.key, (repCount.current.get(x.key) ?? 0) + 1)); return out; })(), i: 0, right: 0, tries: 0 })   /* r12：复活题也走本局去重（不再复用出过的题） */; setPhase('revive-q'); setInput(''); setMulti([]); setPicked(undefined); }}>挑战复活</button>
            </div></div>
        )}
      </div>
      {ringPop && <Modal onClose={() => setRingPop(false)}><h2>⚡ 能量与技能</h2>
        <SkillDetail seg={bs.seg} major={c.major} testid="ring-pop" cdLeft={bs.sk.cd} />   {/* r17-1：和角色卡〔技能详情〕同一个组件 / 同一份文案（含 r17-4 共用触发行、高中冷却行） */}
        <button className="btn" data-testid="ring-ok" onClick={() => setRingPop(false)}>知道了</button></Modal>}
      {intentPop && <Modal onClose={() => setIntentPop(false)}><h2>怪物意图</h2><p className="intent-long" data-testid="intent-pop">{il.long}</p>
        <p className="hint">⚔ 攻击 · ⚡ 蓄力（下次重击 ×2）· 💥 重击 · 🛡 护盾</p>
        <button className="btn" data-testid="intent-ok" onClick={() => setIntentPop(false)}>知道了</button></Modal>}
      {rules && <Modal onClose={() => setRules(false)}><h2>规则说明</h2>
        <ol className="rules-list" data-testid="rules-pop">{rulesFor(bs.mode, kind).map((r, i) => <li key={i}><b>{r[0]}</b>：{r[1]}</li>)}</ol>
        <button className="btn" data-testid="rules-ok" onClick={() => setRules(false)}>知道了</button></Modal>}
      {betHint && (phase === 'cards' || phase === 'bet') && <Modal onClose={closeBetHint}><h2>新玩法：押注</h2>
        <BetHintList />
        <button className="btn" data-testid="bet-hint-ok" onClick={closeBetHint}>知道了</button></Modal>}
      {paused && <PauseOverlay onResume={() => setPaused(false)} onQuit={quitNow} />}
      {__TEST_HOOKS__ && (window as unknown as { __zyBossLab?: boolean }).__zyBossLab && <div data-testid="bosslog-export" style={{ position: 'fixed', left: 4, bottom: 4, zIndex: 60, display: 'flex', gap: 4, fontSize: 12 }}>   {/* r17.1：仅测试构建 + __zyBossLab：导出本场日志 */}
        <button style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => exportBossLog('json')}>导出 JSON</button><button style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => exportBossLog('csv')}>导出 CSV</button></div>}
    </div>
  );
}

/** r15.4.3 学霸：主修科目外层加成（不算在 ×1.8 封顶里）：×1.2，阿算 / 算算数学再 ×1.1 */
const PASSIVE_MATH = (c: { major: string }) => c.major === '数学';
/** r15.4.3 学霸：反击倍率明细「（18 × 轻击卡 ×0.8 × 押注 ×1.25 = 18）」；没有额外倍率就不写 */
/* r15.4.4 学霸：每个倍率都写来源，基础也写明「基础 18 × 轻击卡 ×0.8 × 押注 ×1.25 = 18」 */
const fmtM = (m: number) => String(Math.round(m * 100) / 100);
export function hurtNote(o: ROut) { const h = o.hurtInfo; if (!h || !h.parts.length || !o.taken) return '';
  const prod = h.parts.reduce((a, [, m]) => a * m, 1);
  return `（基础 ${h.base}${h.parts.map(([n, m]) => ` × ${n} ×${fmtM(m)}`).join('')}${prod > HURT_CAP + 1e-9 ? `，最多 ×${HURT_CAP}` : ''} = ${o.taken}）`; }
/** r15.4.4 学霸：加成到顶时逐项写来源「（加成：连击2 ×1.1 × 重击卡 ×1.6 × 押注 ×1.25 = ×2.20，已到上限，按 ×1.8 算）」 */
export function capNote(o?: ROut) { const c = o?.capInfo; if (!c) return '';
  const ps = c.parts?.length ? `${c.parts.map(([n, m]) => `${n} ×${fmtM(m)}`).join(' × ')} = ` : '';
  return `（加成${ps ? '：' + ps : ' '}×${c.raw.toFixed(2)}，已到上限，按 ×${c.used} 算）`; }
/** r15.4.2 游戏策划：押注开关（我方回合看题前，题卡旁边，默认关，点一下就押） */
export const BET_LABEL = '押注：答对伤害 ×1.25，能量额外 +1；答错反击 ×1.25，且不能闪避';   // r15.4.3 学霸：押对能量 = 基础 +1 + 押注额外 +1
/** r15.4.3：第一次出押注开关时的说明弹窗（每个档案 1 次，点〔知道了〕才算看过） */
export const BET_RESET = '每回合重新选';   // r15.4.3 策划：开关每回合自动回到「关」（行为不变），写明
export const BET_HINT_LINES = [
  '题卡下面有个「押注」开关，默认是关的；有把握就点一下打开。每回合重新选。',
  '押了：答对伤害 ×1.25，能量额外 +1；答错（半对也算错）反击 ×1.25，而且闪不开。',
  '押注的 ×1.25 也算在「加成上限 ×1.8」里。',
  '不押就照常答题，答错还有机会闪开。',
];
export const BET_HINT = BET_HINT_LINES.join('');
function BetToggle({ on, set }: { on: boolean; set: (f: (x: boolean) => boolean) => void }) {
  return <div className="bet-wrap" data-testid="bet-wrap"><button className={`bet-toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} data-testid="bet-toggle" data-on={on ? '1' : '0'} onClick={() => set(x => !x)}>
    <span className="bt-sw" aria-hidden><span className="bt-knob" /></span><span className="bt-label">{BET_LABEL}</span></button>
    <small className="bet-reset" data-testid="bet-reset">{BET_RESET}</small>
</div>;
}

/** r16 技术QA P4-a：押注说明——矮横屏缩小字号（样式写在 .bet-hint-pop 上，以前写成 .bet-hint 没生效）；还装不下时列表内滚动，并显示「往下滑还有」 */
function BetHintList() {
  const ref = useRef<HTMLUListElement>(null); const [more, setMore] = useState(false);
  useEffect(() => { const el = ref.current; if (!el) return; const chk = () => setMore(el.scrollHeight > el.clientHeight + 2 && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    chk(); el.addEventListener('scroll', chk, { passive: true }); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(chk) : null; ro?.observe(el);
    return () => { el.removeEventListener('scroll', chk); ro?.disconnect(); }; }, []);
  return <><ul ref={ref} className={`rules-list bet-hint-pop ${more ? 'has-more' : ''}`} data-testid="bet-hint">{BET_HINT_LINES.map((t, i) => <li key={i}>{t}</li>)}</ul>
    {more && <small className="bet-hint-more" data-testid="bet-hint-more" aria-hidden="true">↓ 往下滑还有</small>}</>;
}
