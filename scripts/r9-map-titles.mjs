import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [g, sub, vp] of [['7', '英语', { width: 1024, height: 600 }], ['10', '英语', { width: 1180, height: 820 }], ['7', '数学', { width: 1180, height: 820 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const pg = await ctx.newPage();
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; });
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto('http://localhost:4183/'); await pg.waitForSelector('[data-testid^=profile-]');
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'm'); await pg.click(`[data-testid=home-grade-${g}]`); await w(400); await pg.click('text=m'); await pg.waitForSelector('[data-testid=char-confirm]'); await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(700);
  await pg.click(`[data-testid="chapter-${sub}"]`); await w(400);
  const trunc = await pg.$$eval('.lv-name, .unit-head, .chapter b, .chapter small', es => es.filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map(e => e.className + ':' + e.textContent));
  console.log(g, sub, vp.width, JSON.stringify(trunc).slice(0, 800));
  await pg.screenshot({ path: `/workspace/zhishi-yongzhe/screenshots/r9/map-${g}-${sub}-${vp.width}.png` }); await ctx.close();
}
await b.close();
