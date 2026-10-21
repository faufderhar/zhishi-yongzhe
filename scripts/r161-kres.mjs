// r16.1 (c)：中班 Boss（数数·数到10 = 点点数星熊）打完，结算页写「点点数星熊变成你的好朋友啦！」、立绘是它（不是小乌云）；普通关仍是小乌云
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/r161/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
for (const [W, H] of [[1280, 800], [1280, 600]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; window.__zyNoOfflineCache = true; });
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'k2'); await pg.click('[data-testid=home-grade-K2]'); await w(300);
  const toMap = async () => { for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } await w(300); } };
  await pg.click('text=k2').catch(() => {}); await w(400); await toMap();
  for (const [kind, want] of [['boss', '点点数星熊'], ['normal', '小乌云']]) {
    await pg.click('[data-testid="chapter-数数"]').catch(() => {}); await w(400);
    const idx = await pg.evaluate(k => { const c = window.__zyLevels.find(c => c.subject === '数数'); return c.levels.findIndex(l => l.kind === k && l.qs.some(q => q.unit === '数到10')); }, kind);
    await pg.click(`[data-testid=level-${idx + 1}]`); await w(1500);
    for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
    for (let n = 0; n < 15 && !(await pg.$('[data-testid=result-k-friend]')); n++) { await pg.waitForSelector('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled]), [data-testid=result-k-friend]', { timeout: 15000 }).catch(() => {}); await pg.click('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])', { timeout: 1500 }).catch(() => {}); await w(600); }
    await pg.waitForSelector('[data-testid=result-k-friend]', { timeout: 20000 }).catch(() => {}); await w(1200);
    const r = await pg.evaluate(() => ({ t: document.querySelector('[data-testid=result-k-friend]')?.textContent, mon: document.querySelector('[data-testid=result-k-mon]')?.getAttribute('data-mon'), face: !!document.querySelector('.kmon-face'), qsrc: [...document.querySelectorAll('[data-testid=result-k-mon] img.kmon-q, img.kmon-q[data-testid=result-k-mon]')].map(i => i.getAttribute('src')).join(' '), sub: [...document.querySelectorAll('.center-screen p, .center-screen .ksub')].map(e => e.textContent).join(' | ') }));
    await pg.screenshot({ path: `${OUT}kres-${kind}-${W}x${H}.png` });
    // r17 C1：Boss 结算用 Boss 自己的 Q版图（k_qban/…_boss_*），不再是序列帧的 .kmon-face；普通关仍不是 Boss 的脸
    const bossArt = r.face || /k_qban\/mon_k\d?_?[a-z0-9_]*_boss_/.test(r.qsrc);
    ok(r.t === `${want}变成你的好朋友啦！` && r.mon === want && bossArt === (kind === 'boss'), `${W}x${H} ${kind}: ${JSON.stringify(r)}`);
    await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300); await pg.click('text=k2').catch(() => {}); await w(400); await toMap();
  }
  await ctx.close();
}
console.log(bad ? `r161-kres FAIL ${bad}` : 'r161-kres ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
