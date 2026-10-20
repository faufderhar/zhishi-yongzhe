import { roundModeOf } from './game/rounds';
import { claimTab, onTabActive, isActiveTab } from './tabGuard';
import { launchCause, markAlive, beat, setSafeScreen, logReload } from './swUpdate';
import { bonusShown, effBonus, tickGrace, GRACE_MS, GRACE_VOICE, clampUsageAdd, graceBudgetMs, limitMinutes } from './game/playtime';
import { withBossFirst } from './game/bossUsage';
import { netCheck, pendingDays, pendingWaitedMs, PEND_DAYS, tickPending, resumePending, pendingDue, pendingLeftMs, writeRec, findRec, findVault, vaultOf, writeLocal, writeCache, resetDue, newPending, fmtWhen, type PinVault } from './game/pinVault';
import { GRADE_LABEL, type GradeKey } from './game/questions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './app.css';
import { loadFxManifests } from './fx/assets';
import { prefetchAll } from './fx/sheets';
import { cacheForOffline, cacheVoiceForOffline } from './offlineCache';
import { multiBand, isMultiSel } from './game/multi';
import { stageOf, needsGate, defaultPick, type StageId } from './game/stages';
import { StagePick, GradePick } from './ui/StagePick';
import { STORAGE_ERROR, deleteProfileData, compactAnswers, getKV, setKV } from './db';
import { DESIGN } from './game/config';
import { setAudioPrefs } from './tts';
import { loadAllBanks, questionsOfGrade, type BankState } from './bankStore';
import { syncNewVolumes, volLabel } from './game/volumes';
import { playable, isBossOnly, shuffle, qRev, type Question } from './game/questions';
import { bandConfig, timePrefs } from './game/grades';
import { starOf, retreatCleared, buildChapters, levelStars, chalCostStar, bossPool, elitePool, assignedBefore, capMulti, lessonRank, levelsOfUnit, migrateStars, type Level } from './game/levels';
import { selectQuestions, spreadTemplates, spaceReviews, noAdjacent, stemOf, updateSkill, type Skills } from './game/adaptive';
import { onWrong, onReviewRight, isDue, dayStr, addDays, type WrongEntry } from './game/wrongbook';
import { remainingSec, addUsage, type Usage } from './game/playtime';
import { PUPS, SCIFI, type Character } from './game/characters';
import { unlockAudio, speak, registerPrompts, afterVoiceThen, setKinderSpeech } from './tts';
import { PROMPT_BY_TEXT } from './game/voicePrompts';
registerPrompts(PROMPT_BY_TEXT);   // r15.4：共用提示语录音退路
import { recordAnswer, wrongOf, putWrong, delWrong, answersOf } from './db';
import * as S from './state';
import type { Profile, Progress, Settings } from './state';
import { KinderTutorial, StdTutorial } from './ui/Tutorial';
import { RoundBattle } from './ui/RoundBattle';
import { KinderBattle, StdBattle, FORCE_END, Sprite, type BattleResult } from './ui/Battle';
import { usePhonePortrait, RotateOverlay } from './ui/Rotate';
import { ProfileSelect, CharSelect, MapScreen, ResultScreen, WrongBookScreen, ReviewSession } from './ui/Screens';
import { ParentGate, ParentSettings } from './ui/Parent';
import { ResetWhy, ResetCancelBox, CANCEL_BTN } from './ui/ResetCancel';
import { logNav, logErr } from './navLog';
import { battlePaused, rotateLock, isRestoring } from './runtimeFlags';

type Interrupted = { levelId: string; name: string; pid?: string; upd?: boolean; n?: number; cause?: string };
type Nav = { pid: string; grade?: GradeKey; s: string; level?: string; name?: string; at: number; bv?: string };
const BAL_VER = 'v0.3.8';   // D14 数值版本：旧版本中断的战斗提示「数值更新了」
const NAV_KEY = 'zy-nav';
/** r11：「没打完」按孩子分开记（zy-run-<档案id>）：进关写入、正常离开战斗就删；以前只有一条全局记录，别的孩子玩过就被覆盖 / 串到别人那里 */
type RunRec = { levelId: string; name: string; at: number; bv?: string; n: number };
const RUN = (pid: string) => 'zy-run-' + pid;
const readRun = (pid: string): RunRec | null => { try { const v = JSON.parse(localStorage.getItem(RUN(pid)) ?? 'null'); return v && typeof v.levelId === 'string' ? v : null; } catch { return null; } };
const writeRun = (pid: string, r: RunRec | null) => { try { if (r) localStorage.setItem(RUN(pid), JSON.stringify(r)); else localStorage.removeItem(RUN(pid)); } catch { /* */ } };
function readNav(): Nav | null { try { const v = JSON.parse(localStorage.getItem(NAV_KEY) ?? 'null'); return v && typeof v.pid === 'string' && typeof v.at === 'number' ? v : null; } catch { return null; } }
function writeNav(n: Nav | null) { try { if (n) localStorage.setItem(NAV_KEY, JSON.stringify(n)); else localStorage.removeItem(NAV_KEY); } catch { /* */ } }

type Screen =
  | { s: 'loading' } | { s: 'profiles'; adding?: boolean } | { s: 'gate'; next?: 'add' | 'pick'; pick?: string } | { s: 'parent' }
  | { s: 'stage' } | { s: 'grade'; stage: StageId } | { s: 'gate-grade'; g: GradeKey }
  | { s: 'map' } | { s: 'char'; then?: Level } | { s: 'battle'; level: Level; qs: Question[]; extra: Question[]; prior?: Question[]; reserve?: Question[]; adj?: Question[][]; review?: string[]; prevStem?: string; nonce: number }
  | { s: 'result'; level: Level; r: BattleResult; stars: number; mastered: number; best?: number; prevBest?: number; capped?: boolean; playN?: number }
  | { s: 'wrongbook' } | { s: 'review'; qs: Question[]; nonce: number } | { s: 'review-done'; right: number; total: number };

