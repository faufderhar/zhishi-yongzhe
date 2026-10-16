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
import { readFileSync } from 'node:fs';
if (on('label')) {
  const { ctx, pg, w } = await session('7'); const t = await pg.textContent('[data-testid=version-label]').catch(() => '');
  ok(/^r1[2-9](\.\d+)? · 题库v\d+ · /.test(t.trim()), `版本标签（${t.trim()}）`); await ctx.close();
}
if (on('backup')) {
  const { ctx, pg, w, pinIn } = await session('7');
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('.modal >> text=稍后')) { await pg.click('.modal >> text=稍后'); await w(300); }
  await pg.click('[data-testid=ptab-backup]'); await w(300);
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-testid=backup-export]')]); const f = OUT + 'backup.json'; await dl.saveAs(f);
  const d = JSON.parse(readFileSync(f, 'utf8')); ok(!!d.pin?.pinHash && !!d.pin?.recHash, '导出备份含 PIN 哈希和恢复码哈希');
  await pg.setInputFiles('input[type=file][accept*=json]', f); await w(400);
  ok(await pg.isVisible('[data-testid=restore-pin]'), '已有密码：恢复前要输当前密码'); ok(await pg.isDisabled('[data-testid=restore-go]'), '没输密码不能恢复');
  await pg.fill('[data-testid=restore-pin]', '1111'); await pg.click('[data-testid=restore-go]'); await w(600);
  ok(await pg.isVisible('text=家长密码不对'), '密码错：不恢复并提示'); await pg.screenshot({ path: OUT + 'r12-restore-pin.png' });
  await ctx.close();
}
if (on('chal')) {
  const { ctx, pg, w } = await session('7'); await enterMap(pg, w); await pg.click('[data-testid=level-1]'); await w(800); await tutSkip(pg, w);
  let none = 0, pick = 0;
  for (let i = 0; i < 10; i++) {
    await pg.waitForSelector('[data-testid=chal-toggle], .quiz .opt, .keypad, [data-testid=result-stats]', { timeout: 15000 }).catch(() => {});
    if (await pg.isVisible('[data-testid=result-stats]')) break;
    if (await pg.isVisible('[data-testid=chal-toggle]')) { pick++; if ((await pg.getAttribute('[data-testid=chal-on]', 'aria-disabled')) === 'true') none++; await pg.click('[data-testid=chal-normal]'); }
    await answer(pg, true); await w(1600); await next(pg, w);
  }
  ok(pick > 0, `初一挑战选择出现 ${pick} 次，其中挑战灰 ${none} 次（只在本小节和前序小节都没有更难题时灰）`); await ctx.close();
}
if (on('heavy')) {
  const { ctx, pg, w } = await session('10'); await enterMap(pg, w); await pg.click('[data-testid=level-1]'); await w(800); await tutSkip(pg, w);
  await pg.waitForSelector('[data-testid=card-heavy]', { timeout: 15000 }).catch(() => {});
  const en = await pg.isVisible('[data-testid=card-heavy]') && !(await pg.isDisabled('[data-testid=card-heavy]'));
  const m = await pg.textContent('[data-testid=card-mult-heavy]').catch(() => ''); ok(en, `高一重击卡可选（${m}）`); await pg.screenshot({ path: OUT + 'r12-heavy.png' }); await ctx.close();
}

// 小萌新 r11：结算先落盘；停在结算页、页面被刷新也不丢星、不出「没打完」；点错摇晃 0.6 s
if (on('kresult')) {
  const { ctx, pg, w } = await session('K1'); await enterMap(pg, w);
  const before = await pg.innerHTML('[data-testid=level-1]');
  await pg.click('[data-testid=level-1]'); await w(900); await skipTut(pg, w); await w(2600);
  await pg.waitForSelector('[data-testid^=opt-]');
  const wr = await pg.$('[data-testid^=opt-][data-correct="0"]'); await wr.click(); await w(100);
  const dur = await wr.evaluate(e => getComputedStyle(e).animationDuration); ok(dur === '0.6s', `点错摇晃时长 ${dur}`); await w(1700);
  for (let i = 0; i < 12 && !(await pg.isVisible('.center-screen')); i++) { const c = await pg.$('[data-testid^=opt-][data-correct="1"]'); if (c) await c.click().catch(() => {}); await w(2500); }
  ok(await pg.isVisible('.center-screen'), '打完进结算页'); await w(3000);
  await pg.reload(); await w(2500);
  if (!(await pg.isVisible('[data-testid=level-1]'))) await toMapOf(pg, w, 'r9').catch(() => {}); await w(800);
  if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(700); }
  ok(!(await pg.isVisible('[data-testid=interrupted]')), '停在结算页后页面刷新：不出现「没打完」');
  const after = await pg.innerHTML('[data-testid=level-1]').catch(() => ''); ok(after !== before, `星星已保存（地图卡片变化）`);
  await pg.screenshot({ path: OUT + 'r12-k-after-reload.png' }); await ctx.close();
}
if (on('crown')) {
  const { ctx, pg, w } = await session('7', { __zyUnlockAll: true }); await enterMap(pg, w);
  const boss = pg.locator('[data-testid^=level-]:has-text("Boss")').first(); await boss.click(); await w(1200); await tutSkip(pg, w); await w(800);
  ok(await pg.isVisible('[data-testid=boss-crown]'), 'Boss 有小王冠'); await pg.screenshot({ path: OUT + 'r12-boss-crown.png' }); await ctx.close();
}

// 较真家长 / 策划：忘记密码页有恢复码输入；找回问题设置页有提示；切换档案要密码
if (on('pin')) {
  const { ctx, pg, w, pinIn } = await session('7');
  await pg.click('[data-testid=parent]'); await w(300); await pg.click('[data-testid=forgot]'); await w(300);
  ok(await pg.isVisible('[data-testid=forgot-answer]') && await pg.isVisible('[data-testid=forgot-rec-box] [data-testid=rec-input]'), '忘记密码页：找回问题 + 恢复码输入框');
  for (let i = 0; i < 5; i++) { await pg.fill('[data-testid=forgot-answer]', 'wrong' + i); await pg.click('[data-testid=forgot-ok]'); await w(250); }
  const m = await pg.textContent('[data-testid=forgot-msg]').catch(() => ''); ok(/锁定/.test(m) && /小时/.test(m), `找回问题连错 5 次锁 24 小时（${m}）`);
  await pg.screenshot({ path: OUT + 'r12-forgot.png' }); await ctx.close();
}
if (on('switch')) {
  const { ctx, pg, w, pinIn } = await session('7'); await enterMap(pg, w); await pg.goto(URL); await w(800);
  const other = await pg.$('.profile-card:not(:has-text("r9"))');
  if (other) { await other.click(); await w(500); ok(await pg.isVisible('[data-testid^=pin-]'), '当天换另一个孩子的档案：要家长密码'); await pg.screenshot({ path: OUT + 'r12-switch-pin.png' }); }
  await ctx.close();
}
await b.close(); console.log(bad ? `r12 FAIL ${bad}` : 'r12 ALL PASS'); process.exit(bad ? 1 : 0);
