// r10 验收（测试构建）：D14 出题前选挑战题、Boss 分段条/怒了、各尺寸键盘、幼儿园温和精英/Boss、引导过渡、时长限制所有入口、家长空闲退出、长按删档案、安装说明。URL=... OUT=... ONLY=a,b node scripts/r10-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4183/'; const OUT = process.env.OUT || 'screenshots/r10/'; mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const on = k => !ONLY || ONLY.includes(k);
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(grade, init = {}, vp = { width: 1180, height: 820 }, opt = {}) {
  const ctx = await b.newContext({ viewport: vp }); const pg = await ctx.newPage();
  if (!opt.noAuto) {
    await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
    await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  }
  await pg.addInitScript(o => { window.__zyTest = true; window.__zyTestNoTts = true; window.__said = []; Object.assign(window, o);
    const S = window.speechSynthesis; if (S) S.speak = u => { window.__said.push(u.text); }; }, init);
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400);
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

// A1 挑战题：出题前选、不计时、3 秒默认普通
if (on('chal')) {
  const { ctx, pg, w } = await session('7');
  await enterMap(pg, w); await pg.click('[data-testid="chapter-数学"]').catch(() => {}); await w(300); await pg.click('[data-testid=level-1]'); await w(800); await tutSkip(pg, w);
  await pg.waitForSelector('[data-testid=chal-toggle]', { timeout: 15000 });
  ok(!(await pg.isVisible('.quiz .opt, .keypad, .qtext')), '选普通/挑战时还看不到题目');
  await pg.screenshot({ path: OUT + 'r10-chal-pick.png' });
  await w(5000); ok(await pg.isVisible('[data-testid=chal-toggle]') && !(await pg.isVisible('.quiz .opt, .keypad')), 'r11：不再 3 秒自动普通，等 5 秒仍在选择');
  ok(/默认/.test(await pg.textContent('[data-testid=chal-normal]')), '〔普通题〕标「默认」');
  await pg.click('[data-testid=chal-normal]'); await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 6000 }); ok(!(await pg.isVisible('[data-testid=chal-tag]')), '点普通才出题');
  ok(!(await pg.isVisible('[data-testid=chal-toggle]')), '出题后不能再改');
  await answer(pg, true); await w(1800); await next(pg, w);
  for (let i = 0; i < 6; i++) { if (await pg.isVisible('[data-testid=chal-on]')) break; await answer(pg, true); await w(1600); await next(pg, w); }
  if (await pg.isVisible('[data-testid=chal-on]') && (await pg.getAttribute('[data-testid=chal-on]', 'aria-disabled')) === 'false') {
    await pg.click('[data-testid=chal-on]'); await w(500); ok(await pg.isVisible('[data-testid=chal-tag]'), '选挑战题 → 题目标「🔥 挑战题」'); await pg.screenshot({ path: OUT + 'r10-chal-on.png' });
  } else ok(true, '（本关没有更难的题，挑战按钮灰）');
  const rb = await pg.$eval('[data-testid=rules]', e => e.getBoundingClientRect().width); ok(rb >= 44, `「？」按钮宽 ${rb.toFixed(0)}px ≥ 44`);
  const t = await pg.textContent('[data-testid=lvl-title]'); ok(!/初一同学 · 高一/.test(t), `关卡标题「${t}」`);
  await ctx.close();
}
// R9-1 各尺寸：数字键盘整块在屏内
if (on('kb')) for (const [W, H] of [[768, 1024], [1024, 600], [600, 1024], [744, 1133], [1180, 820], [820, 1180], [1366, 1024], [1024, 768]]) {
  const { ctx, pg, w } = await session('7', {}, { width: W, height: H });
  await enterMap(pg, w); await pg.click('[data-testid="chapter-数学"]').catch(() => {}); await w(300); await pg.click('[data-testid=level-1]'); await w(800); await tutSkip(pg, w);
  let got = false; for (let i = 0; i < 14 && !got; i++) {
    await pg.waitForSelector('.quiz .opt, .keypad, [data-testid=chal-normal], [data-testid=result-stats]', { timeout: 15000 }).catch(() => {});
    if (await pg.isVisible('[data-testid=chal-normal]')) { await pg.click('[data-testid=chal-normal]'); await w(400); }
    if (await pg.isVisible('.keypad')) { got = true; break; }
    if (await pg.isVisible('[data-testid=result-stats]')) { await pg.click('[data-testid=again]'); await w(800); continue; }
    await answer(pg, true); await w(1500); await next(pg, w);
  }
  if (got) { const a = await inVp(pg, '.keypad button, [data-testid=ok]'); ok(a, `${W}×${H}：数字键盘和〔确定〕都在屏内`); await pg.screenshot({ path: OUT + `r10-kb-${W}x${H}.png` }); }
  else ok(false, `${W}×${H}：没遇到填空题`);
  await ctx.close();
}
// A3 / R9-6 Boss：分段条、怒了文案、横幅不压题干；B4 各年级 Boss 名
if (on('boss')) {
  const names = {};
  for (const g of ['7', '10']) {
    const { ctx, pg, w } = await session(g, { __zyUnlockAll: true, __zyTestMonHp: g === '10' ? 129 : 104 });
    await enterMap(pg, w); await w(300); await pg.locator('.level.boss').first().click(); await w(800); await tutSkip(pg, w);
    names[g] = (await pg.textContent('.mon-info b').catch(() => '')).trim();
    ok(await pg.isVisible('.seg-bar') || await pg.isVisible('.seg-mark'), `${g} 年级 Boss 血条两段（开场就显示）`);
    await pg.screenshot({ path: OUT + `r10-boss-${g}.png` });
    let rage = false; for (let i = 0; i < 6 && !rage; i++) {
      await next(pg, w); if (await pg.isVisible('[data-testid=result-stats]')) break;
      await answer(pg, true);
      for (let k = 0; k < 20 && !rage; k++) { rage = await pg.isVisible('[data-testid=rage]'); if (!rage) await w(100); }
      if (rage) {
        const txt = await pg.textContent('[data-testid=rage]'); ok(/Boss 怒了！攻击 \+20%/.test(txt), `横幅「${txt}」`);
        const ov = await pg.evaluate(() => { const a = document.querySelector('[data-testid=rage]')?.getBoundingClientRect(), q = document.querySelector('.qtext, .quiz')?.getBoundingClientRect(); return !a || !q ? false : !(a.bottom <= q.top || a.top >= q.bottom || a.right <= q.left || a.left >= q.right); });
        ok(!ov, '「Boss 怒了」横幅不压题目'); await pg.screenshot({ path: OUT + `r10-rage-${g}.png` });
      }
      await w(1500);
    }
    ok(rage, `${g} 年级 Boss 打到二阶段`);
    await ctx.close();
  }
  ok(names['7'] && names['10'] && names['7'] !== names['10'], `初一 / 高一 Boss 名不同（${names['7']} / ${names['10']}）`);
}
// 幼儿园：引导 3 题 + 过渡、跳过位置、地图字号、返回文字、点错反馈、温和精英/Boss
if (on('k')) {
  const { ctx, pg, w } = await session('K1', { __zyUnlockAll: true });
  await pg.click('text=r9'); await pg.waitForSelector('[data-testid=char-confirm]');
  const back = await pg.textContent('[data-testid=back-char]').catch(() => ''); ok(/返回/.test(back), `选角色页左上角「${back.trim()}」`);
  await pg.click('[data-testid^=char-]:not([data-testid=char-confirm])'); await pg.click('[data-testid=char-confirm]'); await w(900);
  const small = await pg.$$eval('.map-body *', es => es.filter(e => e.offsetParent && e.children.length === 0 && /[\u4e00-\u9fa5]/.test(e.textContent)).map(e => parseFloat(getComputedStyle(e).fontSize)).filter(x => x < 18).length).catch(() => -1);
  ok(small === 0, `地图副标题/锁定文字都 ≥18px（小于 18 的 ${small} 个）`);
  ok(await pg.isVisible('text=这里有小怪兽等你交朋友！'), '地图文案「这里有小怪兽等你交朋友！」');
  await pg.screenshot({ path: OUT + 'r10-k-map.png' });
  // 普通关：引导
  await pg.click('[data-testid=level-1]'); await w(900);
  const qs = new Set(); for (let i = 0; i < 3; i++) {
    await pg.waitForSelector('[data-testid=tut-q]', { timeout: 8000 }).catch(() => {}); qs.add((await pg.textContent('[data-testid=tut-q]').catch(() => '')).trim());
    if (i === 0) { const sk = await pg.$eval('[data-testid=tutorial-skip]', e => e.getBoundingClientRect()); const hm = await pg.$eval('.tutorial .hearts', e => e.getBoundingClientRect()).catch(() => null);
      ok(!hm || sk.bottom <= hm.top || sk.top >= hm.bottom || sk.right <= hm.left || sk.left >= hm.right, '〔跳过练习〕不压开心值'); await pg.screenshot({ path: OUT + 'r10-k-tut.png' }); }
    await pg.click('[data-testid=tut-apple]').catch(() => {}); await w(900);
  }
  ok(qs.size === 3, `练习 3 道题互不相同（${[...qs].join(' / ')}）`);
  const done = await pg.waitForSelector('[data-testid=tut-done]', { timeout: 4000 }).then(() => true).catch(() => false);
  ok(done, '「练习完成，开始闯关啦！」过渡'); if (done) await pg.screenshot({ path: OUT + 'r10-k-tut-done.png' });
  await w(2600); await pg.waitForSelector('[data-testid^=opt-]', { timeout: 8000 }).catch(() => {});
  ok(!(await pg.isVisible('[data-testid=kstars]')), 'r11：幼儿园关内不显示星星（结算才给）');
  await pg.click('[data-testid^=opt-][data-correct="0"], .quiz .opt[data-correct="0"]').catch(() => {}); await w(300);
  const sh = await pg.$('.kwiggle2, .headshake2, .shake'); const say1 = await pg.textContent('[data-testid=ksay]').catch(() => '');
  ok(!!sh || !!say1, `小班点错：摇一摇 + 伙伴说话（${say1}）`); await pg.screenshot({ path: OUT + 'r10-k-wrong.png' });
  await pg.click('[data-testid^=opt-]').catch(() => {}); await w(150);
  ok(await pg.isVisible('[data-testid=kbusy]') || !!(await pg.$('.kwait')), '点错后锁定期间有提示（等一下下）'); await pg.screenshot({ path: OUT + 'r10-k-busy.png' });
  await ctx.close();
  // 温和精英 / Boss
  for (const [kind, n] of [['elite', 3], ['boss', 5]]) {
    const s = await session('K1', { __zyUnlockAll: true }); const { pg: p2, w: w2 } = s;
    await enterMap(p2, w2); await p2.locator(`.level.${kind}`).first().click(); await w2(900);
    for (let i = 0; i < 8 && await p2.isVisible('[data-testid=tutorial-skip]'); i++) { await p2.click('[data-testid=tutorial-skip]'); await w2(400); }
    await p2.waitForSelector('[data-testid=hearts]', { timeout: 10000 }).catch(() => {});
    const cnt = await p2.$$eval('[data-testid=hearts] .ksmile', es => es.length).catch(() => 0); const txt = await p2.textContent('[data-testid=hearts]').catch(() => '');
    ok(cnt === n && !/⭐|★/.test(txt), `${kind}：交朋友进度 ${cnt} 格（要 ${n}），用笑脸不用星星`);
    ok(!(await p2.isVisible('.mhp')) && !(await p2.isVisible('.bar.hp')), `${kind}：没有血条`);
    await p2.screenshot({ path: OUT + `r10-k-${kind}-start.png` });
    await p2.waitForSelector('[data-testid^=opt-]', { timeout: 8000 }); await p2.click('[data-testid^=opt-][data-correct="0"], .quiz .opt[data-correct="0"]').catch(() => {}); await w2(400);
    const s1 = await p2.textContent('[data-testid=ksay]').catch(() => ''); const face = await p2.textContent('[data-testid=mon-face]').catch(() => '');
    ok(/再试试/.test(s1) && !(await p2.$('.screen-shake, .shake-screen')), `${kind} 答错：「${s1}」+ 鬼脸 ${face}，不扣血不震屏`);
    await p2.screenshot({ path: OUT + `r10-k-${kind}-wrong.png` });
    let home = false; for (let i = 0; i < 14; i++) {
      await p2.waitForSelector('[data-testid^=opt-], [data-testid=result-stats], .go-home', { timeout: 10000 }).catch(() => {});
      if (await p2.$('.go-home')) { home = true; await p2.screenshot({ path: OUT + `r10-k-${kind}-home.png` }); }
      if (await p2.isVisible('[data-testid=result-stats]')) break;
      await p2.click('[data-testid^=opt-][data-correct="1"], .quiz .opt[data-correct="1"]', { timeout: 2000 }).catch(() => {}); await w2(500);
      if (!home && await p2.$('.go-home')) { home = true; await p2.screenshot({ path: OUT + `r10-k-${kind}-home.png` }); }
      await w2(1400);
    }
    const res = await p2.isVisible('[data-testid=result-stats]'); ok(res && home, `${kind}：全亮 → 怪兽变朋友挥手回家 → 结算`);
    if (res) await p2.screenshot({ path: OUT + `r10-k-${kind}-result.png` });
    await s.ctx.close();
  }
}
// 较真家长：时长限制所有答题入口
if (on('time')) {
  const { ctx, pg, w } = await session('3');
  await enterMap(pg, w); await pg.click('[data-testid=level-1]'); await w(800); await tutSkip(pg, w);
  for (let i = 0; i < 3; i++) { await answer(pg, false); await w(1600); await next(pg, w); }
  // 局中时间到 → 宽限条
  await pg.evaluate(() => { window.__zyTestSpentSec = 1e7; }); await w(1500);
  const gb = await pg.textContent('[data-testid=grace-bar]').catch(() => ''); ok(/时间到啦 · 收尾时间 \d:\d\d：打完这一关/.test(gb), `局中时间到：「${gb.trim()}」`);
  await pg.screenshot({ path: OUT + 'r10-grace.png' });
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(800); await pg.click('.profile-card:has-text("r9")'); await pg.waitForSelector('[data-testid=char-confirm], [data-testid=wrongbook]', { timeout: 8000 }).catch(() => pg.screenshot({ path: '/workspace/tmp/dbg2.png' }));
  if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm])'); await pg.click('[data-testid=char-confirm]'); } await pg.waitForSelector('[data-testid=wrongbook]', { timeout: 8000 }).catch(() => {});
  await pg.screenshot({ path: OUT + 'dbg-map.png' }); ok(await pg.isVisible('[data-testid=wrongbook]'), '回到地图');
  await pg.evaluate(() => { window.__zyTestSpentSec = 1e7; }); await w(800);
  const entries = [];
  await pg.click('[data-testid=level-1]', { force: true }).catch(() => {}); await w(800); entries.push(['地图关卡', !(await pg.isVisible('.quiz'))]);
  entries.push(['今日复习', await pg.isDisabled('[data-testid=review]').catch(() => true)]);
  await pg.click('[data-testid=wrongbook]'); await w(500);
  for (const t of ['wb-review-all', 'wb-review-due']) { await pg.click(`[data-testid=${t}]`, { force: true, timeout: 1000 }).catch(() => {}); await w(600); entries.push([t === 'wb-review-all' ? '错题本·练习这些' : '错题本·复习到期', !(await pg.isVisible('.quiz, .review .opt, [data-testid=review-exit]'))]); if (!(await pg.isVisible('[data-testid=wrongbook]')) && !(await pg.isVisible('[data-testid=wb-review-all]'))) await pg.click('[data-testid=wrongbook]').catch(() => {}); }
  await pg.screenshot({ path: OUT + 'r10-timeup-wrongbook.png' });
  for (const [n, v] of entries) ok(v, `时间用完：${n} 进不去`);
  // 中断恢复入口
  await pg.goto(URL); await w(1000);
  if (await pg.isVisible('[data-testid=interrupted-go]')) { await pg.click('[data-testid=interrupted-go]'); await w(2000); await pg.evaluate(() => { window.__zyTestSpentSec = 1e7; }); await w(800); ok(!(await pg.isVisible('.quiz .opt')), '时间用完：「回到这一关」进不去'); }
  await ctx.close();
}
// 0 题中断提示 / 退出确认只一次
if (on('misc')) {
  const { ctx, pg, w } = await session('5');
  await enterMap(pg, w); await pg.click('[data-testid=level-1]'); await w(800); await tutSkip(pg, w); await pg.waitForSelector('.quiz .opt, .keypad, [data-testid=chal-normal]');
  await pg.reload(); await pg.waitForSelector('[data-testid^=profile-]'); await w(800);
  await pg.click('.profile-card:has-text("r9")'); await pg.waitForSelector('[data-testid=level-1], [data-testid=char-confirm]'); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm])'); await pg.click('[data-testid=char-confirm]'); } await w(800); const it = await pg.textContent('[data-testid=interrupted]').catch(() => '');   // r11：本人地图上提示
  await pg.goto(URL); await w(800); ok(!/答了 ?0/.test(it) && /没有打完/.test(it) && !/已答的 0/.test(it), `0 题中断提示「${it.trim()}」`);
  await pg.screenshot({ path: OUT + 'r10-interrupted-0.png' });
  let n = 0; pg.on('dialog', d => { n++; d.accept(); });
  await pg.goBack().catch(() => {}); await w(3000);
  ok(n <= 1, `首页按返回确认退出：确认框出现 ${n} 次（≤1）`);
  await ctx.close();
}
// 家长：空闲退出 + 草稿、−5 不变不限、重置提示、安装说明、长按删档案
if (on('parent')) {
  const { ctx, pg, w, pinIn } = await session('2', { __zyParentIdleMs: 45000 });
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500);
  if (await pg.isVisible('text=稍后')) { await pg.click('text=稍后'); await w(300); }
  await pg.click('text=备份/恢复'); await w(400); await pg.locator('[data-testid=install-help]').scrollIntoViewIfNeeded().catch(() => {});
  ok(await pg.isVisible('[data-testid=install-help]'), '家长页「备份/恢复」有安装到主屏幕 / 桌面的手动说明'); await pg.screenshot({ path: OUT + 'r10-install-help.png' });
  await pg.click('text=孩子档案'); await w(400); await pg.locator('button:has-text("编辑")').last().click(); await pg.waitForSelector('[data-testid=profile-editor]');
  await pg.fill('[data-testid=profile-name]', '草稿名');
  ok(await pg.isVisible('[data-testid=reset-tips]'), '档案编辑有〔重置提示〕');
  const warn = await pg.waitForSelector('[data-testid=idle-warn]', { timeout: 30000 }).then(() => true).catch(() => false); ok(warn, '家长页空闲 → 退出前倒计时提醒'); if (warn) await pg.screenshot({ path: OUT + 'r10-idle-warn.png' });
  const out = await pg.waitForSelector('[data-testid^=profile-]', { timeout: 40000 }).then(() => true).catch(() => false); ok(out, '空闲到时自动退出家长页');
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(800);
  const v = await pg.inputValue('[data-testid=profile-name]').catch(() => ''); ok(v === '草稿名', `再进家长页：没保存的档案草稿还在（${v}）`);
  await ctx.close();
  const s = await session('2'); await s.pg.click('[data-testid=add-child]').catch(() => {}); await s.pg.goto(URL); await s.w(800);
  const card = s.pg.locator('[data-testid^=profile-]').first(); const bb = await card.boundingBox();
  await s.pg.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await s.pg.mouse.down(); await s.w(1000); await s.pg.mouse.up(); await s.w(300);
  ok(await s.pg.isVisible('[data-testid=del-ask]'), '长按孩子头像 → 删除档案说明（要家长密码）'); await s.pg.screenshot({ path: OUT + 'r10-longpress-del.png' });
  await s.ctx.close();
}
// 小萌新 HIGH：IndexedDB 被清掉（localStorage 还在）→ 不再「密码数据丢失」，用备份恢复
if (on('pin')) {
  const { ctx, pg, w, pinIn } = await session('2');
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); ok(await pg.isVisible('text=家长设置'), '设好密码进家长页');
  await pg.goto(URL + 'version.json'); const del = await pg.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('zhishi-yongzhe'); q.onsuccess = () => r('ok'); q.onerror = () => r('err'); q.onblocked = () => r('blocked'); }));
  await pg.goto(URL); await pg.waitForSelector('[data-testid=parent]'); await w(800);
  await pg.click('[data-testid=parent]'); await w(800);
  ok(!(await pg.isVisible('text=丢失')), `清掉 IndexedDB（${del}）后点家长：不显示「密码数据丢失」`);
  await pg.screenshot({ path: OUT + 'r10-pin-after-idb-clear.png' });
  if (await pg.isVisible('[data-testid=pin-ok]')) { await pinIn('2468'); await w(600); }
  ok(await pg.isVisible('text=家长设置'), '原密码 2468 仍能进家长页（从备份恢复）');
  await pg.reload(); await w(800); await pg.click('[data-testid=parent]'); await w(500); await pinIn('2468'); await w(600);
  ok(await pg.isVisible('text=家长设置'), '再硬刷新：密码仍在');
  await ctx.close();
}
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
