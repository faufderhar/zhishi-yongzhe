// r15.2 验收（测试构建）：初一普通关挑战题 3 星规则 + 结算提示；高一题卡预计伤害
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
async function answer(pg, right) {
  for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on, [data-testid=${sp}] .stage-btn >> nth=0`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm])'); await pg.click('[data-testid=char-confirm]'); } await w(300); } };
const skipTut = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip]'); await w(400); } };
// 小萌新 1–3：温和精英 / Boss 用柔和学科怪兽、开心值 n/N 笑脸、关内没有星星
// r15.2 浏览器验收：初一普通关挑战题 3 星规则 + 结算提示；高一题卡预计伤害
async function pickAndAnswer(pg, w, useChal) {
  await pg.waitForSelector('[data-testid=chal-normal], .quiz .opt, .keypad', { timeout: 15000 });
  let chalOn = false;
  if (await pg.isVisible('[data-testid=chal-normal]')) { chalOn = !(await pg.isVisible('[data-testid=chal-on][aria-disabled=true]')); await pg.click(useChal && chalOn ? '[data-testid=chal-on]' : '[data-testid=chal-normal]'); await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 }); }
  const o = await pg.$('.quiz .opt[data-correct="1"]');
  if (o) { await o.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); }
  else if (await pg.$('.keypad')) { const a = String(await pg.evaluate(() => window.__zyAnswer?.())); for (const ch of a) await pg.click(`.keypad [data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]'); }
  return chalOn;
}
async function jRun(useChal) {
  const { ctx, pg, w } = await session('7', { __zyUnlockAll: true, __zyNoTut: true, __zyTestMonHp: 1 }); await enterMap(pg, w);
  let res = null;
  for (let lv = 1; lv <= 6 && !res; lv++) {
    await pg.click(`[data-testid=level-${lv}]`); await w(900); await tutSkip(pg, w); await skipTut(pg, w);
    if (await pg.isVisible('[data-testid=level-boss], [data-testid=elite-tag]').catch(() => false)) continue;
    const chalOn = await pickAndAnswer(pg, w, useChal);
    await pg.waitForSelector('[data-testid=result-title]', { timeout: 15000 }).catch(() => {});
    for (let i = 0; i < 6 && !(await pg.isVisible('[data-testid=result-title]')); i++) { await next(pg, w); await w(600); }
    const stars = await pg.$$eval('.stars .on', es => es.length).catch(() => -1);
    const hint = await pg.isVisible('[data-testid=result-chal-hint]');
    const txt = hint ? await pg.textContent('[data-testid=result-chal-hint]') : '';
    if (!chalOn) { await pg.click('[data-testid=to-map], [data-testid=result-map]').catch(() => {}); await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await enterMap(pg, w); continue; }
    res = { lv, stars, hint, txt };
  }
  await pg.screenshot({ path: OUT + `r152-j-${useChal ? 'chal' : 'normal'}.png` }); await ctx.close(); return res;
}
{
  const a = await jRun(false); ok(a && a.stars === 2 && a.hint && a.txt.includes('答对一道挑战题就能拿 3 星'), `初一普通关：挑战亮着但只答普通题 → ★★ + 提示（${JSON.stringify(a)}）`);
  const b = await jRun(true); ok(b && b.stars === 3 && !b.hint, `初一普通关：答对 1 道挑战题 → ★★★、无提示（${JSON.stringify(b)}）`);
}
{
  const { ctx, pg, w } = await session('10', { __zyUnlockAll: true, __zyNoTut: true }); await enterMap(pg, w);
  await pg.click('[data-testid=level-1]'); await w(900); await tutSkip(pg, w); await skipTut(pg, w);
  await pg.waitForSelector('[data-testid=card-std]', { timeout: 15000 }).catch(() => {});
  const t = await Promise.all(['light', 'std', 'heavy'].map(k => pg.textContent(`[data-testid=card-dmg-${k}]`).catch(() => '')));
  await pg.screenshot({ path: OUT + 'r152-h-cards.png' });
  ok(t.every(x => /本题预计伤害 ≈ \d+/.test(x)), `高一题卡显示预计伤害：${t.join(' / ')}`); await ctx.close();
}
await b.close(); console.log(bad ? `FAIL ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
