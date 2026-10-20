// r16.3 小萌新 / 总管方案 A：真的 Chrome（有头、没有声卡，跟测试员一样直接开窗口）+ 正式构建：
//   答对 → 下一题（没技能名 / 有技能名，含最长的「阿贝的ABC 气球！」）、最后一题 → 结算页、结算页朗读顺序，逐步打时间戳。
// 不用任何 __zy 测试钩子（正式构建里也没有）；只在页面里挂观察脚本：系统朗读 / 录音（fetch → decode → AudioBufferSource，按文件名认段）/ <audio> / 界面变化。
// 环境变量：URL（默认 http://localhost:4473/）、EXE（默认 /usr/bin/google-chrome）、CHAR（新建档案选这个伙伴，例：abei；不设 = 用预置的「小班宝贝」）、
//   NOSPEECH=1 关掉系统朗读（走录音包），PLAYS（同一关连玩几次，默认 1）、W/H 窗口、TAG、OUT、MUTE=1 加 --mute-audio、CHECK=1 按方案 A 判 PASS/FAIL
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4473/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/r163/'; mkdirSync(OUT, { recursive: true });
const TAG = process.env.TAG || 'run'; const PLAYS = +(process.env.PLAYS || 1); const W = +(process.env.W || 1280), H = +(process.env.H || 800); const CHAR = process.env.CHAR || '';
const dir = `/tmp/zy-r163-${TAG}-${Date.now()}`; rmSync(dir, { recursive: true, force: true });
const args = ['--touch-events=enabled', `--window-size=${W},${H}`]; if (process.env.MUTE === '1') args.push('--mute-audio');
const ONLY = process.env.CHECK_ONLY;   // 只按已存的 JSON 重新判（不开浏览器）
let res = [], results = [];
if (!ONLY) {
const ctx = await chromium.launchPersistentContext(dir, { executablePath: process.env.EXE || '/usr/bin/google-chrome', headless: false, viewport: null, args, ignoreDefaultArgs: ['--mute-audio', '--disable-component-extensions-with-background-pages', '--enable-automation'] });
const pg = ctx.pages()[0] ?? await ctx.newPage(); pg.setDefaultTimeout(10000);
await pg.addInitScript(noSpeech => {
  // NOSPEECH=1：这台浏览器没有系统朗读（像部分安卓 / 华为浏览器）→ 游戏走录音包
  if (noSpeech) { try { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); } catch { /* */ } }
  const L = window.__obs = []; const t = () => Math.round(performance.now()); const log = (ev, x = {}) => L.push({ t: t(), ev, ...x });
  const nm = u => (u || '').split('/').pop().replace(/\.[0-9a-f]{6,}\.mp3$/, '').replace(/\.mp3$/, '');
  const abUrl = new WeakMap(), bufUrl = new WeakMap();
  const F = window.fetch; window.fetch = async (...a) => { const r = await F(...a); const u = typeof a[0] === 'string' ? a[0] : a[0]?.url; if (/\/voice\/.*\.mp3/.test(u || '')) { const ab = r.arrayBuffer.bind(r); r.arrayBuffer = async () => { const x = await ab(); abUrl.set(x, u); return x; }; } return r; };
  const S = window.speechSynthesis;
  if (S) { const sp = S.speak.bind(S); S.speak = u => { log('tts.speak', { text: u.text.slice(0, 40) }); ['start', 'end', 'error'].forEach(e => u.addEventListener(e, ev => log('tts.' + e, { text: u.text.slice(0, 40), err: ev.error }))); sp(u); };
    const vs = () => log('tts.voices', { n: S.getVoices().length }); setTimeout(vs, 1500); S.addEventListener?.('voiceschanged', vs); }
  const AC = window.AudioContext; const dec = AC.prototype.decodeAudioData; AC.prototype.decodeAudioData = function (ab, ...r) { const u = abUrl.get(ab); const p = dec.call(this, ab, ...r); return p.then(b => { if (u) bufUrl.set(b, u); return b; }); };
  const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { const c = this.context; const d = this.buffer?.duration; const clip = nm(bufUrl.get(this.buffer)); if (!clip) return st.apply(this, a); const p0 = t(); log('clip.start', { clip, dur: d && +d.toFixed(2), state: c.state });
    let stopped = false; const sp = this.stop.bind(this); this.stop = (...x) => { if (!stopped) { stopped = true; log('clip.stop', { clip, wall: t() - p0 }); } return sp(...x); };
    this.addEventListener('ended', () => { if (!stopped) log('clip.end', { clip, wall: t() - p0 }); }); return st.apply(this, a); };
  const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { const src = this.currentSrc || this.src || ''; if (/voice\/.*mp3/.test(src)) { const clip = nm(src); log('clip.start', { clip, el: 1 }); this.addEventListener('ended', () => log('clip.end', { clip, el: 1 }), { once: true }); this.addEventListener('pause', () => log('clip.stop', { clip, el: 1 }), { once: true }); } return pl.call(this); };
  window.AudioContext = class extends AC { constructor(...a) { super(...a); log('ctx.new', { state: this.state }); this.addEventListener('statechange', () => log('ctx.state', { state: this.state })); } };
  let last = {}; const snap = () => { const q = document.querySelector('.kq')?.textContent ?? ''; const s = { busy: !!document.querySelector('[data-testid=kbusy]'), busyTop: Math.round(document.querySelector('[data-testid=kbusy]')?.getBoundingClientRect().top ?? -1), ok: !!document.querySelector('.kopt.okmark'), q: q.slice(0, 20), res: !!document.querySelector('[data-testid=result-actions]'), banner: document.querySelector('.skill-banner')?.textContent?.slice(0, 16) ?? '' };
    for (const k of Object.keys(s)) if (s[k] !== last[k]) log('ui.' + k, { v: s[k] }); last = s; };
  document.addEventListener('DOMContentLoaded', () => { new MutationObserver(snap).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); setInterval(snap, 50); });
}, process.env.NOSPEECH === '1');
const w = ms => pg.waitForTimeout(ms); const shot = n => pg.screenshot({ path: `${OUT}${TAG}_${n}.png` }); const pnow = () => pg.evaluate(() => Math.round(performance.now()));
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]'); await w(800);
if (CHAR) {   // 新建档案（家长密码流程同 r162 e2e），小班，选指定伙伴
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x');
  await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]'); await pg.click('[data-testid=rec-done]'); await w(300); await pinIn('2468');
  await pg.fill('[data-testid=add-name]', 'kc'); await pg.click('[data-testid=home-grade-K1]'); await w(300); await pg.click('text=kc').catch(() => {}); await w(500);
} else { await pg.click('text=小班宝贝'); await w(800); }
for (let i = 0; i < 30 && !(await pg.isVisible('[data-testid=level-1]')); i++) {
  if (await pg.isVisible('[data-testid=pin-ok]').catch(() => false)) await pinIn('2468');
  for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`).catch(() => false)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {});
  if (await pg.isVisible('[data-testid=char-confirm]').catch(() => false)) { await pg.click(CHAR ? `[data-testid=char-${CHAR}]` : '[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); }
  if (await pg.isVisible('[data-testid=to-map]').catch(() => false)) await pg.click('[data-testid=to-map]').catch(() => {}); await w(400); }
await pg.click('[data-testid=level-1]'); await w(800);
for (let i = 0; i < 12; i++) { const tb = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!tb) break; await tb.click().catch(() => {}); await w(400); }
for (let play = 1; play <= PLAYS; play++) {
  await pg.waitForSelector('.kopts:not(.kwait) .kopt:not([disabled])', { timeout: 20000 }); await w(300);
  for (let n = 0; n < 12; n++) {
    let t0 = -1, wrongs = 0, demo = false;
    for (let k = 0; k < 4 && t0 < 0 && !demo; k++) {
      await pg.waitForSelector('.kopts:not(.kwait)', { timeout: 20000 }); await w(150);
      const opts = await pg.$$('.kopt:not([disabled]):not(.dim)'); const o = opts[k - wrongs] ?? opts[0]; if (!o) break;
      const tc = await pnow(); await o.tap().catch(async () => { await o.click(); });
      await w(200); if (await pg.$('.kopt.okmark')) t0 = tc; else if (await pg.$('.kopt.reveal')) demo = true; else { wrongs++; await w(1700); }
    }
    if (demo) { await pg.waitForFunction(() => !!document.querySelector('[data-testid=result-actions]') || !document.querySelector('.kopts.kwait'), null, { timeout: 20000, polling: 50 }); if (await pg.isVisible('[data-testid=result-actions]')) break; continue; }
    if (t0 < 0) { console.log('no correct option found'); break; }
    await pg.waitForFunction(() => !!document.querySelector('[data-testid=result-actions]') || (!document.querySelector('.kopts.kwait') && !document.querySelector('.kopt.okmark')), null, { timeout: 20000, polling: 25 });
    const t1 = await pnow(); const isEnd = await pg.isVisible('[data-testid=result-actions]');
    const ev = (await pg.evaluate(([a, b]) => window.__obs.filter(x => x.t >= a - 5 && x.t <= b + 30), [t0, t1])).map(x => ({ ...x, t: x.t - t0 }));
    const okOff = ev.find(e => e.ev === 'ui.ok' && e.v === false)?.t ?? null;   // ✓ 什么时候消失
    const skill = ev.find(e => e.ev === 'ui.banner' && e.v)?.v ?? '';
    const clips = ev.filter(e => e.ev === 'clip.start').map(e => e.clip); const ends = ev.filter(e => /clip\.(end|stop)/.test(e.ev));
    res.push({ play, n: n + 1, ms: t1 - t0, end: isEnd, skill, clips, okOff, ev });
    console.log(`${TAG} 第${play}次 Q${n + 1}${isEnd ? '→结算' : ''} ${t1 - t0} ms  技能:${skill || '-'}  录音:${clips.join('+') || '(系统朗读)'}  ✓到:${okOff ?? '下一题'}  ${ends.map(e => `${e.clip}@${e.t}${e.ev === 'clip.stop' ? '(切)' : ''}`).join(' ')}`);
    if (isEnd) break; await w(400);
  }
  // 结算页：12 s 内的朗读顺序（从结算页出现起算）
  const r0 = await pg.evaluate(() => { const e = window.__obs.filter(x => x.ev === 'ui.res' && x.v); return e[e.length - 1]?.t ?? performance.now(); }); await w(12000);
  const rev = (await pg.evaluate(([a]) => window.__obs.filter(x => x.t >= a - 4000 && /^(clip|tts)\./.test(x.ev)), [r0])).map(x => ({ ...x, t: x.t - r0 }));
  results.push({ play, ev: rev }); console.log(`${TAG} 第${play}次结算页朗读: ${rev.filter(e => e.t > -4000).map(e => `${e.t}:${e.ev.split('.')[1]}:${e.clip ?? e.text}`).join('  ')}`);
  await shot(`result_${play}`);
  if (play < PLAYS) { await pg.click('[data-testid=again]'); await w(800); for (let i = 0; i < 6; i++) { const tb = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!tb) break; await tb.click().catch(() => {}); await w(300); } }
}
const head = await pg.evaluate(() => window.__obs.filter(x => /tts.voices|ctx.new|ctx.state/.test(x.ev)).slice(0, 6));
writeFileSync(`${OUT}${TAG}.json`, JSON.stringify({ args, head, res, results }, null, 1));
await ctx.close(); rmSync(dir, { recursive: true, force: true });
} else ({ res, results } = JSON.parse(readFileSync(ONLY, 'utf8')));
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
if (process.env.CHECK === '1') {
  const MARGIN = 600, TOL = 250;
  for (const r of res) {
    const sk = r.ev.filter(e => e.ev === 'clip.start' && /^p_sk_/.test(e.clip)); const skEnd = r.ev.find(e => e.ev === 'clip.end' && /^p_sk_/.test(e.clip));
    const cut = r.ev.find(e => e.ev === 'clip.stop' && /^p_/.test(e.clip)); /* 题干 / 选项被孩子点答案打断是正常的；表扬 / 技能名 / 好朋友不能被切 */ const tts = r.ev.some(e => e.ev === 'tts.start');
    const chainEnd = Math.max(0, ...r.ev.filter(e => e.ev === 'clip.end' || e.ev === 'tts.end').map(e => e.t));
    const base = r.end ? 4000 : 3500; const lim = sk.length || tts ? Math.max(base, chainEnd + MARGIN) : base;
    ok(r.ms <= lim + TOL, `第${r.play}次 Q${r.n}${r.end ? '→结算' : ''}${r.skill ? `（技能 ${r.skill}）` : ''}：${r.ms} ms ≤ ${lim}${lim > base ? '（读完技能名 + margin）' : ''} + ${TOL}`);
    ok(!cut, `第${r.play}次 Q${r.n}：没有一段录音被切掉${cut ? `（${cut.clip} 在 ${cut.t} ms 被停）` : ''}`);
    if (sk.length) ok(!!skEnd && skEnd.t <= r.ms, `第${r.play}次 Q${r.n}：技能名 ${sk[0].clip} 读完（${skEnd?.t} ms）才出下一题 / 结算（${r.ms} ms）`);
    ok(r.okOff === null || r.okOff >= r.ms - 60, `第${r.play}次 Q${r.n}：✓ 一直亮到下一题（消失于 ${r.okOff ?? '-'}）`);
    ok(!r.clips.some(c => /^p_happy_/.test(c)), `第${r.play}次 Q${r.n}：答对后不再读「开心值…」`);
    if (r.end) ok(!r.clips.some(c => /^p_praise/.test(c)), `第${r.play}次 Q${r.n}：最后一题不先读表扬，直接「好朋友」（${r.clips.join('+')}）`);
  }
  for (const R of results) {
    // 录音：clip.start / end / stop；系统朗读：tts.start / end（text）。「好朋友」= 结算页出现前开始的那句
    const sp = R.ev.map(e => ({ ...e, what: e.clip ?? e.text ?? '' })).filter(e => /^(clip|tts)\.(start|end|stop|error)$/.test(e.ev));
    const isFr = e => /friend|^p_home_|好朋友/.test(e.what) && !/开心值/.test(e.what);
    const fr = sp.filter(e => /end|stop|error/.test(e.ev) && isFr(e)).pop();
    const firstRes = sp.find(e => /start$/.test(e.ev) && e.t >= 0 && !isFr(e));
    ok(!!firstRes, `第${R.play}次结算页：有自动朗读（${sp.filter(e => /start$/.test(e.ev) && e.t >= 0).map(e => e.what).join(' → ')}）`);
    ok(!!firstRes && /^p_happy_|^开心值一共/.test(firstRes.what), `第${R.play}次结算页：第一句是开心值总数（${firstRes?.what}）`);
    ok(!fr || !firstRes || firstRes.t >= fr.t, `第${R.play}次结算页：开心值总数（${firstRes?.t} ms）排在「好朋友」读完（${fr?.t} ms）之后`);
    let open = 0, maxOpen = 0; for (const e of sp) { open += /start$/.test(e.ev) ? 1 : -1; open = Math.max(0, open); maxOpen = Math.max(maxOpen, open); }
    ok(maxOpen <= 1 && !sp.some(e => e.ev === 'clip.stop' && /^p_/.test(e.what)), `第${R.play}次结算页：一句 / 一段接一段，没有重叠 / 被切（最多同时 ${maxOpen}）`);
  }
  console.log(bad ? `FAILED ${bad}` : 'ALL PASS');
}
process.exit(bad ? 1 : 0);
