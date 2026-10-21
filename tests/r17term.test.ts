/* r17 D：小班期末庆祝关（src/game/kinderTerm.ts + KinderBattle term 模式）
   - 学期划分、解锁、出题（题数 = 普通关、只从这学期打过的关取、易→难）
   - 温和规则：不失败、没有复活页（源码检查：期末关的 onEnd 都是 win: true；没有 revive）；文字不含「打败 / 胜利」
   - 录音键都在录音包里、文字一致；庆祝乐句 ×0.5、运行时缓存、不预缓存；SPEC 尺寸 / 动效（CSS） */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters, isUnlocked } from '../src/game/levels';
import { termChapter, withTermChapter, termOfChapter, termMembers, termOpen, termBlocker, termQuestions, termStrings, TERM_BANNED, TERM_TEXT, TERM_KEYS, TERM_IMG, TERM_SFX, TERM_CHAPTER, type TermNo } from '../src/game/kinderTerm';
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
  it('小班地图最后一章「期末庆祝」两关（上学期、下学期）；其他年级不加', () => {
    const w = withTermChapter(chs, 'K1'); const t = w[w.length - 1];
    expect(t.subject).toBe(TERM_CHAPTER); expect(t.levels.map(l => l.term)).toEqual([1, 2]); expect(t.levels.every(l => l.kind === 'normal')).toBe(true);
    expect(withTermChapter(chs, 'K2')).toBe(chs);
    expect(termChapter(w)!.levels.map(l => l.id)).toEqual(t.levels.map(l => l.id));   // 再算一次不会把自己算进去
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
  it('期末关的结算都是 win: true（暂停超时 / 时间到 / 答完）；一题没答 → 回地图；KinderBattle 没有复活', () => {
    const ends = kb.match(/onEnd\(\{ win: (true|false), term,/g) ?? []; expect(ends.length).toBe(3); expect(ends.every(e => e.includes('win: true'))).toBe(true);
    expect(kb).toMatch(/if \(term\) \{ if \(k\.first \+ k\.retry \+ k\.demo\) onEnd\(\{ win: true, term,[^}]+\}[^;]+; else onQuit\(\); return; \}/);
    expect(kb.replace(/revived: false/g, '')).not.toMatch(/revive/i);   // 只有结果里的 revived: false
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
  it('8 个 k_term 键都在录音包，文字和 VOICE_PROMPTS 一致，1.1 倍速', () => {
    const ks = [...Object.values(TERM_KEYS.intro), ...Object.values(TERM_KEYS.end), ...Object.values(TERM_KEYS.medal), TERM_KEYS.heart, TERM_KEYS.retry];
    expect(ks.length).toBe(8);
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
