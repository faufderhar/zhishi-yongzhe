// r15.4.1 技术QA P3-3：360×640 小手机竖屏长题——数字键盘最后一排在屏内、题干不需要在题目框里再滚、预计伤害和题型标签不重叠。
// 也跑 375×667 / 390×844 / 1024×600 回归。用法：URL=… node scripts/r1541-kb360.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4304/'; const OUT = process.env.OUT || '/workspace/playtest/r1541-kb360/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const CASES = (process.env.CASES || '360x640:M7-550,360x640:M7-352,360x640:M7-207,375x667:M7-550,390x844:M7-352,1024x600:M7-550,768x1024:M7-550').split(',').map(x => { const [v, q] = x.split(':'); const [W, H] = v.split('x').map(Number); return { W, H, q }; });
for (const { W, H, q } of CASES) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: W < 500, isMobile: W < 500 }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(fq => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; window.__zyForceQ = fq; }, q);
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click('[data-testid=home-grade-7]'); await w(300);
  await pg.click('text=r9'); await w(400); if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468');
  for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } await w(300); }
  if (!(await pg.isVisible('[data-testid=level-1]'))) { await pg.screenshot({ path: `${OUT}setup-${W}x${H}.png` }); console.log('  setup: ' + (await pg.evaluate(() => document.body.innerText.slice(0, 160))).replace(/\n/g, ' | ')); }
  await pg.click('[data-testid="chapter-数学"]').catch(() => {}); await w(300); await pg.click('[data-testid=level-1]'); await w(900);
  for (let i = 0; i < 8; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(250); }
  for (let i = 0; i < 6 && !(await pg.isVisible('.keypad')); i++) { if (await pg.isVisible('[data-testid=chal-normal]')) await pg.click('[data-testid=chal-normal]'); await w(500); }
  await w(7000);   // 开局提示气泡（约 6 秒）收起后再量
  const m = await pg.evaluate(() => { const R = e => e ? e.getBoundingClientRect() : null; const keys = [...document.querySelectorAll('.keypad button')].map(e => e.getBoundingClientRect().bottom);
    const qt = document.querySelector('.battle .qtext'); const tr = e => { if (!e) return null; const rg = document.createRange(); rg.selectNodeContents(e); return rg.getBoundingClientRect(); }; const meta = document.querySelector('.battle .qmeta'), dmg = document.querySelector('[data-testid=q-dmg]');   /* 文字实际占的框（Range），不是元素框 */
    const inter = (a, b) => a && b ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0;
    return { vh: innerHeight, maxKey: Math.max(...keys), nKeys: keys.length, qScroll: qt ? qt.scrollHeight - qt.clientHeight : -1, ov: inter(tr(meta), tr(dmg)), stem: qt?.innerText.slice(0, 20), docScroll: document.scrollingElement.scrollHeight - innerHeight, intent: (() => { const i = document.querySelector('[data-testid=intent]'), a = document.querySelector('.battle .arena'); if (!i || !a) return 'none'; const r = i.getBoundingClientRect(), ar = a.getBoundingClientRect(); const cs = getComputedStyle(i); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 10 && r.top >= ar.top - 1 && r.bottom <= ar.bottom + 1 ? 'ok' : `clip ${Math.round(r.top)}-${Math.round(r.bottom)} in ${Math.round(ar.top)}-${Math.round(ar.bottom)}`; })() }; });
  const tag = `${W}×${H} ${q}`; await pg.screenshot({ path: `${OUT}kb-${W}x${H}-${q}.png` });
  if (!m.nKeys) { ok(false, `${tag}：没遇到数字键盘`); await ctx.close(); continue; }
  ok(m.maxKey <= m.vh + 0.5, `${tag}：键盘最后一排在屏内（最下 ${Math.round(m.maxKey)} / 视口 ${m.vh}）`);
  ok(m.qScroll <= 2, `${tag}：题干不用在题目框里再滚（内部多出 ${m.qScroll}px）「${m.stem}」`);
  ok(m.ov < 1, `${tag}：预计伤害和题型标签不重叠（重叠 ${Math.round(m.ov)} px²）`);
  ok(m.intent === 'ok', `${tag}：怪物意图标签完整可见（${m.intent}）`);
  await ctx.close();
}
console.log(bad ? `r1541-kb360 FAIL ${bad}` : 'r1541-kb360 ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
