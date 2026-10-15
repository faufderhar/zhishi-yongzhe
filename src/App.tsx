import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './app.css';
import { loadFxManifests } from './fx/assets';
import { loadAllBanks, questionsOfGrade, type BankState } from './bankStore';
import { playable, type Question } from './game/questions';
import { bandConfig } from './game/grades';
import { buildChapters, starsFor, type Level } from './game/levels';
import { selectQuestions, updateSkill, type Skills } from './game/adaptive';
import { onWrong, onReviewRight, isDue, dayStr, type WrongEntry } from './game/wrongbook';
import { remainingSec, addUsage, type Usage } from './game/playtime';
import { PUPS, SCIFI, type Character } from './game/characters';
import { unlockAudio } from './tts';
import { recordAnswer, wrongOf, putWrong, delWrong, answersOf } from './db';
import * as S from './state';
import type { Profile, Progress, Settings } from './state';
import { KinderBattle, StdBattle, type BattleResult } from './ui/Battle';
import { ProfileSelect, CharSelect, MapScreen, ResultScreen, WrongBookScreen, ReviewSession } from './ui/Screens';
import { ParentGate, ParentSettings } from './ui/Parent';

type Screen =
  | { s: 'loading' } | { s: 'profiles' } | { s: 'gate' } | { s: 'parent' }
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
  const [flags, setFlags] = useState<Record<string, number>>({});
  const [chapterIdx, setChapterIdx] = useState(0);
  const [portrait, setPortrait] = useState(false);
  const masteredThisLevel = useRef(0);

  const reloadBank = useCallback(async () => { setBank(await loadAllBanks((d, t) => setLoadPct(Math.round(d / t * 100)))); }, []);
  useEffect(() => { void loadFxManifests(); }, []);
  useEffect(() => {
    (async () => {
      const [st, ps, fl] = await Promise.all([S.loadSettings(), S.loadProfiles(), S.loadFlags()]);
      setSettingsState(st); setProfilesState(ps); setFlags(fl);
      const us: Record<string, Usage> = {}, sk: Record<string, Skills> = {};
      for (const p of ps) { us[p.id] = await S.loadUsage(p.id); sk[p.id] = await S.loadSkills(p.id); }
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
  const playableKeys = useMemo(() => new Set(gradeQs.map(q => q.key)), [gradeQs]);
  const today = dayStr();
  const remaining = (id: string) => { const pp = profiles.find(x => x.id === id); return pp ? remainingSec(pp.limit, usage[id] ?? {}, today) : Infinity; };
  const myRemaining = pid ? remaining(pid) : Infinity;
  const char: Character | undefined = p && cfg ? (cfg.chars === 'scifi' ? SCIFI : PUPS).find(c => c.id === p.charId) : undefined;

  // 计时：只在答题 / 复习时，页面可见时计
  const playing = screen.s === 'battle' || screen.s === 'review';
  useEffect(() => {
    if (!playing || !pid) return;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setUsageAll(u => { const nu = addUsage(u[pid] ?? {}, dayStr(), 5); S.saveUsage(pid, nu); return { ...u, [pid]: nu }; });
    }, 5000);
    return () => clearInterval(t);
  }, [playing, pid]);

  const setSettings = (s: Settings) => { setSettingsState(s); S.saveSettings(s); };
  const setProfiles = (ps: Profile[]) => { setProfilesState(ps); S.saveProfiles(ps); };
  const setUsage = (id: string, u: Usage) => { setUsageAll(x => ({ ...x, [id]: u })); S.saveUsage(id, u); };

  async function pickProfile(pp: Profile) {
    setPid(pp.id); setChapterIdx(0);
    const [pr, sk, wr, ans] = await Promise.all([S.loadProgress(pp.id), S.loadSkills(pp.id), wrongOf(pp.id), answersOf(pp.id)]);
    setProgress(pr); setSkills(sk); setWrong(wr);
    const cutoff = Date.now() - 3 * 86400e3;
    setRecentRight(new Set(ans.filter(a => a.correct && a.at > cutoff).map(a => a.questionId)));
    setScreen(pp.charId ? { s: 'map' } : { s: 'char' });
  }

  /** 每次作答：记录、难度阶梯、错题本 */
  function onAnswer(q: Question, correct: boolean, ans: string, isReview = false) {
    if (!p || !cfg) return;
    recordAnswer({ profileId: p.id, questionId: q.key, correct, at: Date.now(), subject: q.subject });
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
    const chapter = chapters.find(c => c.subject === level.chapter)!;
    const byKey = bank!.byKey;
    const pool = level.pool.map(k => byKey.get(k)!).filter(q => q && playableKeys.has(q.key));
    const fallback = chapter.levels.flatMap(l => l.pool).map(k => byKey.get(k)!).filter(Boolean);
    const due = wrong.filter(e => isDue(e) && e.subject === level.chapter).map(e => byKey.get(e.qkey)).filter((q): q is Question => !!q && playableKeys.has(q.key));
    const target = skills[level.chapter]?.level ?? 2;
    const n = cfg.questions[level.kind];
    const qs = selectQuestions({ pool, fallback, n, target, kind: level.kind, due, recentCorrect: recentRight, maxDifficulty: cfg.band === 'K' ? 2 : 5 });
    const extra = selectQuestions({ pool: fallback, fallback: [], n: n * 2, target, kind: level.kind });
    masteredThisLevel.current = 0;
    setScreen({ s: 'battle', level, qs, extra, nonce: Date.now() });
  }
  function endLevel(level: Level, r: BattleResult) {
    if (!p) return;
    const stars = starsFor(r.win, r.total ? r.correct / r.total : 0, r.revived);
    const mastered = masteredThisLevel.current;
    setProgress(pr => {
      const nx = { ...pr, stars: { ...pr.stars, [level.id]: Math.max(pr.stars[level.id] ?? 0, stars) }, masteredStars: pr.masteredStars + mastered,
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
      {portrait && <div className="portrait-tip">横过来玩更舒服哦 ↻</div>}
      {screen.s === 'loading' && <div className="center-screen"><h1 className="title">⚔️ 知识勇者</h1><p className="sub">正在加载题库… {loadPct}%</p></div>}
      {screen.s === 'profiles' && <ProfileSelect profiles={profiles} remaining={Object.fromEntries(profiles.map(x => [x.id, remaining(x.id)]))} onPick={pickProfile} onParent={() => setScreen({ s: 'gate' })} />}
      {screen.s === 'gate' && <ParentGate settings={settings} onSetPin={h => setSettings({ ...settings, pinHash: h })} onOk={() => setScreen({ s: 'parent' })} onCancel={() => setScreen({ s: 'profiles' })} />}
      {screen.s === 'parent' && bank && <ParentSettings settings={settings} setSettings={setSettings} profiles={profiles} setProfiles={setProfiles} bank={bank} reloadBank={reloadBank}
        usage={usage} setUsage={setUsage} skills={allSkills} flags={flags} onClose={() => setScreen({ s: 'profiles' })} />}
      {screen.s === 'char' && cfg && p && <CharSelect cfg={cfg} current={p.charId} onBack={() => setScreen(p.charId ? { s: 'map' } : { s: 'profiles' })}
        onPick={c => { setProfiles(profiles.map(x => x.id === p.id ? { ...x, charId: c.id } : x)); setScreen({ s: 'map' }); }} />}
      {screen.s === 'map' && cfg && p && <MapScreen p={p} cfg={cfg} chapters={chapters} progress={progress} wrong={wrong} remaining={myRemaining} c={char}
        chapterIdx={chapterIdx} setChapterIdx={setChapterIdx} onLevel={startLevel} onBack={() => { setPid(undefined); setScreen({ s: 'profiles' }); }}
        onWrongBook={() => setScreen({ s: 'wrongbook' })} onChar={() => setScreen({ s: 'char' })}
        onReview={() => startReview(wrong.filter(e => isDue(e)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 10).map(e => e.qkey))} />}
      {screen.s === 'battle' && cfg && char && (cfg.battle === 'kinder'
        ? <KinderBattle key={screen.nonce} cfg={cfg} c={char} kind={screen.level.kind} title={screen.level.name} questions={screen.qs} extra={screen.extra}
            onAnswer={(q, ok, a) => onAnswer(q, ok, a)} onEnd={r => endLevel(screen.level, r)} onQuit={() => setScreen({ s: 'map' })} />
        : <StdBattle key={screen.nonce} cfg={cfg} c={char} kind={screen.level.kind} title={screen.level.name} questions={screen.qs} extra={screen.extra} g1NoLimit={settings.g1NoLimit}
            onAnswer={(q, ok, a) => onAnswer(q, ok, a)} onEnd={r => endLevel(screen.level, r)} onQuit={() => setScreen({ s: 'map' })} onFlag={flagQ} />)}
      {screen.s === 'result' && cfg && char && <ResultScreen cfg={cfg} c={char} win={screen.r.win} stars={screen.stars} correct={screen.r.correct} total={screen.r.total}
        newlyMastered={screen.mastered} timeUp={myRemaining <= 0} onAgain={() => startLevel(screen.level)} onMap={() => setScreen({ s: 'map' })}
        onNext={screen.r.win && nextLevelOf(screen.level) ? () => startLevel(nextLevelOf(screen.level)!) : undefined} />}
      {screen.s === 'wrongbook' && bank && <WrongBookScreen wrong={wrong} byKey={bank.byKey} onBack={() => setScreen({ s: 'map' })} onReview={startReview} />}
      {screen.s === 'review' && <ReviewSession key={screen.nonce} questions={screen.qs} onAnswer={(q, ok, a) => onAnswer(q, ok, a, true)}
        onDone={(right, total) => { if (masteredThisLevel.current && p) setProgress(pr => { const nx = { ...pr, masteredStars: pr.masteredStars + masteredThisLevel.current }; S.saveProgress(p.id, nx); return nx; }); setScreen({ s: 'review-done', right, total }); }} />}
      {screen.s === 'review-done' && <div className="center-screen"><div className="big-emoji xl">📕</div><h1>复习完成</h1><p className="sub" data-testid="review-stats">答对 {screen.right} / {screen.total} 题</p>
        <div className="row gap24"><button className="btn ghost" onClick={() => setScreen({ s: 'wrongbook' })}>看错题本</button><button className="btn" onClick={() => setScreen({ s: 'map' })}>回地图</button></div></div>}
    </div>
  );
}
