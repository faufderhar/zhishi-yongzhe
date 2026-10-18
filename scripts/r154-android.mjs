// r15.4 安卓 / 华为平板（MatePad 11.5S 灵动款，华为浏览器，横屏）布局：小班第 1–6 关战斗——角色不压题目 / 选项，图片选项整块在屏内；
// 字体放大 115% / 130%（按页面缩放模拟：视口 ÷ 倍数、像素比 × 倍数）；另跑 1–2 年级、3/7/10 年级第 1 关。
// 视口推导（无直接实测来源）：面板 2800×1840（华为官网规格）÷ 像素比 2 = 1400×920 CSS px；「显示大小」调大一档按像素比 2.25 → 1244×818。
// 减去：状态栏 24、华为浏览器顶部地址栏 56、底部工具栏 48、三键导航 48（全屏 / 桌面图标打开 = 不减浏览器栏）。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4194/'; const OUT = process.env.OUT || '/workspace/playtest/shots_android_r154/'; mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const on = k => !ONLY || ONLY.includes(k);
const UA = 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; BTK-W00; HMSCore 6.14.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/15.0.4.312 Safari/537.36';
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const CFG = [
  ['1400x920-全屏', 1400, 920, 2, 1], ['1400x920-全屏-字115', 1400, 920, 2, 1.15], ['1400x920-全屏-字130', 1400, 920, 2, 1.3],
  ['1400x896-桌面图标(状态栏)', 1400, 896, 2, 1],
  ['1400x792-浏览器', 1400, 792, 2, 1], ['1400x792-浏览器-字115', 1400, 792, 2, 1.15], ['1400x792-浏览器-字130', 1400, 792, 2, 1.3],
  ['1400x744-浏览器+三键导航', 1400, 744, 2, 1], ['1244x690-显示放大+浏览器', 1244, 690, 2.25, 1],
];
const MAIN = (process.env.CFG ? CFG.filter(c => process.env.CFG.split(',').includes(c[0])) : CFG);
async function session([name, W, H, dpr, z], grade) {
  const ctx = await b.newContext({ viewport: { width: Math.round(W / z), height: Math.round(H / z) }, deviceScaleFactor: dpr * z, isMobile: true, hasTouch: true, userAgent: UA });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; });
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400);
  await pg.click('text=r9'); await w(500); if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468');
  for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on, [data-testid=${sp}] .stage-btn >> nth=0`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('.char-card >> nth=0'); await w(200); await pg.click('[data-testid=char-confirm]'); } if (await pg.isVisible('.modal >> text=稍后')) await pg.click('.modal >> text=稍后'); await w(400); }
  if (!(await pg.isVisible('[data-testid=level-1]'))) { await pg.screenshot({ path: `${OUT}fail-setup-${grade}.png` }); console.log('  setup: ' + (await pg.evaluate(() => document.body.innerText.slice(0, 200))).replace(/\n/g, ' ')); }
  return { ctx, pg, w };
}
const skipTut = async (pg, w) => { for (let i = 0; i < 10; i++) { const s = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!s) break; await s.click().catch(() => {}); await w(300); } };
/* 量：选项 / 题目 / 角色（可见的 img、动画层）。角色按图片实际内容框（object-fit: contain 后的画面）算 */
const measure = pg => pg.evaluate(async () => {
  /* 图片里不透明部分的外框（PNG/WebP 四周有透明边，按整张图算会误报重叠） */
  window.__bbox ??= new Map();
  const opaque = img => { const k = img.currentSrc || img.src; if (window.__bbox.has(k)) return window.__bbox.get(k); const W = Math.min(256, img.naturalWidth), H = Math.round(img.naturalHeight * W / img.naturalWidth); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); let bb = { l: 0, t: 0, r: 1, b: 1 };
    try { x.drawImage(img, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data; let l = W, t = H, r = 0, b = 0; for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (d[(yy * W + xx) * 4 + 3] > 40) { if (xx < l) l = xx; if (xx > r) r = xx; if (yy < t) t = yy; if (yy > b) b = yy; } if (r > l) bb = { l: l / W, t: t / H, r: (r + 1) / W, b: (b + 1) / H }; } catch { /* */ }
    window.__bbox.set(k, bb); return bb; };
  const R = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const vis = e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && r.width > 2 && r.height > 2; };
  const sheet = e => { const br = e.getBoundingClientRect(), im = e.querySelector('img'); if (!im || !im.naturalWidth) return R(e); const ir = im.getBoundingClientRect(); const S = 0.5, W = Math.ceil(br.width * S), H = Math.ceil(br.height * S); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    try { x.drawImage(im, (ir.left - br.left) * S, (ir.top - br.top) * S, ir.width * S, ir.height * S); const d = x.getImageData(0, 0, W, H).data; let l = W, t = H, r = 0, b = 0; for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (d[(yy * W + xx) * 4 + 3] > 40) { if (xx < l) l = xx; if (xx > r) r = xx; if (yy < t) t = yy; if (yy > b) b = yy; } if (r > l) return { l: br.left + l / S, t: br.top + t / S, r: br.left + (r + 1) / S, b: br.top + (b + 1) / S, w: (r + 1 - l) / S, h: (b + 1 - t) / S }; } catch { /* */ } return R(e); };
  const art = e => { if (e.classList.contains('sheet-box')) return sheet(e); if (e.tagName === 'IMG' && e.naturalWidth) { const r = e.getBoundingClientRect(); const k = Math.min(r.width / e.naturalWidth, r.height / e.naturalHeight); const w = e.naturalWidth * k, h = e.naturalHeight * k; const l = r.left + (r.width - w) / 2, t = r.top + (r.height - h) / 2; const o = opaque(e); const L = l + o.l * w, T = t + o.t * h, Rr = l + o.r * w, B = t + o.b * h; return { l: L, t: T, r: Rr, b: B, w: Rr - L, h: B - T }; } return R(e); };
  const chars = [...document.querySelectorAll('[data-testid=kpup] img:not(.sheet-box img), [data-testid=kpup] .sheet-box, .battle .hero img:not(.sheet-box img), .battle .hero .sheet-box')].filter(vis).map(art);
  const q = [...document.querySelectorAll('.kbubble, .battle .quiz .qtext, .battle .qtext')].filter(vis).map(R);
  const opts = [...document.querySelectorAll('.kopt, .battle .quiz .opt')].filter(vis).map(e => ({ ...R(e), img: !!e.querySelector('img, svg, .kopt-img, .opt-img') }));
  return { vw: innerWidth, vh: innerHeight, chars, q, opts, sx: document.scrollingElement.scrollWidth > innerWidth + 1, sy: document.scrollingElement.scrollHeight > innerHeight + 1 };
});
const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
function judge(m, tag) {
  const off = m.opts.filter(o => o.l < -0.5 || o.t < -0.5 || o.r > m.vw + 0.5 || o.b > m.vh + 0.5);
  ok(m.opts.length > 0 && !off.length, `${tag}：${m.opts.length} 个选项都在屏内（视口 ${m.vw}×${m.vh}${off.length ? '，出屏 ' + off.map(o => `${Math.round(o.t)}–${Math.round(o.b)}`).join(',') : ''}）`);
  const ov = []; for (const c of m.chars) for (const x of [...m.q, ...m.opts]) { const a = inter(c, x); if (a > 0.02 * Math.min(c.w * c.h, x.w * x.h) && a > 100) ov.push(Math.round(a)); }
  ok(!ov.length, `${tag}：角色不压题目 / 选项${ov.length ? `（重叠 ${ov.join(',')} px²）` : ''}`);
}
async function answerK(pg) { const l = pg.locator('.kopt[data-correct="1"]:not([disabled])').first(); if (await l.count()) { await l.click({ timeout: 3000 }).catch(() => {}); return true; } return false; }
async function answerStd(pg) {
  for (let i = 0; i < 3; i++) { if (await pg.isVisible('[data-testid=chal-normal]')) { await pg.click('[data-testid=chal-normal]'); await pg.waitForTimeout(300); } if (await pg.isVisible('[data-testid=card-std]')) { await pg.click('[data-testid=card-std]'); await pg.waitForTimeout(300); } if (await pg.isVisible('[data-testid=wager-sure]')) { await pg.click('[data-testid=wager-sure]'); await pg.waitForTimeout(300); } }
  const o = await pg.$('.quiz .opt[data-correct="1"]'); if (o) { await o.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); return; }
  /* 普通战斗（Battle.tsx）没有 __zyAnswer（r15.4 起就只有回合战斗有）→ 以前会逐字点 "undefined"，每键等 8 秒再超时；这里没有答案就填 0 交掉（本段只量选择题） */
  if (await pg.$('.keypad')) { const a0 = await pg.evaluate(() => window.__zyAnswer?.()); const a = a0 == null ? '0' : String(a0); for (const ch of a) await pg.click(`.keypad [data-key="${ch}"]`, { timeout: 1500 }).catch(() => {}); await pg.click('[data-testid=ok]', { timeout: 1500 }).catch(() => {}); }
}
if (on('k1')) for (const cfg of MAIN) {
  const s = await session(cfg, 'K1'); const { pg, w } = s;
  for (let lv = 1; lv <= 6; lv++) {
    if (!(await pg.isVisible(`[data-testid=level-${lv}]`))) { await pg.click('[data-testid=to-map]').catch(() => {}); await w(600); }
    await pg.click(`[data-testid=level-${lv}]`).catch(() => {}); await w(1000); await skipTut(pg, w);
    if (!(await pg.waitForSelector('.kbattle .kopt', { timeout: 10000 }).catch(() => null))) { await pg.screenshot({ path: `${OUT}fail-k1-L${lv}-${cfg[0]}.png` }); ok(false, `${cfg[0]} 小班第 ${lv} 关：没进战斗`); continue; }
    for (let qn = 1; qn <= 3; qn++) {
      await w(900); const m = await measure(pg); const tag = `${cfg[0]} 小班第 ${lv} 关第 ${qn} 题`; const b0 = bad; judge(m, tag); if (bad > b0) { await pg.screenshot({ path: `${OUT}fail-k1-L${lv}-q${qn}-${cfg[0]}.png` }); console.log('  chars', JSON.stringify(m.chars.map(c => [c.l, c.t, c.r, c.b].map(Math.round)))); }
      if (qn === 1) await pg.screenshot({ path: `${OUT}k1-L${lv}-${cfg[0]}.png` });
      if (!(await answerK(pg))) break; await w(2600); if (await pg.isVisible('[data-testid=result-stats]')) break;
    }
    for (let i = 0; i < 20 && !(await pg.isVisible('[data-testid=result-stats]')); i++) { if (!(await answerK(pg))) await w(500); await w(2200); }
    await pg.click('[data-testid=to-map]').catch(() => {}); await w(800);
  }
  await s.ctx.close();
}
if (on('grades')) for (const cfg of MAIN.filter(c => ['1400x792-浏览器', '1400x792-浏览器-字130', '1244x690-显示放大+浏览器'].includes(c[0]))) for (const g of (process.env.GRADES || '1,2,3,7,10').split(',')) {
  const s = await session(cfg, g); const { pg, w } = s;
  for (const lv of g === '1' || g === '2' ? [1, 2, 3] : [1]) {
    if (!(await pg.isVisible(`[data-testid=level-${lv}]`))) { await pg.click('[data-testid=to-map]').catch(() => {}); await w(600); }
    await pg.click(`[data-testid=level-${lv}]`).catch(() => {}); await w(1000); await skipTut(pg, w);
    for (let qn = 1; qn <= 4; qn++) {
      await pg.waitForSelector('.quiz .opt, .keypad, [data-testid=chal-normal], [data-testid=card-std], [data-testid=result-stats]', { timeout: 12000 }).catch(() => {});
      if (await pg.isVisible('[data-testid=result-stats]')) break;
      if (await pg.isVisible('.quiz .opt')) { const m = await measure(pg); judge(m, `${cfg[0]} ${g} 年级第 ${lv} 关第 ${qn} 题`); if (m.opts.some(o => o.img)) await pg.screenshot({ path: `${OUT}g${g}-L${lv}-q${qn}-${cfg[0]}.png` }); }
      await answerStd(pg); await w(1800); if (await pg.isVisible('[data-testid=next]')) await pg.click('[data-testid=next]').catch(() => {}); await w(400);
    }
    await pg.goto(URL); await w(800); await pg.click('text=r9').catch(() => {}); await w(500); if (await pg.isVisible('[data-testid=pin-ok]')) { for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); } await w(800);
    for (let i = 0; i < 10 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm])'); await pg.click('[data-testid=char-confirm]'); } await w(400); }
  }
  await s.ctx.close();
}
console.log(bad ? `r154-android FAIL ${bad}` : 'r154-android ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
