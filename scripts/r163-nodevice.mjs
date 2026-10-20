// r16.3 小萌新：真的 Chrome（有头、没有声卡，跟测试员一样直接开窗口）+ 正式构建：答对 → 下一题 / 结算页 的等待，逐步打时间戳。
// 不用任何 __zy 测试钩子（正式构建里也没有）；只在页面里挂观察脚本：系统朗读 / 录音（AudioBufferSource、<audio>）/ 界面变化。
// 环境变量：URL（默认 http://localhost:4473/）、EXE（默认 /usr/bin/google-chrome）、MUTE=1 加 --mute-audio、FAKE=1 用假声卡、
//   N（答几题，默认 5 = 小班一关）、W/H 窗口、OUT、LIMIT_NEXT / LIMIT_END（不设 = 只量不判）
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4473/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/r163/'; mkdirSync(OUT, { recursive: true });
const TAG = process.env.TAG || 'run'; const N = +(process.env.N || 5); const W = +(process.env.W || 1280), H = +(process.env.H || 800);
const dir = `/tmp/zy-r163-${TAG}-${Date.now()}`; rmSync(dir, { recursive: true, force: true });
const args = ['--touch-events=enabled', `--window-size=${W},${H}`]; if (process.env.MUTE === '1') args.push('--mute-audio'); if (process.env.FAKE === '1') args.push('--use-fake-device-for-media-stream');
const ctx = await chromium.launchPersistentContext(dir, { executablePath: process.env.EXE || '/usr/bin/google-chrome', headless: false, viewport: null, args, ignoreDefaultArgs: ['--mute-audio', '--disable-component-extensions-with-background-pages', '--enable-automation'] });
const pg = ctx.pages()[0] ?? await ctx.newPage(); pg.setDefaultTimeout(10000);
await pg.addInitScript(() => {
  const L = window.__obs = []; const t = () => Math.round(performance.now()); const log = (ev, x = {}) => L.push({ t: t(), ev, ...x });
  const S = window.speechSynthesis;
  if (S) { const sp = S.speak.bind(S); S.speak = u => { log('tts.speak', { text: u.text.slice(0, 30) }); ['start', 'end', 'error'].forEach(e => u.addEventListener(e, ev => log('tts.' + e, { text: u.text.slice(0, 12), err: ev.error }))); sp(u); };
    const vs = () => log('tts.voices', { n: S.getVoices().length, zh: S.getVoices().filter(v => /zh/i.test(v.lang)).map(v => v.name).join('|') }); setTimeout(vs, 1500); S.addEventListener?.('voiceschanged', vs); }
  const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { const c = this.context; const d = this.buffer?.duration; const c0 = c.currentTime, p0 = t(); log('buf.start', { dur: d && +d.toFixed(2), state: c.state, sink: c.sinkId ?? '' });
    this.addEventListener('ended', () => log('buf.ended', { dur: d && +d.toFixed(2), wall: t() - p0, ctxAdv: +(c.currentTime - c0).toFixed(2), state: c.state })); return st.apply(this, a); };
  const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { const src = (this.currentSrc || this.src || '').split('/').pop(); if (/voice|mp3/.test(src)) { log('el.play', { src }); ['playing', 'ended', 'error', 'stalled', 'suspend'].forEach(e => this.addEventListener(e, () => log('el.' + e, { src, ct: +this.currentTime.toFixed(2) }), { once: true })); } return pl.call(this); };
  const AC = window.AudioContext; window.AudioContext = class extends AC { constructor(...a) { super(...a); log('ctx.new', { state: this.state, rate: this.sampleRate, lat: this.baseLatency }); this.addEventListener('statechange', () => log('ctx.state', { state: this.state, ct: +this.currentTime.toFixed(2) })); } };
  let last = {}; const snap = () => { const q = document.querySelector('.kq')?.textContent ?? ''; const s = { busy: !!document.querySelector('[data-testid=kbusy]'), say: document.querySelector('[data-testid=ksay]')?.textContent ?? '', q: q.slice(0, 20), res: !!document.querySelector('[data-testid=result-actions]'), wait: !!document.querySelector('.kopts.kwait'), banner: document.querySelector('.skill-banner')?.textContent?.slice(0, 16) ?? '' };
    for (const k of Object.keys(s)) if (s[k] !== last[k]) log('ui.' + k, { v: s[k] }); last = s; };
  document.addEventListener('DOMContentLoaded', () => { new MutationObserver(snap).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); setInterval(snap, 100); });
});
const w = ms => pg.waitForTimeout(ms); const shot = n => pg.screenshot({ path: `${OUT}${TAG}_${n}.png` });
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]'); await w(800);
await pg.click('text=小班宝贝'); await w(800);
for (let i = 0; i < 30 && !(await pg.isVisible('[data-testid=level-1]')); i++) {
  for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`).catch(() => false)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {});
  if (await pg.isVisible('[data-testid=char-confirm]').catch(() => false)) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); }
  if (await pg.isVisible('[data-testid=to-map]').catch(() => false)) await pg.click('[data-testid=to-map]').catch(() => {}); await w(400); }
await shot('map'); await pg.click('[data-testid=level-1]'); await w(800);
for (let i = 0; i < 12; i++) { const tb = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!tb) break; await tb.click().catch(() => {}); await w(400); }
await pg.waitForSelector('.kopts:not(.kwait) .kopt:not([disabled])', { timeout: 20000 }); await w(300);
const res = []; const pnow = () => pg.evaluate(() => Math.round(performance.now()));
for (let n = 0; n < N; n++) {
  let t0 = -1, wrongs = 0;
  const nOpts = await pg.$$eval('.kopt', x => x.length);
  for (let k = 0; k < nOpts && t0 < 0; k++) {
    await pg.waitForSelector('.kopts:not(.kwait)', { timeout: 20000 }); await w(150);
    const opts = await pg.$$('.kopt:not([disabled]):not(.dim)'); const o = opts[k - wrongs] ?? opts[0]; if (!o) break;
    const tc = await pnow(); await o.tap().catch(async () => { await o.click(); });
    await w(250); if (await pg.$('.kopt.okmark')) t0 = tc; else { wrongs++; await w(1700); }
  }
  if (t0 < 0) { console.log('no correct option found'); break; }
  if (process.env.SHOTS === '1') { await w(1000); await shot(`q${n + 1}_1s`); await w(3800); await shot(`q${n + 1}_4.8s`); }
  const r = await pg.waitForFunction(() => !!document.querySelector('[data-testid=result-actions]') || (!document.querySelector('.kopts.kwait') && !document.querySelector('.kopt.okmark')), null, { timeout: 20000, polling: 50 }).then(() => true).catch(() => false);
  const t1 = await pnow(); const isEnd = await pg.isVisible('[data-testid=result-actions]');
  const ev = await pg.evaluate(([a, b]) => window.__obs.filter(x => x.t >= a - 5 && x.t <= b + 50), [t0, t1]);
  res.push({ n: n + 1, ms: t1 - t0, end: isEnd, ok: r, ev: ev.map(x => ({ ...x, t: x.t - t0 })) });
  console.log(`${TAG} Q${n + 1}${isEnd ? '→结算' : ''} ${t1 - t0} ms`);
  if (isEnd) break; await w(600);
}
await shot('end');
const head = await pg.evaluate(() => window.__obs.filter(x => /tts.voices|ctx.new|ctx.state/.test(x.ev)).slice(0, 8));
writeFileSync(`${OUT}${TAG}.json`, JSON.stringify({ args, head, res }, null, 1));
await ctx.close(); rmSync(dir, { recursive: true, force: true });
const ln = +(process.env.LIMIT_NEXT || 0), le = +(process.env.LIMIT_END || 0); let bad = 0;
if (ln) for (const r of res) { const lim = r.end ? le : ln; const okk = r.ms <= lim; console.log(`${okk ? 'PASS' : 'FAIL'} ${TAG} Q${r.n}${r.end ? '→结算' : ''} ${r.ms} ms ≤ ${lim}`); if (!okk) bad++; }
process.exit(bad ? 1 : 0);
