// r12 验收（测试构建）：版本标签 r12；备份带密码哈希/恢复码哈希、有密码时恢复要先输当前密码；挑战题按当前难度 + 前序小节；高一重击卡总可选。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4183/'; const OUT = process.env.OUT || 'screenshots/r12/'; mkdirSync(OUT, { recursive: true });
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
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', opt.name || 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400);
  return { ctx, pg, w, pinIn };
}
const said = pg => pg.evaluate(() => window.__said.splice(0));
const enterMap = async (pg, w) => { await pg.click('text=r9'); await pg.waitForSelector('[data-testid=char-confirm]'); await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(700); };
const tutSkip = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); } };
async function answer(pg, right) {
  for (let i = 0; i < 3; i++) {
    await pg.waitForSelector('.quiz .opt, .keypad, [data-testid=chal-normal], [data-testid=card-std], [data-testid=wager-sure]', { timeout: 15000 });
    if (await pg.isVisible('[data-testid=card-std]')) { await pg.click('[data-testid=card-std]'); await pg.waitForTimeout(300); continue; }
    if (await pg.isVisible('[data-testid=wager-sure]')) { await pg.click('[data-testid=wager-sure]'); await pg.waitForTimeout(300); continue; }
    break;
  }
  if (await pg.isVisible('[data-testid=chal-normal]')) { await pg.click('[data-testid=chal-normal]'); await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 }); }
  const o = await pg.$(`.quiz .opt[data-correct="${right ? 1 : 0}"]`);
  if (o) { await o.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); return; }
  if (await pg.$('.keypad')) { const a = right ? String(await pg.evaluate(() => window.__zyAnswer?.())) : '997'; for (const ch of a) await pg.click(`.keypad [data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]'); return; }
  await pg.click('.quiz .opt'); await pg.click('[data-testid=ok]').catch(() => {});
}
const inVp = (pg, sel) => pg.$$eval(sel, (es) => es.every(e => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5 && r.top >= 0; }));
const next = async (pg, w) => { if (await pg.isVisible('[data-testid=next]')) { await pg.click('[data-testid=next]'); await w(500); } };
const toMapOf = async (pg, w, name) => { await pg.click(`.profile-card:has-text("${name}")`); await w(500); if (await pg.isVisible("[data-testid=pin-ok]")) { for (const d of "2468") await pg.click(`[data-testid=pin-${d}]`); await pg.click("[data-testid=pin-ok]"); await w(500); }   /* r12：当天换档案要家长密码 */
  for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on, [data-testid=${sp}] .stage-btn >> nth=0`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm])'); await pg.click('[data-testid=char-confirm]'); } await w(300); } };
const skipTut = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip]'); await w(400); } };

// 小萌新 1–3：温和精英 / Boss 用柔和学科怪兽、开心值 n/N 笑脸、关内没有星星
// r13：反复打初一前几关、随机作答，抓「回到首页」、页面错误和导航
const RUNS = +(process.env.RUNS || 12);
const { ctx, pg, w } = await session('7', { __zyUnlockAll: true });
const errs = []; let navs = 0; let homes = 0;
pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message.slice(0, 300)); });
pg.on('console', m => { if (m.type() === 'error' || /\[zy\]/.test(m.text())) console.log('CON', m.type(), m.text().slice(0, 300)); });
pg.on('framenavigated', f => { if (f === pg.mainFrame()) { navs++; console.log('NAV', f.url()); } });
await enterMap(pg, w);
for (let run = 0; run < RUNS; run++) {
  const lv = ['level-1', 'level-2', 'level-3', 'level-4'][run % 4];
  if (!(await pg.isVisible(`[data-testid=${lv}]`))) { console.log('NOT ON MAP at run', run, (await pg.textContent('body')).slice(0, 120)); if (await pg.isVisible('text=谁来玩')) { homes++; await toMapOf(pg, w, 'r9'); } else break; }
  await pg.click(`[data-testid=${lv}]`); await w(900); await tutSkip(pg, w); await skipTut(pg, w);
  for (let t = 0; t < 40; t++) {
    if (await pg.isVisible('[data-testid=result-stats]')) break;
    if (await pg.isVisible('text=谁来玩')) { homes++; console.log('HOME during battle! run', run, 'turn', t); break; }
    if (await pg.isVisible('text=游戏遇到一点问题')) { console.log('BOUNDARY', await pg.textContent('body')); break; }
    if (await pg.isVisible('[data-testid=chal-toggle]')) await pg.click(Math.random() < 0.3 ? '[data-testid=chal-on]' : '[data-testid=chal-normal]').catch(() => {});
    if (await pg.isVisible('[data-testid=chal-normal]')) await pg.click('[data-testid=chal-normal]').catch(() => {});
    if (await pg.isVisible('[data-testid=revive-no]')) await pg.click(Math.random() < 0.5 ? '[data-testid=revive-yes]' : '[data-testid=revive-no]').catch(() => {});
    if (await pg.isVisible('.quiz')) await answer(pg, Math.random() < 0.6).catch(e => console.log('ans', e.message.slice(0, 80)));
    await w(1400); await next(pg, w);
  }
  console.log('run', run, lv, 'end screen:', (await pg.textContent('body')).replace(/\s+/g,' ').slice(0, 80));
  if (await pg.isVisible('[data-testid=result-stats]')) await pg.click('text=回地图').catch(() => {});
  await w(800);
}
console.log('NAVLOG', await pg.evaluate(() => localStorage.getItem('zy.navLog')));
console.log('ERRLOG', await pg.evaluate(() => localStorage.getItem('zy.errLog')));
console.log(`SOAK runs=${RUNS} homes=${homes} navs=${navs} errors=${errs.length}`);
await b.close();
