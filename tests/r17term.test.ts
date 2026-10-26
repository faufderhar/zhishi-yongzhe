/* r17 D：小班期末庆祝关（src/game/kinderTerm.ts + KinderBattle term 模式）
   - 学期划分、解锁、出题（题数 = 普通关、只从这学期打过的关取、易→难）
   - 温和规则：不失败、没有复活页（源码检查：期末关的 onEnd 都是 win: true；没有 revive）；文字不含「打败 / 胜利」
   - 录音键都在录音包里、文字一致；庆祝乐句 ×0.5、运行时缓存、不预缓存；SPEC 尺寸 / 动效（CSS） */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { loadBank, playable, normalize } from '../src/game/questions';
import { emptyProgress } from '../src/state';
import { cleanProgress } from '../src/game/sanitize';
import { mergeBackup } from '../src/game/merge';
import { buildChapters, isUnlocked } from '../src/game/levels';
import { termChapter, termLevels, termSlots, withSemesters, parseTerm, termResume, withTermLit, clearTermLit, termHintKey, TERM_PENDING_KEYS, termOfChapter, termMembers, termOpen, termBlocker, termQuestions, termStrings, TERM_BANNED, TERM_TEXT, TERM_KEYS, TERM_IMG, TERM_SFX, TERM_CHAPTER, type TermNo } from '../src/game/kinderTerm';
import { VOICE_PROMPTS } from '../src/game/voicePrompts';
import { TERM_SFX_GAIN } from '../src/fx/assets';
import { bandConfig } from '../src/game/grades';
const raw = JSON.parse(readFileSync('public/banks/bank_K1.json', 'utf8'));
const qs = playable(loadBank(raw, 'bank_K1.json').all, false);
const chs = buildChapters(qs, null, loadBank(raw, 'bank_K1.json').all);
const byKey = new Map(qs.map(q => [q.key, q]));
const N = bandConfig('K1').questions.normal;
const man = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8'));
const starsAll = (t: TermNo) => Object.fromEntries(termMembers(chs, t).map(x => [x.l.id, 1]));

