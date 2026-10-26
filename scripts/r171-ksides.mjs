// r17.1（r16.1 延后项 b，小萌新 r16 问题 3）中班 L4「左右比多少」：两组图做成两个大按钮（左边那组在左），题干只留问句；
// 每组的图个数 = 题干里的个数、整组都在按钮里、按钮都在视口里、页面不滚动；点对的那组 = 答对。
// 用法：URL=http://127.0.0.1:4475/ node scripts/r171-ksides.mjs → OUT/<视口>_<题号>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://127.0.0.1:4475/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/ksides/'; mkdirSync(OUT, { recursive: true });
const GRADE = 'K2'; const IDS = (process.env.IDS || 'K2N-020,K2N-016,K2N-027,K2N-021').split(',');
const ALLVP = {
  '1280x610': { viewport: { width: 1280, height: 610 } }, '1280x800': { viewport: { width: 1280, height: 800 } },
  '640x360': { viewport: { width: 640, height: 360 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  '1024x768': { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  '800x1280': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const VPS = (process.env.VP || Object.keys(ALLVP).join(',')).split(',');
const b = await chromium.launch(); let bad = 0;
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
const EXPECT = { 'K2N-015': [6, 3, '左边'], 'K2N-016': [2, 7, '右边'], 'K2N-017': [8, 4, '左边'], 'K2N-018': [3, 9, '右边'], 'K2N-020': [7, 8, '右边'], 'K2N-021': [9, 8, '左边'], 'K2N-027': [9, 10, '右边'] };
const measure = pg => pg.evaluate(() => {
  const R = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const vw = innerWidth, vh = innerHeight; const inV = r => r.l >= -1 && r.t >= -1 && r.r <= vw + 1 && r.b <= vh + 1;
  const se = document.scrollingElement;
  const sides = [...document.querySelectorAll('.kopts .kopt')].map(btn => { const s = btn.querySelector('[data-testid=kside]'); const br = R(btn);
    const its = s ? [...s.querySelectorAll('.kcount-i')].map(R) : []; const lab = s?.querySelector('.kside-label');
    return { side: s?.dataset.side, n: its.length, l: br.l, inV: inV(br), itemsIn: its.every(r => r.l >= br.l - 1 && r.r <= br.r + 1 && r.t >= br.t - 1 && r.b <= br.b + 1), labIn: !!lab && (r => r.l >= br.l - 1 && r.r <= br.r + 1 && r.t >= br.t - 1 && r.b <= br.b + 1)(R(lab)), right: btn.dataset.correct === '1', tid: btn.dataset.testid, emoH: its[0] ? its[0].b - its[0].t : 0 }; });
  const stem = document.querySelector('[data-testid=kq-sides]')?.textContent ?? null;
  return { sides, stem, docOv: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1 };
});
for (const vp of VPS) {
  const { ctx, pg, w } = await session(vp); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  for (const id of IDS) {
    if (!(await pg.isVisible('[data-testid=level-1]'))) { await pg.click('[data-testid=to-map]').catch(() => {}); await w(600); }
    await pg.evaluate(x => { window.__zyForceQ = x; }, id);
    await pg.click('[data-testid=level-1]'); await w(900);
    for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
    await pg.waitForSelector('.kbattle .kopt', { timeout: 10000 }); await w(1400);
    const m = await measure(pg); const [L, Rn, ans] = EXPECT[id];
    await pg.screenshot({ path: `${OUT}${vp}_${id}.png` });
    const [a, c] = m.sides;
    ok(m.stem && !/[左右]边\p{Extended_Pictographic}/u.test(m.stem) && /哪边/.test(m.stem), `${vp} ${id} 题干只留问句：「${m.stem}」`);
    ok(m.sides.length === 2 && a.side === '左边' && c.side === '右边' && a.l < c.l, `${vp} ${id} 两个大按钮，左边那组在左（${m.sides.map(s => s.side).join(' / ')}）`);
    ok(a?.n === L && c?.n === Rn, `${vp} ${id} 图个数和题干一样：${a?.n} / ${c?.n}（应 ${L} / ${Rn}）`);
    ok(m.sides.every(s => s.itemsIn && s.labIn && s.inV), `${vp} ${id} 每组图和「左边 / 右边」小字都在按钮里，按钮在视口里（图高 ${m.sides.map(s => s.emoH.toFixed(0)).join('/')}px）`);
    ok(m.sides.every(s => s.emoH >= 18), `${vp} ${id} 图不太小（≥18px）`);
    ok(!m.docOv, `${vp} ${id} 页面不滚动`);
    const want = m.sides.find(s => s.side === ans); ok(want?.right, `${vp} ${id} 答案是「${ans}」那组`);
    if (vp === '1280x800' && want) { await pg.click(`[data-testid=${want.tid}]`); await w(600); const okm = await pg.$('.kopt.okmark, .kopt.ok, .kopt.right'); ok(!!okm, `${vp} ${id} 点「${ans}」那组 = 答对`); }
    await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300); await pg.click('text=s17'); await w(500); if (await pg.isVisible('[data-testid=pin-ok]')) { for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(300); }
    for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.locator(`[data-testid=${sp}] .stage-btn.on`).first().click().catch(() => {}); if (await pg.isVisible('[data-testid=to-map]')) await pg.click('[data-testid=to-map]').catch(() => {}); await w(300); }
  }
  ok(!errs.length, `${vp} 没有页面错误 ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}
await b.close(); console.log(bad ? `r171-ksides ${bad} FAIL` : 'r171-ksides ALL PASS'); process.exit(bad ? 1 : 0);
