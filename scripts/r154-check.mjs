// r15.4 小萌新：收尾提示不盖题（小班大图标 + 朗读）；时间用完点关卡 → 睡着的小怪兽（小班朗读）
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
const said = pg => pg.evaluate(() => window.__said.splice(0));
const enterMap = async (pg, w) => { await pg.click('text=r9'); await w(400); if (await pg.isVisible('[data-testid=pin-ok]')) { for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(500); }   /* r15：选档案都要密码 */ if (!(await pg.isVisible('[data-testid=levels]'))) await pg.waitForSelector('[data-testid=char-confirm]', { timeout: 8000 }).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(700); } };
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

const GRACE_VOICE = '时间到啦，打完这关就休息哦', SLEEPY_VOICE = '今天玩够啦，明天再来哦。明天零点重新计时';
const rect = (pg, sel) => pg.$eval(sel, e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, pos: getComputedStyle(e).position }; });
const VPS = [{ width: 1180, height: 820 }, { width: 375, height: 667 }];
// (1) 收尾提示：在页面最上面占一行，不浮在战斗区 / 题目上；小班是图标 + 朗读，不写字
if (on('grace')) {
  for (const [grade, vp] of [['K1', VPS[0]], ['K1', VPS[1]], ['1', VPS[0]], ['3', VPS[1]], ['7', VPS[0]], ['7', VPS[1]], ['10', VPS[0]]]) {
    const { ctx, pg, w } = await session(grade, { __zyUnlockAll: true }, vp); await enterMap(pg, w);
    await pg.click('[data-testid=level-1]'); await w(1200); await tutSkip(pg, w); await skipTut(pg, w);
    await pg.waitForSelector('.battle, .kbattle', { timeout: 10000 }); await w(800); await said(pg);
    await pg.evaluate(() => { window.__zyTestSpentSec = 1e7; });
    const K = grade === 'K1'; const sel = K ? '[data-testid=grace-icon]' : '[data-testid=grace-bar]';
    await pg.waitForSelector(sel, { timeout: 10000 }); await w(600);
    const g = await rect(pg, sel), bt = await rect(pg, '.battle, .kbattle');
    const qSel = K ? '.kbattle' : '.quiz, .chal-pick, .cards, .battle'; const q = await rect(pg, qSel);
    ok(g.pos !== 'fixed' && g.pos !== 'absolute' && g.bottom <= bt.top + 1 && g.bottom <= q.top + 1, `${grade} ${vp.width}×${vp.height}：收尾提示在战斗区上方，不盖题（提示底 ${Math.round(g.bottom)} ≤ 战斗区顶 ${Math.round(bt.top)}，${g.pos}）`);
    if (K) {
      const txt = (await pg.textContent(sel)).replace(/[\p{Extended_Pictographic}\uFE0F\s]/gu, '');
      ok(!txt && !(await pg.isVisible('[data-testid=grace-bar]')), `小班：收尾提示只有图标，不写字（剩下文字「${txt}」）`);
      const s1 = await said(pg); ok(s1.includes(GRACE_VOICE), `小班：进入收尾时朗读「${GRACE_VOICE}」（${JSON.stringify(s1)}）`);
      await pg.click(sel); await w(300); const s2 = await said(pg); ok(s2.includes(GRACE_VOICE), '小班：点闹钟图标再读一遍');
    } else {
      const t = await pg.textContent(sel); ok(/时间到啦 · 收尾时间 \d:\d\d：打完这一关/.test(t), `${grade}：收尾文字照旧（「${t.trim().slice(0, 30)}…」）`);
      ok(!(await said(pg)).includes(GRACE_VOICE), `${grade}：不朗读收尾提示`);
    }
    await pg.screenshot({ path: OUT + `r154-grace-${grade}-${vp.width}.png` }); await ctx.close();
  }
}
// (2) 时间用完后点关卡：每个年级都弹出睡着的小怪兽 +「今天玩够啦，明天再来」+ 明天 0:00 重新计时；小班朗读
if (on('sleepy')) {
  for (const grade of ['K1', '1', '3', '5', '7', '10']) {
    const { ctx, pg, w } = await session(grade, { __zyUnlockAll: true }); await enterMap(pg, w);
    /* 地图上的剩余时间随计时刷新；测试里直接带着「时间用完」重新打开 */
    await pg.addInitScript(() => { window.__zyTestSpentSec = 1e7; }); await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=levels], [data-testid=pin-ok]'); await w(600);
    if (await pg.isVisible('[data-testid=pin-ok]')) { for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(500); }
    if (!(await pg.isVisible('[data-testid=levels]'))) await enterMap(pg, w);
    await pg.waitForSelector('[data-testid=timeup-bar]', { timeout: 8000 }); await said(pg);
    await pg.click('[data-testid=level-1]', { force: true }); await w(500);   /* aria-disabled：Playwright 默认不点，真机照样能点 */
    const vis = await pg.isVisible('[data-testid=sleepy]'); const txt = vis ? await pg.textContent('[data-testid=sleepy]') : '';
    ok(vis && txt.includes('今天玩够啦，明天再来') && txt.includes('明天 0:00 重新计时') && await pg.isVisible('[data-testid=sleepy] img'), `${grade}：时间用完点关卡 → 睡着的小怪兽「${txt.trim()}」`);
    ok(!(await pg.isVisible('.battle, .kbattle')), `${grade}：没有进关`);
    const s = await said(pg); ok(grade === 'K1' ? s.includes(SLEEPY_VOICE) : !s.includes(SLEEPY_VOICE), `${grade}：${grade === 'K1' ? '朗读' : '不朗读'}（${JSON.stringify(s)}）`);
    if (grade === 'K1') await pg.screenshot({ path: OUT + 'r154-sleepy-K1.png' });
    await pg.click('[data-testid=sleepy]'); await w(300); ok(!(await pg.isVisible('[data-testid=sleepy]')), `${grade}：点一下关掉`);
    await pg.click('[data-testid=level-1]', { force: true }); await w(300); ok(await pg.isVisible('[data-testid=sleepy]'), `${grade}：再点关卡又出现`);
    await w(4300); ok(!(await pg.isVisible('[data-testid=sleepy]')), `${grade}：4 秒后自己关掉`);
    await ctx.close();
  }
}

