// r16 8d：家长页编辑档案〔全部册别〕截图（全部 / 只选一册），1280x800 和 800x600
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/volall/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
for (const [W, H] of [[1280, 800], [800, 600]]) {
  const pg = await (await b.newContext({ viewport: { width: W, height: H } })).newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; });
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x'); await pg.click('[data-testid=hint-ok]');
  await pg.waitForSelector('[data-testid=rec-code]').then(() => pg.click('[data-testid=rec-done]')); await pg.waitForSelector('[data-testid=pin-verify]').then(() => pinIn('2468'));
  await pg.fill('[data-testid=add-name]', 'vol'); await pg.click('[data-testid=home-grade-2]').catch(() => {}); await w(400);
  await pg.goto(URL); await w(600); await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); if (await pg.isVisible('.modal >> text=稍后')) await pg.click('.modal >> text=稍后');
  await pg.click('[data-testid^=edit-] >> nth=0'); await pg.click('[data-testid=grade-2]'); await pg.waitForSelector('[data-testid=vol-all]'); await w(200);
  const st = sel => pg.$eval(sel, e => { const c = getComputedStyle(e); return { bg: c.backgroundColor, bd: c.borderStyle, cls: e.className }; });
  await pg.locator('[data-testid=vol-all]').scrollIntoViewIfNeeded(); const a = await st('[data-testid=vol-all]'); const vs = await pg.$$eval('[data-testid^="vol-"]:not([data-testid=vol-all]):not([data-testid=vol-none])', es => es.map(e => [e.className, getComputedStyle(e).backgroundColor]));
  await pg.screenshot({ path: `${OUT}all-${W}x${H}.png` });
  ok(a.bd === 'solid' && vs.length > 1 && vs.every(([c]) => /in-all/.test(c)) && vs[0][1] !== a.bg, `${W}x${H} 全部：实心 ${a.bg}，各册浅色 ${vs[0]?.[1]}`);
  await pg.click('[data-testid=vol-all]'); await w(200); const id = (await pg.$$eval('[data-testid^="vol-"]:not([data-testid=vol-all]):not([data-testid=vol-none])', es => es.map(e => e.dataset.testid)))[0]; await pg.click(`[data-testid="${id}"]`); await w(200);
  const a2 = await st('[data-testid=vol-all]'), v2 = await st(`[data-testid="${id}"]`);
  await pg.screenshot({ path: `${OUT}one-${W}x${H}.png` });
  ok(a2.bd === 'dashed' && /\bon\b/.test(v2.cls) && !(await pg.isVisible('text=含在全部里')), `${W}x${H} 只选一册：〔全部册别〕虚线，${id} 实心 ${v2.bg}`);
}
await b.close(); console.log(bad ? `FAILED ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
