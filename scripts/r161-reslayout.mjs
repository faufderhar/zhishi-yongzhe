// r16.1 (a)：结算页在可视高度 600 / 610（1280×600、1280×610）放得下——第 1、2 次玩（第 2 次多「再玩」一行），带「再试一次」行；内容不被吸底按钮盖住、不用滚动
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/r161/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
for (const [W, H] of [[1280, 600], [1280, 610], [1280, 700], [1280, 740], [1280, 800]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; window.__zyNoOfflineCache = true; });
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'k2'); await pg.click('[data-testid=home-grade-K2]'); await w(300);
  const toMap = async () => { for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } await w(300); } };
  await pg.click('text=k2').catch(() => {}); await w(400); await toMap();
  await pg.click('[data-testid="chapter-数数"]').catch(() => {}); await w(400);
  const idx = await pg.evaluate(() => { const c = window.__zyLevels.find(c => c.subject === '数数'); return c.levels.findIndex(l => l.kind === 'boss' && l.qs.some(q => q.unit === '数到10')); });
  await pg.click(`[data-testid=level-${idx + 1}]`);
  for (const play of [1, 2]) {
    await w(1500); for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
    let wrong = 1;
    for (let n = 0; n < 20 && !(await pg.$('[data-testid=result-actions]')); n++) {
      await pg.waitForSelector('.kopts:not(.kwait) .kopt:not([disabled]), [data-testid=result-actions]', { timeout: 15000 }).catch(() => {});
      if (wrong > 0 && n === 1) { await pg.click('.kopts:not(.kwait) .kopt[data-correct="0"]:not([disabled])', { timeout: 1500 }).then(() => wrong--).catch(() => {}); await w(1900); continue; }
      await pg.click('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])', { timeout: 1500 }).catch(() => {}); await w(600); }
    await pg.waitForSelector('[data-testid=result-actions]', { timeout: 20000 }).catch(() => {}); await w(1500);
    const r = await pg.evaluate(() => { const cs = document.querySelector('.center-screen'); const act = document.querySelector('[data-testid=result-actions]').getBoundingClientRect();
      const kids = [...cs.children].filter(e => e.dataset.testid !== 'result-actions' && !e.classList.contains('kfin-layer'));   /* r17 C3：结算动画层（绝对定位、铺满、不挡点）不算内容 */ const low = Math.max(...kids.map(e => e.getBoundingClientRect().bottom));
      return { scroll: cs.scrollHeight - cs.clientHeight, low: Math.round(low), actTop: Math.round(act.top), actBottom: Math.round(act.bottom), vh: innerHeight, again: !!document.querySelector('[data-testid=result-k-again]'), lines: document.querySelector('.klines')?.textContent }; });
    await pg.screenshot({ path: `${OUT}reslayout-${W}x${H}-play${play}.png` });
    ok(r.scroll <= 1 && r.low <= r.actTop + 1 && r.actBottom <= r.vh + 1 && (play === 1 || r.again), `${W}x${H} play${play}: ${JSON.stringify(r)}`);
    if (play === 1) await pg.click('[data-testid=again]');
  }
  await ctx.close();
}
console.log(bad ? `r161-reslayout FAIL ${bad}` : 'r161-reslayout ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
