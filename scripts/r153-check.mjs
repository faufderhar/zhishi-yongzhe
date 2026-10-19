// r15.3 验收（测试构建）：复活失败说明 + 结算原因；（后续项目陆续加入）
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
const tutAll = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); } for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip]'); await w(300); } };
/** 一步：按 how（'right' | 'wrong'）答当前题；处理题卡 / 押注 / 挑战选择 / 继续 */
async function step(pg, w, how) {
  await tutAll(pg, w);
  for (const s of ['[data-testid=card-std]', '[data-testid=wager-sure]', '[data-testid=chal-normal]']) if (await pg.isVisible(s)) { await pg.click(s); await w(200); return 'pick'; }
  const sel = `.quiz .opt[data-correct="${how === 'right' ? 1 : 0}"]`;
  if (await pg.$(sel)) { await pg.click(sel); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); await w(300); return 'ans'; }
  if (await pg.$('.keypad')) { const a = how === 'right' ? String(await pg.evaluate(() => window.__zyAnswer?.())) : '98765'; for (const ch of a) await pg.click(`.keypad [data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]').catch(() => {}); await w(300); return 'ans'; }
  if (await pg.isVisible('[data-testid=next]')) { await pg.click('[data-testid=next]').catch(() => {}); await w(300); return 'next'; }
  await w(300); return 'wait';
}
if (on('revive')) {
  const { ctx, pg, w } = await session('7', { __zyUnlockAll: true, __zyNoTut: true, __zyTestHp: 1, __zyTestMonHp: 9999 }); await enterMap(pg, w);
  await pg.click('[data-testid=level-1]'); await w(900);
  let sawAsk = false, msg = '';
  for (let i = 0; i < 80; i++) {
    if (await pg.isVisible('[data-testid=revive-yes]')) { sawAsk = true; await pg.click('[data-testid=revive-yes]'); await w(400); continue; }
    if (await pg.isVisible('[data-testid=revive-fail]')) msg = await pg.textContent('[data-testid=revive-fail]');
    if (await pg.isVisible('[data-testid=result-title]')) break;
    await step(pg, w, 'wrong');
  }
  const title = await pg.textContent('[data-testid=result-title]').catch(() => ''); const why = await pg.textContent('[data-testid=lose-why]').catch(() => '');
  await pg.screenshot({ path: OUT + 'r153-revive-fail.png' });
  ok(sawAsk && /剩下 1 次机会，已经不够答对 2 道/.test(msg), `复活：连错 3 道提前结束并说明（${msg}）`);
  ok(/复活失败/.test(title) && !/差一点/.test(why), `结算页写原因、低正确率不说差一点（${title} / ${why}）`);
  await ctx.close();
}
if (on('hp0')) {
  const { ctx, pg, w } = await session('7', { __zyUnlockAll: true, __zyNoTut: true, __zyTestHp: 1, __zyTestMonHp: 9999 }); await enterMap(pg, w);
  await pg.click('[data-testid=level-1]'); await w(900);
  for (let i = 0; i < 80; i++) {
    if (await pg.isVisible('[data-testid=revive-no]')) { await pg.click('[data-testid=revive-no]'); await w(400); continue; }
    if (await pg.isVisible('[data-testid=result-title]')) break;
    await step(pg, w, 'wrong');
  }
  const title = await pg.textContent('[data-testid=result-title]').catch(() => '');
  ok(/血量归零/.test(title), `不复活 → 结算写「血量归零」（${title}）`); await ctx.close();
}
await b.close(); console.log(bad ? `FAIL ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
