import { chromium } from 'playwright';
// r15.4.3 较真家长 P2-3：改密码后「保留 / 重新生成」两个按钮都在屏幕内；重新生成并确认新码后不再弹回「原来的恢复码仍然有效」
const b = await chromium.launch(); let bad = 0; const URL = process.env.URL || 'http://localhost:4340/'; const OUT = '/workspace/playtest/r1543/recgen/'; (await import('node:fs')).mkdirSync(OUT, { recursive: true });
for (const [W, H] of [[1180, 820], [820, 1180], [390, 844], [844, 390], [1024, 768]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true }); const pg = await ctx.newPage();
  await pg.goto(URL); await pg.waitForSelector('[data-testid=add-child]'); await pg.waitForTimeout(400);
  const tap = async s => { const l = pg.locator(s).first(); await l.scrollIntoViewIfNeeded(); const bb = await l.boundingBox(); await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.waitForTimeout(150); };
  const pin = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await pg.waitForTimeout(300); };
  await tap('[data-testid=parent]'); await pin('2468'); await pin('2468');
  await pg.locator('.pinpad input[type=radio]').first().check(); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await tap('[data-testid=hint-ok]'); await pg.waitForTimeout(500);
  const c0 = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, ''); await pg.fill('[data-testid=rec-type]', c0); await tap('[data-testid=rec-type-ok]'); await pg.waitForTimeout(600);
  if (await pg.isVisible('.modal >> text=稍后')) await tap('.modal >> text=稍后');
  await tap('[data-testid=ptab-pin]'); await tap('[data-testid=pintab-change]'); await pin('2468'); await pin('1357'); await pin('1357'); await pg.waitForTimeout(500);
  const kb = await pg.locator('[data-testid=rec-keep]').boundingBox(); const rb = await pg.locator('[data-testid=rec-regen]').boundingBox();
  const sx = await pg.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.scrollLeft > 0).map(e => e.className + ':' + e.scrollLeft).join(','));
  await pg.screenshot({ path: `${OUT}after-change-${W}x${H}.png` });
  await tap('[data-testid=rec-regen]'); await pg.waitForTimeout(500); const c1 = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, '');
  await pg.fill('[data-testid=rec-type]', c1); await tap('[data-testid=rec-type-ok]'); await pg.waitForTimeout(500);
  const back = await pg.isVisible('[data-testid=rec-after-change]'); await pg.screenshot({ path: `${OUT}after-regen-confirm-${W}x${H}.png` });
  const inside = r => r && r.x >= 0 && r.x + r.width <= W + 0.5; const pass = inside(kb) && inside(rb) && !back; if (!pass) bad++;
  console.log((pass ? 'PASS ' : 'FAIL ') + W + 'x' + H, 'keep', JSON.stringify(kb), 'regen', JSON.stringify(rb), 'vw', W, 'scrolled', sx || '-', 'bounceBack', back); await ctx.close(); }
await b.close(); console.log(bad ? `r1543-recgen FAIL ${bad}` : 'r1543-recgen ALL PASS'); process.exit(bad ? 1 : 0);
