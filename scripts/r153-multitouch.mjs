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
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', opt.name || 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400);
  return { ctx, pg, w, pinIn };
}
const enterMap = async (pg, w) => { await pg.click('text=r9'); await w(400); if (await pg.isVisible('[data-testid=pin-ok]')) { for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(500); }   /* r15：选档案都要密码 */ if (!(await pg.isVisible('[data-testid=levels]'))) await pg.waitForSelector('[data-testid=char-confirm]', { timeout: 8000 }).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(700); } };
const tutSkip = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); } };
const skipTut = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip]'); await w(400); } };

const { ctx, pg, w } = await session('7', { __zyUnlockAll: true, __zyNoTut: true }, { width: 1180, height: 820 }, { ctx: { hasTouch: true, isMobile: false } });
await enterMap(pg, w);
await pg.click('[data-testid=level-1]'); await w(900); await tutSkip(pg, w); await skipTut(pg, w);
// 找到填空题
for (let i = 0; i < 25 && !(await pg.isVisible('.keypad')); i++) {
  await pg.waitForSelector('[data-testid=chal-normal], .quiz .opt, .keypad', { timeout: 15000 });
  if (await pg.isVisible('[data-testid=chal-normal]')) { await pg.click('[data-testid=chal-normal]'); await w(300); }
  if (await pg.isVisible('.keypad')) break;
  const o = await pg.$('.quiz .opt[data-correct="1"]'); if (o) { await o.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); }
  await w(1500); for (const s of ['[data-testid=next]', '[data-testid=fb-next]']) if (await pg.isVisible(s)) await pg.click(s);
  await w(500);
}
ok(!!(await pg.$('.keypad.num3')), '进到填空题');
const cdp = await ctx.newCDPSession(pg);
await pg.evaluate(() => { window.__pd = []; document.addEventListener('pointerdown', e => { const k = e.target.closest?.('[data-key]')?.dataset.key; if (k) window.__pd.push([k, e.pointerId, Math.round(e.timeStamp * 10) / 10]); }, true); });
const ctr = async k => { const bb = await pg.locator(`.keypad [data-key="${k}"]`).boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };
const val = async () => pg.evaluate(() => { const el = document.querySelector('[data-testid=input]'); return el.querySelector('.ph') ? '' : el.textContent; });
const clear = async () => { for (let i = 0; i < 12 && (await val()); i++) await pg.click('.keypad .del'); await pg.evaluate(() => { window.__pd = []; }); };
const pts = async seq => { const r = []; for (const k of seq) r.push(await ctr(k)); return r; };
const end = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
async function oneEvent(seq) { await clear(); const p = await pts(seq); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: p.map((q, i) => ({ ...q, id: i })) }); await end(); await w(150); return [await val(), await pg.evaluate(() => window.__pd)]; }
async function burst(seq) { await clear(); const p = await pts(seq); const tp = []; const sends = [];   // 同一 tick 连发（不等回复）：每次多一个手指
  for (let i = 0; i < p.length; i++) { tp.push({ ...p[i], id: i }); sends.push(cdp.send('Input.dispatchTouchEvent', { type: i ? 'touchMove' : 'touchStart', touchPoints: tp.map(x => ({ ...x })) })); }
  await Promise.all(sends); await end(); await w(150); return [await val(), await pg.evaluate(() => window.__pd)]; }
async function stamped(seq, order) { await clear(); const p = await pts(seq); const t0 = Date.now() / 1000; let tp = [];   // 事件到达顺序 = order，但每个带真实按下时间（i*5ms）
  for (const i of order) { tp = [...tp, { ...p[i], id: i }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', timestamp: t0 + i * 0.005, touchPoints: tp }); }
  await end(); await w(150); return [await val(), await pg.evaluate(() => window.__pd)]; }
const chk = async (name, f, want) => { const [v, pd] = await f(); ok(v === want, `${name} → 「${v}」（应为「${want}」） pointerdown=${JSON.stringify(pd)}`); };
await chk('同一个 touchStart 带 4 指 1234', () => oneEvent('1234'), '1234');
await chk('同一 tick 连发 4 个事件 1234', () => burst('1234'), '1234');
await chk('到达顺序 3,2,1,4、时间戳 1<2<3<4', () => stamped('1234', [2, 1, 0, 3]), '1234');
await chk('到达顺序 4,3,2,1、时间戳递增', () => stamped('1234', [3, 2, 1, 0]), '1234');
await chk('同一事件里 - 在前、3 在后', () => oneEvent('-3'), '-3');
await chk('同一事件里 3 在前、- 在后（- 不在开头，忽略）', () => oneEvent('3-'), '3');
await chk('- 先按但晚到（3 先到）', () => stamped('-3', [1, 0]), '-3');
await chk('-3/-2 一起按（时间戳顺序）', () => stamped('-3/-2', [4, 3, 2, 1, 0]), '-3/-2');
await chk('3 后面按 -（单独、间隔 200ms）', async () => { await clear(); await pg.tap('.keypad [data-key="3"]'); await w(200); await pg.tap('.keypad [data-key="-"]'); await w(150); return [await val(), []]; }, '3');
await pg.screenshot({ path: '/workspace/playtest/r153-multitouch.png' });
console.log(bad ? `FAIL ${bad}` : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
