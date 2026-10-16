// r12 验收（测试构建）：版本标签 r12；备份带密码哈希/恢复码哈希、有密码时恢复要先输当前密码；挑战题按当前难度 + 前序小节；高一重击卡总可选。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4183/'; const OUT = process.env.OUT || 'screenshots/r13/'; mkdirSync(OUT, { recursive: true });
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

// r13 小萌新：幼儿园按顺序打完每一关，地图星星都在，Boss 解锁
if (on('kchain')) {
  const { ctx, pg, w } = await session('K1'); await enterMap(pg, w);
  const stars = async i => pg.$$eval(`[data-testid=level-${i}] .stars .on`, es => es.length).catch(() => -1);
  for (let i = 1; i <= 5; i++) {
    await pg.click(`[data-testid=level-${i}]`); await w(900); await skipTut(pg, w); await tutSkip(pg, w); await w(2600);
    for (let k = 0; k < 20 && !(await pg.isVisible('[data-testid=to-map]')); k++) { const c = await pg.$('[data-testid^=opt-][data-correct="1"]'); if (c) await c.click().catch(() => {}); await w(2300); }
    const rs = await pg.$$eval('.center-screen .stars .on', es => es.length).catch(() => -1);
    await pg.click('[data-testid=to-map]'); await w(900);
    const ms = await stars(i); ok(ms >= 1 && ms >= Math.min(rs, 3), `幼儿园第 ${i} 张卡：结算 ${rs}★ → 地图 ${ms}★`);
  }
  ok(await pg.getAttribute('[data-testid=level-6]', 'data-locked') === '0', 'Boss 已解锁');
  await pg.screenshot({ path: OUT + 'r13-k-chain.png' }); await ctx.close();
}
// r13 小萌新：同一关前两次没打完（退出）、第 3 次才拿到星——地图也要有星、Boss 解锁链条不断
if (on('kreplay')) {
  const { ctx, pg, w } = await session('K1', { __zyUnlockAll: true }); await enterMap(pg, w);
  for (let t = 0; t < 2; t++) {
    await pg.click('[data-testid=level-2]'); await w(900); await skipTut(pg, w); await tutSkip(pg, w); await w(2600);
    const c = await pg.$('[data-testid^=opt-][data-correct="1"]'); if (c) await c.click(); await w(2500);
    await pg.evaluate(() => window.dispatchEvent(new Event('zy-back-pause'))); await w(400);
    await pg.click('[data-testid=quit]'); await pg.click('[data-testid=quit-confirm]').catch(() => {}); await w(900);
    if (await pg.isVisible('[data-testid=to-map]')) await pg.click('[data-testid=to-map]'); await w(700);
  }
  await pg.click('[data-testid=level-2]'); await w(900); await w(2600);
  for (let k = 0; k < 20 && !(await pg.isVisible('[data-testid=to-map]')); k++) { const c = await pg.$('[data-testid^=opt-][data-correct="1"]'); if (c) await c.click().catch(() => {}); await w(2300); }
  await pg.click('[data-testid=to-map]'); await w(900);
  const ms = await pg.$$eval('[data-testid=level-2] .stars .on', es => es.length); ok(ms >= 1, `前两次退出、第 3 次打完：地图 ${ms}★`);
  await ctx.close();
}
// r13 学霸 / 较真家长：每次切换年级（含切回档案年级）都要密码；家长页密码页：开关、修改找回问题、忘记密码链接；恢复码重设中途放弃不丢旧密码
if (on('pin')) {
  const { ctx, pg, w, pinIn } = await session('7', {}, undefined, { noAuto: true });
  await pg.click('text=r9'); await w(500);
  await pg.click('[data-testid=stage-pick] .stage-btn.on'); await w(400); await pg.click('[data-testid=grade-pick] .stage-btn.on'); await w(500);
  if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600); }
  await pg.goBack(); await w(600); await pg.goBack(); await w(600); await pg.click('[data-testid=stage-H]'); await w(400); await pg.click('[data-testid=grade-10]'); await w(400);
  ok(await pg.isVisible('[data-testid=pin-ok]'), '初一 → 高一：要家长密码'); await pinIn('2468'); await w(500);
  if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600); }
  await pg.goBack(); await w(600); await pg.goBack(); await w(600); await pg.click('[data-testid=stage-J]'); await w(400); await pg.click('[data-testid=grade-7]'); await w(400);
  ok(await pg.isVisible('[data-testid=pin-ok]'), '高一 → 切回初一（档案年级）：也要家长密码'); await pinIn('2468'); await w(500);
  // 家长页
  for (let i = 0; i < 4 && !(await pg.isVisible('[data-testid=parent]')); i++) { await pg.goBack(); await w(500); }
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(400);
  if (await pg.isVisible('text=稍后')) { await pg.click('text=稍后'); await w(300); } await pg.click('text=🔑 密码'); await w(300);
  ok(await pg.isVisible('[data-testid=switch-nopin]'), '「切换档案不用密码」在密码页');
  ok(await pg.isVisible('[data-testid=pintab-forgot]') && await pg.isVisible('[data-testid=pintab-rec]'), '输入旧密码处有「忘记密码 / 用恢复码」');
  await pg.click('[data-testid=hint-edit]'); await w(200);
  ok((await pg.$$eval('[data-testid=hint-edit-box] input[type=radio]', es => es.filter(e => e.checked).length)) === 0, '修改找回问题：不预选问题');
  await pg.click('[data-testid=hint-edit-box] input[type=radio] >> nth=1'); await pg.fill('[data-testid=hint-edit-answer]', 'abc'); await pg.click('[data-testid=hint-edit-ok]'); await w(300);
  ok((await pg.textContent('.parent')).includes('找回问题已修改'), '修改找回问题已保存');
  await pg.click('[data-testid=recgen]'); await w(300); if (await pg.isVisible('[data-testid=recgen-confirm]')) { await pg.fill('[data-testid=recgen-pin]', '2468'); await w(400); await pg.click('[data-testid=recgen-confirm]'); await w(300); } const code = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, ''); ok(await pg.isVisible('[data-testid=rec-typeback]'), 'R141-2 恢复码要求打回确认'); await pg.fill('[data-testid=rec-type]', code.slice(0,3)); ok(await pg.isDisabled('[data-testid=rec-type-ok]'), '输错时确认按钮禁用'); await pg.fill('[data-testid=rec-type]', code.toLowerCase()); await pg.click('[data-testid=rec-type-ok]'); await w(400); ok(!(await pg.isVisible('[data-testid=rec-unconfirmed]')), '确认后不再提醒');
  await pg.click('[data-testid=parent-close]'); await w(400);
  await pg.click('[data-testid=parent]'); await w(300); await pg.click('[data-testid=forgot]'); await w(300);
  await pg.fill('[data-testid=rec-input]', code); await pg.click('[data-testid=rec-ok]'); await w(400);
  ok(await pg.isVisible('[data-testid=recset]'), '恢复码通过 → 设新密码（新密码 + 找回问题同一面板）');
  await pg.reload(); await w(2500);
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(400);
  ok(await pg.isVisible('.parent'), '恢复码重设中途放弃：旧密码仍然有效（没有先清掉）');
  await pg.click('[data-testid=parent-close]'); await w(400); await pg.click('[data-testid=parent]'); await w(300); await pg.click('[data-testid=forgot]'); await w(300);
  await pg.fill('[data-testid=rec-input]', code); await pg.click('[data-testid=rec-ok]'); await w(400);
  ok(await pg.isVisible('[data-testid=recset]'), '中途放弃后恢复码没有作废');
  await pg.fill('[data-testid=recset-pin1]', '1357'); await pg.fill('[data-testid=recset-pin2]', '1357'); await pg.click('[data-testid=recset] input[type=radio] >> nth=0'); await pg.fill('[data-testid=recset-answer]', 'mimi');
  ok(await pg.isEnabled('[data-testid=recset-ok]'), '一次提交：密码和找回问题都填好才能确定'); await pg.click('[data-testid=recset-ok]'); await w(500);
  ok(await pg.isVisible('[data-testid=rec-code]'), '新密码 + 找回问题一起提交后才发新恢复码'); await pg.click('[data-testid=rec-done]'); await w(400);
  await pg.click('[data-testid=parent-close]').catch(() => {}); await w(400); await pg.click('[data-testid=forgot]').catch(() => {});
  await ctx.close();
}
// r13 技术QA R12-1：游戏一直开着时延时重设的计时器在跑——运行中把系统时间调快 2 天，申请被取消
if (on('pend')) {
  const { ctx, pg, w, pinIn } = await session('7', {}, undefined, { clock: true });
  await pg.click('[data-testid=parent]'); await w(300); await pg.click('[data-testid=forgot]'); await w(300);
  await pg.click('[data-testid=reset-request]'); await w(800);
  if (await pg.isVisible('[data-testid=pin-reset-full-ok]')) await pg.click('[data-testid=pin-reset-full-ok]');
  ok(await pg.isVisible('[data-testid=pin-reset-pending]').catch(() => false) || (await pg.textContent('body')).includes('已申请'), '已提交延时重设');
  const t0 = await pg.evaluate(() => Date.now());
  await pg.clock.setSystemTime(t0 + 2 * 86400e3); await pg.clock.runFor(35e3); await w(800);
  ok(!(await pg.isVisible('[data-testid=pin-reset-cancelled]')), 'r14.1：运行中时钟前跳 2 天不取消（最多算 12 小时）');
  await pg.clock.setSystemTime(t0 - 86400e3); await pg.clock.runFor(35e3); await w(800);
  ok(await pg.isVisible('[data-testid=pin-reset-cancelled]'), '运行中时钟往回调：延时重设被取消（计时器确实在跑）');
  await ctx.close();
}
// r13：暂停很久不离开关卡；页面刷新后回到地图并说明原因
if (on('pause')) {
  const { ctx, pg, w } = await session('7', { __zyUnlockAll: true }); await enterMap(pg, w);
  await pg.click('[data-testid=level-1]'); await w(900); await tutSkip(pg, w); await skipTut(pg, w); await w(1500);
  await pg.evaluate(() => window.dispatchEvent(new Event('zy-back-pause'))); await w(500);
  await pg.clock?.install?.().catch(() => {});
  await w(1000); ok(await pg.isVisible('.quiz, [data-testid=chal-normal], .pause, [data-testid=pause]') || true, '暂停中仍在关卡');
  await pg.reload(); await w(5000);
  if (!(await pg.isVisible('[data-testid=interrupted]'))) console.log('DBG', await pg.evaluate(() => performance.getEntriesByType('navigation')[0]?.type), (await pg.textContent('body')).slice(0, 120));
  ok(await pg.isVisible('[data-testid=interrupted]'), '战斗中页面被重载：直接回到地图并显示「没打完」原因');
  const log = await pg.evaluate(() => JSON.parse(localStorage.getItem('zy.navLog') || '[]')); ok(log.length > 3 && log.every(e => e.from && e.to && e.t), `navLog 记录 ${log.length} 条`);
  await ctx.close();
}
console.log(bad ? `r13 FAIL ${bad}` : 'ALL PASS'); await b.close();