describe('r17 D 学期划分 / 地图', () => {
  it('每个学科章：前 ⌈n/2⌉ 个单元 = 上学期，其余 = 下学期；每科两学期都有关', () => {
    for (const ch of chs) { const m = termOfChapter(ch); const units = [...new Set(ch.levels.map(l => l.volume + '|' + l.unit))];
      for (const l of ch.levels) expect(m.get(l.id), l.id).toBe(units.indexOf(l.volume + '|' + l.unit) < Math.ceil(units.length / 2) ? 1 : 2);
      if (units.length > 1) expect(new Set(m.values()).size, ch.subject).toBe(2); }
  });
  it('策划 r17：两个期末关放在小班主地图（各学科章：大乌云 = 上学期最后一个节点、彩虹云 = 最后）；没有单独的「期末庆祝」章；其他年级没有', () => {
    const tl = termLevels(chs, 'K1'); expect(tl.map(l => l.term)).toEqual([1, 2]); expect(tl.every(l => l.kind === 'normal')).toBe(true); expect(termLevels(chs, 'K2')).toEqual([]);
    expect(termChapter(chs)!.subject).toBe(TERM_CHAPTER);   // 只是关卡的内部章名，不再接到地图上
    for (const ch of chs) { const m = termOfChapter(ch); const { after1 } = termSlots(ch);
      expect(m.get(ch.levels[after1].id), ch.subject).toBe(1); for (let i = after1 + 1; i < ch.levels.length; i++) expect(m.get(ch.levels[i].id), ch.subject).toBe(2); }
    const a = readFileSync('src/App.tsx', 'utf8'), sc = readFileSync('src/ui/Screens.tsx', 'utf8');
    expect(a).not.toMatch(/withTermChapter/); expect(a).toMatch(/termLevels=\{kTermLevels\}/);
    expect(sc).toMatch(/tl\.term === 1 && i === slot\.after1\) \|\| \(tl\.term === 2 && i === ch\.levels\.length - 1\)/);   // 节点位置
    expect(sc).toMatch(/<\/button>\{termAfter\(i\)\}<\/Fragment>/);
    expect(sc).toMatch(/className=\{`kterm-node-img \$\{open \? '' : 'silhouette'\}`\}/);   // 没解锁 = 灰色剪影
    const css = readFileSync('src/app.css', 'utf8'); expect(css).toMatch(/\.kterm-node-img\.silhouette\{filter:grayscale\(1\) contrast\(0\) opacity\(\.55\)\}/);
    expect(css).toMatch(/\.level\.kterm-node\.khint \.kterm-node-img\{animation:ktermNodeHop \.9s ease-out 1\}/); expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.level\.kterm-node\.khint \.kterm-node-img\{animation:none\}\}/);
  });
  it('解锁提示：真正解锁（不是测试全解锁）时弹一下 + 读开场白（p:k_term*_intro），每档案每学期一次（localStorage）', () => {
    const sc = readFileSync('src/ui/Screens.tsx', 'utf8'); expect(termHintKey('p1', 2)).toBe('zy.termHint.p1.2');
    expect(sc).toMatch(/find\(t => termReal\(t\) && !localStorage\.getItem\(termHintKey\(p\.id, t\)\)\)/);
    expect(sc).toMatch(/localStorage\.setItem\(termHintKey\(p\.id, t\), '1'\)[^\n]*\n\s*setTermHint\(t\); speak\(TERM_TEXT\.intro\[t\], 'zh-CN', \{ keys: \[TERM_KEYS\.intro\[t\]\] \}\)/);
  });
  it('题库的 term 字段（可选）覆盖对半分：1 / 2 / 上 / 下 / 上学期 / 下学期 / semester', () => {
    expect([1, 2, '1', '2', '上', '下', '上学期', '下学期', '上册', '下册', '', null, 3, '中'].map(parseTerm)).toEqual([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, undefined, undefined, undefined, undefined]);
    const q0 = raw.questions[0]; expect(normalize({ ...q0, term: '下学期' }).term).toBe(2); expect(normalize({ ...q0, semester: 1 }).term).toBe(1); expect(normalize(q0).term).toBeUndefined();
    // 数数章第一个单元（按对半分本来是上学期）标成下学期 → 这个单元的关都算下学期；其它单元照旧
    const ch0 = chs[0]; const u0 = ch0.levels[0].unit; const tk = new Map(qs.filter(q => q.subject === ch0.subject && q.unit === u0).map(q => [q.key, 2 as const]));
    const w = withSemesters(chs, k => tk.get(k)); const m0 = termOfChapter(chs[0]), m1 = termOfChapter(w[0]);
    for (const l of w[0].levels) expect(m1.get(l.id), l.id).toBe(l.unit === u0 ? 2 : m0.get(l.id));
    expect(m0.get(ch0.levels[0].id)).toBe(1); expect(w.slice(1)).toEqual(chs.slice(1));
    expect(termMembers(w, 2).some(x => x.l.unit === u0)).toBe(true); expect(termMembers(w, 1).some(x => x.ch.subject === ch0.subject && x.l.unit === u0)).toBe(false);
    expect(readFileSync('src/App.tsx', 'utf8')).toMatch(/withSemesters\(ch, k => tk\.get\(k\)\)/);
  });
  it('解锁：这学期每个单元都打过一关才打开；还差的那一单元第一关给提示', () => {
    for (const t of [1, 2] as TermNo[]) {
      expect(termOpen(chs, t, {})).toBe(false); expect(termBlocker(chs, t, {})).toBeTruthy();
      const all = starsAll(t); expect(termOpen(chs, t, all)).toBe(true); expect(termBlocker(chs, t, all)).toBeUndefined();
      const one = { ...all }; const b = termMembers(chs, t)[0].l; for (const x of termMembers(chs, t)) if (x.ch.subject === termMembers(chs, t)[0].ch.subject && x.l.unit === b.unit) delete one[x.l.id];
      expect(termOpen(chs, t, one)).toBe(false); expect(termBlocker(chs, t, one)!.unit).toBe(b.unit);
    }
    expect(termOpen(chs, 2, starsAll(1))).toBe(false);
  });
});
describe('r17 D 出题', () => {
  it('题数 = 普通关；只从这学期打过的关取；各学科轮流；按难度易→难', () => {
    for (const t of [1, 2] as TermNo[]) for (let seed = 1; seed < 30; seed++) {
      let x = seed; const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
      const st = starsAll(t); const keys = new Set(termMembers(chs, t).flatMap(m => m.l.pool));
      const got = termQuestions(chs, t, st, byKey, () => true, N, rnd);
      expect(got.length).toBe(N); expect(new Set(got.map(q => q.key)).size).toBe(N);
      for (const q of got) expect(keys.has(q.key), q.id).toBe(true);
      for (let i = 1; i < got.length; i++) expect(got[i].difficulty ?? 1).toBeGreaterThanOrEqual(got[i - 1].difficulty ?? 1);
      expect(new Set(got.map(q => q.subject)).size).toBe(Math.min(N, new Set(termMembers(chs, t).map(m => m.ch.subject)).size));
    }
  });
  it('只打过一关（题不够 n 道）→ 用这学期已解锁的关补；没打过的学期的题不会混进来', () => {
    const m = termMembers(chs, 1)[0]; const got = termQuestions(chs, 1, { [m.l.id]: 3 }, byKey, () => true, N);
    expect(got.length).toBe(N); const ok = new Set(termMembers(chs, 1).filter(x => isUnlocked(x.ch.levels, x.i, { [m.l.id]: 3 })).flatMap(x => x.l.pool));
    for (const q of got) expect(ok.has(q.key)).toBe(true);
    const two = new Set(termMembers(chs, 2).flatMap(x => x.l.pool)); const one = new Set(termMembers(chs, 1).flatMap(x => x.l.pool));
    for (const q of got) expect(two.has(q.key) && !one.has(q.key)).toBe(false);
  });
});
describe('r17 D 温和规则 / 文字', () => {
  const b = readFileSync('src/ui/Battle.tsx', 'utf8'); const kb = b.slice(b.indexOf('export function KinderBattle'), b.indexOf('/** 小班选项（策划 X-6）'));
  it('策划 r17：期末关只在爱心全亮时结算（win: true + 奖章）；时间到 / 暂停超时没点完 = 不结算、不给奖章，「X要睡觉啦，下次再来玩～」→ 回地图；没有复活 / 失败', () => {
    const ends = kb.match(/onEnd\(\{ win: (true|false), term,/g) ?? []; expect(ends.length).toBe(2); expect(ends.every(e => e.includes('win: true'))).toBe(true);
    expect(kb).toMatch(/const kQuit = \(\) => \{ const k = ksRef\.current; if \(term\) \{ if \(k\.done\) termDone\(k\); else void termSleep\(\); return; \}/);   // 暂停超时
    expect(kb).toMatch(/if \(term\) \{ if \(k\.done\) termDone\(k\); else await termSleep\(\); return; \}/);   // 时间到（家长时长）
    const sl = kb.slice(kb.indexOf('const termSleep'), kb.indexOf('const termDone'));
    expect(sl).toMatch(/speak\(TERM_TEXT\.sleep\[term\], 'zh-CN', \{ keys: \[TERM_KEYS\.sleep\[term\]\] \}\)/); expect(sl).toMatch(/onQuit\(\)/); expect(sl).not.toMatch(/onEnd|setMedal|playTermCelebrate/);
    expect((kb.match(/setMedal\(true\)/g) ?? []).length).toBe(1); expect(kb.slice(kb.indexOf('if (last && term) {')).indexOf('setMedal(true)')).toBeGreaterThan(0);   // 奖章只在答完最后一题（爱心全亮）那条路
    expect(kb).toMatch(/data-testid="term-sleep-text">\{TERM_TEXT\.sleep\[term\]\}/);
    expect(kb.replace(/revived: false/g, '')).not.toMatch(/revive/i);   // 只有结果里的 revived: false
    expect(TERM_TEXT.sleep).toEqual({ 1: '大乌云要睡觉啦，下次再来玩～', 2: '彩虹云要睡觉啦，下次再来玩～' });
    expect(TERM_PENDING_KEYS).toEqual([]);   // r17.1：睡觉句已录（见下面 10 个 k_term 键）
  });
  it('时间到半路：已点亮的爱心记在进度里；再进来接着点（只出剩下的题），全亮才颁奖章；完成后清掉', () => {
    const id = 'K1:term1'; let pr = emptyProgress();
    // 第一次进：0 颗 → N 道题；答对两题，每颗都马上记下
    expect(termResume(pr.termLit?.[id], N)).toBe(0);
    pr = withTermLit(pr, 1, 1); pr = withTermLit(pr, 1, 2);
    // 时间到：不结算 → 星星 / 奖章都没有（endLevel 没被调用），进度里还是 2 颗
    expect(pr.stars[id]).toBeUndefined(); expect(pr.termLit).toEqual({ [id]: 2 });
    // 存盘 / 读回 / 备份清洗都保留
    const back = cleanProgress(JSON.parse(JSON.stringify(pr)))!; expect(back.termLit).toEqual({ [id]: 2 });
    // 再进来：接着 2 颗，只出 N − 2 道题
    const lit0 = termResume(back.termLit?.[id], N); expect(N).toBe(3); expect(lit0).toBe(2);
    const a = readFileSync('src/App.tsx', 'utf8'); expect(a).toMatch(/const lit0 = termResume\(progress\.termLit\?\.\[level\.id\], cfg\.questions\.normal\)/);
    expect(a).toMatch(/cfg\.questions\.normal - lit0\)/); expect(a).toMatch(/termLit0: lit0 \}\); return;/);
    const b2 = readFileSync('src/ui/Battle.tsx', 'utf8'); expect(b2).toMatch(/const hearts = term \? questions\.length \+ termLit0 :/); expect(b2).toMatch(/\{ \.\.\.newKinder\(hearts\), lit: Math\.min\(termLit0, hearts\) \}/);
    expect(b2).toMatch(/if \(term\) onTermLit\?\.\(term, ns\.lit\);/);
    // 完成（全亮 → win）→ 清掉半截进度；存的数 ≥ 爱心数 / 坏值 = 从 0 开始
    expect(clearTermLit(pr, 1).termLit).toEqual({}); expect(a).toMatch(/level\.term && r\.win \? clearTermLit\(pr, level\.term\) : pr/);
    expect([termResume(N, N), termResume(N + 2, N), termResume(-1, N), termResume(undefined, N), termResume(NaN, N)]).toEqual([0, 0, 0, 0, 0]);
  });
  it('恢复备份（合并）：半截爱心取多的；这关已经有星了就不带回旧的半截进度', () => {
    const prof = [{ id: 'a' }]; const kv = (p: object) => ({ kv: [['profiles', prof], ['progress:a', p]] as [string, unknown][], answers: [], wrong: [], bank: [] });
    const cur = { stars: {}, plays: {}, xp: 0, masteredStars: 0, termLit: { 'K1:term1': 1 } }, bk = { stars: { 'K1:term2': 2 }, plays: {}, xp: 0, masteredStars: 0, termLit: { 'K1:term1': 2, 'K1:term2': 1 } };
    const out = new Map(mergeBackup(kv(cur) as never, kv(bk) as never, '2026-10-20').out.kv) as Map<string, { termLit?: Record<string, number> }>;
    expect(out.get('progress:a')!.termLit).toEqual({ 'K1:term1': 2 });
  });
  it('彩虹云原尺寸（画布像素和普通怪一样：高约 1.2 倍、宽约 1.34 倍），不缩到 0.97', () => {
    const css = readFileSync('src/app.css', 'utf8'); expect(css).toMatch(/\.kterm2\{scale:calc\(680 \/ 512\);/); expect(css).not.toMatch(/\.kterm2[^{]*\{[^}]*0\.97/);
  });
  it('期末关答错 = 「再想一想」（不扣分，和普通小班一样只是再试 / 演示）；答对 = 点亮爱心，不放技能、不闪白', () => {
    expect(kb).toMatch(/if \(term\) talk\(TERM_TEXT\.retry/); expect(kb).toMatch(/\} else if \(term\) \{[^}]*TERM_TEXT\.heart/);
    const termBranch = kb.slice(kb.indexOf('} else if (term) {'), kb.indexOf('} else {', kb.indexOf('} else if (term) {')));
    expect(termBranch).not.toMatch(/playSkill|kinderCorrect|whiteFlash/);
  });
  it('显示 / 朗读的文字都不含「打败 / 胜利」；结算页标题 = 结尾语 + 奖章名', () => {
    for (const t of termStrings()) expect(TERM_BANNED.test(t), t).toBe(false);
    const s = readFileSync('src/ui/Screens.tsx', 'utf8'); expect(s).toMatch(/data-testid="result-term-title">\{TERM_TEXT\.end\[kTerm\]\} \{TERM_MEDAL_NAME\[kTerm\]\}/);
    expect(s).toMatch(/!forcedTimeUp && !kTerm;/);   // 期末关不演「变朋友」
  });
});
describe('r17 D 录音 / 音效 / 美术', () => {
  it('10 个 k_term 键（r17.1 +睡觉句 2）都在录音包，文字和 VOICE_PROMPTS / TERM_TEXT 一致（含句尾 ～），1.1 倍速，登记在 deploy.r17_term', () => {
    const ks = [...Object.values(TERM_KEYS.intro), ...Object.values(TERM_KEYS.end), ...Object.values(TERM_KEYS.medal), TERM_KEYS.heart, TERM_KEYS.retry, ...Object.values(TERM_KEYS.sleep)];
    expect(ks.length).toBe(10);
    expect(man.meta['p:k_term1_sleep'].text).toBe(TERM_TEXT.sleep[1]); expect(man.meta['p:k_term2_sleep'].text).toBe(TERM_TEXT.sleep[2]);
    expect(man.items['p:k_term1_sleep']).toBe('p_k_term1_sleep.45d1bcd0aa.mp3'); expect(man.items['p:k_term2_sleep']).toBe('p_k_term2_sleep.f34ced5a3d.mp3');
    expect([...(man.deploy?.r17_term?.keys ?? [])].sort()).toEqual([...ks].sort());
    for (const k of ks) { expect(man.items[k], k).toMatch(/\.mp3$/); const id = k.slice(2); expect(VOICE_PROMPTS[id], k).toBeTruthy();
      const m = man.meta[k]; expect(m.text, k).toBe(VOICE_PROMPTS[id]); expect(m.speed, k).toBe(1.1); expect(existsSync('public/voice/' + man.items[k]), k).toBe(true); }
    expect(VOICE_PROMPTS.k_term1_intro).toBe(TERM_TEXT.intro[1]);
  });
  it('庆祝乐句：主版文件在、音量 ×0.5、主版预缓存（唯一预缓存的 mp3）+ SW 运行时 CacheFirst 后备、小班离线预下载带上', () => {
    expect(TERM_SFX).toBe('sfx_k_term_celebrate.mp3'); expect(existsSync('public/sfx/' + TERM_SFX)).toBe(true); expect(TERM_SFX_GAIN).toBe(0.5);
    const v = readFileSync('vite.config.ts', 'utf8'); expect(v).toMatch(/urlPattern: \/\\\/sfx\\\/sfx_k_term_celebrate\\\.mp3\$\/, handler: 'CacheFirst', options: \{ cacheName: 'zy-sfx-term'/);
    // 总管 r17 上线条件：主版预缓存（离线第一次玩也有音乐）；alt 不预缓存、不进运行时规则
    expect(v).toMatch(/globPatterns: \[[^\]]*'sfx\/sfx_k_term_celebrate\.mp3'\]/); expect(v).not.toMatch(/sfx_k_term_celebrate_alt|sfx_k_term_\[a-z_\]/);
    for (const f of ['src/fx/assets.ts', 'src/offlineCache.ts', 'src/game/kinderTerm.ts']) expect(readFileSync(f, 'utf8'), f).not.toMatch(/_alt\.mp3/);
    expect((v.match(/globPatterns: \[[^\]]*\]/)?.[0] ?? '').match(/mp3/g)).toEqual(['mp3']);   // 只有这一个 mp3 进预缓存（录音 / 技能音效不进）
    expect(readFileSync('src/offlineCache.ts', 'utf8')).toMatch(/n\.grade === TERM_GRADE\) add\(file, 'sfx\/' \+ TERM_SFX, 'zy-sfx-term'\)/);
  });
  it('美术：7 张图都在 public/images/k1_boss/（拷贝脚本管）；CSS 按 SPEC（彩虹层 1.5S×1.1875S @(−0.25S,−0.1875S)、×1.25、896×680 按 512 同比例、0.4 s 淡化、爱心 0.15 s / 0.3 s 1.15、减少动态只淡化、没有 brightness）', () => {
    for (const p of [TERM_IMG.intro2, TERM_IMG.end2, TERM_IMG.overlay1, TERM_IMG.heartEmpty, TERM_IMG.heartLit, TERM_IMG.medal[1], TERM_IMG.medal[2]]) expect(existsSync('public/' + p), p).toBe(true);
    expect(readFileSync('scripts/copy-kinder-art.mjs', 'utf8')).toMatch(/k1_boss/);
    const css = readFileSync('src/app.css', 'utf8'); const d = css.slice(css.indexOf('/* r17 D：'));
    expect(d).toMatch(/\.kterm-overlay\{position:absolute;left:-25%;top:-18\.75%;width:150%;height:118\.75%/);
    expect(d).toMatch(/\.kterm1\{scale:1\.25/); expect(d).toMatch(/\.kterm2\{scale:calc\(680 \/ 512\)/);
    expect(d).toMatch(/translate:0 10px;transition:opacity \.4s ease-out,translate \.4s ease-out/);
    expect(d).toMatch(/\.kterm2-end\{[^}]*transition:opacity \.4s linear/);
    expect(d).toMatch(/\.kheart \.kh-lit\{opacity:0;transition:opacity \.15s linear\}/); expect(d).toMatch(/@keyframes kheartPop\{0%\{transform:scale\(1\)\}50%\{transform:scale\(1\.15\)\}100%\{transform:scale\(1\)\}\}/);
    expect(d).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.kheart\.pop\{animation:none\}/); expect(d).toMatch(/\.reduce-motion \.kheart\.pop\{animation:none\}/);
    expect(d).not.toMatch(/brightness/);
  });
});
