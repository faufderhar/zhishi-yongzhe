// r15.4.1 小萌新：小班第 4 关第 3 题，答题后「…在说话，等一下下哦」提示不压题干气泡 / 伙伴说话气泡，且在屏幕内。6 个视口。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4307/'; const OUT = process.env.OUT || '/workspace/playtest/r1541-kbusy/'; mkdirSync(OUT, { recursive: true });
const VPS = (process.env.VPS || '1393x901,1400x920,1244x818,1280x800,1024x600,1180x820').split(',');
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
for (const vp of VPS) {
  const [W, H] = vp.split('x').map(Number); const ctx = await b.newContext({ viewport: { width: W, height: H } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; });
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click('[data-testid=home-grade-K1]'); await w(300);
  await pg.click('text=r9').catch(() => {}); await w(400); for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-4]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } await w(300); }
  await pg.click('[data-testid=level-4]'); await w(1500);
  for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
  let r = null;
  for (let qn = 1; qn <= 3; qn++) {
    await pg.waitForSelector('.kopt:not([disabled])', { timeout: 15000 }); await w(400);
    await pg.click('.kopt[data-correct="1"]'); await w(qn === 3 ? 250 : 0);
    if (qn === 3) { await pg.waitForSelector('[data-testid=kbusy]', { timeout: 3000 }).catch(() => {}); await pg.click('.kopt >> nth=0', { force: true }).catch(() => {}); await w(120);   // 锁定时再点一下：提示轻跳
      r = await pg.evaluate(() => { const R = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; }; const k = R('[data-testid=kbusy]'), bub = R('.kbubble'), say = R('[data-testid=ksay]');
        const inter = (x, y) => x && y ? Math.max(0, Math.min(x.right, y.right) - Math.max(x.left, y.left)) * Math.max(0, Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top)) : 0;
        return { k: !!k, ovB: inter(k, bub), ovS: inter(k, say), inV: k ? k.left >= 0 && k.right <= innerWidth && k.top >= 0 && k.bottom <= innerHeight : false, kr: k && [k.left, k.top, k.right, k.bottom].map(Math.round), br: bub && [bub.bottom].map(Math.round) }; });
      await pg.screenshot({ path: `${OUT}L4-Q3-${vp}.png` }); }
    else await pg.waitForSelector('[data-testid=kbusy]', { state: 'detached', timeout: 8000 }).catch(() => {});
  }
  ok(r?.k && r.ovB === 0 && r.ovS === 0 && r.inV, `${vp} 第 4 关第 3 题「在说话」提示：重叠题干 ${Math.round(r?.ovB ?? -1)} / 说话气泡 ${Math.round(r?.ovS ?? -1)} px²，在屏内 ${r?.inV}（提示 ${r?.kr}，题干底 ${r?.br}）`);
  await ctx.close();
}
console.log(bad ? `r1541-kbusy FAIL ${bad}` : 'r1541-kbusy ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
