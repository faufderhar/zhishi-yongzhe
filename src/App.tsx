import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './app.css';
import { loadFxManifests } from './fx/assets';
import { prefetchAll } from './fx/sheets';
import { STORAGE_ERROR, deleteProfileData, compactAnswers } from './db';
import { DESIGN } from './game/config';
import { setAudioPrefs } from './tts';
import { loadAllBanks, questionsOfGrade, type BankState } from './bankStore';
import { playable, type Question } from './game/questions';
import { bandConfig } from './game/grades';
import { buildChapters, levelStars, bossPool, levelsOfUnit, type Level } from './game/levels';
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

type Screen =
  | { s: 'loading' } | { s: 'profiles'; adding?: boolean } | { s: 'gate'; next?: 'add' } | { s: 'parent' }
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
      setSettingsState(st); setProfilesState(ps); setFlags(fl);
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
    })();
    const f = () => setPortrait(window.innerHeight > window.innerWidth);
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, [reloadBank]);

  const p = profiles.find(x => x.id === pid);
  const cfg = p ? bandConfig(p.grade) : null;
  const gradeQs = useMemo(() => bank && p ? playable(questionsOfGrade(bank, p.grade), settings.includePending) : [], [bank, p?.grade, settings.includePending]);
  const chapters = useMemo(() => buildChapters(gradeQs, p?.volumes ?? null), [gradeQs, p?.volumes]);
  // 仅自动化测试：导出关卡 → 题目 unit / 题干，供线上验收检查「诗词关卡里的题都属于这首诗」
  useEffect(() => { const w = window as unknown as { __zyTest?: boolean; __zyLevels?: unknown }; if (!w.__zyTest || !bank) return;
    w.__zyLevels = chapters.map(c => ({ subject: c.subject, levels: c.levels.map(l => ({ id: l.id, kind: l.kind, name: l.name, qs: l.pool.map(k => { const q = bank.byKey.get(k); return { unit: q?.unit, question: q?.question }; }) })) })); }, [chapters, bank]);
  const playableKeys = useMemo(() => new Set(gradeQs.map(q => q.key)), [gradeQs]);
  const today = dayStr();
  // 时钟被调回（GDD §8.2）：按「今日已用满」处理，家长在「时长」页解除
  const remaining = (id: string) => { if (clock.locked) return 0; const pp = profiles.find(x => x.id === id); return pp ? remainingSec(pp.limit, usage[id] ?? {}, today) : Infinity; };
  const myRemaining = pid ? remaining(pid) : Infinity;
  // 到时：允许打完当前关，最多再 3 分钟，之后按已答题结算（策划 T-P2-2）
  // 首次联网后后台预下载各档案年龄段用到的动画（技术QA P1-6）；失败不影响流程（有程序动效兜底）
  useEffect(() => {
    if (!profiles.length || !navigator.onLine) return;
    const kinds = [...new Set(profiles.map(x => bandConfig(x.grade).chars === 'scifi' ? 'hs' : 'pup'))] as ('pup' | 'hs')[];
    const t = setTimeout(() => { void prefetchAll(undefined, kinds).catch(() => {}); }, 8000);
    return () => clearTimeout(t);
  }, [profiles.map(x => x.grade).join()]);
  const replay = !!p && (!p.tutorialDone || !!settings.tutorialReplay?.[p.id]);
  // 老档案（看过旧引导）第一次进轮流回合战斗：只补弹第 3 张卡一次（规格 §10）
  const onlyCard3 = !!p && !replay && cfg?.battle === 'full' && !p.tutorialV036;
  const needTutorial = replay || onlyCard3;
  const finishTutorial = () => {
    if (!p) return;
    setProfiles(profiles.map(x => x.id === p.id ? { ...x, tutorialDone: true, ...(cfg?.battle === 'full' ? { tutorialV036: true } : {}) } : x));
    if (settings.tutorialReplay?.[p.id]) { const r = { ...settings.tutorialReplay }; delete r[p.id]; setSettings({ ...settings, tutorialReplay: r }); }
  };
  const overTime = myRemaining <= 0 && screen.s === 'battle';
  useEffect(() => { if (!overTime) return; const t = setTimeout(() => window.dispatchEvent(new Event(FORCE_END)), 3 * 60e3); return () => clearTimeout(t); }, [overTime]);
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

  const setSettings = (s: Settings) => { setSettingsState(s); S.saveSettings(s); };
  const setProfiles = (ps: Profile[]) => {
    for (const old of profiles) if (!ps.some(x => x.id === old.id)) void deleteProfileData(old.id, S.profileKeys(old.id));   // P1-2：删档案连数据一起清
    setProfilesState(ps); S.saveProfiles(ps);
  };
  const setUsage = (id: string, u: Usage) => { setUsageAll(x => ({ ...x, [id]: u })); S.saveUsage(id, u); };

  async function pickProfile(pp: Profile) {
    setPid(pp.id); setChapterIdx(0);
    const [pr, sk, wr, ans] = await Promise.all([S.loadProgress(pp.id), S.loadSkills(pp.id), wrongOf(pp.id), answersOf(pp.id)]);
    setProgress(pr); setSkills(sk); setWrong(wr);
    const cutoff = Date.now() - 3 * 86400e3;
    setRecentRight(new Set(ans.filter(a => a.correct && a.at > cutoff).map(a => a.questionId)));
    setSeenKeys(new Set(ans.map(a => a.questionId)));
    setScreen(pp.charId ? { s: 'map' } : { s: 'char' });
  }

  /** 每次作答：记录、难度阶梯、错题本 */
  function onAnswer(q: Question, correct: boolean, ans: string, isReview = false) {
    if (!p || !cfg) return;
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
    const sameUnit = level.kind === 'boss' ? levelsOfUnit(chapter.levels, level).flatMap(l => l.pool) : level.pool;
    const wrongKeys = new Set(wrong.map(e => e.qkey));
    const fallback0 = sameUnit.map(k => byKey.get(k)!).filter(q => q && playableKeys.has(q.key));
    const fallback = level.kind === 'boss' ? bossPool(fallback0, seenKeys, wrongKeys, cfg.questions.boss) : fallback0;
    const unitKeys = new Set(sameUnit);
    const due = wrong.filter(e => isDue(e) && unitKeys.has(e.qkey)).map(e => byKey.get(e.qkey)).filter((q): q is Question => !!q && playableKeys.has(q.key));
    const target = skills[level.chapter]?.level ?? 2;
    const n = cfg.questions[level.kind];
    const qs = spreadTemplates(selectQuestions({ pool: level.kind === 'boss' ? bossPool(pool, seenKeys, wrongKeys, n) : pool, fallback, n, target, kind: level.kind, due, recentCorrect: recentRight, maxDifficulty: cfg.band === 'K' ? 2 : 5 }), pool);
    // 题少的课（语文课文/古诗词不合并）：关内重复本课题，错题优先（策划 r6）
    if (qs.length < n && pool.length && level.kind === 'normal') { const rep = [...pool].sort((a, b) => +wrongKeys.has(b.key) - +wrongKeys.has(a.key)); for (let i = 0; qs.length < n; i++) qs.push(rep[i % rep.length]); }
    const extra = selectQuestions({ pool: cfg.battle === 'full' ? pool : fallback, fallback: cfg.battle === 'full' ? fallback : [], n: cfg.battle === 'full' ? Math.max(n * 2, 30) : n * 2, target, kind: level.kind });
    masteredThisLevel.current = 0;
    setScreen({ s: 'battle', level, qs, extra, nonce: Date.now() });
  }
  function endLevel(level: Level, r: BattleResult) {
    if (!p) return;
    const played = progress.plays[level.id]?.day === today ? progress.plays[level.id].count : 0;
    // 防刷（D3）：同关当天第 3 次起不再新增星星（历史最高保留）
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
  const startReview = (keys: string[]) => { const qs = keys.map(k => bank!.byKey.get(k)).filter((q): q is Question => !!q); if (qs.length) { masteredThisLevel.current = 0; setScreen({ s: 'review', qs, nonce: Date.now() }); } };

  const theme = cfg && !['profiles', 'gate', 'parent', 'loading'].includes(screen.s) ? 'theme-' + cfg.theme : '';
  return (
    <div className={`app ${theme}`} onPointerDown={unlockAudio}>
      {portrait && !tipGone && <div className="portrait-tip" onAnimationEnd={() => setTipGone(true)}>横过来玩更舒服哦 ↻</div>}
      {storageErr && screen.s === 'parent' && <div className="sys-bar yellow-bar" data-testid="storage-error" onClick={() => setStorageErr(undefined)}>保存失败：平板存储空间可能不足，请导出备份（{storageErr}）。点此关闭</div>}
      {clock.locked && ['profiles', 'map'].includes(screen.s) && <div className="sys-bar warn-bar" data-testid="clock-lock">⏰ 平板时间好像被调过了，请爸爸妈妈确认一下 <button className="chip" onClick={() => setScreen({ s: 'gate' })}>家长解锁</button></div>}
      {updateReady && ['profiles', 'map'].includes(screen.s) && <button className="sys-bar" data-testid="update-ready" onClick={() => updateReady()}>✨ 有新版本，点这里更新（不会丢进度）</button>}
      {screen.s === 'loading' && <div className="center-screen"><h1 className="title">⚔️ 知识勇者</h1><p className="sub">正在加载题库… {loadPct}%</p></div>}
      {screen.s === 'profiles' && <ProfileSelect profiles={profiles} remaining={Object.fromEntries(profiles.map(x => [x.id, remaining(x.id)]))} onPick={pickProfile} onParent={() => setScreen({ s: 'gate' })}
        canAdd={profiles.length < DESIGN.maxProfiles} adding={!!screen.adding} onAddRequest={() => setScreen({ s: 'gate', next: 'add' })} onAddClose={() => setScreen({ s: 'profiles' })}
        onAdd={p => { setProfiles([...profiles, p]); setScreen({ s: 'profiles' }); }} />}
      {screen.s === 'gate' && <ParentGate settings={settings} purpose={screen.next === 'add' ? '添加孩子需要家长确认' : undefined}
        onSetPin={(h, hint) => setSettings({ ...settings, pinHash: h || undefined, pinHint: hint ?? settings.pinHint })}
        onOk={() => setScreen(screen.next === 'add' ? { s: 'profiles', adding: true } : { s: 'parent' })} onCancel={() => setScreen({ s: 'profiles' })} />}
      {screen.s === 'parent' && bank && <ParentSettings settings={settings} setSettings={setSettings} profiles={profiles} setProfiles={setProfiles} bank={bank} reloadBank={reloadBank}
        usage={usage} setUsage={setUsage} skills={allSkills} flags={flags} clockLocked={clock.locked} unlockClock={() => { const n = { maxSeen: Date.now(), locked: false }; setClock(n); void S.saveClock(n); }} onClose={() => setScreen({ s: 'profiles' })} />}
      {screen.s === 'char' && cfg && p && <CharSelect cfg={cfg} current={p.charId} subjects={chapters.map(c => c.subject)} onBack={() => setScreen(p.charId ? { s: 'map' } : { s: 'profiles' })}
        onPick={c => { setProfiles(profiles.map(x => x.id === p.id ? { ...x, charId: c.id } : x)); const then = screen.then; setScreen({ s: 'map' }); if (then) setTimeout(() => startLevel(then), 0); }} />}
      {screen.s === 'map' && cfg && p && <MapScreen p={p} cfg={cfg} chapters={chapters} progress={progress} wrong={wrong} remaining={myRemaining} c={char}
        chapterIdx={chapterIdx} setChapterIdx={setChapterIdx} onLevel={startLevel} onBack={() => { setPid(undefined); setScreen({ s: 'profiles' }); }}
        onWrongBook={() => setScreen({ s: 'wrongbook' })} onChar={() => setScreen({ s: 'char' })}
        onReview={() => startReview(wrong.filter(e => isDue(e)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 10).map(e => e.qkey))} />}
      {screen.s === 'battle' && cfg && char && p && needTutorial && (cfg.battle === 'kinder'
        ? <KinderTutorial c={char} onDone={finishTutorial} />
        : <StdTutorial cfg={cfg} onDone={finishTutorial} onlyCard3={onlyCard3} />)}
      {screen.s === 'battle' && cfg && char && !needTutorial && (cfg.battle === 'kinder'
        ? <KinderBattle demoReward={settings.kinderDemoReward ?? DESIGN.kinderDemoReward} key={screen.nonce} cfg={cfg} c={char} kind={screen.level.kind} title={screen.level.name} questions={screen.qs} extra={screen.extra}
            onAnswer={(q, ok, a) => onAnswer(q, ok, a)} onEnd={r => endLevel(screen.level, r)} onQuit={() => setScreen({ s: 'map' })} />
        : cfg.battle === 'full'
        ? <RoundBattle key={screen.nonce} cfg={cfg} c={char} kind={screen.level.kind} title={screen.level.name} questions={screen.qs} extra={screen.extra}
            wagerOn={settings.hsWager ?? true} lowGrade={p?.grade === '3' || p?.grade === '4'}
            onAnswer={(q, ok, a) => onAnswer(q, ok, a)} onEnd={r => endLevel(screen.level, r)} onQuit={() => setScreen({ s: 'map' })} onFlag={flagQ} />
        : <StdBattle key={screen.nonce} cfg={cfg} c={char} kind={screen.level.kind} title={screen.level.name} questions={screen.qs} extra={screen.extra} g1NoLimit={settings.g1NoLimit}
            onAnswer={(q, ok, a) => onAnswer(q, ok, a)} onEnd={r => endLevel(screen.level, r)} onQuit={() => setScreen({ s: 'map' })} onFlag={flagQ} />)}
      {screen.s === 'result' && cfg && char && <ResultScreen cfg={cfg} c={char} win={screen.r.win} stars={screen.stars} correct={screen.r.correct} total={screen.r.total} kinder={screen.r.kinder} retreat={screen.r.retreat} turns={screen.r.turns}
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
