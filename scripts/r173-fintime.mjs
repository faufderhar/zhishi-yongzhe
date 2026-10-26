// r17.3 小萌新 r17.1：幼儿园最后一题答对 → 结算页出现 ≈ 3 s（以前 4.4–7.4 s，等整句「技能名 + 变成好朋友…」读完）。
// 假 speechSynthesis（按字数 230 ms/字，比真录音慢）→ 证明不再等整句读完；同时查：战斗页那句没被切（end 正常、不是 interrupted），结算页自动朗读排在它后面（不重叠）。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/finale/'; mkdirSync(OUT, { recursive: true });
const GRADES = (process.env.GRADES || 'K1,K2,K3').split(','); const RUNS = Number(process.env.RUNS || 2); const TARGET = Number(process.env.TARGET || 3600);
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; }; const report = [];
for (const G of GRADES) for (let run = 0; run < RUNS; run++) { const rm = false; const H = 600;
  const WD = 1280; const ctx = await b.newContext({ viewport: { width: WD, height: H }, reducedMotion: rm ? 'reduce' : 'no-preference' }); const pg = await ctx.newPage(); if (run % 2) await ctx.addInitScript(() => { window.__e2eSlow = 1; });   // 奇数轮：慢声音（520 ms/字 ≈ 技能名 + 好朋友整句 / 录音卡住时一直在读） pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__fin = { clicks: [], res: 0 };
    document.addEventListener('click', e => { if (e.target.closest?.('.kopt')) window.__fin.clicks.push(performance.now()); }, true);
    new MutationObserver(() => { if (!window.__fin.res && document.querySelector('[data-testid=result-screen]')) window.__fin.res = performance.now(); }).observe(document, { subtree: true, childList: true }); window.__zyNoOfflineCache = true;
    const log = []; window.__e2eSpk = log; let cur = null;
    const fake = { speaking: false, pending: false, paused: false, getVoices: () => [{ lang: 'zh-CN', name: 'fake-zh', default: true, localService: true, voiceURI: 'fake' }], addEventListener() {}, removeEventListener() {},
      cancel() { if (cur) { const u = cur; cur = null; u.__e && (u.__e.end = performance.now()); clearTimeout(u.__t); u.onerror && u.onerror({ error: 'interrupted' }); } fake.speaking = false; }, resume() {}, pause() {},
      speak(u) { if (cur) fake.cancel(); cur = u; const e = { text: u.text, t: performance.now(), end: 0 }; u.__e = e; log.push(e); const ms = Math.max(600, [...u.text].filter(ch => /[\u4e00-\u9fff]/.test(ch)).length * (window.__e2eSlow ? 520 : 230));
        setTimeout(() => { if (cur === u) { fake.speaking = true; u.onstart && u.onstart({}); } }, 30);
        u.__t = setTimeout(() => { if (cur === u) { cur = null; fake.speaking = false; e.end = performance.now(); u.onend && u.onend({}); } }, 30 + ms); } };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ''; this.voice = null; this.rate = 1; this.pitch = 1; this.volume = 1; } }; });   // 假的 utterance：voice 可以设成假的声音对象
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x');
  await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]'); await pg.click('[data-testid=rec-done]'); await w(300); await pinIn('2468');
  await pg.fill('[data-testid=add-name]', 'k1'); await pg.click(`[data-testid=home-grade-${G}]`); await w(300);
  const toMap = async () => { for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } if (await pg.isVisible('[data-testid=to-map]')) await pg.click('[data-testid=to-map]').catch(() => {}); await w(300); } };
  await pg.click('text=k1').catch(() => {}); await w(400); await toMap();
  await pg.click('text=k1').catch(() => {}); await w(400); await toMap();

  await pg.click('[data-testid=level-1]').catch(async e => { await pg.screenshot({ path: OUT + 'fail_onboard.png' }); throw e; }); await w(500);
  for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
  for (let i = 0; i < 300 && !(await pg.isVisible('[data-testid=result-screen]')); i++) { const c = await pg.$('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])'); if (c) await c.click().catch(() => {}); await w(150); }
  await pg.waitForSelector('[data-testid=result-screen]', { timeout: 20000 }); await w(9000);
  const f = await pg.evaluate(() => ({ clicks: window.__fin.clicks, res: window.__fin.res, gentle: !!document.querySelector('.kfin-q'), spk: window.__e2eSpk.map(e => ({ text: e.text, t: Math.round(e.t), end: Math.round(e.end) })) }));
  const last = f.clicks.filter(t => t < f.res).pop(); const dt = Math.round(f.res - last);
  const fr = f.spk.filter(e => /好朋友/.test(e.text)).pop(); const res = f.spk.find(e => /^开心值一共/.test(e.text));
  const tag = `${G}#${run}`; report.push({ tag, dt, spk: f.spk.slice(-3) });
  ok(dt >= 2500 && dt <= TARGET, `${tag} 最后一题答对 → 结算页 ${dt} ms（目标 ≈ 3 s，≤ ${TARGET}）`);
  ok(!!fr && fr.end > 0 && fr.end - fr.t >= 600, `${tag} 战斗页「${fr?.text}」读完（${fr ? fr.end - fr.t : '-'} ms，开始 ${fr ? Math.round(fr.t - last) : '-'} ms，结束于答对后 ${fr ? Math.round(fr.end - last) : '-'} ms）`);
  ok(!!res && res.t >= fr.end, `${tag} 结算页朗读「${res?.text?.slice(0, 24)}…」排在后面（${res ? Math.round(res.t - fr.end) : '-'} ms 后）`);
  await ctx.close();
}
writeFileSync(`${OUT}fintime.json`, JSON.stringify(report, null, 1));
console.log(bad ? `r173-fintime FAIL ${bad}` : 'r173-fintime ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