const parentReloadNote = (kind: string) => `刚才在家长设置里：${CAUSE_TEXT[kind] ?? '页面被重新加载了'}。请重新进入家长设置。`;
const CAUSE_TEXT: Record<string, string> = { discarded: '浏览器为了省内存把页面回收了（不是游戏自己退出的）', sw: '游戏在更新版本时刷新了', reload: '页面被重新加载了（下拉刷新或浏览器重载）', crash: '页面崩溃或内存不足被浏览器重启了（不是游戏自己刷新的，已记录）', restore: '刚才从备份恢复 / 合并 / 撤销后重新打开了', tab: '在这个标签页点了「在这里继续」，重新打开了', navigate: '答题中途游戏被关掉了（平板把切到后台的游戏关掉）' };
const EXIT_TEXT: Record<string, string> = { quit: '刚才在暂停里点了〔回地图〕，还没答题，所以没有结算。', timeup: '今天的游戏时间用完了，关卡已结束。' };
/* r15 学霸：选角色页（幼儿园以外）也列出另一套角色；这里必须同样接受，否则高一选「算算」后角色为空，点关卡永远跳回选角色 */
const allowedChars = (g: GradeKey) => { const c = bandConfig(g); const own = c.chars === 'scifi' ? SCIFI : PUPS; return c.band === 'K' ? own : [...PUPS, ...SCIFI]; };
export default function App() {
  const [screen, setScreen0] = useState<Screen>({ s: 'loading' });
  const phonePortrait = usePhonePortrait();   // r15.4.2 技术QA P1-1
  // r13 学霸：页面跳转日志 zy.navLog（from / to / reason / stack / 时间），只留最近 80 条，用来查「答题中被踢回首页」
  const screenRef = useRef<Screen>(screen); screenRef.current = screen;
  // r14：用户意图令牌——每次真实点按 +1；自动导航（启动恢复）和异步结果在用户点过之后一律作废，不能覆盖更新的导航
  const [tabActive, setTabActive] = useState(isActiveTab()); useEffect(() => onTabActive(setTabActive), []);
  const lastInput = useRef(0);
  const userGen = useRef(0); const pickGen = useRef(0); const [booted, setBooted] = useState(false);
  useEffect(() => { const f = (e: Event) => { if (e.isTrusted) { userGen.current++; lastInput.current = Date.now(); } }; window.addEventListener('pointerdown', f, true); window.addEventListener('keydown', f, true); return () => { window.removeEventListener('pointerdown', f, true); window.removeEventListener('keydown', f, true); }; }, []);
  const [exitNote, setExitNote] = useState<string>();   // r13：任何「离开关卡 / 回到首页」都在首页 / 地图上写明原因
  const setScreen = (to: Screen, reason = '') => { const from = screenRef.current.s; logNav(from, to.s, reason || to.s);
    if ((from === 'battle' || from === 'review') && !['result', 'review-done', 'battle', 'review'].includes(to.s)) setExitNote(EXIT_TEXT[reason] ?? `刚才离开了关卡（${reason || '未知原因'}）`);
    screenRef.current = to; setScreen0(to); beat(to.s); setSafeScreen(['profiles', 'stage', 'grade', 'map', 'loading'].includes(to.s) && to.s !== 'loading'); };
  const [loadPct, setLoadPct] = useState(0);
  const [bank, setBank] = useState<BankState | null>(null);
  const [settings, setSettingsState] = useState<Settings>(S.DEFAULT_SETTINGS);
  const [profiles, setProfilesState] = useState<Profile[]>([]);
  const [pid, setPid] = useState<string>();
  const [progress, setProgress] = useState<Progress>(S.emptyProgress());
  const [skills, setSkills] = useState<Skills>({});
  const [allSkills, setAllSkills] = useState<Record<string, Skills>>({});
  const [usage, setUsageAll] = useState<Record<string, Usage>>({});
  const usageRef = useRef(usage); usageRef.current = usage;
  const [wrong, setWrong] = useState<WrongEntry[]>([]);
  const [recentRight, setRecentRight] = useState<Set<string>>(new Set());
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set());
  const lastAnswered = useRef<{ pid: string; q: Question } | undefined>(undefined);   // r15.3：上一局最后答的题（下一局开头避开同题干）   // 出过的题（Boss 选题优先没出过的）
  const [flags, setFlags] = useState<Record<string, number>>({});
  const [chapterIdx, setChapterIdx] = useState(0);
  const [portrait, setPortrait] = useState(false);
  const masteredThisLevel = useRef(0);
  useEffect(() => { setAudioPrefs({ sfx: settings.sfx ?? true, tts: settings.tts ?? true, volume: settings.volume ?? 0.8 }); }, [settings.sfx, settings.tts, settings.volume]);
  timePrefs.lenient = !!settings.lenientTime;   // 渲染期同步，战斗内 timeLimitFor 直接读
  const [clock, setClock] = useState<S.ClockState>({ maxSeen: 0, locked: false });
  const [storageErr, setStorageErr] = useState<string>();
  const [updateReady, setUpdateReady] = useState<null | (() => void)>(null);
  const [tipGone, setTipGone] = useState(false);
  // r15.4.2 技术QA：竖屏提示条只是提示——点击穿透（CSS pointer-events:none）；动画被「减少动效」关掉或 animationend 没来时 7 秒后也一定移除
  useEffect(() => { if (!portrait || tipGone) return; const t = setTimeout(() => setTipGone(true), 7000); return () => clearTimeout(t); }, [portrait, tipGone]);
  // 写入失败提示（技术QA P1-4）、新版本提示（P1-7：不在战斗中自动刷新）
  useEffect(() => {
    const f = (e: Event) => setStorageErr(String((e as CustomEvent).detail ?? ''));
    const u = (e: Event) => setUpdateReady(() => (e as CustomEvent).detail as () => void);
    window.addEventListener(STORAGE_ERROR, f); window.addEventListener('zy-update-ready', u);
    void navigator.storage?.persist?.().catch(() => {});   // P1-5：申请持久化存储
    return () => { window.removeEventListener(STORAGE_ERROR, f); window.removeEventListener('zy-update-ready', u); };
  }, []);

  // 每次启动检查一次：超过 180 天 / 5000 条的答题明细先按 档案×科目×月 汇总再删（技术QA P2-5）
  const compacted = useRef(false);
  useEffect(() => {
    if (!bank || compacted.current || !profiles.length) return; compacted.current = true;
    for (const pp of profiles) void compactAnswers(pp.id, r => bank.byKey.get(r.questionId)?.subject ?? '其他');
  }, [bank, profiles]);
  const reloadBank = useCallback(async () => { setBank(await loadAllBanks((d, t) => setLoadPct(Math.round(d / t * 100)))); }, []);
  useEffect(() => { void loadFxManifests(); }, []);
  useEffect(() => {
    (async () => {
      const [st, ps, fl, ck] = await Promise.all([S.loadSettings(), S.loadProfiles(), S.loadFlags(), S.loadClock()]);
      let ck2 = S.checkClock(ck, Date.now());
      // r11：任何一份密码副本还在就自动恢复
      let st2 = st; if (!st.pinHash) { const v = await findVault(st, ps); if (v) { st2 = { ...st, pinHash: v.pinHash, pinHint: v.pinHint ?? st.pinHint, pinRec: v.recHash ?? st.pinRec }; void S.saveSettings(st2); } }
      if (!st2.pinRec) { const rh = await findRec(st2, ps, getKV); if (rh) { st2 = { ...st2, pinRec: rh }; void S.saveSettings(st2); } }   // r12 R11-3：恢复码独立副本
      if (st2.pinRec) void writeRec(st2.pinRec, setKV);
      settingsRef.current = st2; profilesRef.current = ps; setSettingsState(st2); setProfilesState(ps); setFlags(fl); if (st2.pinHash) mirrorPin(vaultOf(st2));
      const us: Record<string, Usage> = {}, sk: Record<string, Skills> = {};
      for (const p of ps) { us[p.id] = await S.loadUsage(p.id); sk[p.id] = await S.loadSkills(p.id); }
      // D8：今天早于时长记录里最大的日期 → 也算时间被调回
      const maxDay = Object.values(us).flatMap(u => Object.keys(u)).sort().pop();
      // r14.1：时长记录里比今天晚 1 天以上的日期 = 别人调快过时钟留下的，作废（删掉、记日志），不上锁；只晚 1 天以内仍按「时间被调回」上锁
      /* r15 技术QA R141-1：日期往回走不再删「未来」日期的用时记录（以前关着游戏调回 >24 小时会把今天已用时间清掉） */
      if (ck2.staleReset) logErr('stale-clock', new Date(ck2.staleReset).toISOString());
      const maxDay2 = Object.values(us).flatMap(u => Object.keys(u)).sort().pop();
      void maxDay; void maxDay2;   // r14.2 小萌新：不再用本地日期字符串判定调钟——时区从 PT 换成北京时间再换回来，「明天」的记录会让每个档案都被锁
      setClock(ck2); void S.saveClock(ck2);
      // 切回前台时也检查（D8）
      document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') return; setClock(c => { const n = S.checkClock(c, Date.now()); if (n !== c) void S.saveClock(n); return n; }); });
      setUsageAll(us); setAllSkills(sk);
      await reloadBank();
      // r14：启动是一条串行流程——先决定要不要「回到原来的地图」，决定完、做完才显示首页；在此之前一直是加载页（没有可点的头像）
      // r9：页面被重新加载（新版本刷新、平板清理后台）后回到原来的孩子与地图；战斗中被打断的给出提示，不再静默丢进度
      const cause0 = launchCause(); markAlive(); if (cause0.kind !== 'navigate') console.info('[zy] 启动原因', cause0);
      const runs: Record<string, Interrupted> = {};
      const endAt = (id: string) => { try { return (JSON.parse(localStorage.getItem('zy.lastEnd:' + id) ?? 'null') as { at: number } | null)?.at ?? 0; } catch { return 0; } };
      for (const x of ps) { const r = readRun(x.id); if (r && r.at <= endAt(x.id)) { writeRun(x.id, null); continue; }   // r14.1 学霸：关卡其实已经结算（例如另一个标签页 / 结算后才重载）——不再显示「已答 N 题、星星没算」
        if (r && Date.now() - r.at < 12 * 3600e3) runs[x.id] = { levelId: r.levelId, name: r.name, pid: x.id, upd: r.bv !== BAL_VER, n: r.n, cause: cause0.kind }; else if (r) writeRun(x.id, null); }
      setInterruptedAll(runs);
      { const r0 = Object.values(runs)[0];   // 首页不点名（「没打完」详情只给本人，在自己的地图上显示）
        if (r0) setExitNote(`有一关没有打完就离开了：${CAUSE_TEXT[r0.cause ?? 'navigate']}。点自己的头像进入地图可以看到详情。`); }
      const nav = readNav();
      const pp = nav && ps.find(x => x.id === nav.pid);
      const swReload = (() => { try { const v = sessionStorage.getItem('zy-sw-reload'); sessionStorage.removeItem('zy-sw-reload'); return !!v; } catch { return false; } })();
      // r14 较真家长：在家长设置 / 密码页里被重载（选备份文件时浏览器回收页面、崩溃）——不要「恢复」到孩子的学段 / 选角色页，回首页并说明
      const beat0 = (() => { try { return JSON.parse(localStorage.getItem('zy.beat') ?? 'null') as { screen: string; at: number } | null; } catch { return null; } })();
      const inParent = !['navigate', 'restore', 'tab'].includes(cause0.kind) && !!beat0 && ['parent', 'gate', 'gate-grade'].includes(beat0.screen) && Date.now() - beat0.at < 30 * 60e3;
      if (inParent) setExitNote(parentReloadNote(cause0.kind));   // r16.2 较真家长：以前「…页面被重新加载了：页面被重新加载了（…）」说两遍
      if (!inParent && nav && pp && Date.now() - nav.at < 2 * 3600e3 && nav.s !== 'profiles') {
        // r13：不只新版本刷新——浏览器回收 / 崩溃重载 / 下拉刷新后（30 分钟内）也直接回到原来的孩子和地图，并在地图上说明原因，不再一声不响停在首页
        if (swReload || (cause0.kind !== 'navigate' && Date.now() - nav.at < 30 * 60e3) ) restoreRef.current = { nav, pp };
      }
      const r = restoreRef.current; const g0 = userGen.current;
      if (r) {
        try {
          await new Promise(res => setTimeout(res, 0));   // 等上面 setProfiles / setSettings 生效，再用最新一轮渲染的函数（闭包里的旧 profiles 会把档案写空）
          await latest.current.pickProfile(r.pp, true, 'restore');
          await new Promise(res => setTimeout(res, 0));
          const g = r.nav.grade && !needsGate(r.pp.grade, r.nav.grade) ? r.nav.grade : r.pp.grade;   // 非档案年级不自动恢复：仍要家长确认
          if (userGen.current === g0 && ['map', 'battle', 'result', 'char', 'wrongbook', 'review', 'review-done'].includes(r.nav.s)) latest.current.enterGrade(g, false, r.pp);
        } catch (e) { console.warn('[zy] 恢复位置失败', e); }
        restoreRef.current = null;
      }
      if (screenRef.current.s === 'loading') setScreen({ s: 'profiles' }, 'startup');
      setBooted(true);
    })();
    const f = () => setPortrait(window.innerHeight > window.innerWidth);
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, [reloadBank]);

  const [lastPid, setLastPid] = useState<string>(); const addedPid = useRef<string | undefined>(undefined); const [pinNudge, setPinNudge] = useState<Profile | null>(null);
  const restoreRef = useRef<{ nav: Nav; pp: Profile } | null>(null);
  const [interruptedAll, setInterruptedAll] = useState<Record<string, Interrupted>>({});
  const interrupted = pid ? interruptedAll[pid] ?? null : null;   // 只给当前孩子
  const setInterrupted = (_: null) => { if (pid) setInterruptedAll(m => { const n = { ...m }; delete n[pid]; return n; }); };
  const p0 = profiles.find(x => x.id === pid);
  // r8b：两级入口选的年级（默认档案年级）；非档案年级不带档案的教材册别
  /* r15.3 学霸：「初一同学 · 在玩高一的关卡」——选档案时先 setPid、等读完数据才清掉上一个孩子正在看的年级，中间这段（以及这时写下的「上次位置」、
     页面更新后按它恢复）新档案会带着上一个孩子的年级。现在看的年级记在「哪个孩子」名下，换了孩子就不算数 */
  const [viewGradeOf, setViewGradeOf] = useState<{ pid: string; g: GradeKey } | undefined>();
  const viewGrade = viewGradeOf && p0 && viewGradeOf.pid === p0.id ? viewGradeOf.g : undefined;
  const pidRef = useRef(pid); pidRef.current = pid;
  const setViewGrade = (g: GradeKey | undefined, id = pidRef.current) => setViewGradeOf(g && id ? { pid: id, g } : undefined);
  const vg = p0 ? viewGrade ?? p0.grade : undefined;
  const vChars = vg ? allowedChars(vg) : [];
  const p = p0 && vg ? { ...p0, homeGrade: p0.grade, grade: vg, volumes: vg === p0.grade ? p0.volumes : null, charId: [p0.charIds?.[bandConfig(vg).chars], p0.charId].find(id => id && vChars.some(c => c.id === id)) } : p0;
  const cfg = p ? bandConfig(p.grade) : null;
  setKinderSpeech(cfg?.band === 'K');   // r15.4.4：小班系统朗读退路放慢（和 1.2 倍速录音一致）；幂等，渲染时直接设
  const gradeQs = useMemo(() => bank && p ? playable(questionsOfGrade(bank, p.grade), settings.includePending) : [], [bank, p?.grade, settings.includePending]);
  const allGradeQs = useMemo(() => bank && p ? questionsOfGrade(bank, p.grade) : [], [bank, p?.grade]);
  const chapters = useMemo(() => buildChapters(gradeQs, p?.volumes ?? null, allGradeQs), [gradeQs, p?.volumes, allGradeQs]);
  // 星级迁移：关卡表变化后把旧关卡的星写到新关卡（只升不降），持久化
  useEffect(() => { if (!p) return; const nx = migrateStars(chapters.flatMap(c => c.levels), progress.stars); if (nx) setProgress(pr => { const v = { ...pr, stars: { ...pr.stars, ...Object.fromEntries(Object.entries(nx).filter(([k, x]) => x > (pr.stars[k] ?? 0))) } }; S.saveProgress(p.id, v); return v; }); }, [chapters, p?.id, progress.stars]);
  // 仅自动化测试：导出关卡 → 题目 unit / 题干，供线上验收检查「诗词关卡里的题都属于这首诗」
  useEffect(() => { const w = window as unknown as { __zyTest?: boolean; __zyLevels?: unknown }; if (!(__TEST_HOOKS__ && w.__zyTest) || !bank) return;
    w.__zyLevels = chapters.map(c => ({ subject: c.subject, levels: c.levels.map(l => ({ id: l.id, kind: l.kind, name: l.name, qs: l.pool.map(k => { const q = bank.byKey.get(k); return { unit: q?.unit, question: q?.question }; }) })) })); }, [chapters, bank]);
  const playableKeys = useMemo(() => new Set(gradeQs.map(q => q.key)), [gradeQs]);
  const today = dayStr();
  // 时钟被调回（GDD §8.2）：按「今日已用满」处理，家长在「时长」页解除
  const remaining = (id: string) => { if (clock.locked) return 0; const pp = profiles.find(x => x.id === id); if (!pp) return Infinity; const r = remainingSec(S.effLimit(pp), usage[id] ?? {}, today); const sp = __TEST_HOOKS__ ? Number((window as unknown as { __zyTestSpentSec?: number }).__zyTestSpentSec) || 0 : 0; return sp ? Math.max(0, r - sp) : r; };
  const myRemaining = pid ? remaining(pid) : Infinity;
  /** r14.1：家长解除时间锁定 = 时间基准重置为现在，并删掉「今天之后」的时长记录（否则刷新后又按「时间被调回」锁上）；reset=true 时再把今天的计时清零 */
  function unlockClock(reset: boolean) {
    const n = { maxSeen: Date.now(), locked: false }; setClock(n); void S.saveClock(n); const td = dayStr();
    setUsageAll(all => { const out = { ...all }; for (const [id, u] of Object.entries(all)) { const nu = { ...u }; let ch = false; void addDays; if (reset && nu[td]) { nu[td] = { used: 0, bonus: 0 }; ch = true; } if (ch) { out[id] = nu; void S.saveUsage(id, nu); } } return out; });
    logNav('parent', 'parent', reset ? 'reset-timing' : 'unlock-clock');
  }
  // 到时：允许打完当前关，最多再 3 分钟，之后按已答题结算（策划 T-P2-2）
  // 首次联网后后台预下载各档案年龄段用到的动画（技术QA P1-6）；失败不影响流程（有程序动效兜底）
  useEffect(() => {
    if (!profiles.length || !navigator.onLine) return;
    const kinds = [...new Set(profiles.map(x => bandConfig(x.grade).chars === 'scifi' ? 'hs' : 'pup'))] as ('pup' | 'hs')[];
    // 学科怪物 + 技能特效/图标/音效：按档案年级与学科，空闲时放进运行时缓存（技术QA R6-1）
    const needs = bank ? [...new Set(profiles.map(x => x.grade))].map(g => ({ grade: g, subjects: [...new Set(questionsOfGrade(bank, g).map(q => q.subject))] })) : [];
    const noBg = __TEST_HOOKS__ && !!(window as unknown as { __zyNoOfflineCache?: boolean }).__zyNoOfflineCache;   // 仅测试构建：r5「按需懒加载」检查时关掉后台离线缓存
    const t = setTimeout(() => { if (noBg) return; void prefetchAll(undefined, kinds).catch(() => {}).then(() => cacheForOffline(needs)).catch(() => {}); }, 8000);
    /* r15.4.1 技术QA P2-1：有小班档案 → 首屏后 3 秒起后台把全部小班录音放进 zy-voice（离线也能播） */
    const hasK = profiles.some(x => bandConfig(x.grade).band === 'K');
    const tv = setTimeout(() => { if (hasK && !noBg) void cacheVoiceForOffline().catch(() => {}); }, 3000);
    const on = () => { if (!noBg) { void cacheForOffline(needs).catch(() => {}); if (hasK) void cacheVoiceForOffline().catch(() => {}); } }; window.addEventListener('online', on);
    return () => { clearTimeout(t); clearTimeout(tv); window.removeEventListener('online', on); };
  }, [profiles.map(x => x.grade).join(), !!bank]);
  const replay = !!p && (!p.tutorialDone || !!settings.tutorialReplay?.[p.id]);
  // 老档案（看过旧引导）第一次进轮流回合战斗：只补弹第 3 张卡一次（规格 §10）
  const onlyCard3 = !!p && !replay && cfg?.battle === 'full' && !p.tutorialV036;
  const needTutorial = replay || onlyCard3;
  const finishTutorial = () => {
    if (!p) return;
    setProfiles(ps => ps.map(x => x.id === p.id ? { ...x, tutorialDone: true, ...(cfg?.battle === 'full' ? { tutorialV036: true } : {}) } : x));
    if (settings.tutorialReplay?.[p.id]) { const r = { ...settings.tutorialReplay }; delete r[p.id]; setSettings({ ...settings, tutorialReplay: r }); }
  };
  // r10 时长统一把关：所有答题入口（关卡 / 错题本「练习这些」/ 今日复习 / 中断恢复）进入时检查；进入后到时有 3 分钟收尾，然后强制结算
  const ANSWER_SCREENS = ['battle', 'review'];
  const [timeUpNote, setTimeUpNote] = useState(false);
  const [resetNoticeSeen, setResetNoticeSeen] = useState(false);   // r12：等待重设期间，每次启动全屏提示一次
  const [cancelBox, setCancelBox] = useState(false);   // r15.4：取消重设申请的输入框
  const [cancelDone, setCancelDone] = useState(false);   // r15.4.1 较真家长：取消申请后要有「已取消申请」
  const [ttsIssue, setTtsIssue] = useState<string | null>(null);   // r15.4：朗读不可用时给看得见的提示（华为浏览器等）
  useEffect(() => { if (!ttsIssue) return; const t = window.setTimeout(() => setTtsIssue(null), 6000); return () => clearTimeout(t); }, [ttsIssue]);   // r15.4：朗读提示 6 秒后自己收起，不长期压住小班题目气泡
  useEffect(() => { const f = (e: Event) => setTtsIssue((e as CustomEvent).detail as string); window.addEventListener('zy-tts-issue', f); return () => window.removeEventListener('zy-tts-issue', f); }, []);
  // r12 较真家长：到时前 3 分钟提前提醒（每个孩子每天一次，不闪烁）
  const [warn3, setWarn3] = useState(false); const [warnMini, setWarnMini] = useState(false);
  /* r15 小萌新：「还有 3 分钟」横条 5 秒后收成角落小徽标，不再挡题目和地图 */
  useEffect(() => { if (!warn3) return; setWarnMini(true); const t = setTimeout(() => setWarn3(false), 5000); return () => clearTimeout(t); }, [warn3]); const warned = useRef<string>('');
  useEffect(() => { if (!pid || !Number.isFinite(myRemaining)) return; const k = pid + today; if (myRemaining > 0 && myRemaining <= 180 && warned.current !== k) { warned.current = k; setWarn3(true); } if (myRemaining <= 0) setWarn3(false); }, [myRemaining, pid, today]);
  useEffect(() => { if (ANSWER_SCREENS.includes(screen.s) && myRemaining <= 0 && !graceOk.current) { setTimeUpNote(true); setScreen({ s: 'map' }, 'timeup'); } graceOk.current = false; }, [screen]);
  const graceOk = useRef(false);
  const overTime = myRemaining <= 0 && ANSWER_SCREENS.includes(screen.s);
  /* r15.4 小萌新：小班进入收尾时间时朗读一次（不识字的孩子看不懂横条） */
  /* r15.4.2 小萌新：横条只从 6% 长到 8% 屏高，不够醒目——小班进入收尾时先在屏幕中间弹一张大卡片（伙伴 + 🥱 打哈欠 + ⏰，轻轻放大 / 摇一摇），
     4 秒后缩回顶上的横条；卡片不挡点按（pointer-events:none）。录音和卡片同一刻开始 */
  const [graceCard, setGraceCard] = useState(false);
  useEffect(() => { if (overTime && cfg?.band === 'K') { speak(GRACE_VOICE, 'zh-CN', { prio: true }); setGraceCard(true); return afterVoiceThen(4000, 9000, () => setGraceCard(false)); }   /* r15.4.4：至少 4 秒，读完再缩回横条（最多 9 秒） */ setGraceCard(false); }, [overTime, cfg?.band]);
  // r11 技术QA R10-1：3 分钟收尾倒计时并进下面的游戏时钟（单调时钟、暂停/后台不走、只有一个计时源），不再用 Date.now + 固定 setTimeout
  const graceMs = useRef<number | null>(null);
  /* r15.3 较真家长：今天的上限秒数（含加时；不限 = Infinity）。用时永远 ≤ 上限 + 3 分钟收尾 */
  const limitBase = (id: string, u: Record<string, Usage> = usageRef.current) => { const pp = profilesRef.current.find(x => x.id === id); if (!pp) return Infinity; const m = limitMinutes(S.effLimit(pp)); return m ? m * 60 + effBonus(u[id]?.[dayStr()], m * 60) : Infinity; };
  useEffect(() => { const G0 = (__TEST_HOOKS__ && (window as unknown as { __zyGraceMs?: number }).__zyGraceMs) || GRACE_MS;
    /* 收尾时长扣掉已经记进去的超时部分（用时按秒批量结算，进入收尾时可能已多记几秒；同一天第二次进入收尾也不会再给 3 分钟） */
    const G = overTime && pid ? graceBudgetMs(usageRef.current[pid]?.[dayStr()]?.used ?? 0, limitBase(pid), G0) : G0;
    graceMs.current = overTime ? G : null; setGraceLeft(Math.ceil(G / 1000)); if (overTime && G <= 0) { graceMs.current = null; window.dispatchEvent(new Event(FORCE_END)); } }, [overTime]);
  const [graceLeft, setGraceLeft] = useState(180);
  const char: Character | undefined = p && cfg ? [...PUPS, ...SCIFI].find(c => c.id === p.charId) : undefined;

  // 计时：进入孩子档案后（地图/选角色/战斗/结算/错题本/复习）且页面可见时都计；幼儿园短关卡以前只计战斗，几乎为 0（试玩报告 #10）
  // r15 策划：登录了档案的所有界面都计时（含地图，所有年级）；家长页 / 密码页 / 选角色页不计；2 分钟没操作或切到后台暂停
  const IDLE_MS = 120e3;
  const playing = !!pid && !['parent', 'gate', 'gate-grade', 'profiles', 'loading'].includes(screen.s);
  // 按时间戳差值累计（技术QA P2-3）：每秒结算一次、暂停/后台不计、单次差值封顶 2 秒；同时做会话内时钟跳变检测
  useEffect(() => {
    if (!playing || !pid) return;
    let lastPerf = performance.now(), lastWall = Date.now(), acc = 0, graceDone = false;
    const t = setInterval(() => {
      const nowP = performance.now(), nowW = Date.now();
      const dp = nowP - lastPerf, dw = nowW - lastWall; lastPerf = nowP; lastWall = nowW;
      // r14.1 真正的误锁原因：以前「墙钟比单调时钟多走 10 分钟」也算调钟——电脑 / 平板休眠时 performance.now() 停住、Date.now() 照走，醒来就被锁。现在只有墙钟往回走才锁
      if (dw < -60e3 || dw < dp - 10 * 60e3) { setClock(c => { const n = { ...c, locked: true, lockedAt: nowW }; void S.saveClock(n); return n; }); }
      else setClock(c => { if (nowW <= c.maxSeen + 30e3) return c; const n = { ...c, maxSeen: nowW }; void S.saveClock(n); return n; });
      const pausedNow = document.visibilityState !== 'visible' || Date.now() - lastInput.current > IDLE_MS || !isActiveTab() || battlePaused() || rotateLock();   // r15.4.2：手机竖屏盖层时不计时
      if (graceMs.current !== null) { const g = tickGrace(graceMs.current, dp, pausedNow); graceMs.current = g.left; setGraceLeft(Math.ceil(g.left / 1000)); if (g.fire) { graceMs.current = null; graceDone = true; window.dispatchEvent(new Event(FORCE_END)); } }
      if (pausedNow) return;
      acc += Math.min(dp, 2000);
      /* r15.4 技术QA P4-2：收尾走完的这一下，把还没结算的零头按收尾记上（向上取整，封顶在上限 + 3:00）。以前收尾结束后零头按「不在收尾」记，被夹掉 → 显示 2:59 */
      if (graceDone) { graceDone = false; const sec = Math.ceil(acc / 1000 - 1e-6); acc = 0; if (sec > 0) setUsageAll(u => { const d = dayStr(); const add = clampUsageAdd(u[pid]?.[d]?.used ?? 0, sec, limitBase(pid, u), true); if (!add) return u; const nu = addUsage(u[pid] ?? {}, d, add, limitBase(pid, u)); S.saveUsage(pid, nu); return { ...u, [pid]: nu }; }); return; }
      /* r15.3 较真家长：以前时间到之后，结算页 / 地图 / 错题本照样计时（r15 起所有登录界面都计时），收尾 3 分钟之外还在涨（5 分钟上限出现 8:25）。
         现在：超过上限的部分只在收尾进行中（战斗 / 复习里）才记，而且总数封顶在上限 + 3:00；离上限 6 秒以内每秒结算（收尾按时开始） */
      const base = limitBase(pid); const near = Number.isFinite(base) && base - ((usageRef.current[pid]?.[dayStr()]?.used ?? 0) + acc / 1000) <= 6;
      if (acc >= 5000 || (near && acc >= 1000)) {
        const sec = Math.floor(acc / 1000); acc -= sec * 1000; const inGrace = graceMs.current !== null;
        setUsageAll(u => { const d = dayStr(); const add = clampUsageAdd(u[pid]?.[d]?.used ?? 0, sec, limitBase(pid, u), inGrace); if (!add) return u; const nu = addUsage(u[pid] ?? {}, d, add, limitBase(pid, u)); S.saveUsage(pid, nu); return { ...u, [pid]: nu }; });
      }
    }, 1000);
    return () => {
      clearInterval(t);
      const sec = Math.round(acc / 1000);   // 退出时把不足 5 秒的部分也记上
      const inGrace = graceMs.current !== null;
      if (sec > 0) setUsageAll(u => { const d = dayStr(); const add = clampUsageAdd(u[pid]?.[d]?.used ?? 0, sec, limitBase(pid, u), inGrace); if (!add) return u; const nu = addUsage(u[pid] ?? {}, d, add, limitBase(pid, u)); S.saveUsage(pid, nu); return { ...u, [pid]: nu }; });
    };
  }, [playing, pid]);

  // r11 技术QA R10-2：密码副本（设置 / localStorage / 每个孩子档案 / Cache Storage）。只在有密码时写副本；清副本只走 clearPin（明确的重设）
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const profilesRef = useRef(profiles); profilesRef.current = profiles;
  const stamp = (ps: Profile[], v: PinVault | null) => ps.map(x => { const { pinVault: _o, ...rest } = x; return v ? { ...rest, pinVault: v } : rest; });
  const mirrorPin = (v: PinVault | null) => { writeLocal(v); void writeCache(v); const ps = stamp(profilesRef.current, v); if (JSON.stringify(ps) !== JSON.stringify(profilesRef.current)) { profilesRef.current = ps; setProfilesState(ps); S.saveProfiles(ps); } };
  /* r15 较真家长：以前每次 setSettings 都把「本页内存里」整份设置连同密码写回 4 处副本——另一个标签页 / 共用浏览器的人改过密码，
     这一页一取消申请、一计时就把旧密码写回去，家长就被锁在外面。现在：调用方没改的密码字段一律以库里最新的为准，只有真正改密码时才同步副本；
     不活动的标签页、恢复进行中不写 */
  const PIN_F = ['pinHash', 'pinHint', 'pinRec'] as const;
  const setSettings = (s: Settings) => { const prev = settingsRef.current; const prevRec = prev.pinRec; const pinChanged = PIN_F.some(k => JSON.stringify(s[k]) !== JSON.stringify(prev[k]));
    settingsRef.current = s; setSettingsState(s);
    if (!isActiveTab() || isRestoring()) return;
    if (!pinChanged) { void S.loadSettings().then(cur => { const fresh = { ...settingsRef.current }; if (cur?.pinHash) for (const k of PIN_F) (fresh as Record<string, unknown>)[k] = cur[k];
      if (PIN_F.some(k => JSON.stringify(fresh[k]) !== JSON.stringify(settingsRef.current[k]))) { logErr('pin-stale-memory', '本页内存里的密码和库里不同，以库里为准'); settingsRef.current = fresh; setSettingsState(fresh); }
      void S.saveSettings(fresh); }); return; }
    S.saveSettings(s); if (s.pinHash) mirrorPin(vaultOf(s)); if (s.pinRec && s.pinRec !== prevRec) { void writeRec(s.pinRec, setKV); const ps = profilesRef.current.map(x => ({ ...x, recHash: s.pinRec })); profilesRef.current = ps; setProfilesState(ps); S.saveProfiles(ps); } };
  const clearPin = (extra: Partial<Settings> = {}) => { const s = { ...settingsRef.current, pinHash: undefined, pinRec: undefined, ...extra }; settingsRef.current = s; setSettingsState(s); S.saveSettings(s); mirrorPin(null); void writeRec(null, setKV); const ps = profilesRef.current.map(({ recHash: _r, ...x }) => x); profilesRef.current = ps; setProfilesState(ps); S.saveProfiles(ps); };
  /* r15.3 学霸：可传函数——按最新档案改（以前各处用渲染时的 profiles 改一个字段再整份写回，会把刚记下的押注说明次数 / 年级等冲掉） */
  const setProfiles = (arg: Profile[] | ((ps: Profile[]) => Profile[])) => { const ps0 = typeof arg === 'function' ? arg(profilesRef.current) : arg;
    for (const old of profilesRef.current) if (!ps0.some(x => x.id === old.id)) void deleteProfileData(old.id, S.profileKeys(old.id));   // P1-2：删档案连数据一起清
    const ps = stamp(ps0, vaultOf(settingsRef.current)); profilesRef.current = ps;   // 新档案也带一份密码副本
    setProfilesState(ps); S.saveProfiles(ps);
  };
  /* r15.4.4（总管）：题库新增的册别（v32 政治必修3 = 必修第三册）给保存过「已学册别」的档案自动勾上一次，家长页提示一次（见 game/volumes.ts） */
  useEffect(() => {
    if (!bank || !profiles.length) return; let ch = false;
    const nx = profilesRef.current.map(x => {
      const qs = questionsOfGrade(bank, x.grade); const vols = [...new Set(qs.map(q => q.volume))]; const r = syncNewVolumes(x, vols); if (!r) return x; ch = true;
      const labels = r.added.map(v => volLabel(v, [...new Set(qs.filter(q => q.volume === v).map(q => q.subject))]));
      const { volsKnown: _k, ...y } = x;
      return { ...y, volumes: r.volumes, ...(r.volsKnown ? { volsKnown: r.volsKnown } : {}), ...(labels.length ? { volNotice: [...(x.volNotice ?? []), ...labels] } : {}) };
    });
    if (ch) setProfiles(nx);
  }, [bank, profiles]);   // eslint-disable-line react-hooks/exhaustive-deps
  // r12：72 小时到期的重设：到点（时钟没被调过）只标记到期，不清密码
  // r12 技术QA R11-1：72 小时只按运行中观察到的单调时间 （r14：关闭期间完全不计）；运行中检测到时钟跳变 → 取消申请并提示
  const [resetCancelled, setResetCancelled] = useState(false);
  const pendResumed = useRef(false);
  useEffect(() => {
    if (!settings.pinReset) return;
    // r13 技术QA R12-1：以前第一次执行在这里 return，计时器永远不启动——运行中不累计、时钟跳变也不取消
    if (!pendResumed.current) { pendResumed.current = true; const st = settingsRef.current; if (st.pinReset) { const r0 = resumePending(st.pinReset, Date.now()); if (r0 === 'cancel') { setSettings({ ...st, pinReset: undefined }); setResetCancelled(true); } else setSettings({ ...st, pinReset: { ...r0, ready: pendingDue(r0) } }); } }
    let lp = performance.now(), lw = Date.now();
    const f = () => { const st = settingsRef.current; if (!st.pinReset) return; const np = performance.now(), nw = Date.now();
      const r = tickPending(st.pinReset, np - lp, nw - lw, nw); lp = np; lw = nw;
      if (r === 'cancel' || clock.locked) { setSettings({ ...st, pinReset: undefined }); setResetCancelled(true); return; }
      setSettings({ ...st, pinReset: { ...r, ready: pendingDue(r), effectiveAt: nw + pendingLeftMs(r) } }); };
    // r15 策划 R141-2：联网时读同源、不走缓存 / SW 的响应头 Date 当网络时间；锚点另存一份在 localStorage
    const NETK = 'zy.pendNet';
    const net = async () => { if (!navigator.onLine || !isActiveTab()) return; let t = NaN;
      try { const r = await fetch('version.json?ts=' + Date.now(), { cache: 'no-store' }); if (r.headers.get('x-zy-sw-cache')) return; t = Date.parse(r.headers.get('date') ?? ''); } catch { return; }
      const st = settingsRef.current; if (!st.pinReset || !Number.isFinite(t)) return;
      let p0 = st.pinReset; try { const m = JSON.parse(localStorage.getItem(NETK) ?? 'null'); if (m && m.requestedAt === p0.requestedAt) p0 = { ...p0, netReq: p0.netReq ?? m.netReq, netLast: Math.max(p0.netLast ?? 0, m.netLast ?? 0) || undefined }; } catch { /* */ }
      const r = netCheck(p0, t, Date.now());
      if (r === 'cancel') { logErr('pend-net-skew', `网络时间 ${new Date(t).toISOString()} 本机 ${new Date().toISOString()}`); setSettings({ ...st, pinReset: undefined }); setResetCancelled(true); return; }
      try { localStorage.setItem(NETK, JSON.stringify({ requestedAt: r.requestedAt, netReq: r.netReq, netLast: r.netLast })); } catch { /* */ }
      setSettings({ ...st, pinReset: { ...r, ready: pendingDue(r) } }); };
    void net(); let k = 0;
    const t = setInterval(() => { f(); if (++k % 10 === 0) void net(); }, 30e3); return () => clearInterval(t); }, [!!settings.pinReset, clock.locked]);
  const setUsage = (id: string, u: Usage) => { setUsageAll(x => ({ ...x, [id]: u })); S.saveUsage(id, u); };

  // r9：记下当前位置（重新加载后恢复）
  useEffect(() => {
    if (screen.s === 'loading') return;
    const lv = screen.s === 'battle' ? screen.level : undefined;
    writeNav(screen.s === 'profiles' || !pid ? null : { pid, grade: vg, s: screen.s, level: lv?.id, name: lv?.name, at: Date.now(), bv: BAL_VER });
    if (pid) { if (lv) { const old = readRun(pid); writeRun(pid, { levelId: lv.id, name: lv.name, at: Date.now(), bv: BAL_VER, n: old?.levelId === lv.id ? old.n : 0 }); } else writeRun(pid, null); }
  }, [screen, pid, vg]);
  // r9：安卓返回键/手势——每个页面压一条历史，返回 = 游戏内返回；首页返回先确认；战斗中返回 = 暂停
  const backRef = useRef<() => boolean>(() => false);
  const exiting = useRef(false);
  backRef.current = () => {
    const sc = screen;
    switch (sc.s) {
      case 'battle': window.dispatchEvent(new Event('zy-back-pause')); return true;
      case 'review': setScreen({ s: 'wrongbook' }); return true;
      case 'map': if (p) setScreen({ s: 'grade', stage: stageOf(p.grade) }); return true;
      case 'grade': setScreen({ s: 'stage' }); return true;
      case 'stage': setPid(undefined); setScreen({ s: 'profiles' }); return true;
      case 'gate-grade': setScreen({ s: 'grade', stage: stageOf(sc.g) }); return true;
      case 'char': setScreen(p?.charId ? { s: 'map' } : { s: 'grade', stage: stageOf(p?.grade ?? '1') }); return true;
      case 'result': case 'wrongbook': case 'review-done': setScreen({ s: 'map' }); return true;
      case 'gate': case 'parent': setScreen({ s: 'profiles' }); return true;
      case 'profiles': if (sc.adding) { setScreen({ s: 'profiles' }); return true; } return false;
      default: return true;
    }
  };
  useEffect(() => {
    try { history.pushState({ zy: 1 }, ''); } catch { /* */ }
    // r11 技术QA R9-2：以前 history.go(-(length-1))——返回后当前位置后面还有「前进」记录，步数超出范围时浏览器什么都不做，于是又要确认好几次
    let exitT = 0; const exitTick = () => { clearTimeout(exitT); exitT = window.setTimeout(() => { exiting.current = false; }, 1500); };
    const onPop = () => {
      logNav(screenRef.current.s, screenRef.current.s, 'popstate');   // r14.1：返回键 / 返回手势也记进 navLog
      if (exiting.current) { exitTick(); history.back(); return; }   // r11：确认退出后一路退到底（每一步都不再确认）
      if (backRef.current()) { try { history.pushState({ zy: 1 }, ''); } catch { /* */ } return; }
      if (confirm('要退出知识勇者吗？')) { exiting.current = true; exitTick(); history.back(); } else try { history.pushState({ zy: 1 }, ''); } catch { /* */ }
    };
    window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop);
  }, []);
  // r9：新版本 SW 已接管——只在安全页面自动刷新，战斗中绝不刷新
  // r13 小萌新：只在「安全页面」停稳 2 秒后才刷新——关卡、练习（复习）、结算页、选角色、确认页、加载中都不刷；还有没打完的关卡记录时也不刷
  const SAFE_RELOAD = ['profiles', 'stage', 'grade', 'map'];
  useEffect(() => {
    if (!updateReady || !SAFE_RELOAD.includes(screen.s) || restoreRef.current) return;
    const t = setTimeout(() => {
      const sc = screenRef.current.s; if (!SAFE_RELOAD.includes(sc) || restoreRef.current) return;
      if (pid && readRun(pid) && sc !== 'profiles') return;
      if (document.querySelector('[data-testid=interrupted]')) return;
      // r14：正在输入 / 有弹窗 / 5 秒内刚点过——不刷新（以前在学段 / 年级页上操作时会被更新刷新打断）
      const ae = document.activeElement; if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
      if (document.querySelector('.modal, [role=dialog]') || Date.now() - lastInput.current < 5000) return;
      try { sessionStorage.setItem('zy-sw-reload', '1'); } catch { /* */ } logNav(sc, 'reload', 'sw-update'); (updateReady as (sc?: string) => void)(sc);
    }, 2000);
    return () => clearTimeout(t);
  }, [updateReady, screen.s]);
  // r12（策划）：同一台设备当天换另一个孩子的档案要家长密码（防止换档案躲时长）；家长页可关
  // r14：兜底防白屏——需要当前孩子的页面却没有孩子（档案还没载入 / 被异步结果覆盖），或需要的配置缺失时，回首页并记日志，而不是什么都不画
  // r14 技术QA R13-5：通用兜底——换页后 1 帧内根节点什么都没画出来（白屏）→ 记日志并回首页
  useEffect(() => {
    if (!booted) return;
    const t = window.setTimeout(() => { const root = document.getElementById('root'); if (root && !root.textContent?.trim() && !root.querySelector('img,svg,canvas,button')) { logErr('blank-render', screenRef.current.s); setExitNote('刚才的页面没有显示出来，已回到首页（已记录）。'); setPid(undefined); setScreen({ s: 'profiles' }, 'blank'); } }, 600);
    return () => clearTimeout(t);
  }, [screen, booted]);
  useEffect(() => {
    if (!booted) return;
    const needP = ['stage', 'grade', 'gate-grade', 'map', 'char', 'battle', 'result', 'wrongbook', 'review', 'review-done'].includes(screen.s);
    if (needP && !profiles.some(x => x.id === pid)) { logErr('blank', `screen=${screen.s} 但当前孩子 ${pid ?? '无'} 不存在`); setExitNote('刚才的页面找不到当前孩子的档案，已回到首页（已记录）。'); setScreen({ s: 'profiles' }, 'no-profile'); }
  }, [booted, screen, pid, profiles]);
  const latest = useRef({ pickProfile: (..._: Parameters<typeof pickProfile>) => Promise.resolve(), enterGrade: (..._: Parameters<typeof enterGrade>) => {} });
  latest.current = { pickProfile, enterGrade };
  async function pickProfile(pp: Profile, viaPin = false, why: 'user' | 'restore' = 'user') {
    if (why === 'user' && !booted) return;   // r14：启动流程没走完前不接受点按
    const gen = ++pickGen.current; const ug = userGen.current;
    const stale = () => pickGen.current !== gen || (why === 'restore' && userGen.current !== ug);   // 有更新的选择 / 用户已经点了别的
    const lp = (() => { try { const v = JSON.parse(localStorage.getItem('zy.lastPlayer') ?? 'null'); return v && typeof v === 'object' && typeof v.pid === 'string' ? v as { pid: string; day: string } : null; } catch { return null; } })();   // r14 技术QA R13-5：校验格式
    const prevPid = lastPid ?? lp?.pid;   // r13 学霸：每次换档案都要密码（不再只限当天；本次启动内换过的也算），家长页开关可关
    if (!viaPin && settings.pinHash && !settings.switchNoPin && profiles.length > 1 && !(addedPid.current === pp.id) /* r15：选今天正在用的同一个档案也要密码（以前 prevPid === pp.id 时跳过）；只有刚添加完的档案第一次进免密 */ /* r14.1 学霸：内置档案（kid-k / kid-7 / kid-10）同样要；新浏览器 / 没有上次记录、上次档案已删除也要 */) { setScreen({ s: 'gate', next: 'pick', pick: pp.id }); return; }
    /* r15 学霸：新装还没家长密码时，第一次换档案提示家长设一个（可跳过，只提示一次） */
    if (why === 'user' && !viaPin && !settings.pinHash && !settings.pinNudged && profiles.length > 1 && prevPid && prevPid !== pp.id) { setPinNudge(pp); return; }
    addedPid.current = undefined;
    try { localStorage.setItem('zy.lastPlayer', JSON.stringify({ pid: pp.id, day: today })); } catch { /* */ }
    setPid(pp.id); pidRef.current = pp.id; setViewGrade(undefined); setLastPid(pp.id); setChapterIdx(0);
    const [pr, sk, wr, ans] = await Promise.all([S.loadProgress(pp.id), S.loadSkills(pp.id), wrongOf(pp.id), answersOf(pp.id)]);
    if (stale()) { logNav(screenRef.current.s, screenRef.current.s, `pickProfile(${pp.name}) 作废：有更新的导航`); return; }
    setProgress(pr); setSkills(sk); setWrong(wr);
    const cutoff = Date.now() - 3 * 86400e3;
    setRecentRight(new Set(ans.filter(a => a.correct && a.at > cutoff).map(a => a.questionId)));
    setSeenKeys(new Set(ans.map(a => a.questionId)));
    setViewGrade(undefined); setScreen({ s: 'stage' });
  }
  const lastGradeOf = (x: Profile) => { try { return localStorage.getItem('zy-lastGrade-' + x.id) ?? x.lastGrade; } catch { return x.lastGrade; } };
  /** 进入某年级地图（r8b）：记住选择；该学段还没选过角色就先选角色 */
  function enterGrade(g: GradeKey, gateOk = false, prof?: Profile) {
    const p0 = prof ?? profilesRef.current.find(x => x.id === pidRef.current) ?? profiles.find(x => x.id === pid); if (!p0) return;
    // r9：家长确认在入口处强制（不只靠界面）：非档案年级没经过确认一律先去确认页
    if (needsGate(p0.grade, g) && !gateOk) { setScreen({ s: 'gate-grade', g }); return; }
    // r13 学霸：同一档案在年级之间来回切换（包括切回档案年级）也要家长密码，除非家长开了「切换不用密码」
    if (!gateOk && !prof && (viewGrade ?? lastGradeOf(p0) ?? p0.grade) !== g && settings.pinHash   /* r14：刚选完档案（还没进过年级）时也按「上次所在年级」算切换 */ && !settings.switchNoPin) { setScreen({ s: 'gate-grade', g }); return; }
    setViewGrade(g, p0.id); setChapterIdx(0);
    setProfiles(ps => ps.map(x => x.id === p0.id ? { ...x, lastGrade: g } : x)); try { localStorage.setItem('zy-lastGrade-' + p0.id, g); } catch { /* */ }
    const ch = allowedChars(g);
    const has = [p0.charIds?.[bandConfig(g).chars], p0.charId].some(id => id && ch.some(c => c.id === id));
    setScreen(has ? { s: 'map' } : { s: 'char' });
  }

  /** 每次作答：记录、难度阶梯、错题本 */
  function onAnswer(q: Question, correct: boolean, ans: string, isReview = false) {
    if (!p || !cfg) return;
    { const r = readRun(p.id); if (r) writeRun(p.id, { ...r, n: r.n + 1 }); }
    recordAnswer({ profileId: p.id, questionId: q.key, correct, at: Date.now(), subject: q.subject });
    setSeenKeys(s => s.has(q.key) ? s : new Set(s).add(q.key));
    lastAnswered.current = { pid: p.id, q };
    if (!isReview) setSkills(sk => { const nx = { ...sk, [q.subject]: updateSkill(sk[q.subject], correct, cfg) }; S.saveSkills(p.id, nx); setAllSkills(a => ({ ...a, [p.id]: nx })); return nx; });
    const id = `${p.id}|${q.key}`;
    setWrong(list => {
      const prev = list.find(e => e.id === id);
      if (!correct) { const e = onWrong(prev, { profileId: p.id, qkey: q.key, subject: q.subject, rev: qRev(q) }, ans); putWrong(e); return [...list.filter(x => x.id !== id), e]; }
      if (prev && (isReview || isDue(prev))) {
        const nx = onReviewRight(prev);
        if (!nx) { delWrong(id); masteredThisLevel.current++; return list.filter(x => x.id !== id); }
        putWrong(nx); return list.map(x => x.id === id ? nx : x);
      }
      return list;
    });
    if (correct) setProgress(pr => ({ ...pr, xp: pr.xp + 5 * q.difficulty }));
  }

  /* r15 学霸：选完角色后开战——旧代码在 setTimeout 里调用旧渲染的 startLevel（那时 char 还是空），又跳回选角色页，永远开不了战。改成等新档案生效后再开 */
  const [pendingStart, setPendingStart] = useState<Level | null>(null);
  useEffect(() => { if (!pendingStart || !char || screen.s !== 'map') return; const l = pendingStart; setPendingStart(null); startLevel(l); });
  function startLevel(level: Level) {
    if (!p || !cfg) return;
    if (myRemaining <= 0) return;
    if (!char) { setScreen({ s: 'char', then: level }); return; }
    if (level.redirect) { const t = chapters.flatMap(c => c.levels).find(l => l.id === level.redirect); if (t) { startLevel(t); return; } }   // 语文题少的古诗课 → 同名诗词关
    const chapter = chapters.find(c => c.subject === level.chapter)!;
    const byKey = bank!.byKey;
    const pool = level.pool.map(k => byKey.get(k)!).filter(q => q && playableKeys.has(q.key));
    // 补题和错题复习都只取「同一章（册别+章/单元）」的题，绝不跨章（试玩报告 #1：集合关卡混入余弦定理）
    // 裁定 2：普通 / 精英关只用本课（本关题池）的题；Boss 用整章，优先没出过和之前答错的
    const sameUnit = level.kind === 'boss' ? [...new Set([...levelsOfUnit(chapter.levels, level).flatMap(l => l.pool), ...level.pool])] : level.pool;
    // r14.1 学霸：后备题 / 战斗内补题也按「本档案历史上没答过 → 以前答错 → 答过」排，重开一局不会先拿到上一局的题
    const wrongKeys = new Set(wrong.map(e => e.qkey));
    const histRank = (q: Question) => !seenKeys.has(q.key) ? 0 : wrongKeys.has(q.key) ? 1 : 2;
    const fallback0 = sameUnit.map(k => byKey.get(k)!).filter(q => q && playableKeys.has(q.key)).sort((a, b) => histRank(a) - histRank(b));
    const fallback = level.kind === 'boss' ? bossPool(fallback0, seenKeys, wrongKeys, cfg.questions.boss) : fallback0;
    const unitKeys = new Set(sameUnit);
    // r15 策划：Boss 关不出复习题
    const due = level.kind === 'boss' ? [] : wrong.filter(e => isDue(e) && unitKeys.has(e.qkey)).map(e => byKey.get(e.qkey)).filter((q): q is Question => !!q && playableKeys.has(q.key));
    const target = skills[level.chapter]?.level ?? 2;
    const n = cfg.questions[level.kind];
    // 策划 r7：精英先出本课没出现过的（含生成时已分给前面普通关的题，不只看游玩记录）；Boss 先出整章没出现过/答错的，精英预留题优先
    const assigned = assignedBefore(chapter.levels, level);
    const lessonKeys = new Set(level.pool);
    /* r15.1 策划规则 C：同一小节（lesson）的几关共用题池——本关题出完后，先补同小节其他关（没见过 → 以前答错 → 见过），再补前面小节，最后重复。语文课文 / 古诗词同一篇也一样 */
    const lessonOthers = level.kind === 'boss' || !level.lesson ? [] : [...new Set(chapter.levels.filter(l => l.lesson === level.lesson && l.id !== level.id && l.kind !== 'boss' && !l.redirect).flatMap(l => l.pool))]
      .filter(k => !lessonKeys.has(k)).map(k => byKey.get(k)!).filter(q => q && playableKeys.has(q.key) && !isBossOnly(q)).sort((a, b) => histRank(a) - histRank(b));
    /* r15.3 学霸 / 小萌新：普通关开局就从整个小节挑（本关没见过 → 同小节没见过 → 答错 → 见过，同名次随机）。
       以前开局只看本关题池、见过的题按原顺序截取：题全见过后每局都是同一批同顺序的题，同小节其他关没见过的题只在本关出完后才补 */
    const lessonPool = level.kind === 'normal' ? [...pool, ...lessonOthers] : pool;
    const lr = lessonRank(lessonKeys, seenKeys, wrongKeys);
    const runRank = level.kind === 'boss' ? undefined : level.kind === 'normal' ? lr : histRank;
    const prefPool = level.kind === 'boss' ? bossPool(pool, seenKeys, wrongKeys, n, new Set(levelsOfUnit(chapter.levels, level).flatMap(l => l.fresh ?? [])))
      : level.kind === 'elite' ? elitePool(pool, level.fresh, seenKeys, wrongKeys, n, assigned, Math.random)
      : lessonPool;   // r15.3：普通关候选 = 整个小节，按 lessonRank 排名、同名次随机
    const strict = prefPool;
    const qs0 = capMulti(spreadTemplates(selectQuestions({ pool: strict, fallback, rank: runRank, n, target, kind: level.kind, due, recentCorrect: recentRight, maxDifficulty: cfg.band === 'K' ? 2 : 5 }), shuffle(lessonPool).sort((a, b) => (runRank ?? histRank)(a) - (runRank ?? histRank)(b))), pool);
    // r11：Boss 关先出本单元 usage=boss 的题（没出过 / 答错过的在前），剩下的按原来的整单元规则补
    const bossOnly = level.kind === 'boss' ? (level.bossPool ?? []).map(k => byKey.get(k)!).filter(q => q && playableKeys.has(q.key)) : [];
    const qs = bossOnly.length ? withBossFirst(bossPool(bossOnly, seenKeys, wrongKeys, n), qs0, n) : qs0;
    { const w = window as unknown as { __zyTest?: boolean; __zyForceQ?: string }; if ((__TEST_HOOKS__ && w.__zyTest) && w.__zyForceQ) { const fq = [...byKey.values()].find(q => q.id === w.__zyForceQ); if (fq) qs.unshift(fq); } }   // 仅自动化测试：指定首题
    // 题少的课（语文课文/古诗词不合并）：关内重复本课题，错题优先（策划 r6）
    // r13 技术QA R12-3：回合制（初一 / 高一 / 小学 full）不再在开局把本课题重复塞满；不够时战斗里先补同单元相邻小节，最后才重复
    if (!roundModeOf(cfg.band) && cfg.battle !== 'full' && qs.length < n && pool.length && level.kind === 'normal') {   // r14 技术QA R13-2：小学 3–6 年级也是回合制，不再开局重复塞满
    const rep = [...pool].sort((a, b) => +wrongKeys.has(b.key) - +wrongKeys.has(a.key)); for (let i = 0; qs.length < n; i++) qs.push(rep[i % rep.length]); }
    const extra = selectQuestions({ pool: cfg.battle === 'full' ? lessonPool : fallback, fallback: cfg.battle === 'full' ? fallback : [], n: cfg.battle === 'full' ? Math.max(n * 2, 30) : n * 2, target, kind: level.kind, rank: runRank });
    // r8 多选规则：小学/幼儿园一律不出；初一/高一把本关题池里的多选题都放进候选（是否出、出几道由战斗里按回合规则决定，不受难度挑选影响）
    // r13 学霸：同一小节拆成几关（如 2.1-1 / 2.1-2）时多选题两关都在题池里——普通关不再出本机已经出过的多选题（精英 / Boss 仍可出，但排在没见过的后面）
    // r14 技术QA R13-3：多选保底优先——本关没有本机没见过的多选题时，先用以前答错的多选，再用见过的（最多 2 道），不再整局一道多选都没有
    const poolMulti = multiBand(cfg.band) ? pool.filter(q => isMultiSel(q)) : [];
    const fallbackM = new Set((poolMulti.some(q => !seenKeys.has(q.key)) ? [] : [...poolMulti.filter(q => wrongKeys.has(q.key)), ...poolMulti.filter(q => !wrongKeys.has(q.key))].slice(0, 2)).map(q => q.key));
    const seenMulti = (q: Question) => level.kind === 'normal' && isMultiSel(q) && seenKeys.has(q.key) && !fallbackM.has(q.key);
    if (roundModeOf(cfg.band)) { const seenK = new Set<string>(); const uq = qs.filter(q => !seenK.has(q.key) && !!seenK.add(q.key)); qs.splice(0, qs.length, ...uq); }   // r14 技术QA R13-2：回合制开局题单去重
    const dueKeys = new Set(due.map(q => q.key));
    // r15 策划：复习题前 2 题不出、之后每 4 题最多 1 道；幼儿园–二年级同一道题不连着出
    const qs1 = spaceReviews((multiBand(cfg.band) ? qs : qs.filter(q => !isMultiSel(q))).filter(q => !seenMulti(q)), q => dueKeys.has(q.key));
    /* r15.3 小萌新：上一局最后一题和这一局第一题不同题干（幼儿园–二年级整局都不相邻；其他年级只换开头） */
    const prevQ = lastAnswered.current?.pid === p.id ? lastAnswered.current.q : undefined;
    const qs2a = ['K', 'G1', 'G2'].includes(cfg.band) && new Set(qs1.map(q => q.key)).size > 1 ? noAdjacent(qs1, prevQ) : qs1;
    const qs2 = (() => { if (!prevQ || !qs2a.length || stemOf(qs2a[0]) !== stemOf(prevQ)) return qs2a; const i = qs2a.findIndex(q => stemOf(q) !== stemOf(prevQ)); if (i <= 0) return qs2a; const o = [...qs2a]; const [x] = o.splice(i, 1); o.unshift(x); return o; })();
    const extra2 = (multiBand(cfg.band) ? [...extra, ...pool.filter(q => isMultiSel(q) && !extra.some(x => x.key === q.key) && !qs.some(x => x.key === q.key))] : extra.filter(q => !isMultiSel(q))).filter(q => !seenMulti(q));
    // r12：挑战题 / 重击卡的「更难一档」本小节没有时，放宽到同单元前序小节（只取前面已学的，不取后面的；Boss 已是整单元）
    const prior = level.kind === 'boss' ? [] : [...assignedBefore(chapter.levels, level)].filter(k => !lessonKeys.has(k)).map(k => byKey.get(k)!).filter(q => q && playableKeys.has(q.key) && !isBossOnly(q) && (multiBand(cfg.band) || !isMultiSel(q)));
    // r13 策划：题池用完 → 同单元相邻小节（前面的先），再不够才重复；语文课文 / 古诗词不跨课，只重复
    const noCross = level.kind === 'boss' || ['语文', '诗词'].includes(chapter.subject);
    const mf = (q: Question) => q && playableKeys.has(q.key) && !isBossOnly(q) && !lessonKeys.has(q.key) && (multiBand(cfg.band) || !isMultiSel(q)) && !seenMulti(q);
    const adjGroups: Question[][] = noCross ? [] : (() => { const all = chapter.levels, idx = all.findIndex(l => l.id === level.id);
      const ls = levelsOfUnit(all, level).filter(l => l.kind === 'normal' && l.id !== level.id && !l.redirect);
      const before = ls.filter(l => all.indexOf(l) < idx).reverse() /* r14 策划：只取前面已学的小节，最近的先 */, after = ls.filter(l => all.indexOf(l) > idx);
      void after; return [...before].map(l => l.pool.map(k => byKey.get(k)!).filter(mf)).filter(g => g.length); })();
    const sameLesson = new Set(lessonOthers.map(q => q.key));
    const reserve1 = [...fallback0, ...lessonOthers.filter(q => !fallback0.some(x => x.key === q.key))];
    const adj1 = adjGroups.map(g => g.filter(q => !sameLesson.has(q.key))).filter(g => g.length);
    masteredThisLevel.current = 0; setInterrupted(null);
    setScreen({ s: 'battle', level, qs: qs2, extra: extra2, prior, review: [...dueKeys], reserve: (multiBand(cfg.band) ? reserve1 : reserve1.filter(q => !isMultiSel(q))).filter(q => !seenMulti(q)), adj: adj1, prevStem: prevQ ? stemOf(prevQ) : undefined, nonce: Date.now() });
  }
  function endLevel(level: Level, r: BattleResult) {
    if (!p) return;
    const played = progress.plays[level.id]?.day === today ? progress.plays[level.id].count : 0;
    // 防刷（D3）：同关当天第 3 次起不再新增星星（历史最高保留）
    // r10（较真家长）：一题都没答对（例如全部超时）不算「胜利」，0★；时长用完被强制结算一律按「时间到」
    if (!r.kinder && r.correct === 0 && r.win) r = { ...r, win: false };
    if (myRemaining <= 0 && !r.win && !r.quit) r = { ...r, timeUp: r.timeUp || r.correct === 0 };
    if (r.retreat && !retreatCleared(r)) r = { ...r, win: false };   // r12：撤退 < 40% 不算通关、不得星
    const stars = levelStars(r);   // 裁定 1：撤退最多 ★、时间到 0★；小班 correct = 第一次答对
    // r13 小萌新：同关当天第 3 次起不再加星（D3），但这一关还没有星星时照样记上——以前前两次没打赢、第 3 次 1★ 结算页显示 1★，地图却 0★、Boss 不解锁
    const prevBest = starOf(level, progress.stars);
    const gain = played >= 2 && prevBest > 0 ? 0 : stars;
    const mastered = masteredThisLevel.current;
    // r12 小萌新：先落盘（星星、进度、清掉「没打完」记录）再显示结算页——结算页停多久、页面被关/刷新都不丢星
    const pr = progress;
    const nx = { ...pr, stars: { ...pr.stars, ...Object.fromEntries([level.id, ...(level.parts ?? [])].map(id => [id, Math.max(pr.stars[id] ?? 0, gain)])) }, masteredStars: pr.masteredStars + mastered,
      plays: { ...pr.plays, [level.id]: { day: today, count: (pr.plays[level.id]?.day === today ? pr.plays[level.id].count : 0) + 1 } } };
    writeRun(p.id, null); writeNav({ pid: p.id, grade: vg, s: 'map', at: Date.now(), bv: BAL_VER });
    try { localStorage.setItem('zy.lastEnd:' + p.id, JSON.stringify({ levelId: level.id, at: Date.now() })); } catch { /* */ }   // r14.1：结算落盘时间（启动时比它早的「没打完」记录作废）
    S.saveProgress(p.id, nx); setProgress(nx);
    const best = Math.max(pr.stars[level.id] ?? 0, gain);
    setScreen({ s: 'result', level, r, stars, mastered, best, prevBest, capped: gain === 0 && stars > 0, playN: played + 1 });
  }
  const nextLevelOf = (level: Level) => { const ch = chapters.find(c => c.subject === level.chapter); const i = ch?.levels.findIndex(l => l.id === level.id) ?? -1; return ch && i >= 0 ? ch.levels[i + 1] : undefined; };
  const flagQ = (q: Question) => { const nf = { ...flags, [q.key]: (flags[q.key] ?? 0) + 1 }; setFlags(nf); S.saveFlags(nf); };
  const startReview = (keys: string[]) => { if (myRemaining <= 0) { setTimeUpNote(true); return; } const qs = keys.map(k => bank!.byKey.get(k)).filter((q): q is Question => !!q); if (qs.length) { masteredThisLevel.current = 0; setScreen({ s: 'review', qs, nonce: Date.now() }); } };

  const theme = cfg && !['profiles', 'gate', 'parent', 'loading'].includes(screen.s) ? 'theme-' + cfg.theme : '';
  return (
    <div className={`app ${theme}`} onPointerDown={e => unlockAudio(e.nativeEvent)}>
      {!tabActive && <div className="tab-inactive" data-testid="tab-inactive"><div className="p-card wide-panel"><h2>已在别处打开</h2><p>知识勇者在这台设备的另一个标签页 / 窗口里打开了。为了不把数据弄乱，这里先停下。</p><button className="btn big-sq" data-testid="tab-takeover" onClick={() => { claimTab(); logReload('tab-takeover', screenRef.current.s); location.reload(); }}>在这里继续</button></div></div>}
      {portrait && !tipGone && !(phonePortrait && (screen.s === 'battle' || screen.s === 'review')) && <div className="portrait-tip" data-testid="portrait-tip" aria-hidden onAnimationEnd={() => setTipGone(true)}>横过来玩更舒服哦 ↻</div>}
      {storageErr && screen.s === 'parent' && <div className="sys-bar yellow-bar" data-testid="storage-error" onClick={() => setStorageErr(undefined)}>保存失败：平板存储空间可能不足，请导出备份（{storageErr}）。点此关闭</div>}
      {clock.locked && ['profiles', 'map'].includes(screen.s) && <div className="sys-bar warn-bar inflow" data-testid="clock-lock">⏰ 平板时间好像被调过了，请爸爸妈妈确认一下 <button className="chip" onClick={() => setScreen({ s: 'gate' })}>家长解锁</button></div>}
      {updateReady && ['profiles', 'map'].includes(screen.s) && <button className="sys-bar" data-testid="update-ready" onClick={() => updateReady()}>✨ 有新版本，点这里更新（不会丢进度）</button>}
      {exitNote && (screen.s === 'profiles' || (screen.s === 'map' && !interrupted)) && <div className="sys-bar warn-bar inflow" data-testid="exit-note" onClick={() => setExitNote(undefined)}>ℹ️ {exitNote}（点此关闭）</div>}
      {interrupted && screen.s === 'map' && interrupted.pid === pid && <div className="sys-bar warn-bar inflow" data-testid="interrupted">上次玩「{interrupted.name}」没有打完：{CAUSE_TEXT[interrupted.cause ?? 'navigate'] ?? CAUSE_TEXT.navigate}。{interrupted.n ? `已答的 ${interrupted.n} 道题记进了学习记录和错题本，` : ''}这一关的星星没有算。点〔重新开始这一关〕＝马上从第 1 题重新打；点〔知道了〕＝关掉这条提示，留在地图。
        <button className="chip" data-testid="interrupted-again" onClick={() => { const l = chapters.flatMap(c => c.levels).find(x => x.id === interrupted.levelId); setInterrupted(null); if (l) startLevel(l); }}>重新开始这一关</button>
        <button className="chip" onClick={() => setInterrupted(null)}>知道了</button></div>}
      {/* r11：「没打完」只提示给那个孩子本人（进了他的地图才显示），首页不再显示别人的提示，也不会打断正在玩的孩子 */}
      {screen.s === 'loading' && <div className="center-screen"><h1 className="title">⚔️ 知识勇者</h1><p className="sub">正在加载题库… {loadPct}%</p></div>}
      {/* r15.4 小萌新：收尾提示不再浮在题目上——放在页面最上面一行，把下面的内容往下挤（order:-1，不是 fixed）。
          小班（不识字）不写字：一个大闹钟图标 + 收尾进度条，进入收尾时朗读一次，点图标再读一遍 */}
      {overTime && (cfg?.band === 'K'
        ? <button className="grace-icon" data-testid="grace-icon" aria-label={GRACE_VOICE} onClick={() => speak(GRACE_VOICE)}>
            <span className="gi-clock" aria-hidden>⏰</span><span className="gi-track" aria-hidden><span className="gi-fill" style={{ width: `${Math.max(0, Math.min(100, graceLeft / 180 * 100))}%` }} /></span><span className="gi-sleep" aria-hidden>🛏️</span></button>
        : <div className="grace-bar" data-testid="grace-bar">⏰ 今天的时间到啦 · 收尾时间 {Math.floor(graceLeft / 60)}:{String(graceLeft % 60).padStart(2, '0')}：打完这一关就休息（收尾最多 3 分钟，不是还能玩的时间）· 明天 0:00 重新计时</div>)}
      {overTime && cfg?.band === 'K' && graceCard && <div className="grace-pop" data-testid="grace-pop" aria-hidden><div className="gp-card">
        <div className="gp-pup">{char && <img src={char.img} alt="" draggable={false} />}<span className="gp-yawn">🥱</span></div>
        <div className="gp-clock">⏰</div><div className="gp-bed">🛏️</div></div></div>}
      {ttsIssue && <div className="sys-bar warn-bar inflow tts-bar" data-testid="tts-issue" role="status" onClick={() => setTtsIssue(null)}>{/* r15.4.2 技术QA P4：小屏上一两行就够，关闭用 ✕ */}🔇 {ttsIssue === 'blocked' ? '点一下屏幕就能听到朗读' : ttsIssue === 'missing' ? '这段录音还没下载好，联网后自动补全' : ttsIssue === 'novoice' ? '没有中文朗读语音（家长：系统设置 → 文字转语音）' : '这台平板暂时不能朗读（家长：系统设置 → 文字转语音）'} <span className="tts-x" aria-label="关闭">✕</span></div>}
      {resetCancelled && <div className="sys-bar warn-bar" data-testid="pin-reset-cancelled" onClick={() => setResetCancelled(false)}>⏰ 检测到平板时间被调过，正在进行的家长密码重设申请已自动取消。（点此关闭）</div>}
      {settings.pinReset && !resetNoticeSeen && screen.s !== 'loading' && <div className="fullscreen-notice" data-testid="pin-reset-notice-full" role="dialog"><div className="fs-card">
        <h1>有人申请重设家长密码</h1><ResetWhy testid="reset-rules" /><p data-testid="pin-reset-days">已申请 {Math.max(0, Math.floor((Date.now() - settings.pinReset.requestedAt) / 86400e3))} 天</p>{settings.pinReset.ready ? <p>已到期</p> : <p className="big-rule">已等 {Math.min(72, Math.floor(pendingWaitedMs(settings.pinReset) / 3600e3)) /* r15.4：和忘记密码页同一个数（联网申请按网络时间差），以前用本机累计 observed，两处显示会不一样 */} 小时（满 72 小时）<br />已打开 {Math.min(PEND_DAYS, pendingDays(settings.pinReset))}/{PEND_DAYS} 天</p>}
        <p className="hint">到期后还要答对找回问题（或输入恢复码）才能设新密码。</p>
        <div className="row gap16"><button className="btn danger" data-testid="pin-reset-full-cancel" onClick={() => setCancelBox(true)}>{CANCEL_BTN}</button>{/* r15.4 策划定稿：取消要家长密码或恢复码 */}
          <button className="btn ghost" data-testid="pin-reset-full-ok" onClick={() => setResetNoticeSeen(true)}>知道了</button></div></div></div>}
      {settings.pinReset && ['profiles', 'map', 'stage', 'grade', 'char', 'wrongbook', 'result', 'review-done', 'parent', 'gate'].includes(screen.s) && <div className="sys-bar warn-bar" data-testid="pin-reset-pending">🔑 有人申请重设家长密码：{settings.pinReset.ready ? '已到期（还要回答找回问题或输入恢复码）' : <>已等 {Math.min(72, Math.floor(pendingWaitedMs(settings.pinReset) / 3600e3)) /* r15.4：和忘记密码页同一个数（联网申请按网络时间差），以前用本机累计 observed，两处显示会不一样 */} 小时（满 72）· 已打开 {Math.min(PEND_DAYS, pendingDays(settings.pinReset))}/{PEND_DAYS} 天</>}。<button className="chip" data-testid="pin-reset-cancel" onClick={() => setCancelBox(true)}>{CANCEL_BTN}</button></div>}
      {settings.pinReset && cancelBox && <ResetCancelBox settings={settings} onBack={() => setCancelBox(false)} onCancelled={() => { setSettings({ ...settingsRef.current, pinReset: undefined }); setResetNoticeSeen(true); setCancelBox(false); setCancelDone(true); setTimeout(() => setCancelDone(false), 8000); }} />}
      {cancelDone && <div className="sys-bar ok-bar" role="status" data-testid="reset-cancel-done" onClick={() => setCancelDone(false)}>✅ 已取消申请：家长密码没有变，还是原来的。（点此关闭）</div>}
      {warn3 && myRemaining > 0 && myRemaining <= 180 && <div className="sys-bar warn-bar" data-testid="warn3" onClick={() => setWarn3(false)}>⏳ 还有 {Math.ceil(myRemaining / 60)} 分钟就到今天的游戏时间了，准备收尾吧（点此关闭）</div>}
      {!warn3 && warnMini && myRemaining > 0 && myRemaining <= 180 && <div className="warn-mini" data-testid="warn3-mini" title="今天的游戏时间快到了">⏳ {Math.ceil(myRemaining / 60)} 分</div>}
      {timeUpNote && screen.s === 'map' && <div className="sys-bar warn-bar" data-testid="timeup-note" onClick={() => setTimeUpNote(false)}>⏰ 今天的时间用完啦，不能再答题了。<br />明天 0:00 重新计时。<br />（家长可在设置里加时间）</div>}
      {pinNudge && <div className="modal-back" data-testid="pin-nudge"><div className="modal"><h2>要不要设一个家长密码？</h2><p>现在换孩子档案不需要密码，孩子可以随意进别人的档案、改设置。设了密码后，换档案和进家长页都要输密码（家长页里可以关掉「换档案要密码」）。</p>
        <div className="row gap16"><button className="btn" data-testid="pin-nudge-set" onClick={() => { const pp = pinNudge; setPinNudge(null); setSettings({ ...settingsRef.current, pinNudged: true }); setScreen({ s: 'gate', next: 'pick', pick: pp.id }); }}>设置密码</button>
        <button className="btn ghost" data-testid="pin-nudge-skip" onClick={() => { const pp = pinNudge; setPinNudge(null); setSettings({ ...settingsRef.current, pinNudged: true }); void pickProfile(pp, true); }}>跳过</button></div></div></div>}
      {screen.s === 'profiles' && <ProfileSelect profiles={profiles} remaining={Object.fromEntries(profiles.map(x => [x.id, remaining(x.id)]))} bonus={Object.fromEntries(profiles.map(x => [x.id, bonusShown(usage[x.id], today)]))} onPick={pickProfile} onParent={() => setScreen({ s: 'gate' })}
        canAdd={profiles.length < DESIGN.maxProfiles} adding={!!screen.adding} onAddRequest={() => setScreen({ s: 'gate', next: 'add' })} onAddClose={() => setScreen({ s: 'profiles' })}
        onAdd={p => { setProfiles(ps => [...ps, p]); setLastPid(p.id); addedPid.current = p.id; try { localStorage.setItem('zy.lastPlayer', JSON.stringify({ pid: p.id, day: today })); } catch { /* */ } setScreen({ s: 'profiles' }); }} />}   {/* r14.1：添加孩子已经过家长密码，进这个新档案不再问一次 */}
      {screen.s === 'gate' && <ParentGate allHints={profiles.map(x => x.pinVault?.pinHint?.a).filter((a): a is string => !!a)} settings={settings} purpose={screen.next === 'add' ? '添加孩子需要家长确认' : undefined}
        onRecConfirmed={() => setSettings({ ...settingsRef.current, recConfirmed: true })} onSetPin={(h, hint, rec) => h ? setSettings({ ...settings, pinHash: h, pinHint: hint ?? settings.pinHint, pinRec: rec ?? settings.pinRec, ...(rec ? { recConfirmed: false } : {}), ...(rec && settings.pinReset ? { pinReset: undefined, pinResetDoneAt: Date.now() } : {}) }) : clearPin(settings.pinReset ? { pinReset: undefined, pinResetDoneAt: Date.now() } : {})}
        onRestorePin={(h, hint, rec) => setSettings({ ...settings, pinHash: h, pinHint: hint ?? settings.pinHint, pinRec: rec ?? settings.pinRec })} hasProgress={profiles.length > 0}
        onRequestReset={() => { setResetNoticeSeen(true); setSettings({ ...settings, pinReset: newPending(Date.now()) }); }}
        onOk={() => { if (screen.next === 'pick') { const pp = profiles.find(x => x.id === screen.pick); if (pp) { void pickProfile(pp, true); return; } } setScreen(screen.next === 'add' ? { s: 'profiles', adding: true } : { s: 'parent' }); }} onCancel={() => setScreen({ s: 'profiles' })} />}
      {screen.s === 'parent' && bank && <ParentSettings currentPid={lastPid} settings={settings} setSettings={setSettings} profiles={profiles} setProfiles={setProfiles} bank={bank} reloadBank={reloadBank}
        usage={usage} setUsage={setUsage} skills={allSkills} flags={flags} clockLocked={clock.locked} unlockClock={() => unlockClock(false)} resetTiming={() => unlockClock(true)} remainingOf={remaining} onClose={() => setScreen({ s: 'profiles' })} />}
      {screen.s === 'char' && cfg && p && <CharSelect cfg={cfg} current={p.charId} subjects={chapters.map(c => c.subject)} onBack={() => setScreen(p.charId ? { s: 'map' } : { s: 'grade', stage: stageOf(p.grade) })}
        onPick={c => { setProfiles(ps => ps.map(x => x.id === p.id ? { ...x, charId: c.id, charIds: { ...x.charIds, [cfg.chars]: c.id } } : x)); const then = screen.then; setScreen({ s: 'map' }); if (then) setPendingStart(then); }} />}
      {screen.s === 'stage' && p0 && <StagePick who={`${p0.avatar} ${p0.name} · ${GRADE_LABEL[p0.grade]}档案`} current={defaultPick(p0.grade, lastGradeOf(p0))} profileGrade={p0.grade} onPick={st => setScreen({ s: 'grade', stage: st })} onBack={() => { setPid(undefined); setScreen({ s: 'profiles' }); }} />}
      {screen.s === 'grade' && p0 && <GradePick stage={screen.stage} current={defaultPick(p0.grade, lastGradeOf(p0))} profileGrade={p0.grade} onBack={() => setScreen({ s: 'stage' })}
        onPick={g => enterGrade(g)} />}
      {screen.s === 'gate-grade' && p0 && <ParentGate allHints={profiles.map(x => x.pinVault?.pinHint?.a).filter((a): a is string => !!a)} settings={settings} purpose={screen.g === p0.grade ? `切换年级需要家长确认（回到${GRADE_LABEL[p0.grade]}）` : `去${GRADE_LABEL[screen.g]}需要家长确认（${p0.name}的档案是${GRADE_LABEL[p0.grade]}）`}
        onRecConfirmed={() => setSettings({ ...settingsRef.current, recConfirmed: true })} onSetPin={(h, hint, rec) => h ? setSettings({ ...settings, pinHash: h, pinHint: hint ?? settings.pinHint, pinRec: rec ?? settings.pinRec, ...(rec ? { recConfirmed: false } : {}), ...(rec && settings.pinReset ? { pinReset: undefined, pinResetDoneAt: Date.now() } : {}) }) : clearPin(settings.pinReset ? { pinReset: undefined, pinResetDoneAt: Date.now() } : {})}
        onRestorePin={(h, hint, rec) => setSettings({ ...settings, pinHash: h, pinHint: hint ?? settings.pinHint, pinRec: rec ?? settings.pinRec })} hasProgress={profiles.length > 0}
        onRequestReset={() => { setResetNoticeSeen(true); setSettings({ ...settings, pinReset: newPending(Date.now()) }); }}
        onOk={() => enterGrade(screen.g, true)} onCancel={() => setScreen({ s: 'grade', stage: stageOf(screen.g) })} />}
      {screen.s === 'map' && cfg && p && <MapScreen p={p} cfg={cfg} chapters={chapters} progress={progress} wrong={wrong} remaining={myRemaining} bonus={pid ? bonusShown(usage[pid], today) : 0} c={char}
        chapterIdx={chapterIdx} setChapterIdx={setChapterIdx} onLevel={startLevel} onBack={() => setScreen({ s: 'grade', stage: stageOf(p.grade) })}
        onWrongBook={() => setScreen({ s: 'wrongbook' })} onChar={() => setScreen({ s: 'char' })}
        onReview={() => startReview(wrong.filter(e => isDue(e)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 10).map(e => e.qkey))} />}
      {screen.s === 'battle' && cfg && char && p && needTutorial && (cfg.battle === 'kinder'
        ? <KinderTutorial c={char} onDone={finishTutorial} />
        : <StdTutorial cfg={cfg} onDone={finishTutorial} onlyCard3={onlyCard3} />)}
      {screen.s === 'battle' && cfg && char && !needTutorial && (cfg.battle === 'kinder'
        ? <KinderBattle demoReward={settings.kinderDemoReward ?? DESIGN.kinderDemoReward} key={screen.nonce} cfg={cfg} c={char} kind={screen.level.kind} unit={screen.level.unit} title={screen.level.name} questions={screen.qs} review={screen.review} extra={screen.extra}
            onAnswer={(q, ok, a) => onAnswer(q, ok, a)} onEnd={r => endLevel(screen.level, r)} onQuit={() => setScreen({ s: 'map' }, 'quit')} />
        : cfg.battle === 'full'
        ? <RoundBattle electives={p0?.electives} prevStem={screen.prevStem} seen={seenKeys} prior={screen.prior} reserve={screen.reserve} adj={screen.adj} key={screen.nonce} cfg={cfg} c={char} kind={screen.level.kind} unit={screen.level.unit} title={screen.level.name} questions={screen.qs} review={screen.review} extra={screen.extra}
            wagerOn={settings.hsWager ?? true} lowGrade={p?.grade === '3' || p?.grade === '4'}
            tips={p0?.tips} onTip={k => { const id = pid; setProfiles(ps => ps.map(x => x.id === id ? { ...x, tips: { ...x.tips, [k]: true } } : x)); }}
            onAnswer={(q, ok, a) => onAnswer(q, ok, a)} onEnd={r => endLevel(screen.level, r)} onQuit={() => setScreen({ s: 'map' }, 'quit')} onFlag={flagQ} />
        : <StdBattle key={screen.nonce} cfg={cfg} c={char} kind={screen.level.kind} unit={screen.level.unit} title={screen.level.name} questions={screen.qs} review={screen.review} extra={screen.extra} g1NoLimit={settings.g1NoLimit}
            onAnswer={(q, ok, a) => onAnswer(q, ok, a)} onEnd={r => endLevel(screen.level, r)} onQuit={() => setScreen({ s: 'map' }, 'quit')} onFlag={flagQ} />)}
      {screen.s === 'result' && cfg && char && <ResultScreen kMon={screen.r.kMon} endReason={screen.r.endReason} chalHint={chalCostStar(screen.r)} exhausted={!!screen.r.exhausted} prevBest={screen.prevBest} capped={screen.capped} playN={screen.playN} half={screen.r.half} cfg={cfg} c={char} win={screen.r.win} stars={screen.stars} best={screen.best} correct={screen.r.correct} total={screen.r.total} kinder={screen.r.kinder} retreat={screen.r.retreat} quit={screen.r.quit} turns={screen.r.turns}
        newlyMastered={screen.mastered} timeUp={myRemaining <= 0} forcedTimeUp={!!screen.r.timeUp} onAgain={() => startLevel(screen.level)} onMap={() => setScreen({ s: 'map' })}
        onNext={screen.r.win && !screen.r.timeUp && nextLevelOf(screen.level) ? () => startLevel(nextLevelOf(screen.level)!) : undefined} />}
      {screen.s === 'wrongbook' && bank && <WrongBookScreen wrong={wrong} byKey={bank.byKey} onBack={() => setScreen({ s: 'map' })} onReview={startReview} timeUp={myRemaining <= 0} />}
      {phonePortrait && (screen.s === 'battle' || screen.s === 'review') && <RotateOverlay kinder={cfg?.band === 'K'} pic={char ? <Sprite c={char} /> : undefined} />}
      {screen.s === 'review' && <ReviewSession key={screen.nonce} questions={screen.qs} onAnswer={(q, ok, a) => onAnswer(q, ok, a, true)}
        onDone={(right, total) => { if (masteredThisLevel.current && p) setProgress(pr => { const nx = { ...pr, masteredStars: pr.masteredStars + masteredThisLevel.current }; S.saveProgress(p.id, nx); return nx; }); setScreen({ s: 'review-done', right, total }); }} />}
      {screen.s === 'review-done' && <div className="center-screen"><div className="big-emoji xl">📕</div><h1>复习完成</h1><p className="sub" data-testid="review-stats">答对 {screen.right} / {screen.total} 题</p>
        <div className="row gap24"><button className="btn ghost" onClick={() => setScreen({ s: 'wrongbook' })}>看错题本</button><button className="btn" onClick={() => setScreen({ s: 'map' })}>回地图</button></div></div>}
    </div>
  );
}