// 较真家长 r15.3 复测 + 策划忘记密码页定稿 + 改密码后恢复码提示
if (on('parent154')) {
  const { ctx, pg, w, pinIn } = await session('7', { __zyUnlockAll: true });
  const kv = k => pg.evaluate(k => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => { r.result.close(); res(g.result); }; }; }), k);
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('.modal >> text=稍后')) { await pg.click('.modal >> text=稍后'); await w(300); }
  // (4) 每日上限 m:ss；计时旁写「2 分钟没操作会暂停计时」
  await pg.click('[data-testid=ptab-time]'); await w(300);
  const lc = (await pg.textContent('[data-testid^=limit-cfg-]')).trim(); ok(/^\d+:\d\d \/ \d+:\d\d$/.test(lc), `每日上限显示 m:ss（「${lc}」）`);
  ok(/2 分钟没操作会暂停计时/.test(await pg.textContent('[data-testid^=idle-note-]')), '已用时长旁写着「2 分钟没操作会暂停计时」');
  // (3) 导出后「上次备份」马上变成今天
  await pg.click('[data-testid=ptab-backup]'); await w(400);
  const age0 = await pg.textContent('[data-testid=backup-age]');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-testid=backup-export]')]); const file = OUT + 'r154-backup.json'; await dl.saveAs(file); await w(600);
  const age1 = await pg.textContent('[data-testid=backup-age]'); ok(/从未备份/.test(age0) && /今天/.test(age1), `导出后「上次备份」马上刷新（${age0.trim()} → ${age1.trim()}）`);
  // (1) 覆盖恢复确认框：本机时间、两张清单、不写「覆盖…全部数据」
  await pg.setInputFiles('[data-testid=backup] input[type=file], input[type=file] >> nth=0', file).catch(async () => { await pg.setInputFiles('input[type=file]', file); }); await w(500);
  const when = (await pg.textContent('[data-testid=restore-when]').catch(() => '')).trim(); const box = await pg.textContent('.modal').catch(() => '');
  ok(/^备份时间：\d{1,2}月\d{1,2}日 \d\d:\d\d$/.test(when) && !/\d{4}-\d\d-\d\dT/.test(box), `恢复确认框用本机时间（「${when}」）`);
  ok(await pg.isVisible('[data-testid=restore-will-replace]') && await pg.isVisible('[data-testid=restore-will-keep]') && !/全部数据/.test(box), '恢复确认框分「会被替换」「会保留」两张清单，不写「覆盖…全部数据」');
  ok(/会保留：.*今天已经玩了多久/.test(box) && !/会被替换：[^。]*今天/.test(box), '今天已玩时长只在「会保留」里');
  await pg.click('.modal button.btn.ghost:text-is("取消")'); await w(300);
  // 改密码：恢复码不变（默认保留），可以重新生成（旧码作废、新码要抄回确认）
  await pg.click('[data-testid=ptab-pin]'); await w(300);
  const rec0 = (await kv('settings'))?.pinRec;
  const change = async (oldP, newP) => { await pg.click('[data-testid=pintab-change]'); await w(300); await pinIn(oldP); await pinIn(newP); await pinIn(newP); await w(500); };
  await change('2468', '1357');
  ok(await pg.isVisible('[data-testid=rec-after-change]') && /原来的恢复码仍然有效。如果担心恢复码被别人看到过，可以重新生成。/.test(await pg.textContent('[data-testid=rec-after-change]')), '改完密码提示「原来的恢复码仍然有效…」');
  ok(await pg.evaluate(() => document.activeElement?.getAttribute('data-testid')) === 'rec-keep', '默认是「保留」');
  await pg.click('[data-testid=rec-keep]'); await w(300); const rec1 = (await kv('settings'))?.pinRec;
  ok(!!rec0 && rec0 === rec1 && !(await pg.isVisible('[data-testid=rec-after-change]')), '点「保留」：恢复码没变');
  await pg.click('[data-testid=pintab-close]').catch(() => {}); await pg.click('[data-testid=ptab-time]'); await w(200); await pg.click('[data-testid=ptab-pin]'); await w(300);
  await change('1357', '2468'); await pg.click('[data-testid=rec-regen]'); await w(500);
  const rec2 = (await kv('settings'))?.pinRec; ok(await pg.isVisible('[data-testid=rec-code]') && rec2 && rec2 !== rec0, '点「重新生成」：出新恢复码，旧的作废');
  ok(await pg.isVisible('[data-testid=recgen-done], [data-testid=rec-typeback], [data-testid=recgen-code] input'), '新恢复码照常要抄回确认');
  // 忘记密码页（策划定稿）
  await pg.click('[data-testid=ptab-time]'); await w(200); await pg.click('[data-testid=ptab-pin]'); await w(300); await pg.click('[data-testid=pintab-forgot]'); await w(400);
  const fp = await pg.textContent('[data-testid=forgot-page]').catch(() => '');
  ok(/忘记家长密码了？选一种办法：/.test(fp) && /① 我有恢复码/.test(fp) && /② 我有备份文件/.test(fp) && /③ 什么都没有：点「申请重设」/.test(fp), '忘记密码页：标题 + 三个编号办法');
  ok(!(await pg.$eval('[data-testid=reset-why]', e => e.open)), '「为什么要等 3 天？」默认收起');
  const reds = await pg.$$eval('[data-testid=forgot-page] p, [data-testid=forgot-page] li, [data-testid=forgot-page] h2', es => es.filter(e => e.offsetParent && !e.classList.contains('err-dark') && !e.classList.contains('warn')).map(e => getComputedStyle(e).color).filter(c => { const m = c.match(/\d+/g).map(Number); return m[0] > 150 && m[0] > m[1] + 60; }));
  ok(!reds.length, `正文没有红字（${reds.length} 处）`);
  ok(!(await pg.isVisible('[data-testid=forgot-answer]')), '③ 没申请 / 没到期时不让答找回问题（到期后才答）');
  await pg.click('[data-testid=reset-request]'); await w(800); await pg.click('[data-testid=pin-reset-full-ok]', { timeout: 1500 }).catch(() => {}); await w(300);
  ok(await pg.isVisible('[data-testid=reset-bar-hours]') && await pg.isVisible('[data-testid=reset-bar-days]'), '申请后显示两条进度条（已等 X 小时 / 72，已打开 X / 3 天）');
  await pg.screenshot({ path: OUT + 'r154-forgot.png', fullPage: true });
  await ctx.close();
}
console.log(bad ? `r154 FAIL ${bad}` : 'r154 ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
