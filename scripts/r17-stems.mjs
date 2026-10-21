// r17 C5：中班 4 张新题干配图（1024 宽横图）在战斗气泡里：宽度约为气泡宽的 60%（50–66%；矮屏按高度上限封顶时只要求顶到上限），整张图在气泡里、在视口里；
// 选项卡都在视口里；页面不出滚动条（气泡内部滚动除外）。视口：1280×420 / 600 / 800、手机横屏 640×360；360×640 竖屏 = 「横过来」提示，量提示页不溢出。
// 用法：URL=http://127.0.0.1:4471/ node scripts/r17-stems.mjs → OUT/<视口>_<题号>.png + report.json
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://127.0.0.1:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/stems/'; mkdirSync(OUT, { recursive: true });
const GRADE = 'K2'; const IDS = (process.env.IDS || 'K2N-010,K2N-011,K2N-012,K2N-014').split(',');
const ALLVP = {
  '1280x420': { viewport: { width: 1280, height: 420 } }, '1280x600': { viewport: { width: 1280, height: 600 } }, '1280x800': { viewport: { width: 1280, height: 800 } },
  '640x360': { viewport: { width: 640, height: 360 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  '800x1280': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },   // 平板竖屏（16dvh 规则）
  '360x640': { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const VPS = (process.env.VP || Object.keys(ALLVP).join(',')).split(',');
const b = await chromium.launch(); let bad = 0; const rep = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(name) {
  const ctx = await b.newContext({ ...ALLVP[name] }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; window.__zyTestSpentSec = -1e7; /* 跑很久也不触发每日时长 */ });
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 's17'); await pg.click(`[data-testid=home-grade-${GRADE}]`); await w(400);
  await pg.click('text=s17'); await w(500); if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468');
  for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.locator(`[data-testid=${sp}] .stage-btn.on`).first().click().catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]) >> nth=0'); await w(200); await pg.click('[data-testid=char-confirm]'); } if (await pg.isVisible('.modal >> text=稍后')) await pg.click('.modal >> text=稍后'); await w(400); }
  return { ctx, pg, w };
}

const measure = pg => pg.evaluate(() => {
  const R = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const img = document.querySelector('.kbubble .q-img, .kq .q-img'); const bub = img?.closest('.kbubble') || img?.closest('.kq');
  const vw = innerWidth, vh = innerHeight; const inV = r => r.l >= -1 && r.t >= -1 && r.r <= vw + 1 && r.b <= vh + 1;
  const opts = [...document.querySelectorAll('.kopts .kopt')].map(R);
  const se = document.scrollingElement; const docOv = se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1;
  if (!img) return { noImg: true, docOv };
  const ir = R(img), br = R(bub); const cs = getComputedStyle(bub);
  const inner = br.w - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const cap = parseFloat(getComputedStyle(img).maxHeight);
  // 题干文字没被挡住、没被气泡裁掉：每行字的中心点打到的是气泡里的元素
  const txt = [...bub.querySelectorAll('.kq > span')].flatMap(sp => [...sp.getClientRects()]).filter(r => r.width > 2); const txtOk = txt.length > 0 && txt.every(r => { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && bub.contains(e); });
  return { txtOk, cap, loaded: img.complete && img.naturalWidth > 0, ratio: ir.w / inner, img: ir, bub: br, inBub: ir.l >= br.l - 1 && ir.r <= br.r + 1 && ir.t >= br.t - 1 && ir.b <= br.b + 1, imgInV: inV(ir), optsInV: opts.length > 0 && opts.every(inV), nOpts: opts.length, docOv, bubScroll: bub.scrollHeight > bub.clientHeight + 1 };
});
for (const vp of VPS) {
  const { ctx, pg, w } = await session(vp);
  if (vp === '360x640') {
    const r = await pg.evaluate(() => { const se = document.scrollingElement; return { ov: se.scrollWidth > se.clientWidth + 1, rot: !!document.querySelector('[data-testid=rotate-hint], .rotate-hint, .rotate') }; });
    ok(!r.ov, `${vp} 竖屏手机：横向不溢出 ${JSON.stringify(r)}`); await pg.screenshot({ path: `${OUT}${vp}_portrait.png` }); rep.push({ vp, ...r }); await ctx.close(); continue;
  }
  for (const id of IDS) {
    if (!(await pg.isVisible('[data-testid=level-1]'))) { await pg.click('[data-testid=to-map]').catch(() => {}); await w(600); }
    await pg.evaluate(x => { window.__zyForceQ = x; }, id);
    await pg.click('[data-testid=level-1]'); await w(900);
    for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
    await pg.waitForSelector('.kbattle .kopt', { timeout: 10000 }); await w(1400);
    const m = await measure(pg); rep.push({ vp, id, ...m });
    const r = m.ratio ? m.ratio.toFixed(2) : '-';
    ok(!m.noImg && m.loaded && m.ratio <= 0.66 && (m.ratio >= 0.5 || m.img.h >= m.cap - 1) && m.txtOk && m.inBub && m.imgInV && m.optsInV && !m.docOv, `${vp} ${id}：图宽 / 气泡宽 ${r}，高度上限 ${Math.round(m.cap)}，图 ${m.img ? Math.round(m.img.w) + '×' + Math.round(m.img.h) : '-'}，题干字都看得见 ${m.txtOk}，在气泡里 ${m.inBub}，在视口里 ${m.imgInV}，选项都在视口里 ${m.optsInV}(${m.nOpts})，页面溢出 ${m.docOv}，气泡内滚动 ${m.bubScroll}`);
    await pg.screenshot({ path: `${OUT}${vp}_${id}.png` });
    await pg.evaluate(() => { window.__zyForceQ = undefined; });
    await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300); await pg.click('text=s17'); await w(500);
    for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) { for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); } for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.locator(`[data-testid=${sp}] .stage-btn.on`).first().click().catch(() => {}); await w(400); }
  }
  await ctx.close();
}
await b.close(); writeFileSync(OUT + 'report.json', JSON.stringify(rep, null, 1));
console.log(bad ? `FAILED ${bad}` : 'r17-stems ALL PASS'); process.exit(bad ? 1 : 0);
