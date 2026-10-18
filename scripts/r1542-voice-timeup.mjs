// r15.4.2 小萌新 #1：小班「收尾横条 / 睡觉云 / 时间到结算页」三句录音是不是真的经 AudioContext 播出来。
// 条件：只用触摸（hasTouch + touchscreen.tap，不产生鼠标 / 键盘事件），删掉 speechSynthesis，--autoplay-policy=user-gesture-required，
// 第一次联网打开 + 等录音预缓存完 → 断网 → 重开（新文档，没有激活）→ page.clock 快进。
// 量法（测试包和正式包都能用，靠 init script 包一层浏览器 API，不靠游戏里的钩子）：
//   Response.arrayBuffer → decodeAudioData → AudioBufferSourceNode.start 一路带上文件名；记录 start 时 AudioContext.state、
//   buffer 时长 / 峰值（排除 1 个样本的解锁静音）、start 后 400 ms currentTime 有没有往前走（真的在出声）；<audio>.play 成功 / 被拦。
//   测试包另外读游戏自己的 __zyAudioLog（manifest 键 + decode / start / end）。
// 场景 A（测试员那次）：上限 5 分钟 → 打第 1 关时不答题等到收尾横条出现 → 横条出现马上要放 p:grace → 答完这一关 → 收尾里打完的结算页放 p:res_k* + p:timeup_k
//          → 回地图点关卡 → 睡觉云放 p:sleepy。
// 场景 B：强制结算：收尾开始后最后一次点屏 ≥ 50 秒才到时间（结算页出现前没有手势）→ 结算页放 p:timeup_k。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4321/'; const OUT = process.env.OUT || '/workspace/playtest/r1542-vt/'; mkdirSync(OUT, { recursive: true });
const TEST = process.env.PROD !== '1'; const TAG = process.env.TAG || (TEST ? 'test' : 'prod');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const on = k => !ONLY || ONLY.includes(k);
const AUDIBLE = process.env.AUDIBLE === '1';   // 有头（xvfb-run）+ 只读 tabs 的探针扩展：读 Chrome 标签页喇叭图标的状态 tab.audible
const EXT = '/workspace/playtest/r1542-ext';
const b = AUDIBLE ? null : await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] }); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + `[${TAG}] ` + m); if (!c) bad++; };
const INIT = test => {
  if (test) { window.__zyTest = true; }
  try { delete window.speechSynthesis; delete Window.prototype.speechSynthesis; } catch { /* */ } Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); window.SpeechSynthesisUtterance = undefined;
  const L = window.__au = []; const now = () => Math.round(performance.now()); const ctxs = window.__ctxs = [];
  const tagAB = new WeakMap(), tagBuf = new WeakMap();
  const oab = Response.prototype.arrayBuffer; Response.prototype.arrayBuffer = function () { const u = this.url; return oab.call(this).then(ab => { if (/\/voice\/.*\.(mp3|m4a)/.test(u)) tagAB.set(ab, u.split('/').pop()); return ab; }); };
  const AC = window.AudioContext; window.AudioContext = function (...a) { const c = new AC(...a); ctxs.push(c); L.push({ ev: 'ctx-new', t: now(), state: c.state }); c.addEventListener('statechange', () => L.push({ ev: 'ctx-' + c.state, t: now() })); return c; }; window.AudioContext.prototype = AC.prototype; window.webkitAudioContext = window.AudioContext;
  const od = BaseAudioContext.prototype.decodeAudioData; BaseAudioContext.prototype.decodeAudioData = function (ab, ...r) { const f = tagAB.get(ab); return od.call(this, ab, ...r).then(buf => { if (f) { tagBuf.set(buf, f); L.push({ ev: 'decode', f, t: now(), dur: +buf.duration.toFixed(2) }); } return buf; }); };
  const os = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { const buf = this.buffer, c = this.context; let peak = 0; if (buf) { const d = buf.getChannelData(0); for (let i = 0; i < d.length; i += 37) peak = Math.max(peak, Math.abs(d[i])); }
    const e = { ev: 'start', f: buf && tagBuf.get(buf) || '', t: now(), state: c.state, dur: buf ? +buf.duration.toFixed(2) : 0, peak: +peak.toFixed(3), ct0: c.currentTime }; L.push(e);
    this.addEventListener('ended', () => { e.played = +(c.currentTime - e.ct0).toFixed(2); });
    const ct = c.currentTime; const rt = window.__realSetTimeout || setTimeout; rt(() => { e.adv = +(c.currentTime - ct).toFixed(3); e.state2 = c.state; }, 400); return os.apply(this, a); };
  window.__realSetTimeout = setTimeout;   // page.clock 装上之前的真定时器（量 currentTime 用）
  const op = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { const f = (this.currentSrc || this.src || '').split('/').pop(); const p = op.call(this); p.then(() => L.push({ ev: 'el-start', f, t: now() }), err => L.push({ ev: 'el-blocked', f, t: now(), err: String(err?.name) })); return p; };
};
async function session(name) {
  const opt = { viewport: { width: 1393, height: 901 }, hasTouch: true };
  const ctx = AUDIBLE ? await chromium.launchPersistentContext('/tmp/r1542-vt-' + name + '-' + Date.now(), { ...opt, channel: 'chromium', headless: false, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=user-gesture-required'] }) : await b.newContext(opt);
  let sw = null; if (AUDIBLE) { sw = ctx.serviceWorkers().find(x => x.url().startsWith('chrome-extension://')) ?? await ctx.waitForEvent('serviceworker', { timeout: 10000 }); }
  const pg = AUDIBLE ? (ctx.pages()[0] ?? await ctx.newPage()) : await ctx.newPage(); pg.setDefaultTimeout(10000);
  const audible = async () => sw ? (await sw.evaluate(() => self.audible())).find(t => t.url.startsWith(URL))?.audible ?? null : null;
  await pg.addInitScript(INIT, TEST);
  let clock = false; const w = ms => clock ? pg.clock.runFor(ms) : pg.waitForTimeout(ms);
  const tap = async (sel, nth = 0) => { const l = pg.locator(sel).nth(nth); if (!(await l.isVisible().catch(() => false))) return false; const bb = await l.boundingBox(); if (!bb) return false; await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
  const pinIn = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(300); };
  const vis = s => pg.isVisible(s);
  const toMap = async () => { for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')); i++) {
    if (await vis('[data-testid=pin-ok]')) await pinIn('2468'); else if (await vis('[data-testid=stage-pick]')) await tap('[data-testid=stage-pick] .stage-btn.on'); else if (await vis('[data-testid=grade-pick]')) await tap('[data-testid=grade-pick] .stage-btn.on');
    else if (await vis('[data-testid=char-confirm]')) { await tap('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await tap('[data-testid=char-confirm]'); }
    else if (await vis('.modal >> text=稍后')) await tap('.modal >> text=稍后'); else if (await vis('[data-testid=to-map]')) await tap('[data-testid=to-map]'); else if (await vis('text=' + name)) await tap('text=' + name); await w(500); } };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await tap('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await tap('.pinpad input[type=radio]'); await pg.fill('[data-testid=hint-answer]', 'x'); await tap('[data-testid=hint-ok]'); await w(600); if (await vis('[data-testid=rec-done]')) await tap('[data-testid=rec-done]'); await w(300);
  await pg.fill('[data-testid=add-name]', name); await tap('[data-testid=home-grade-K1]'); await w(500);
  const pid = await pg.evaluate(n => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('profiles'); g.onsuccess = () => { r.result.close(); res(g.result.find(p => p.name === n)?.id); }; }; }), name);
  // 家长页把上限调到 5 分钟（全触摸）
  for (let i = 0; i < 12 && !(await vis('[data-testid=parent]')); i++) { for (const s of ['[data-testid=to-map]', '[data-testid=map-back]', '[data-testid=grade-back]', '[data-testid=stage-pick] >> text=返回', '[data-testid=back-char]']) if (await vis(s)) { await tap(s); break; } await w(500); }
  await tap('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await vis('.modal >> text=稍后')) { await tap('.modal >> text=稍后'); await w(300); }
  await tap('[data-testid=ptab-profiles]'); await w(300); await tap(`[data-testid=edit-${pid}]`); await w(400);
  for (const k of ['weekday', 'weekend']) for (let i = 0; i < 8; i++) { const v = Number((await pg.textContent(`[data-testid=limit-${k}-val]`).catch(() => '')).match(/\d+/)?.[0]); if (!v || v === 5) break; await tap(`[data-testid=limit-${k}-${v > 5 ? 'minus' : 'plus'}]`); await w(150); }
  const lim = await pg.textContent('[data-testid=limit-weekday-val]').catch(() => '?');
  await tap('[data-testid=profile-save]'); await w(500); await tap('[data-testid=parent-close]'); await w(500);
  // 等录音预缓存
  await pg.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 }).catch(() => {});
  let st = null; for (let i = 0; i < 150; i++) { st = await pg.evaluate(() => JSON.parse(localStorage.getItem('zy-offline-voice') || 'null')); if (st && st.total && st.done >= st.total) break; await pg.waitForTimeout(1000); }
  const n = await pg.evaluate(async () => (await (await caches.open('zy-voice')).keys()).length);
  ok(!!st && st.done === st.total && n >= st.total, `${name}：上限 ${lim}；录音预缓存 ${JSON.stringify(st)}，zy-voice ${n} 条`);
  // 断网 → 装假时钟 → 重开（新文档：没有任何用户激活）
  await ctx.setOffline(true); await pg.clock.install(); clock = true; await pg.reload(); await pg.waitForSelector('[data-testid^=profile-]', { timeout: 20000 }); await w(800);
  ok(await pg.evaluate(() => !window.speechSynthesis && !!navigator.serviceWorker?.controller), `${name}：断网重开后页面没有 speechSynthesis、SW 接管`);
  await toMap();
  return { ctx, pg, w, tap, vis, pid, audible };
}
const log = pg => pg.evaluate(() => window.__au.slice());
const glog = pg => pg.evaluate(() => (window.__zyAudioLog || []).slice());
/** 等某个文件开始播（真时间里等 decode / onended；假时钟每次走 200 ms） */
async function waitStart(S, re, fromIdx, maxMs = 6000, whole = false) { const t0 = Date.now(); while (Date.now() - t0 < maxMs) { const L = await log(S.pg); const e = L.slice(fromIdx).find(x => x.ev === 'start' && re.test(x.f)); if (e) { const aud = []; for (let k = 0; k < (whole ? Math.ceil(e.dur * 4) + 12 : 3); k++) { if (AUDIBLE) aud.push((await S.audible()) ? 1 : 0); if (whole && !AUDIBLE) { const x = (await log(S.pg)).slice(fromIdx).find(x => x.ev === 'start' && re.test(x.f)); if (x?.played !== undefined) break; } await S.pg.waitForTimeout(250); await S.w(250); } const x = (await log(S.pg)).slice(fromIdx).find(x => x.ev === 'start' && re.test(x.f)); if (AUDIBLE) x.aud = aud.join(''); return x; } await S.w(200); await S.pg.waitForTimeout(100); } return null; }
const describe = e => e ? `${e.f} state=${e.state}→${e.state2} 时长 ${e.dur}s 峰值 ${e.peak} 400ms 内 currentTime +${e.adv}${e.played !== undefined ? ` 播了 ${e.played}s` : ''}${e.aud ? ` 标签喇叭 ${e.aud}` : ''}` : '没开始';
const good = e => !!e && e.state === 'running' && e.peak > 0.05 && e.adv > 0.2 && (!AUDIBLE || /1/.test(e.aud || ''));
const whole = e => !!e && e.played !== undefined && e.played >= e.dur * 0.9;
async function gameKeys(S, re) { if (!TEST) return ''; const g = await glog(S.pg); const e = g.filter(x => re.test(x.key)); return ` | 游戏日志 ${e.map(x => `${x.ev}:${x.key}(${x.state})`).join(', ') || '无'}`; }
const bgTap = S => S.pg.touchscreen.tap(8, 893);   // 左下角空白处：算「有操作」，不点到任何按钮
async function enterLevel(S) { await S.tap('[data-testid=level-1]'); await S.w(1500); for (let i = 0; i < 8 && await S.vis('[data-testid=tutorial-skip]'); i++) { await S.tap('[data-testid=tutorial-skip]'); await S.w(400); } }

