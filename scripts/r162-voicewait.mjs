// r16.2 小萌新：答对 → 下一题能点 的等待时间（没有声卡 / 声音坏了时不能卡 8–10 秒）。
// MODES：natural（这台机器本来的样子：没有声卡）、nosynth（没有 speechSynthesis）、failaudio（<audio> 报错 + AudioContext 卡在 suspended）、hang（speak() 不开始也不结束、<audio> play() 永远 pending）
// 不设 __zyTestNoTts：走真的朗读 / 录音流程
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/voicewait/'; mkdirSync(OUT, { recursive: true });
const MODES = (process.env.MODES || 'natural,nosynth,failaudio,hang').split(','); const N = +(process.env.N || 4); const LIMIT = +(process.env.LIMIT || 2000);
const b = await chromium.launch({ headless: process.env.HEADED !== '1', args: ['--autoplay-policy=no-user-gesture-required'] }); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const rep = {};
for (const mode of MODES) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 700 } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(m => { window.__zyTest = true; window.__zyNoOfflineCache = true;
    if (m === 'nosynth') { try { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); } catch { /* */ } }
    if (m === 'failaudio' || m === 'hang') {
      const P = HTMLMediaElement.prototype; P.play = m === 'hang' ? function () { return new Promise(() => {}); } : function () { setTimeout(() => this.dispatchEvent(new Event('error')), 30); return Promise.reject(new DOMException('no device', 'NotAllowedError')); };
      const AC = window.AudioContext; if (AC) window.AudioContext = class extends AC { constructor(...a) { super(...a); this.suspend().catch(() => {}); } resume() { return m === 'hang' ? new Promise(() => {}) : Promise.reject(new Error('no device')); } };
    }
    if (m === 'hang' && window.speechSynthesis) { const s = window.speechSynthesis; s.speak = () => {}; Object.defineProperty(s, 'speaking', { get: () => true }); }
  }, mode);
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x');
  await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]'); await pg.click('[data-testid=rec-done]'); await w(300); await pinIn('2468');
  await pg.fill('[data-testid=add-name]', 'k1'); await pg.click('[data-testid=home-grade-K1]'); await w(300);
  const toMap = async () => { for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } if (await pg.isVisible('[data-testid=to-map]')) await pg.click('[data-testid=to-map]').catch(() => {}); await w(300); } };
  await pg.click('text=k1').catch(() => {}); await w(400); await toMap();
  await pg.click('[data-testid=level-1]'); await w(500);
  for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
  await pg.waitForSelector('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])', { timeout: 15000 });
  const times = [], clips = []; let ended = false;
  for (let n = 0; n < N; n++) {
    const stem0 = await pg.evaluate(() => document.querySelector('.kq, .ktext, .qtext')?.textContent ?? '' + Math.random());
    const c = await pg.$('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])'); if (!c) break;
    const pt0 = await pg.evaluate(() => performance.now()); const t0 = Date.now(); await c.click();
    // 下一题可点：选项区不是 kwait、没有「在说话」提示、能点到正确答案；最多等 15 s
    const r = await pg.waitForFunction(() => !document.querySelector('[data-testid=kbusy]') && !!document.querySelector('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])') || !!document.querySelector('[data-testid=result-actions]'), null, { timeout: 15000, polling: 50 }).then(() => Date.now() - t0, () => -1);
    const busyMs = r; times.push(busyMs);
    // 这段时间里真正开始播的录音总时长（AudioContext 'start' 带片长）
    clips.push(await pg.evaluate(([a, b]) => Math.round((window.__zyAudioLog ?? []).filter(x => x.ev === 'start' && x.t >= a && x.t <= b).reduce((s, x) => s + (x.dur ?? 0) * 1000, 0)), [pt0, pt0 + Math.max(0, r)]));
    if (await pg.isVisible('[data-testid=result-actions]')) { ended = true; break; }
    await w(150);
    void stem0;
  }
  const dbg = await pg.evaluate(() => ({ speaking: window.speechSynthesis?.speaking ?? null, alog: (window.__zyAudioLog ?? []).slice(-12).map(x => `${x.ev}:${x.url}:${x.state}:${x.dur ? x.dur.toFixed(2) : ''}`), miss: (window.__zyMissLog ?? []).length }));
  rep[mode] = { times, clips, over: times.map((t, i) => t - clips[i]), dbg }; console.log(mode, JSON.stringify(times), JSON.stringify(dbg));
  // 预算：动画（答对 1.2 s 左右）+ 录音时长 + 2 s；没有录音 / 放不出来时只看 LIMIT + 动画
  // r16.2 验收：答对 → 下一题可点 减去这段时间真正播出的录音时长，必须 < LIMIT（2 s）
  //   最后一题进结算页：另有固定的「变成好朋友」演出（kinderFinale ≤ 2.5 s），预算 + 2.5 s
  const over = times.map((t, i) => t - clips[i]); const lastIsEnd = ended; const mid = lastIsEnd ? over.slice(0, -1) : over; const worst = Math.max(...mid);
  ok(times.length > 0 && !times.includes(-1) && worst < LIMIT, `${mode}：答对 → 下一题可点 ${JSON.stringify(times)} ms，减去播出的录音 ${JSON.stringify(clips)} → 最多多等 ${worst} ms（< ${LIMIT}）`);
  if (lastIsEnd) ok(over[over.length - 1] < LIMIT + 2500, `${mode}：最后一题 → 结算页 ${times[times.length - 1]} ms，减去录音 ${clips[clips.length - 1]} → ${over[over.length - 1]} ms（< ${LIMIT + 2500}，含 2.5 s 演出）`);
  await pg.screenshot({ path: `${OUT}${mode}.png` }); await ctx.close();
}
writeFileSync(OUT + 'report.json', JSON.stringify(rep, null, 1));
console.log(bad ? `FAILED ${bad}` : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
