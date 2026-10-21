// r17 C3：幼儿园闯关成功动画（结算页 3 秒：变朋友 → 抱抱 → 星星飞进星槽 → 彩带）。1280×420 / 600 / 800 + 减少动画；
// 量：页面不滚动、按钮在屏幕里、人物 / 文字 / 星槽 / 按钮两两不重叠（二维）、节拍走到 b5、星星落位、彩带淡完、没有 brightness / 白色遮罩；
// 朗读顺序：战斗页「…好朋友」→ 结算页一句「开心值一共m个。副标题。…自己答对N题」，不重叠。
// 系统朗读用假的 speechSynthesis（会发 onstart / onend，按字数算时长），不放真声音。截图 OUT/<h>[_rm]_t<ms>.png
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/finale/'; mkdirSync(OUT, { recursive: true });
const HS = (process.env.HS || '420,600,800').split(',').map(Number); const SHOTS = [300, 1100, 1900, 2750, 3400, 5000];
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; }; const report = [];
for (const rm of [false, true]) for (const H of HS) {
  const WD = 1280; const ctx = await b.newContext({ viewport: { width: WD, height: H }, reducedMotion: rm ? 'reduce' : 'no-preference' }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyNoOfflineCache = true;
    const log = []; window.__e2eSpk = log; let cur = null;
    const fake = { speaking: false, pending: false, paused: false, getVoices: () => [{ lang: 'zh-CN', name: 'fake-zh', default: true, localService: true, voiceURI: 'fake' }], addEventListener() {}, removeEventListener() {},
      cancel() { if (cur) { const u = cur; cur = null; u.__e && (u.__e.end = performance.now()); clearTimeout(u.__t); u.onerror && u.onerror({ error: 'interrupted' }); } fake.speaking = false; }, resume() {}, pause() {},
      speak(u) { if (cur) fake.cancel(); cur = u; const e = { text: u.text, t: performance.now(), end: 0 }; u.__e = e; log.push(e); const ms = Math.max(600, [...u.text].filter(ch => /[\u4e00-\u9fff]/.test(ch)).length * 230);
        setTimeout(() => { if (cur === u) { fake.speaking = true; u.onstart && u.onstart({}); } }, 30);
        u.__t = setTimeout(() => { if (cur === u) { cur = null; fake.speaking = false; e.end = performance.now(); u.onend && u.onend({}); } }, 30 + ms); } };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ''; this.voice = null; this.rate = 1; this.pitch = 1; this.volume = 1; } }; });   // 假的 utterance：voice 可以设成假的声音对象
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x');
  await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]'); await pg.click('[data-testid=rec-done]'); await w(300); await pinIn('2468');
  await pg.fill('[data-testid=add-name]', 'k1'); await pg.click('[data-testid=home-grade-K1]'); await w(300);
  const toMap = async () => { for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } if (await pg.isVisible('[data-testid=to-map]')) await pg.click('[data-testid=to-map]').catch(() => {}); await w(300); } };
  await pg.click('text=k1').catch(() => {}); await w(400); await toMap();
  await pg.click('text=k1').catch(() => {}); await w(400); await toMap();

  await pg.click('[data-testid=level-1]').catch(async e => { await pg.screenshot({ path: OUT + 'fail_onboard.png' }); throw e; }); await w(500);
  for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
  for (let i = 0; i < 40 && !(await pg.isVisible('[data-testid=result-screen]')); i++) { const c = await pg.$('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])'); if (c) await c.click().catch(() => {}); await w(150); }
  await pg.waitForSelector('[data-testid=result-screen].kfin', { timeout: 20000 }); const t0 = Date.now();
  const tag = `${H}${rm ? '_rm' : ''}`; const beats = [];
  for (const ms of SHOTS) { const left = ms - (Date.now() - t0); if (left > 0) await w(left); await pg.screenshot({ path: `${OUT}${tag}_t${String(ms).padStart(4, '0')}.png` }); beats.push([ms, await pg.$eval('[data-testid=result-screen]', e => e.dataset.beat)]); }
  const m = await pg.evaluate(() => {
    const R = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, s }; };
    const boxes = ['.kfin-pup', '.kfin-mon', '[data-testid=result-k-friend]', '[data-testid=kinder-sub]', '[data-testid=result-k-stars]', '[data-testid=result-stats]', '[data-testid=result-actions]'].map(R).filter(Boolean);
    const ov = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], c = boxes[j]; if ((a.s === '.kfin-pup' && c.s === '.kfin-mon')) continue; const x = Math.min(a.r, c.r) - Math.max(a.l, c.l), y = Math.min(a.b, c.b) - Math.max(a.t, c.t); if (x > 1 && y > 1) ov.push(`${a.s}×${c.s}`); }
    const out = boxes.filter(x => x.l < -1 || x.t < -1 || x.r > innerWidth + 1 || x.b > innerHeight + 1).map(x => x.s);
    const se = document.scrollingElement; const scroll = se.scrollHeight > innerHeight + 1 || [...document.querySelectorAll('*')].some(e => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1; });
    const stars = [...document.querySelectorAll('[data-testid=result-k-stars] .on')].map(e => getComputedStyle(e).opacity);
    const left = document.querySelectorAll('.kfin-conf, .kfin-fly').length; const garland = !!document.querySelector('.kfin-garland');
    const bright = [...document.querySelectorAll('.result-screen *')].some(e => /brightness|invert/.test(getComputedStyle(e).filter));
    const pup = R('.kfin-pup'), mon = R('.kfin-mon'); const hugGap = pup && mon ? Math.round(mon.l - pup.r) : null;
    return { ov, out, scroll, stars, left, garland, bright, hugGap, qban: document.querySelector('.kfin-q') ? document.querySelector('[data-testid=result-k-mon]').dataset.mon : null, spk: window.__e2eSpk.map(e => ({ text: e.text, t: Math.round(e.t), end: Math.round(e.end) })) };
  });
  const lastBattle = m.spk.filter(e => /好朋友/.test(e.text)).pop(); const res = m.spk.find(e => /^开心值一共/.test(e.text));
  const order = !!lastBattle && !!res && res.t >= lastBattle.end && /太厉害啦|越来越棒啦|每道题都认真学会啦/.test(res.text) && /自己答对/.test(res.text) && res.text.indexOf('开心值') < res.text.indexOf('自己答对');
  const overlap = m.spk.some((e, i) => i && m.spk[i - 1].end && e.t < m.spk[i - 1].end - 5 && m.spk[i - 1].end - e.t > 50 && !/interrupted/.test(''));
  report.push({ tag, beats, ...m, spk: m.spk.slice(-3) });
  ok(!m.scroll && m.out.length === 0 && m.ov.length === 0, `${tag} 布局：不滚动、都在屏幕里、不重叠 ${JSON.stringify({ ov: m.ov, out: m.out })}`);
  ok(beats.some(([, x]) => x === 'b5'), `${tag} 节拍走到 b5：${JSON.stringify(beats)}`);
  ok(m.stars.length > 0 && m.stars.every(o => o === '1') && m.left === 0, `${tag} 星星都落位（${m.stars.join(',')}），飞行星星 / 彩带都清掉（剩 ${m.left}）`);
  ok(!m.bright && (rm ? m.garland : !m.garland), `${tag} 没有 brightness / invert 滤镜；${rm ? '减少动画：静态彩旗' : '不是静态彩旗'}`);
  ok(rm || (m.hugGap !== null && m.hugGap <= 0), `${tag} 抱在一起（怪物左边 - 小狗右边 = ${m.hugGap} px ≤ 0）`);
  ok(order && !overlap, `${tag} 朗读顺序：「${lastBattle?.text}」→「${res?.text}」，不重叠`);
  ok(m.qban === '小乌云', `${tag} 结算怪物是 Q版小乌云（${m.qban}）`);
  await ctx.close();
}
writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 1));
console.log(bad ? `r17-finale FAIL ${bad}` : 'r17-finale ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
