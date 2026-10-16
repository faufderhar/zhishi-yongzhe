// r9 复现：Boss「再玩一次」是否完全重置（回合计数、血量）
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4183/'; const OUT = process.env.OUT || 'screenshots/r9/';
const G = process.env.G || '7';
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } }); const pg = await ctx.newPage();
await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; });
const w = ms => pg.waitForTimeout(ms);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await w(300);
await pg.fill('[data-testid=add-name]', 'r9'); await pg.click(`[data-testid=home-grade-${G}]`); await w(400); await pg.click('text=r9'); await w(1000);
await pg.waitForSelector('[data-testid=char-confirm]'); await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600);
await pg.click('[data-testid="chapter-数学"]').catch(() => {}); await w(300);
const boss = pg.locator('.level.boss').first(); await boss.click(); await w(800);
for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
const snap = () => pg.evaluate(() => ({ turn: document.querySelector('[data-testid=turn]')?.textContent, bars: [...document.querySelectorAll('.bar, [class*=hp]')].map(e => e.className + ':' + e.textContent).slice(0, 6), prog: document.querySelector('.progress, .qcount, [data-testid=qcount]')?.textContent }));
const s0 = await snap(); console.log('start', JSON.stringify(s0));
async function answer(right) {
  await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 });
  const o = await pg.$(`.quiz .opt[data-correct="${right ? 1 : 0}"]`); if (o) { await o.click(); await pg.click('[data-testid=ok]', { timeout: 500 }).catch(() => {}); return; }
  if (await pg.$('.keypad')) { const a = right ? String(await pg.evaluate(() => window.__zyAnswer?.())) : '997'; for (const ch of a) await pg.click(`.keypad [data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]'); return; }
  await pg.click('.quiz .opt'); await pg.click('[data-testid=ok]').catch(() => {});
}
for (let i = 0; i < 120; i++) {
  if (await pg.isVisible('[data-testid=result-stats]')) break;
  if (await pg.isVisible('[data-testid=revive-no]')) { await pg.click('[data-testid=revive-no]'); await w(800); continue; }
  if (await pg.isVisible('[data-testid=act-attack]')) { await pg.click('[data-testid=act-attack]').catch(() => {}); await w(900); continue; }
  if (await pg.isVisible('[data-testid=next]')) { await pg.click('[data-testid=next]').catch(() => {}); await w(400); continue; }
  if (await pg.$('.quiz .opt, .keypad')) { await answer(i % 3 !== 0 && i < 30); await w(900); continue; }
  await w(500);
}
console.log(await pg.$$eval('[data-testid]', es => es.map(e => e.dataset.testid).join(' ')));
const mid = await snap(); console.log('end', JSON.stringify(mid));
await pg.screenshot({ path: OUT + 'r9-boss-result.png' });
await pg.click('[data-testid=again]'); await w(1500);
for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
const s1 = await snap(); console.log('again', JSON.stringify(s1));
await pg.screenshot({ path: OUT + 'r9-boss-again.png' });
ok(JSON.stringify(s1) === JSON.stringify(s0), 'Boss 再玩一次：回合与血量完全重置');
await b.close(); process.exit(bad ? 1 : 0);
