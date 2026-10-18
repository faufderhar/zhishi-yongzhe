// r15.4.1 学霸 / 技术QA：地图——①中途离开后的红色提示条不盖顶栏「今天还能玩…」；②关卡名（两三行）不被裁底、不被省略，100% / 115% / 130% 字号都一样。
// 字号放大按页面缩放模拟（视口 ÷ 倍数、像素比 × 倍数），和 r154-android 相同。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4305/'; const OUT = process.env.OUT || '/workspace/playtest/r1541-map/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0, n = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const VPS = (process.env.VPS || '1400x800,1180x820,1024x600').split(','); const ZS = [1, 1.15, 1.3];
async function session(grade, W, H, z) {
  const ctx = await b.newContext({ viewport: { width: Math.round(W / z), height: Math.round(H / z) }, deviceScaleFactor: 2 * z }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; });
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(300);
  const toMap = async () => { await pg.click('text=r9').catch(() => {}); await w(400); for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } await w(300); } };
  await toMap(); return { ctx, pg, w, toMap };
}
const names = pg => pg.evaluate(() => [...document.querySelectorAll('.level .lv-name')].map(e => { const r = e.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()]; const tb = Math.max(...rs.map(x => x.bottom)); const cs = getComputedStyle(e);
  const clipB = r.top + e.clientHeight + parseFloat(cs.borderTopWidth); return { t: e.textContent, over: Math.round(tb - clipB), lines: new Set(rs.map(x => Math.round(x.top))).size, sh: e.scrollHeight - e.clientHeight }; }));
for (const vp of VPS) for (const z of ZS) for (const g of ['10', '7']) {
  const [W, H] = vp.split('x').map(Number); const s = await session(g, W, H, z); const { pg, w } = s; const tag = `${g} 年级 ${vp} 字${Math.round(z * 100)}%`;
  const chs = await pg.$$eval('[data-testid^=chapter-]', es => es.map(e => e.getAttribute('data-testid')));
  const cut = []; let total = 0;
  for (const ch of chs) { await pg.click(`[data-testid="${ch}"]`).catch(() => {}); await w(250); for (const x of await names(pg)) { total++; if (x.over > 1 || x.sh > 2) cut.push(`${x.t}（${x.lines} 行，底部多 ${x.over}px，隐藏 ${x.sh}px）`); } }
  n += total; ok(total > 0 && !cut.length, `${tag}：${total} 个关卡名都完整显示${cut.length ? '；被裁：' + cut.slice(0, 6).join('、') : ''}`);
  if (cut.length || (z === 1 && g === '10')) await pg.screenshot({ path: `${OUT}names-${g}-${vp}-z${Math.round(z * 100)}.png` });
  if (z === 1 || z === 1.3) {   // 中途离开：进关后整页刷新 → 地图出红色提示条
    await pg.click('[data-testid=level-1]'); await w(1200); for (let i = 0; i < 8; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(250); }
    await pg.waitForSelector('.battle, .kbattle', { timeout: 10000 }).catch(() => {}); await w(600); await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=pin-ok], [data-testid=level-1]').catch(async () => { await pg.screenshot({ path: `${OUT}reload-stuck-${g}-${vp}.png` }); }); await w(500); await s.toMap(); await w(600);
    const r = await pg.evaluate(() => { const R = e => e ? e.getBoundingClientRect() : null; const bar = document.querySelector('[data-testid=interrupted], [data-testid=exit-note]'); const tl = document.querySelector('[data-testid=time-left]'); const top = document.querySelector('.map-top');
      const a = R(bar), t = R(tl), m = R(top); const inter = (x, y) => x && y ? Math.max(0, Math.min(x.right, y.right) - Math.max(x.left, y.left)) * Math.max(0, Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top)) : 0;
      return { bar: !!bar, which: bar?.getAttribute('data-testid'), ovT: inter(a, t), ovTop: inter(a, m), txt: bar?.textContent.slice(0, 24) }; });
    ok(r.bar, `${tag}：中途离开后地图有提示条（${r.which}「${r.txt}」）`);
    ok(r.bar && r.ovT === 0 && r.ovTop === 0, `${tag}：提示条不盖顶栏 / 「今天还能玩」（重叠 ${Math.round(r.ovT)} / ${Math.round(r.ovTop)} px²）`);
    await pg.screenshot({ path: `${OUT}quit-bar-${g}-${vp}-z${Math.round(z * 100)}.png` });
  }
  await s.ctx.close();
}
console.log(`共量 ${n} 个关卡名`); console.log(bad ? `r1541-map FAIL ${bad}` : 'r1541-map ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
