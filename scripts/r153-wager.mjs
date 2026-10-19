// r15.3 学霸：押注说明每个档案只显示前 3 次（连打 3 局、每局之间刷新页面）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4183/'; const OUT = process.env.OUT || 'screenshots/r14/'; mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const on = k => !ONLY || ONLY.includes(k);
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(grade, init = {}, vp = { width: 1180, height: 820 }, opt = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(opt.ctx || {}) }); const pg = await ctx.newPage();
  if (!opt.noAuto) {
    await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
    await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  }
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });   // r12：等待重设的全屏提示
  await pg.addInitScript(o => { window.__zyTest = true; window.__zyTestNoTts = true; window.__said = []; Object.assign(window, o);
    const S = window.speechSynthesis; if (S) S.speak = u => { window.__said.push(u.text); }; }, init);
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  if (opt.clock) await pg.clock.install();
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', opt.name || 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400);
  return { ctx, pg, w, pinIn };
}
const enterMap = async (pg, w) => { await pg.click('text=r9'); await w(400); if (await pg.isVisible('[data-testid=pin-ok]')) { for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(500); }   /* r15：选档案都要密码 */ if (!(await pg.isVisible('[data-testid=levels]'))) await pg.waitForSelector('[data-testid=char-confirm]', { timeout: 8000 }).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(700); } };
const tutSkip2 = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); } for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip]'); await w(300); } };
const { ctx, pg, w } = await session('10', { __zyUnlockAll: true }); process.env.RELOAD = '1';
await enterMap(pg, w);
const counts = [];
for (let run = 0; run < 3; run++) {
  await pg.click('[data-testid=level-1]'); await w(900); await tutSkip2(pg, w);
  let hints = 0, wagers = 0;
  for (let step = 0; step < 60; step++) {
    if (await pg.isVisible('[data-testid=result-title]')) break;
    await tutSkip2(pg, w);
    if (await pg.isVisible('[data-testid=card-std]')) { await pg.click('[data-testid=card-std]'); await w(200); continue; }
    if (await pg.isVisible('[data-testid=wager-sure]')) { wagers++; if (await pg.isVisible('[data-testid=wager-hint-off]')) hints++; await pg.click('[data-testid=wager-sure]'); await w(200); continue; }
    if (await pg.isVisible('[data-testid=chal-normal]')) { await pg.click('[data-testid=chal-normal]'); await w(200); continue; }
    const o = await pg.$('.quiz .opt[data-correct="1"]');
    if (o) { await o.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); await w(300); continue; }
    if (await pg.$('.keypad')) { const a = String(await pg.evaluate(() => window.__zyAnswer?.())); for (const ch of a) await pg.click(`.keypad [data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]').catch(() => {}); await w(300); continue; }
    if (await pg.isVisible('[data-testid=next]')) { await pg.click('[data-testid=next]').catch(() => {}); await w(300); continue; }
    await w(400);
  }
  counts.push(`第${run + 1}局 押注 ${wagers} 次，说明 ${hints} 次`);
  const tips = await pg.evaluate(async () => { const r = indexedDB.open('zhishi'); return null; });
  await pg.click('[data-testid=result-map], [data-testid=to-map]').catch(() => {}); await w(800);
  if (process.env.RELOAD || !(await pg.isVisible('[data-testid=level-1]'))) { await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await enterMap(pg, w); }
}
console.log(counts.join('\n')); const tot = counts.reduce((a, c) => a + Number(c.match(/说明 (\d+)/)[1]), 0); console.log(tot <= 3 ? 'PASS 押注说明一共显示 ' + tot + ' 次（≤3）' : 'FAIL 押注说明显示了 ' + tot + ' 次'); if (tot > 3) process.exitCode = 1;
await b.close();
