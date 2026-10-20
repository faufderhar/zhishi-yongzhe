// r16.2 小萌新 #2：小班 L1 结算页在 1280×600 / 610 不出滚动条（连玩 3 次：第 1 / 2 / 3 次结算页内容不同）。
// 「1280×600 的窗口」扣掉浏览器地址栏实际视口约 510 高（小萌新截图量的），所以 481–560 也一起量
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/kresult/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
for (const H of (process.env.HS || '481,500,510,560,600,610').split(',').map(Number)) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: H } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyNoOfflineCache = true; window.__zyTestNoTts = true; });
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x');
  await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]'); await pg.click('[data-testid=rec-done]'); await w(300); await pinIn('2468');
  await pg.fill('[data-testid=add-name]', 'k1'); await pg.click('[data-testid=home-grade-K1]'); await w(300);
  const toMap = async () => { for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } if (await pg.isVisible('[data-testid=to-map]')) await pg.click('[data-testid=to-map]').catch(() => {}); await w(300); } };
  await pg.click('text=k1').catch(() => {}); await w(400); await toMap();
  await pg.click('text=k1').catch(() => {}); await w(400); await toMap();
  for (let run = 1; run <= 3; run++) {
    await pg.click('[data-testid=level-1]'); await w(500);
    for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
    for (let i = 0; i < 20 && !(await pg.isVisible('[data-testid=result-actions]')); i++) { const c = await pg.$('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])'); if (c) await c.click().catch(() => {}); await w(400); }
    await pg.waitForSelector('[data-testid=result-actions]', { timeout: 20000 }); await w(1500);
    const m = await pg.evaluate(() => { const out = []; for (const el of [document.scrollingElement, ...document.querySelectorAll('*')]) { if (!el) continue; const cs = getComputedStyle(el); const sc = el === document.scrollingElement || /(auto|scroll)/.test(cs.overflowY); if (sc && el.scrollHeight > el.clientHeight) out.push(`${el.className || el.tagName}:${el.scrollHeight}-${el.clientHeight}`); } return out; });
    if (m.length) console.log('  children', JSON.stringify(await pg.evaluate(() => [...document.querySelector('.result-screen').children].map(e => `${e.tagName}.${e.className}:${Math.round(e.getBoundingClientRect().height)}`))), JSON.stringify(await pg.evaluate(() => { const c = getComputedStyle(document.querySelector('.result-screen')); return [c.gap, c.padding, c.justifyContent]; })));
    const act = await pg.$eval('[data-testid=result-actions]', e => { const r = e.getBoundingClientRect(); return r.bottom; });
    ok(m.length === 0 && act <= H, `1280×${H} 第 ${run} 次结算页：可滚动溢出 ${JSON.stringify(m)}，按钮底 ${Math.round(act)}`);
    await pg.screenshot({ path: `${OUT}h${H}_run${run}.png` });
    if (run < 3) { await pg.click('[data-testid=to-map]'); await w(600); await toMap(); }
  }
  await ctx.close();
}
console.log(bad ? `FAILED ${bad}` : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
