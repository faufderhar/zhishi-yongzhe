import { backupPin } from './game/pin';
import { GRADE_LABEL, type GradeKey } from './game/questions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './app.css';
import { loadFxManifests } from './fx/assets';
import { prefetchAll } from './fx/sheets';
import { cacheForOffline } from './offlineCache';
import { multiBand, isMultiSel } from './game/multi';
import { stageOf, needsGate, defaultPick, type StageId } from './game/stages';
import { StagePick, GradePick } from './ui/StagePick';
import { STORAGE_ERROR, deleteProfileData, compactAnswers } from './db';
import { DESIGN } from './game/config';
import { setAudioPrefs } from './tts';
import { loadAllBanks, questionsOfGrade, type BankState } from './bankStore';
import { playable, type Question } from './game/questions';
import { bandConfig, timePrefs } from './game/grades';
import { buildChapters, levelStars, bossPool, elitePool, assignedBefore, capMulti, levelsOfUnit, migrateStars, type Level } from './game/levels';
import { selectQuestions, spreadTemplates, updateSkill, type Skills } from './game/adaptive';
import { onWrong, onReviewRight, isDue, dayStr, type WrongEntry } from './game/wrongbook';
import { remainingSec, addUsage, type Usage } from './game/playtime';
import { PUPS, SCIFI, type Character } from './game/characters';
import { unlockAudio } from './tts';
import { recordAnswer, wrongOf, putWrong, delWrong, answersOf } from './db';
import * as S from './state';
import type { Profile, Progress, Settings } from './state';
import { KinderTutorial, StdTutorial } from './ui/Tutorial';
import { RoundBattle } from './ui/RoundBattle';
import { KinderBattle, StdBattle, FORCE_END, type BattleResult } from './ui/Battle';
import { ProfileSelect, CharSelect, MapScreen, ResultScreen, WrongBookScreen, ReviewSession } from './ui/Screens';
import { ParentGate, ParentSettings } from './ui/Parent';

type Nav = { pid: string; grade?: GradeKey; s: string; level?: string; name?: string; at: number; bv?: string };
const BAL_VER = 'v0.3.8';   // D14 数值版本：旧版本中断的战斗提示「数值更新了」
const NAV_KEY = 'zy-nav';
const navN = () => { try { return Number(localStorage.getItem('zy-nav-n')) || 0; } catch { return 0; } };
function readNav(): Nav | null { try { const v = JSON.parse(localStorage.getItem(NAV_KEY) ?? 'null'); return v && typeof v.pid === 'string' && typeof v.at === 'number' ? v : null; } catch { return null; } }
function writeNav(n: Nav | null) { try { if (n) localStorage.setItem(NAV_KEY, JSON.stringify(n)); else localStorage.removeItem(NAV_KEY); } catch { /* */ } }

