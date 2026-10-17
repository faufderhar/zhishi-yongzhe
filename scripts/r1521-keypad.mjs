// r15.2.1 验收（测试构建）：填空键盘真实点击 / 触屏 / 两指交叠快速输入，顺序不乱、不丢键（学霸：-,1 成「1-」；100 成「1」）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4183/'; const OUT = process.env.OUT || 'screenshots/r14/'; mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const on = k => !ONLY || ONLY.includes(k);
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(grade, init = {}, vp = { width: 1180, height: 820 }, opt = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(opt.ctx || {}) }); const pg = await ctx.newPage();
  if (!opt.noAuto) {
    await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
    await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  }
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });   // r12：等待重设的全屏提示
  await pg.addInitScript(o => { window.__zyTest = true; window.__zyTestNoTts = true; window.__said = []; Object.assign(window, o);
    const S = window.speechSynthesis; if (S) S.speak = u => { window.__said.push(u.text); }; }, init);
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  if (opt.clock) await pg.clock.install();
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', opt.name || 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400);
  return { ctx, pg, w, pinIn };
}
const enterMap = async (pg, w) => { await pg.click('text=r9'); await w(400); if (await pg.isVisible('[data-testid=pin-ok]')) { for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(500); }   /* r15：选档案都要密码 */ if (!(await pg.isVisible('[data-testid=levels]'))) await pg.waitForSelector('[data-testid=char-confirm]', { timeout: 8000 }).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(700); } };
const tutSkip = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); } };
const skipTut = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip]'); await w(400); } };
const touch = process.env.TOUCH === '1'; const MODE = process.env.OVERLAP === '1' ? '触屏两指交叠' : touch ? (process.env.FAST === '1' ? '触屏快速点' : '触屏点') : '鼠标点';
const { ctx, pg, w } = await session('7', { __zyUnlockAll: true, __zyNoTut: true }, { width: 1180, height: 820 }, { ctx: touch ? { hasTouch: true, isMobile: false } : {} });
await enterMap(pg, w);
await pg.click('[data-testid=level-1]'); await w(900); await tutSkip(pg, w); await skipTut(pg, w);
const cdp = touch ? await ctx.newCDPSession(pg) : null;
const ctr = async k => { const bb = await pg.locator(`.keypad [data-key="${k}"]`).boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };
// 两指交叠：前一个键还没抬起，下一个键已经按下（快速打字常见）
async function overlap(seq) { const pts = []; for (const k of seq) pts.push(await ctr(k));
  const T = (type, list) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: list.map(i => ({ x: pts[i].x, y: pts[i].y, id: i })) });
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) await T('touchStart', [0]);
    else { await T('touchStart', [i - 1, i]); await new Promise(r => setTimeout(r, 30)); await T('touchEnd', [i - 1]); }
    await new Promise(r => setTimeout(r, 60));
  }
  await T('touchEnd', []); }
const tapK = async k => touch ? pg.tap(`.keypad [data-key="${k}"]`) : pg.click(`.keypad [data-key="${k}"]`);
for (let i = 0; i < 20; i++) {
  await pg.waitForSelector('[data-testid=chal-normal], .quiz .opt, .keypad', { timeout: 15000 });
  if (await pg.isVisible('[data-testid=chal-normal]')) { await pg.click('[data-testid=chal-normal]'); await w(300); }
  if (await pg.isVisible('.keypad')) {
    const out = [];
    for (const seq of ['-1', '-3/2', '100', '41']) {
      for (let j=0;j<8 && !(await pg.$('[data-testid=input] .ph'));j++) await pg.click('.keypad .del');
      if (process.env.OVERLAP === '1') { await overlap(seq); await w(300); } else for (const k of seq) { await tapK(k); if (process.env.FAST !== '1') await w(150); }
      out.push(seq + '→' + await pg.textContent('[data-testid=input]'));
    }
    // 用同一种方式输入本题正确答案并提交，必须判对
    for (let j = 0; j < 8 && !(await pg.$('[data-testid=input] .ph')); j++) await pg.click('.keypad .del');
    const ans = String(await pg.evaluate(() => window.__zyAnswer?.()));
    if (/^[0-9.\-\/]+$/.test(ans)) { if (process.env.OVERLAP === '1') await overlap(ans); else for (const k of ans) { await tapK(k); if (process.env.FAST !== '1') await w(150); } await w(300);
      const typed = await pg.textContent('[data-testid=input]'); await pg.click('[data-testid=ok]'); await pg.waitForSelector('[data-testid=feedback]', { timeout: 8000 }).catch(() => {});
      const cls = await pg.getAttribute('[data-testid=feedback]', 'class').catch(() => '');
      ok(typed === ans && /\bok\b/.test(cls || ''), `${MODE}：输入本题答案「${ans}」→ 显示「${typed}」，判${/\bok\b/.test(cls || '') ? '对' : '错'}`); }
    for (const x of out) { const [a, v] = x.split('→'); ok(a === v, `${MODE}：${x}`); } await pg.screenshot({ path: '/workspace/tmp/kp.png' }); break;
  }
  const o = await pg.$('.quiz .opt[data-correct="1"]'); if (o) { await o.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); }
  await w(1500); for (const s of ['[data-testid=next]', '[data-testid=fb-next]']) if (await pg.isVisible(s)) await pg.click(s);
  await w(500);
}
await b.close(); console.log(bad ? `FAIL ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