if (on('A')) {
  const S = await session('ra');
  await enterLevel(S); ok(await S.vis('.kopt'), 'A：进了小班第 1 关');
  // 不答题，每 20 秒点一下空白，等收尾横条
  let i0 = 0, seen = false; for (let i = 0; i < 40; i++) { i0 = (await log(S.pg)).length; await bgTap(S); for (let j = 0; j < 40 && !seen; j++) { await S.w(500); seen = await S.vis('[data-testid=grace-icon]'); } if (seen) break; }
  ok(seen, 'A：上限用完 → 小班收尾闹钟条出现');
  // 最容易出问题的时刻：横条出现的同一刻孩子点了答案（以前表扬 / 下一题题干会把收尾提示切掉）
  const corr = TEST ? '.kopt[data-correct="1"]:not([disabled])' : '.kopt:not([disabled])'; const tappedNow = await S.tap(corr);
  const pop = await S.vis('[data-testid=grace-pop]');
  const h = await S.pg.evaluate(() => { const e = document.querySelector('[data-testid=grace-icon]'); return e ? Math.round(e.getBoundingClientRect().height / innerHeight * 100) : 0; });
  await S.pg.screenshot({ path: OUT + `${TAG}-A1-grace.png` });
  const eg = await waitStart(S, /^p_grace\./, i0, 4000, true);
  ok(good(eg) && whole(eg), `A(a) 收尾横条出现（同一刻点了答案：${tappedNow}）→ 录音 p:grace 经 AudioContext 完整播出：${describe(eg)}（横条高 ${h}% 屏高，大卡片 ${pop ? '有' : '无'}）${await gameKeys(S, /p:grace/)}`);
  // 答完这一关（触摸）
  for (let i = 0; i < 60 && !(await S.vis('[data-testid=kinder-sub]')); i++) { if (await S.tap(corr)) await S.w(2500); else await S.w(700); }
  const i1 = (await log(S.pg)).length - 0; const txt = (await S.pg.textContent('.center-screen').catch(() => '')).replace(/\s+/g, ' ');
  await S.pg.screenshot({ path: OUT + `${TAG}-A2-result.png` });
  const before = await log(S.pg); const lastRes = before.map((x, i) => [x, i]).filter(([x]) => x.ev === 'start' && /^p_res_k/.test(x.f)).pop();
  const et = await waitStart(S, /^p_timeup_k\./, Math.max(0, (lastRes?.[1] ?? i1) - 0), 9000, true);
  ok(/今天玩够啦，明天见/.test(txt) && good(et) && whole(et), `A(c) 收尾里打完的小班结算页（「${txt.slice(0, 40)}」）→ p:timeup_k 播出：${describe(et)}${await gameKeys(S, /timeup_k/)}`);
  // 睡觉云
  await S.w(4000); await S.tap('[data-testid=to-map]'); await S.w(1200); const i2 = (await log(S.pg)).length; await S.tap('[data-testid=level-1]'); await S.w(300);
  const sl = await S.vis('[data-testid=sleepy]'); await S.pg.screenshot({ path: OUT + `${TAG}-A3-sleepy.png` });
  const es = await waitStart(S, /^p_sleepy\./, i2, 5000, true);
  ok(sl && good(es) && whole(es), `A(b) 时间用完点关卡 → 睡觉云出现、p:sleepy 播出：${describe(es)}${await gameKeys(S, /p:sleepy/)}`);
  const L = await log(S.pg); console.log('  A 录音流水：' + L.filter(x => x.ev !== 'decode').map(x => x.ev === 'start' ? `${x.f || '(silent)'}@${x.state}` : x.ev + (x.f ? ':' + x.f : '')).join(' · '));
  await S.ctx.close();
}
if (on('B')) {
  const S = await session('rb');
  await enterLevel(S); ok(await S.vis('.kopt'), 'B：进了小班第 1 关');
  let seen = false; for (let i = 0; i < 40 && !seen; i++) { await bgTap(S); for (let j = 0; j < 40 && !seen; j++) { await S.w(500); seen = await S.vis('[data-testid=grace-icon]'); } }
  ok(seen, 'B：收尾闹钟条出现');
  // 收尾 3 分钟里只在第 0 / 60 / 120 秒点空白，之后不再碰屏幕，直到强制结算
  let lastTap = 0, fake = 0, res = false; const i0 = (await log(S.pg)).length;
  for (let s = 0; s < 400 && !res; s++) { if (fake % 60000 === 0 && fake <= 120000) { await bgTap(S); lastTap = fake; } await S.w(1000); fake += 1000; res = await S.vis('[data-testid=result-title]'); }
  const gap = Math.round((fake - lastTap) / 1000);
  await S.pg.screenshot({ path: OUT + `${TAG}-B-forced.png` });
  const ctxState = await S.pg.evaluate(() => window.__ctxs.map(c => c.state).join(','));
  const et = await waitStart(S, /^p_timeup_k\./, i0, 6000, true);
  ok(res && good(et) && whole(et), `B(c) 强制结算的小班结算页（最后一次点屏在 ${gap} 秒前，ctx=${ctxState}）→ p:timeup_k 播出：${describe(et)}${await gameKeys(S, /timeup_k/)}`);
  await S.ctx.close();
}
console.log(bad ? `r1542-voice-timeup FAIL ${bad}` : 'r1542-voice-timeup ALL PASS'); await b?.close(); process.exit(bad ? 1 : 0);
