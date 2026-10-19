// r16 第 6 步（小萌新）：中班结算页「再玩一次 / 回地图」不滚动就看得到（含 ~700 高）、按钮有图标；
// 第 3 次玩同一关：不加星的图 + 原因；「自己答对 N 题」画成星星；点锁住的关 → 要先打的关出现 👆。
// 用测试包（__zyTest），不开 __zyUnlockAll（要测锁住的关）。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/kidres/'; mkdirSync(OUT, { recursive: true });
const VPS = (process.env.VPS || '1280x700,1366x680,1024x700,844x390m,768x1024').split(',');
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; }; const rep = [];
for (const vp of VPS) {
  const mob = vp.endsWith('m'); const [W, H] = vp.replace('m', '').split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(mob ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}) }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; });
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'k2'); await pg.click('[data-testid=home-grade-K2]'); await w(300);
  const toMap = async () => { for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } if (await pg.isVisible('[data-testid=to-map]')) await pg.click('[data-testid=to-map]').catch(() => {}); await w(300); } };
  await pg.click('text=k2').catch(() => {}); await w(400); await toMap();
  // 点锁住的关（第 3 关）→ 第 1 关上出现 👆
  const lk = await pg.$('.level.locked'); let hint = null;
  if (lk) { await lk.click({ force: true }); await w(300); hint = await pg.evaluate(() => { const h = document.querySelector('[data-testid=lock-hint]'); const lv = h?.closest('.level'); return h ? { on: lv?.dataset.testid, vis: (r => r.width > 0 && r.top >= 0)(h.getBoundingClientRect()) } : null; }); await pg.screenshot({ path: `${OUT}${vp}-lockhint.png` }); await w(3800); hint.gone = !(await pg.$('[data-testid=lock-hint]')); }
  ok(!!hint && hint.vis && hint.gone, `${vp} 点锁住的关 → ${JSON.stringify(hint)}（3.5 秒后消失）`);
  const res = {};
  for (let play = 1; play <= 3; play++) {
    await pg.click('[data-testid=level-1]'); await w(500);
    for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
    for (let n = 0; n < 40 && !(await pg.isVisible('[data-testid=result-actions]')); n++) { const c = await pg.$('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])'); if (c) await c.click().catch(() => {}); await w(400); }
    await w(600);
    const m = await pg.evaluate(() => { const vis = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.width > 0; };
      const sc = document.querySelector('.center-screen'); return { again: vis('[data-testid=again]'), map: vis('[data-testid=to-map]'), icons: document.querySelectorAll('[data-testid=result-actions] .bicon').length, scrollTop: sc?.scrollTop ?? 0,
        why: vis('[data-testid=result-k-why]'), first: document.querySelector('[data-testid=result-k-first] .kfirst-icons')?.textContent ?? null, firstVis: vis('[data-testid=result-k-first]') }; });
    if (process.env.DUMP && play === 1) console.log('DUMP', JSON.stringify(await pg.evaluate(() => [...document.querySelector('.center-screen').querySelectorAll(':scope > *, :scope .klines > *')].map(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return [e.tagName + '.' + e.className, Math.round(r.top), Math.round(r.height), cs.marginTop, cs.marginBottom]; }))));
    res[play] = m; await pg.screenshot({ path: `${OUT}${vp}-play${play}.png` });
    ok(m.again && m.map && m.icons >= 2 && m.scrollTop === 0, `${vp} 第 ${play} 次结算：按钮不滚动可见 ${JSON.stringify(m)}`);
    if (play < 3) ok(!!m.first && m.firstVis, `${vp} 第 ${play} 次：「自己答对」星星行可见 ${m.first}`); else ok(m.why, `${vp} 第 3 次：不加星的图 + 原因可见`);
    await pg.click('[data-testid=to-map]'); await w(500); await toMap();
  }
  rep.push({ vp, hint, res }); await ctx.close();
}
writeFileSync(OUT + 'report.json', JSON.stringify(rep, null, 1));
console.log(bad ? `r16-kidres FAIL ${bad}` : 'r16-kidres ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