type Screen =
  | { s: 'loading' } | { s: 'profiles'; adding?: boolean } | { s: 'gate'; next?: 'add' } | { s: 'parent' }
  | { s: 'stage' } | { s: 'grade'; stage: StageId } | { s: 'gate-grade'; g: GradeKey }
  | { s: 'map' } | { s: 'char'; then?: Level } | { s: 'battle'; level: Level; qs: Question[]; extra: Question[]; nonce: number }
  | { s: 'result'; level: Level; r: BattleResult; stars: number; mastered: number }
  | { s: 'wrongbook' } | { s: 'review'; qs: Question[]; nonce: number } | { s: 'review-done'; right: number; total: number };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ s: 'loading' });
  const [loadPct, setLoadPct] = useState(0);
  const [bank, setBank] = useState<BankState | null>(null);
  const [settings, setSettingsState] = useState<Settings>(S.DEFAULT_SETTINGS);
  const [profiles, setProfilesState] = useState<Profile[]>([]);
  const [pid, setPid] = useState<string>();
  const [progress, setProgress] = useState<Progress>(S.emptyProgress());
  const [skills, setSkills] = useState<Skills>({});
  const [allSkills, setAllSkills] = useState<Record<string, Skills>>({});
  const [usage, setUsageAll] = useState<Record<string, Usage>>({});
  const [wrong, setWrong] = useState<WrongEntry[]>([]);
  const [recentRight, setRecentRight] = useState<Set<string>>(new Set());
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set());   // 出过的题（Boss 选题优先没出过的）
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
      if (st.pinHash) backupPin(st.pinHash, st.pinHint); setSettingsState(st); setProfilesState(ps); setFlags(fl);
      const us: Record<string, Usage> = {}, sk: Record<string, Skills> = {};
      for (const p of ps) { us[p.id] = await S.loadUsage(p.id); sk[p.id] = await S.loadSkills(p.id); }
      // D8：今天早于时长记录里最大的日期 → 也算时间被调回
      const maxDay = Object.values(us).flatMap(u => Object.keys(u)).sort().pop();
      if (maxDay && dayStr() < maxDay && !ck2.locked) ck2 = { ...ck2, locked: true, lockedAt: Date.now() };
      setClock(ck2); void S.saveClock(ck2);
      // 切回前台时也检查（D8）
      document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') return; setClock(c => { const n = S.checkClock(c, Date.now()); if (n !== c) void S.saveClock(n); return n; }); });
      setUsageAll(us); setAllSkills(sk);
      await reloadBank();
      setScreen({ s: 'profiles' });
      // r9：页面被重新加载（新版本刷新、平板清理后台）后回到原来的孩子与地图；战斗中被打断的给出提示，不再静默丢进度
      const nav = readNav();
      const pp = nav && ps.find(x => x.id === nav.pid);
      const swReload = (() => { try { const v = sessionStorage.getItem('zy-sw-reload'); sessionStorage.removeItem('zy-sw-reload'); return !!v; } catch { return false; } })();
      if (nav && pp && Date.now() - nav.at < 2 * 3600e3 && nav.s !== 'profiles') {
        if (swReload) restoreRef.current = { nav, pp };   // 新版本自动刷新：直接回到原来的地图
        else if (nav.s === 'battle' && nav.level) setInterrupted({ levelId: nav.level, name: nav.name ?? '', pid: pp.id, upd: nav.bv !== BAL_VER, n: navN() });   // 战斗中被关掉：首页提示
      }
    })();
    const f = () => setPortrait(window.innerHeight > window.innerWidth);
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, [reloadBank]);

  const [lastPid, setLastPid] = useState<string>();
  const restoreRef = useRef<{ nav: Nav; pp: Profile } | null>(null);
  const [interrupted, setInterrupted] = useState<{ levelId: string; name: string; pid?: string; upd?: boolean; n?: number } | null>(null);
  const p0 = profiles.find(x => x.id === pid);
  // r8b：两级入口选的年级（默认档案年级）；非档案年级不带档案的教材册别
  const [viewGrade, setViewGrade] = useState<GradeKey | undefined>();
  const vg = p0 ? viewGrade ?? p0.grade : undefined;
  const vChars = vg ? (bandConfig(vg).chars === 'scifi' ? SCIFI : PUPS) : [];
  const p = p0 && vg ? { ...p0, homeGrade: p0.grade, grade: vg, volumes: vg === p0.grade ? p0.volumes : null, charId: [p0.charIds?.[bandConfig(vg).chars], p0.charId].find(id => id && vChars.some(c => c.id === id)) } : p0;
  const cfg = p ? bandConfig(p.grade) : null;
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
  // 到时：允许打完当前关，最多再 3 分钟，之后按已答题结算（策划 T-P2-2）
  // 首次联网后后台预下载各档案年龄段用到的动画（技术QA P1-6）；失败不影响流程（有程序动效兜底）
  useEffect(() => {
    if (!profiles.length || !navigator.onLine) return;
    const kinds = [...new Set(profiles.map(x => bandConfig(x.grade).chars === 'scifi' ? 'hs' : 'pup'))] as ('pup' | 'hs')[];
    // 学科怪物 + 技能特效/图标/音效：按档案年级与学科，空闲时放进运行时缓存（技术QA R6-1）
    const needs = bank ? [...new Set(profiles.map(x => x.grade))].map(g => ({ grade: g, subjects: [...new Set(questionsOfGrade(bank, g).map(q => q.subject))] })) : [];
    const noBg = __TEST_HOOKS__ && !!(window as unknown as { __zyNoOfflineCache?: boolean }).__zyNoOfflineCache;   // 仅测试构建：r5「按需懒加载」检查时关掉后台离线缓存
    const t = setTimeout(() => { if (noBg) return; void prefetchAll(undefined, kinds).catch(() => {}).then(() => cacheForOffline(needs)).catch(() => {}); }, 8000);
    const on = () => { if (!noBg) void cacheForOffline(needs).catch(() => {}); }; window.addEventListener('online', on);
    return () => { clearTimeout(t); window.removeEventListener('online', on); };
  }, [profiles.map(x => x.grade).join(), !!bank]);
  const replay = !!p && (!p.tutorialDone || !!settings.tutorialReplay?.[p.id]);
  // 老档案（看过旧引导）第一次进轮流回合战斗：只补弹第 3 张卡一次（规格 §10）
  const onlyCard3 = !!p && !replay && cfg?.battle === 'full' && !p.tutorialV036;
  const needTutorial = replay || onlyCard3;
  const finishTutorial = () => {
    if (!p) return;
    setProfiles(profiles.map(x => x.id === p.id ? { ...x, tutorialDone: true, ...(cfg?.battle === 'full' ? { tutorialV036: true } : {}) } : x));
    if (settings.tutorialReplay?.[p.id]) { const r = { ...settings.tutorialReplay }; delete r[p.id]; setSettings({ ...settings, tutorialReplay: r }); }
  };
  // r10 时长统一把关：所有答题入口（关卡 / 错题本「练习这些」/ 今日复习 / 中断恢复）进入时检查；进入后到时有 3 分钟收尾，然后强制结算
  const ANSWER_SCREENS = ['battle', 'review'];
  const [timeUpNote, setTimeUpNote] = useState(false);
  useEffect(() => { if (ANSWER_SCREENS.includes(screen.s) && myRemaining <= 0 && !graceOk.current) { setTimeUpNote(true); setScreen({ s: 'map' }); } graceOk.current = false; }, [screen]);
  const graceOk = useRef(false);
  const overTime = myRemaining <= 0 && ANSWER_SCREENS.includes(screen.s);
  useEffect(() => { if (!overTime) return; const t0 = Date.now(); setGraceLeft(180); const iv = setInterval(() => setGraceLeft(Math.max(0, 180 - Math.round((Date.now() - t0) / 1000))), 1000);
    const t = setTimeout(() => window.dispatchEvent(new Event(FORCE_END)), 3 * 60e3); return () => { clearTimeout(t); clearInterval(iv); }; }, [overTime]);
  const [graceLeft, setGraceLeft] = useState(180);
  const char: Character | undefined = p && cfg ? [...PUPS, ...SCIFI].find(c => c.id === p.charId) : undefined;

  // 计时：进入孩子档案后（地图/选角色/战斗/结算/错题本/复习）且页面可见时都计；幼儿园短关卡以前只计战斗，几乎为 0（试玩报告 #10）
  const playing = !!pid && ['battle', 'review', 'map', 'result', 'char', 'wrongbook'].includes(screen.s);
  // 按时间戳差值累计（技术QA P2-3）：每秒结算一次、暂停/后台不计、单次差值封顶 2 秒；同时做会话内时钟跳变检测
  useEffect(() => {
    if (!playing || !pid) return;
    let lastPerf = performance.now(), lastWall = Date.now(), acc = 0;
    const t = setInterval(() => {
      const nowP = performance.now(), nowW = Date.now();
      const dp = nowP - lastPerf, dw = nowW - lastWall; lastPerf = nowP; lastWall = nowW;
      if (Math.abs(dw - dp) > 10 * 60e3 || dw < -60e3) { setClock(c => { const n = { ...c, locked: true, lockedAt: nowW }; void S.saveClock(n); return n; }); }
      else setClock(c => { if (nowW <= c.maxSeen + 30e3) return c; const n = { ...c, maxSeen: nowW }; void S.saveClock(n); return n; });
      if (document.visibilityState !== 'visible' || (window as unknown as { __zyPaused?: boolean }).__zyPaused) return;
      acc += Math.min(dp, 2000);
      if (acc >= 5000) {
        const sec = Math.floor(acc / 1000); acc -= sec * 1000;
        setUsageAll(u => { const nu = addUsage(u[pid] ?? {}, dayStr(), sec); S.saveUsage(pid, nu); return { ...u, [pid]: nu }; });
      }
    }, 1000);
    return () => {
      clearInterval(t);
      const sec = Math.round(acc / 1000);   // 退出时把不足 5 秒的部分也记上
      if (sec > 0) setUsageAll(u => { const nu = addUsage(u[pid] ?? {}, dayStr(), sec); S.saveUsage(pid, nu); return { ...u, [pid]: nu }; });
    };
  }, [playing, pid]);

  const setSettings = (s: Settings) => { setSettingsState(s); S.saveSettings(s); backupPin(s.pinHash, s.pinHint); };
  const setProfiles = (ps: Profile[]) => {
    for (const old of profiles) if (!ps.some(x => x.id === old.id)) void deleteProfileData(old.id, S.profileKeys(old.id));   // P1-2：删档案连数据一起清
    setProfilesState(ps); S.saveProfiles(ps);
  };
  const setUsage = (id: string, u: Usage) => { setUsageAll(x => ({ ...x, [id]: u })); S.saveUsage(id, u); };

  // r9：恢复上次的位置（只在启动后做一次）
  useEffect(() => {
    const r = restoreRef.current; if (!r || screen.s !== 'profiles' || !bank) return; restoreRef.current = null;
    void (async () => {
      await pickProfile(r.pp);
      const g = r.nav.grade && !needsGate(r.pp.grade, r.nav.grade) ? r.nav.grade : r.pp.grade;   // 非档案年级不自动恢复：仍要家长确认
      if (['map', 'battle', 'result', 'char', 'wrongbook', 'review', 'review-done'].includes(r.nav.s)) enterGrade(g, false, r.pp);
      if (r.nav.s === 'battle' && r.nav.level) setInterrupted({ levelId: r.nav.level, name: r.nav.name ?? '', pid: r.pp.id, n: navN() });
    })();
  }, [screen, bank]);
  // r9：记下当前位置（重新加载后恢复）
  useEffect(() => {
    if (screen.s === 'loading') return;
    const lv = screen.s === 'battle' ? screen.level : undefined;
    writeNav(screen.s === 'profiles' || !pid ? null : { pid, grade: vg, s: screen.s, level: lv?.id, name: lv?.name, at: Date.now(), bv: BAL_VER });
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
    const onPop = () => {
      if (exiting.current) return;   // r10：确认退出后一次退到底，不再反复弹确认
      if (backRef.current()) { try { history.pushState({ zy: 1 }, ''); } catch { /* */ } return; }
      if (confirm('要退出知识勇者吗？')) { exiting.current = true; history.go(-(history.length - 1)); setTimeout(() => { exiting.current = false; }, 1500); } else try { history.pushState({ zy: 1 }, ''); } catch { /* */ }
    };
    window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop);
  }, []);
  // r9：新版本 SW 已接管——只在安全页面自动刷新，战斗中绝不刷新
  useEffect(() => { if (updateReady && ['profiles', 'stage', 'grade', 'map'].includes(screen.s) && !restoreRef.current) { try { sessionStorage.setItem('zy-sw-reload', '1'); } catch { /* */ } updateReady(); } }, [updateReady, screen.s]);
  async function pickProfile(pp: Profile) {
    setPid(pp.id); setLastPid(pp.id); setChapterIdx(0);
    const [pr, sk, wr, ans] = await Promise.all([S.loadProgress(pp.id), S.loadSkills(pp.id), wrongOf(pp.id), answersOf(pp.id)]);
    setProgress(pr); setSkills(sk); setWrong(wr);
    const cutoff = Date.now() - 3 * 86400e3;
    setRecentRight(new Set(ans.filter(a => a.correct && a.at > cutoff).map(a => a.questionId)));
    setSeenKeys(new Set(ans.map(a => a.questionId)));
    setViewGrade(undefined); setScreen({ s: 'stage' });
  }
  const lastGradeOf = (x: Profile) => { try { return localStorage.getItem('zy-lastGrade-' + x.id) ?? x.lastGrade; } catch { return x.lastGrade; } };
  /** 进入某年级地图（r8b）：记住选择；该学段还没选过角色就先选角色 */
  function enterGrade(g: GradeKey, gateOk = false, prof?: Profile) {
    const p0 = prof ?? profiles.find(x => x.id === pid); if (!p0) return;
    // r9：家长确认在入口处强制（不只靠界面）：非档案年级没经过确认一律先去确认页
    if (needsGate(p0.grade, g) && !gateOk) { setScreen({ s: 'gate-grade', g }); return; }
    setViewGrade(g); setChapterIdx(0);
    setProfiles(profiles.map(x => x.id === p0.id ? { ...x, lastGrade: g } : x)); try { localStorage.setItem('zy-lastGrade-' + p0.id, g); } catch { /* */ }
    const ch = bandConfig(g).chars === 'scifi' ? SCIFI : PUPS;
    const has = [p0.charIds?.[bandConfig(g).chars], p0.charId].some(id => id && ch.some(c => c.id === id));
    setScreen(has ? { s: 'map' } : { s: 'char' });
  }

  /** 每次作答：记录、难度阶梯、错题本 */
  function onAnswer(q: Question, correct: boolean, ans: string, isReview = false) {
    if (!p || !cfg) return;
    try { localStorage.setItem('zy-nav-n', String(navN() + 1)); } catch { /* */ }
    recordAnswer({ profileId: p.id, questionId: q.key, correct, at: Date.now(), subject: q.subject });
    setSeenKeys(s => s.has(q.key) ? s : new Set(s).add(q.key));
    if (!isReview) setSkills(sk => { const nx = { ...sk, [q.subject]: updateSkill(sk[q.subject], correct, cfg) }; S.saveSkills(p.id, nx); setAllSkills(a => ({ ...a, [p.id]: nx })); return nx; });
    const id = `${p.id}|${q.key}`;
    setWrong(list => {
      const prev = list.find(e => e.id === id);
      if (!correct) { const e = onWrong(prev, { profileId: p.id, qkey: q.key, subject: q.subject }, ans); putWrong(e); return [...list.filter(x => x.id !== id), e]; }
      if (prev && (isReview || isDue(prev))) {
        const nx = onReviewRight(prev);
        if (!nx) { delWrong(id); masteredThisLevel.current++; return list.filter(x => x.id !== id); }
        putWrong(nx); return list.map(x => x.id === id ? nx : x);
      }
      return list;
    });
    if (correct) setProgress(pr => ({ ...pr, xp: pr.xp + 5 * q.difficulty }));
  }

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
    const wrongKeys = new Set(wrong.map(e => e.qkey));
    const fallback0 = sameUnit.map(k => byKey.get(k)!).filter(q => q && playableKeys.has(q.key));
    const fallback = level.kind === 'boss' ? bossPool(fallback0, seenKeys, wrongKeys, cfg.questions.boss) : fallback0;
    const unitKeys = new Set(sameUnit);
    const due = wrong.filter(e => isDue(e) && unitKeys.has(e.qkey)).map(e => byKey.get(e.qkey)).filter((q): q is Question => !!q && playableKeys.has(q.key));
    const target = skills[level.chapter]?.level ?? 2;
    const n = cfg.questions[level.kind];
    // 策划 r7：精英先出本课没出现过的（含生成时已分给前面普通关的题，不只看游玩记录）；Boss 先出整章没出现过/答错的，精英预留题优先
    const assigned = assignedBefore(chapter.levels, level);
    const prefPool = level.kind === 'boss' ? bossPool(pool, seenKeys, wrongKeys, n, new Set(levelsOfUnit(chapter.levels, level).flatMap(l => l.fresh ?? [])))
      : level.kind === 'elite' ? elitePool(pool, level.fresh, seenKeys, wrongKeys, n, assigned) : pool;
    const strict = prefPool;
    const qs = capMulti(spreadTemplates(selectQuestions({ pool: strict, fallback, n, target, kind: level.kind, due, recentCorrect: recentRight, maxDifficulty: cfg.band === 'K' ? 2 : 5 }), pool), pool);
    { const w = window as unknown as { __zyTest?: boolean; __zyForceQ?: string }; if ((__TEST_HOOKS__ && w.__zyTest) && w.__zyForceQ) { const fq = [...byKey.values()].find(q => q.id === w.__zyForceQ); if (fq) qs.unshift(fq); } }   // 仅自动化测试：指定首题
    // 题少的课（语文课文/古诗词不合并）：关内重复本课题，错题优先（策划 r6）
    if (qs.length < n && pool.length && level.kind === 'normal') { const rep = [...pool].sort((a, b) => +wrongKeys.has(b.key) - +wrongKeys.has(a.key)); for (let i = 0; qs.length < n; i++) qs.push(rep[i % rep.length]); }
    const extra = selectQuestions({ pool: cfg.battle === 'full' ? pool : fallback, fallback: cfg.battle === 'full' ? fallback : [], n: cfg.battle === 'full' ? Math.max(n * 2, 30) : n * 2, target, kind: level.kind });
    // r8 多选规则：小学/幼儿园一律不出；初一/高一把本关题池里的多选题都放进候选（是否出、出几道由战斗里按回合规则决定，不受难度挑选影响）
    const qs2 = multiBand(cfg.band) ? qs : qs.filter(q => !isMultiSel(q));
    const extra2 = multiBand(cfg.band) ? [...extra, ...pool.filter(q => isMultiSel(q) && !extra.some(x => x.key === q.key) && !qs.some(x => x.key === q.key))] : extra.filter(q => !isMultiSel(q));
    masteredThisLevel.current = 0; setInterrupted(null); try { localStorage.setItem('zy-nav-n', '0'); } catch { /* */ }
    setScreen({ s: 'battle', level, qs: qs2, extra: extra2, nonce: Date.now() });
  }
  function endLevel(level: Level, r: BattleResult) {
    if (!p) return;
    const played = progress.plays[level.id]?.day === today ? progress.plays[level.id].count : 0;
    // 防刷（D3）：同关当天第 3 次起不再新增星星（历史最高保留）
    // r10（较真家长）：一题都没答对（例如全部超时）不算「胜利」，0★；时长用完被强制结算一律按「时间到」
    if (!r.kinder && r.correct === 0 && r.win) r = { ...r, win: false };
    if (myRemaining <= 0 && !r.win && !r.quit) r = { ...r, timeUp: r.timeUp || r.correct === 0 };
    const stars = levelStars(r);   // 裁定 1：撤退最多 ★、时间到 0★；小班 correct = 第一次答对
    const gain = played >= 2 ? 0 : stars;
    const mastered = masteredThisLevel.current;
    setProgress(pr => {
      const nx = { ...pr, stars: { ...pr.stars, ...Object.fromEntries([level.id, ...(level.parts ?? [])].map(id => [id, Math.max(pr.stars[id] ?? 0, gain)])) },   // 合并关同时记到各课 id（拆回后不丢星） masteredStars: pr.masteredStars + mastered,
        plays: { ...pr.plays, [level.id]: { day: today, count: (pr.plays[level.id]?.day === today ? pr.plays[level.id].count : 0) + 1 } } };
      S.saveProgress(p.id, nx); return nx;
    });
    setScreen({ s: 'result', level, r, stars, mastered });
  }
  const nextLevelOf = (level: Level) => { const ch = chapters.find(c => c.subject === level.chapter); const i = ch?.levels.findIndex(l => l.id === level.id) ?? -1; return ch && i >= 0 ? ch.levels[i + 1] : undefined; };
  const flagQ = (q: Question) => { const nf = { ...flags, [q.key]: (flags[q.key] ?? 0) + 1 }; setFlags(nf); S.saveFlags(nf); };
  const startReview = (keys: string[]) => { if (myRemaining <= 0) { setTimeUpNote(true); return; } const qs = keys.map(k => bank!.byKey.get(k)).filter((q): q is Question => !!q); if (qs.length) { masteredThisLevel.current = 0; setScreen({ s: 'review', qs, nonce: Date.now() }); } };

  const theme = cfg && !['profiles', 'gate', 'parent', 'loading'].includes(screen.s) ? 'theme-' + cfg.theme : '';
  return (
    <div className={`app ${theme}`} onPointerDown={unlockAudio}>
      {portrait && !tipGone && <div className="portrait-tip" onAnimationEnd={() => setTipGone(true)}>横过来玩更舒服哦 ↻</div>}
      {storageErr && screen.s === 'parent' && <div className="sys-bar yellow-bar" data-testid="storage-error" onClick={() => setStorageErr(undefined)}>保存失败：平板存储空间可能不足，请导出备份（{storageErr}）。点此关闭</div>}
      {clock.locked && ['profiles', 'map'].includes(screen.s) && <div className="sys-bar warn-bar" data-testid="clock-lock">⏰ 平板时间好像被调过了，请爸爸妈妈确认一下 <button className="chip" onClick={() => setScreen({ s: 'gate' })}>家长解锁</button></div>}
      {updateReady && ['profiles', 'map'].includes(screen.s) && <button className="sys-bar" data-testid="update-ready" onClick={() => updateReady()}>✨ 有新版本，点这里更新（不会丢进度）</button>}
      {interrupted && screen.s === 'map' && <div className="sys-bar warn-bar" data-testid="interrupted">上次玩「{interrupted.name}」时游戏没有正常结束就关掉了（可能是切到别的应用太久被平板关掉，或者版本更新）。{interrupted.n ? `已经答的 ${interrupted.n} 道题都保存了，` : ''}这一关需要重新开始
        <button className="chip" data-testid="interrupted-again" onClick={() => { const l = chapters.flatMap(c => c.levels).find(x => x.id === interrupted.levelId); setInterrupted(null); if (l) startLevel(l); }}>重新开始这一关</button>
        <button className="chip" onClick={() => setInterrupted(null)}>知道了</button></div>}
      {interrupted?.pid && screen.s === 'profiles' && (() => { const ip = profiles.find(x => x.id === interrupted.pid); return ip && <div className="sys-bar warn-bar" data-testid="interrupted-home">{ip.avatar} {ip.name}上次玩「{interrupted.name}」时游戏没有正常结束就关掉了（可能是切到别的应用太久被平板关掉，或者版本更新）。{interrupted.n ? `已经答的 ${interrupted.n} 道题都保存了。` : ''}{interrupted.upd ? '游戏数值更新了，这一关要重新开始。' : ''}
        <button className="chip" data-testid="interrupted-go" onClick={() => { restoreRef.current = { nav: { pid: ip.id, grade: ip.lastGrade && !needsGate(ip.grade, ip.lastGrade) ? ip.lastGrade : ip.grade, s: 'battle', level: interrupted.levelId, name: interrupted.name, at: Date.now() }, pp: ip }; setScreen({ s: 'profiles', adding: false }); }}>回到这一关</button>
        <button className="chip" onClick={() => setInterrupted(null)}>知道了</button></div>; })()}
      {screen.s === 'loading' && <div className="center-screen"><h1 className="title">⚔️ 知识勇者</h1><p className="sub">正在加载题库… {loadPct}%</p></div>}
      {overTime && <div className="sys-bar warn-bar grace-bar" data-testid="grace-bar">⏰ 时间到啦，打完这一关（最多 3 分钟，还剩 {Math.floor(graceLeft / 60)}:{String(graceLeft % 60).padStart(2, '0')}）</div>}
      {timeUpNote && screen.s === 'map' && <div className="sys-bar warn-bar" data-testid="timeup-note" onClick={() => setTimeUpNote(false)}>⏰ 今天的时间用完啦，不能再答题了，明天再来！（家长可在设置里加时间）</div>}
      {screen.s === 'profiles' && <ProfileSelect profiles={profiles} remaining={Object.fromEntries(profiles.map(x => [x.id, remaining(x.id)]))} onPick={pickProfile} onParent={() => setScreen({ s: 'gate' })}
        canAdd={profiles.length < DESIGN.maxProfiles} adding={!!screen.adding} onAddRequest={() => setScreen({ s: 'gate', next: 'add' })} onAddClose={() => setScreen({ s: 'profiles' })}
        onAdd={p => { setProfiles([...profiles, p]); setScreen({ s: 'profiles' }); }} />}
      {screen.s === 'gate' && <ParentGate settings={settings} purpose={screen.next === 'add' ? '添加孩子需要家长确认' : undefined}
        onSetPin={(h, hint) => setSettings({ ...settings, pinHash: h || undefined, pinHint: hint ?? settings.pinHint })}
        onRestorePin={(h, hint) => setSettings({ ...settings, pinHash: h, pinHint: hint ?? settings.pinHint })} hasProgress={profiles.length > 0}
        onOk={() => setScreen(screen.next === 'add' ? { s: 'profiles', adding: true } : { s: 'parent' })} onCancel={() => setScreen({ s: 'profiles' })} />}
      {screen.s === 'parent' && bank && <ParentSettings currentPid={lastPid} settings={settings} setSettings={setSettings} profiles={profiles} setProfiles={setProfiles} bank={bank} reloadBank={reloadBank}
        usage={usage} setUsage={setUsage} skills={allSkills} flags={flags} clockLocked={clock.locked} unlockClock={() => { const n = { maxSeen: Date.now(), locked: false }; setClock(n); void S.saveClock(n); }} onClose={() => setScreen({ s: 'profiles' })} />}
      {screen.s === 'char' && cfg && p && <CharSelect cfg={cfg} current={p.charId} subjects={chapters.map(c => c.subject)} onBack={() => setScreen(p.charId ? { s: 'map' } : { s: 'grade', stage: stageOf(p.grade) })}
        onPick={c => { setProfiles(profiles.map(x => x.id === p.id ? { ...x, charId: c.id, charIds: { ...x.charIds, [cfg.chars]: c.id } } : x)); const then = screen.then; setScreen({ s: 'map' }); if (then) setTimeout(() => startLevel(then), 0); }} />}
      {screen.s === 'stage' && p0 && <StagePick current={defaultPick(p0.grade, lastGradeOf(p0))} profileGrade={p0.grade} onPick={st => setScreen({ s: 'grade', stage: st })} onBack={() => { setPid(undefined); setScreen({ s: 'profiles' }); }} />}
      {screen.s === 'grade' && p0 && <GradePick stage={screen.stage} current={defaultPick(p0.grade, lastGradeOf(p0))} profileGrade={p0.grade} onBack={() => setScreen({ s: 'stage' })}
        onPick={g => enterGrade(g)} />}
      {screen.s === 'gate-grade' && p0 && <ParentGate settings={settings} purpose={`去${GRADE_LABEL[screen.g]}需要家长确认（${p0.name}的档案是${GRADE_LABEL[p0.grade]}）`}
        onSetPin={(h, hint) => setSettings({ ...settings, pinHash: h || undefined, pinHint: hint ?? settings.pinHint })}
        onRestorePin={(h, hint) => setSettings({ ...settings, pinHash: h, pinHint: hint ?? settings.pinHint })} hasProgress={profiles.length > 0}
        onOk={() => enterGrade(screen.g, true)} onCancel={() => setScreen({ s: 'grade', stage: stageOf(screen.g) })} />}
      {screen.s === 'map' && cfg && p && <MapScreen p={p} cfg={cfg} chapters={chapters} progress={progress} wrong={wrong} remaining={myRemaining} c={char}
        chapterIdx={chapterIdx} setChapterIdx={setChapterIdx} onLevel={startLevel} onBack={() => setScreen({ s: 'grade', stage: stageOf(p.grade) })}
        onWrongBook={() => setScreen({ s: 'wrongbook' })} onChar={() => setScreen({ s: 'char' })}
        onReview={() => startReview(wrong.filter(e => isDue(e)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 10).map(e => e.qkey))} />}
      {screen.s === 'battle' && cfg && char && p && needTutorial && (cfg.battle === 'kinder'
        ? <KinderTutorial c={char} onDone={finishTutorial} />
        : <StdTutorial cfg={cfg} onDone={finishTutorial} onlyCard3={onlyCard3} />)}
      {screen.s === 'battle' && cfg && char && !needTutorial && (cfg.battle === 'kinder'
        ? <KinderBattle demoReward={settings.kinderDemoReward ?? DESIGN.kinderDemoReward} key={screen.nonce} cfg={cfg} c={char} kind={screen.level.kind} title={screen.level.name} questions={screen.qs} extra={screen.extra}
            onAnswer={(q, ok, a) => onAnswer(q, ok, a)} onEnd={r => endLevel(screen.level, r)} onQuit={() => setScreen({ s: 'map' })} />
        : cfg.battle === 'full'
        ? <RoundBattle seen={seenKeys} key={screen.nonce} cfg={cfg} c={char} kind={screen.level.kind} title={screen.level.name} questions={screen.qs} extra={screen.extra}
            wagerOn={settings.hsWager ?? true} lowGrade={p?.grade === '3' || p?.grade === '4'}
            tips={p0?.tips} onTip={k => setProfilesState(ps => { const nx = ps.map(x => x.id === pid ? { ...x, tips: { ...x.tips, [k]: true } } : x); S.saveProfiles(nx); return nx; })}
            onAnswer={(q, ok, a) => onAnswer(q, ok, a)} onEnd={r => endLevel(screen.level, r)} onQuit={() => setScreen({ s: 'map' })} onFlag={flagQ} />
        : <StdBattle key={screen.nonce} cfg={cfg} c={char} kind={screen.level.kind} title={screen.level.name} questions={screen.qs} extra={screen.extra} g1NoLimit={settings.g1NoLimit}
            onAnswer={(q, ok, a) => onAnswer(q, ok, a)} onEnd={r => endLevel(screen.level, r)} onQuit={() => setScreen({ s: 'map' })} onFlag={flagQ} />)}
      {screen.s === 'result' && cfg && char && <ResultScreen cfg={cfg} c={char} win={screen.r.win} stars={screen.stars} correct={screen.r.correct} total={screen.r.total} kinder={screen.r.kinder} retreat={screen.r.retreat} quit={screen.r.quit} turns={screen.r.turns}
        newlyMastered={screen.mastered} timeUp={myRemaining <= 0} forcedTimeUp={!!screen.r.timeUp} onAgain={() => startLevel(screen.level)} onMap={() => setScreen({ s: 'map' })}
        onNext={screen.r.win && !screen.r.timeUp && nextLevelOf(screen.level) ? () => startLevel(nextLevelOf(screen.level)!) : undefined} />}
      {screen.s === 'wrongbook' && bank && <WrongBookScreen wrong={wrong} byKey={bank.byKey} onBack={() => setScreen({ s: 'map' })} onReview={startReview} />}
      {screen.s === 'review' && <ReviewSession key={screen.nonce} questions={screen.qs} onAnswer={(q, ok, a) => onAnswer(q, ok, a, true)}
        onDone={(right, total) => { if (masteredThisLevel.current && p) setProgress(pr => { const nx = { ...pr, masteredStars: pr.masteredStars + masteredThisLevel.current }; S.saveProgress(p.id, nx); return nx; }); setScreen({ s: 'review-done', right, total }); }} />}
      {screen.s === 'review-done' && <div className="center-screen"><div className="big-emoji xl">📕</div><h1>复习完成</h1><p className="sub" data-testid="review-stats">答对 {screen.right} / {screen.total} 题</p>
        <div className="row gap24"><button className="btn ghost" onClick={() => setScreen({ s: 'wrongbook' })}>看错题本</button><button className="btn" onClick={() => setScreen({ s: 'map' })}>回地图</button></div></div>}
    </div>
  );
}
