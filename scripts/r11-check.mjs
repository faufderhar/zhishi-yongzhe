// r11 验收（测试构建）：幼儿园柔和怪兽 / 开心值 / 锁定 1.5 s / 点错摇晃；没打完提示只给本人；学霸挑战题状态；较真家长 加时 / 册别 / 安装 / 错题本时间到。URL=... OUT=... ONLY=a,b node scripts/r11-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4183/'; const OUT = process.env.OUT || 'screenshots/r11/'; mkdirSync(OUT, { recursive: true });
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
if (on('kmon')) for (const [kind, n] of [['elite', 3], ['boss', 5]]) {
  const { ctx, pg, w } = await session('K1', { __zyUnlockAll: true }); const reqs = []; pg.on('request', r => reqs.push(r.url()));
  await enterMap(pg, w); await pg.locator(`.level.${kind}`).first().click(); await w(900); await skipTut(pg, w);
  await pg.waitForSelector('[data-testid=monster-sheet]', { timeout: 10000 }).catch(() => {});
  const mon = await pg.getAttribute('[data-testid=monster-sheet]', 'data-mon').catch(() => null);
  ok(!!mon && /_normal$/.test(mon) && mon !== 'mon_chinese_normal', `${kind}：柔和版学科怪兽（${mon}），不是小乌云`);
  ok(reqs.some(u => /mon_\w+_normal\/idle_soft_sheet\.webp/.test(u)) && !reqs.some(u => /mon_\w+\/idle_sheet\.webp/.test(u)), `${kind}：加载的是 *_soft_sheet（${reqs.find(u => /soft_sheet/.test(u))?.split('/').slice(-2).join('/')}）`);
  const hn = await pg.textContent('[data-testid=hearts]'); ok(new RegExp(`开心值.*0/${n}`).test(hn), `${kind}：右上角「开心值 0/${n}」（${hn.replace(/\s+/g, '')}）`);
  ok(await pg.$$eval('[data-testid=hearts] .ksmile.off', es => es.length) === n, `${kind}：${n} 个淡淡的笑脸轮廓`);
  ok(!(await pg.isVisible('[data-testid=kstars]')), `${kind}：关内没有星星`);
  await pg.screenshot({ path: OUT + `r11-k-${kind}-start.png` });
  await pg.evaluate(() => window.__said.splice(0));
  await pg.click('[data-testid^=opt-][data-correct="1"]'); await w(900);
  const said1 = (await said(pg)).join('|'); const hn2 = await pg.textContent('[data-testid=hearts-num]');
  ok(hn2.trim() === `1/${n}` && /开心值1个/.test(said1), `${kind}：答对亮 1 个（${hn2.trim()}），朗读「${said1.slice(0, 40)}」`);
  await pg.screenshot({ path: OUT + `r11-k-${kind}-lit1.png` });
  let maxSeen = 1, dropped = false;
  for (let i = 0; i < 16; i++) { await pg.waitForSelector('[data-testid^=opt-], [data-testid=result-stats]', { timeout: 10000 }).catch(() => {}); if (await pg.isVisible('[data-testid=result-stats]')) break;
    const v = +(await pg.textContent('[data-testid=hearts-num]').catch(() => '0/0')).split('/')[0]; if (v < maxSeen) dropped = true; maxSeen = Math.max(maxSeen, v);
    await pg.click(`[data-testid^=opt-][data-correct="${i % 3 === 0 ? 0 : 1}"]`, { timeout: 2000 }).catch(() => {}); await w(1700); }
  ok(!dropped, `${kind}：开心值只升不降`);
  const end = await pg.textContent('body'); ok(await pg.isVisible('[data-testid=result-stats]'), `${kind}：打完进结算（结算才给星星）`);
  await pg.screenshot({ path: OUT + `r11-k-${kind}-result.png` });
  await ctx.close();
}
// 小萌新 1：序列帧加载失败 → 小乌云，文字也说小乌云
if (on('kfallback')) {
  const { ctx, pg, w } = await session('K1', { __zyUnlockAll: true, __zyNoArt: true });
  await enterMap(pg, w); await pg.locator('.level.elite').first().click(); await w(900); await skipTut(pg, w);
  await pg.waitForSelector('[data-testid=kmon]'); const alt = await pg.getAttribute('[data-testid=kmon]', 'alt'); const dm = await pg.getAttribute('[data-testid=kmon]', 'data-mon');
  ok(alt === '小乌云' && dm === 'cloud', `怪兽图没加载：显示小乌云，名字也是「${alt}」`);
  await ctx.close();
}
// 小萌新 4：点错后固定锁 1.5 s；锁内点的（包括锁内按下、锁后松开）一律作废，不算第二次答错
if (on('klock')) {
  const { ctx, pg, w } = await session('K1');
  await enterMap(pg, w); await pg.click('[data-testid=level-1]'); await w(900); await skipTut(pg, w); await w(2600);
  await pg.waitForSelector('[data-testid^=opt-]');
  const wrongs = await pg.$$('[data-testid^=opt-][data-correct="0"]');
  const tap = async el => { const bb = await el.boundingBox(); await pg.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.mouse.down(); await pg.mouse.up(); };
  await tap(wrongs[0]); const t0 = Date.now();
  await w(150); const anim = await wrongs[0].evaluate(e => getComputedStyle(e).animationName); const tr = await wrongs[0].evaluate(e => getComputedStyle(e).transform);
  ok(/kwiggle2/.test(anim), `点错的卡片在摇（animation=${anim}，transform=${tr.slice(0, 30)}）`); await pg.screenshot({ path: OUT + 'r11-k-wrong-shake.png' });
  ok(await pg.isVisible('[data-testid=kbusy]'), '锁定期间有可见提示'); 
  await w(1400 - (Date.now() - t0)); const other = wrongs[1] ?? wrongs[0]; await tap(other);   // 1.4 s：锁内
  const bb = await other.boundingBox(); await w(1450 - (Date.now() - t0)); await pg.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.mouse.down(); await w(1650 - (Date.now() - t0)); await pg.mouse.up();   // 锁内按下、锁后松开
  await w(300); const s1 = await pg.textContent('[data-testid=ksay]').catch(() => '');
  ok(!/我来帮你看看/.test(s1), `1.4 s 点击、锁内按下锁后松开：都不算第二次答错（伙伴：${s1 || '—'}）`);
  await w(Math.max(0, 1700 - (Date.now() - t0))); await tap(other); await w(300);
  const s2 = await pg.textContent('[data-testid=ksay]').catch(() => ''); ok(/我来帮你看看/.test(s2), `1.5 s 之后再点错：算第二次 → 自动给答案（${s2}）`);
  await ctx.close();
  // 减少动画：不摇，改颜色脉冲
  const r = await session('K1', {}, undefined, { ctx: { reducedMotion: 'reduce' } });
  await enterMap(r.pg, r.w); await r.pg.click('[data-testid=level-1]'); await r.w(900); await skipTut(r.pg, r.w); await r.w(2600);
  const wr = await r.pg.waitForSelector('[data-testid^=opt-][data-correct="0"]'); await wr.click(); await r.w(150);
  const an2 = await wr.evaluate(e => getComputedStyle(e).animationName); ok(/ktint/.test(an2), `系统「减弱动态效果」：点错改成颜色脉冲（${an2}）`);
  await r.pg.screenshot({ path: OUT + 'r11-k-wrong-reduced.png' }); await r.ctx.close();
}
// 小萌新 5 / 学霸 4：「没打完」提示只给本人，不打断别的孩子
if (on('resume')) {
  const { ctx, pg, w } = await session('7');
  await enterMap(pg, w); await pg.click('[data-testid=level-1]'); await w(1200); await tutSkip(pg, w); await skipTut(pg, w);
  await pg.waitForSelector('[data-testid=chal-toggle], [data-testid=chal-none], .quiz', { timeout: 15000 }).catch(() => {}); await pg.reload(); await w(3000);
  const t13 = await pg.textContent('[data-testid=interrupted]').catch(() => ''); ok(/没有打完/.test(t13) && /重新开始这一关〕＝/.test(t13), 'r13：战斗中页面被重载 → 直接回到本人的地图并提示「没打完」，写明按钮作用');
  await pg.goto(URL); await w(2000);   // 重新打开（不是重载）：停在首页
  ok(!(await pg.isVisible('[data-testid=interrupted-home]')) && !(await pg.isVisible('text=上次玩')), '首页不再显示某个孩子的「没打完」');
  await toMapOf(pg, w, '小班宝贝'); ok(!(await pg.isVisible('[data-testid=interrupted]')), '别的孩子的地图上不显示');
  await pg.click('[data-testid=level-1]'); await w(1500); await pg.click('[data-testid=tut-apple]').catch(() => {}); await w(1500);
  ok(!(await pg.isVisible('text=谁来玩')), '小班点练习题：不会跳回「谁来玩？」');
  await pg.goto(URL); await w(1000); await toMapOf(pg, w, 'r9');
  // r13：提示已在重载后自动回到地图时显示过（看过即清），这里不再重复
  await pg.screenshot({ path: OUT + 'r11-interrupted-own.png' }); await ctx.close();
}
// 学霸 3：挑战题状态在出选择前定好
if (on('chal')) {
  const { ctx, pg, w } = await session('7'); await enterMap(pg, w); await pg.click('[data-testid=level-1]'); await w(800); await tutSkip(pg, w);
  let none = 0, pick = 0, bad2 = 0;
  for (let i = 0; i < 10; i++) {
    await pg.waitForSelector('[data-testid=chal-toggle], .quiz .opt, .keypad, [data-testid=result-stats]', { timeout: 15000 }).catch(() => {});
    if (await pg.isVisible('[data-testid=result-stats]')) break;
    if (await pg.isVisible('[data-testid=chal-toggle]')) { pick++; if ((await pg.getAttribute('[data-testid=chal-on]', 'aria-disabled')) === 'true') bad2++; if (pick === 1) await pg.screenshot({ path: OUT + 'r11-chal-pick.png' }); await pg.click('[data-testid=chal-normal]'); }
    else if (await pg.isVisible('[data-testid=chal-none]')) { none++; if (none === 1) await pg.screenshot({ path: OUT + 'r11-chal-none.png' }); }
    await answer(pg, true); await w(1600); await next(pg, w);
  }
  ok(pick + none > 0, `r12 起：没有更难题（本小节 + 前序小节）时挑战按钮灰着（灰 ${bad2} 次）；没有更难题时直接出普通题并写明（${none} 回合）；可选 ${pick} 回合`);
  await ctx.close();
}
// 较真家长：临时加时、册别、勾选框、安装、错题本时间到
if (on('parent')) {
  const { ctx, pg, w, pinIn } = await session('2', {}, undefined, { name: 'P二' });
  await pg.goto(URL); await w(600); await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500);
  if (await pg.isVisible('text=稍后')) { await pg.click('text=稍后'); await w(300); }
  await pg.click('text=时长'); await w(300); const pid = (await pg.getAttribute('tr:has-text("P二") [data-testid^=bonus-]', 'data-testid')).replace('bonus-', '');
  await pg.click(`[data-testid=bonus-${pid}]`); await w(300);
  ok(await pg.isVisible(`[data-testid=bonus-now-${pid}]`), '时长页显示「今天已加 10 分钟」+〔取消〕');
  await pg.click('text=孩子档案'); await w(300); await pg.locator('.p-card:has-text("P二") button:has-text("编辑")').first().click(); await w(300);
  ok(await pg.isVisible('[data-testid=bonus-note]'), '改上限时显示今天的临时加时，可取消');
  for (let i = 0; i < 10; i++) await pg.click('[data-testid=limit-weekday-minus]', { timeout: 300 }).catch(() => {});
  for (let i = 0; i < 10; i++) await pg.click('[data-testid=limit-weekend-minus]', { timeout: 300 }).catch(() => {});
  await pg.screenshot({ path: OUT + 'r11-unl-unchecked.png' });
  const bg = await pg.$eval('[data-testid=limit-weekday-unl]', e => getComputedStyle(e).backgroundColor); ok(/rgba\(0, 0, 0, 0\)|transparent/.test(bg), `「不限时长」未勾选是空心（背景 ${bg}）`);
  // 册别
  const vs = await pg.$$eval('[data-testid^="vol-"]:not([data-testid=vol-all])', es => es.map(e => e.dataset.testid));
  for (const t of vs) await pg.click(`[data-testid="${t}"]`);
  ok(await pg.$$eval('[data-testid^="vol-"][aria-pressed=true]', es => es.length) === 0 && await pg.isVisible('[data-testid=vol-none]') && await pg.isDisabled('[data-testid=profile-save]'), '点掉最后一册：一册都不亮 + 提示至少选一册，不能保存');
  await pg.screenshot({ path: OUT + 'r11-vol-none.png' });
  await pg.click('[data-testid=vol-all]'); ok(await pg.$$eval('[data-testid^="vol-"]:not([data-testid=vol-all])[aria-pressed=true]', es => es.length) === vs.length, '〔全部册别〕→ 全亮');
  await pg.click('[data-testid=vol-all]'); ok(await pg.$$eval('[data-testid^="vol-"][aria-pressed=true]', es => es.length) === 0, '再点〔全部册别〕→ 全灭');
  await pg.click('[data-testid=vol-all]');
  await pg.click('[data-testid=profile-save]'); await w(300); await pg.click('[data-testid=parent-close]'); await w(500);
  const home = await pg.textContent('.profile-card:has-text("P二")'); ok(/含今天临时加时 10 分钟/.test(home), `首页「${home.match(/今天还能玩[^]*?分钟）/)?.[0]}」`);
  await pg.screenshot({ path: OUT + 'r11-home-bonus.png' });
  // 错题本时间到
  await toMapOf(pg, w, 'P二'); await pg.evaluate(() => { window.__zyTestSpentSec = 1e7; }); await w(600); await pg.click('[data-testid=wrongbook]'); await w(400);
  ok(await pg.isVisible('[data-testid=wb-timeup]'), '错题本页显示时间用完'); await pg.screenshot({ path: OUT + 'r11-wb-timeup.png' });
  await ctx.close();
  // 勾选后的样子
  const s2 = await session('2'); await s2.pg.goto(URL); await s2.w(600); await s2.pg.click('[data-testid=parent]'); await s2.w(300); await s2.pinIn('2468'); await s2.w(500);
  if (await s2.pg.isVisible('text=稍后')) await s2.pg.click('text=稍后');
  await s2.pg.locator('button:has-text("编辑")').last().click(); await s2.w(300); s2.pg.once('dialog', d => d.accept()); await s2.pg.check('[data-testid=limit-weekend-unl]'); await s2.w(200);
  await s2.pg.screenshot({ path: OUT + 'r11-unl-checked.png' }); await s2.ctx.close();
}
if (on('install')) {
  // iPad Safari：没有 beforeinstallprompt → 文字引导（分享图标）
  const ua = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const { ctx, pg, w, pinIn } = await session('2', {}, { width: 1180, height: 820 }, { ctx: { userAgent: ua, hasTouch: true } });
  await pg.goto(URL); await w(800); ok(await pg.isVisible('[data-testid=ios-steps]'), 'iPad Safari：首页横幅「分享 → 添加到主屏幕」'); await pg.screenshot({ path: OUT + 'r11-install-ipad-home.png' });
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('text=稍后')) await pg.click('text=稍后');
  await pg.click('text=备份/恢复'); await w(300); await pg.locator('[data-testid=install-help]').scrollIntoViewIfNeeded();
  ok(await pg.isVisible('[data-testid=install-help-ios]'), 'iPad Safari：家长页也有同样的文字引导'); await pg.screenshot({ path: OUT + 'r11-install-ipad-parent.png' });
  await ctx.close();
  // 桌面 Chrome：模拟 beforeinstallprompt → 取消 → 横幅留着改手动步骤；家长页能再触发
  const d = await session('2', { __fakeBip: true });
  await d.pg.addInitScript(() => { window.addEventListener('load', () => setTimeout(() => { const e = new Event('beforeinstallprompt'); e.prompt = async () => { window.__prompted = (window.__prompted || 0) + 1; }; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); }, 300)); });
  await d.pg.goto(URL); await d.w(1200); ok(await d.pg.isVisible('[data-testid=install-btn]'), '桌面 Chrome：首页〔安装到主屏幕〕');
  await d.pg.click('[data-testid=install-btn]'); await d.w(500);
  ok(await d.pg.isVisible('[data-testid=install-manual]'), '安装框里点了取消：横幅不消失，改成手动步骤'); await d.pg.screenshot({ path: OUT + 'r11-install-desktop-dismissed.png' });
  await d.pg.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = async () => { window.__prompted++; }; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); });
  await d.pg.click('[data-testid=parent]'); await d.w(300); await d.pinIn('2468'); await d.w(500); if (await d.pg.isVisible('text=稍后')) await d.pg.click('text=稍后');
  await d.pg.click('text=备份/恢复'); await d.w(300); await d.pg.click('[data-testid=install-now]'); await d.w(500);
  ok(await d.pg.evaluate(() => window.__prompted) === 2, '家长页〔现在安装〕重新弹出保存的安装框'); await d.pg.locator('[data-testid=install-help]').scrollIntoViewIfNeeded(); await d.pg.screenshot({ path: OUT + 'r11-install-desktop-parent.png' });
  await d.ctx.close();
}
// 技术QA R10-2（策划确认版）：密码副本 / 恢复码 / 24 小时延时重设
const idb = (pg, fn) => pg.evaluate(fn);
const wipe = (pg, profilesToo) => pg.evaluate(async pt => {
  localStorage.clear(); await caches.delete('zy-pin');
  await new Promise((res, rej) => { const r = indexedDB.open('zhishi-yongzhe'); r.onerror = rej; r.onsuccess = () => { const d = r.result; const tx = d.transaction('kv', 'readwrite'); const st = tx.objectStore('kv');
    st.delete('settings');
    if (pt) { const g = st.get('profiles'); g.onsuccess = () => { const ps = (g.result || []).map(p => { const { pinVault, ...x } = p; return x; }); st.put(ps, 'profiles'); }; }
    tx.oncomplete = () => { d.close(); res(); }; }; });
}, profilesToo);
if (on('pin')) {
  // 恢复码只显示一次：自己走一遍设置
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } }); const pg = await ctx.newPage(); const w = ms => pg.waitForTimeout(ms);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; const o = +(sessionStorage.getItem('zyOff') || 0); if (o) { const n = Date.now; Date.now = () => n() + o; } });   // 「关掉过了一天」
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]');
  await pg.waitForSelector('[data-testid=rec-code]'); const code = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, '');
  ok(/^[A-HJKMNP-Z2-9]{8}$/.test(code), `设好密码后显示 8 位恢复码（${code}），写明只显示一次`); await pg.screenshot({ path: OUT + 'r11-pin-reccode.png' });
  await pg.click('[data-testid=rec-done]'); await w(300); await pg.fill('[data-testid=add-name]', 'r9'); await pg.click('[data-testid=home-grade-7]'); await w(600);
  const copies = await pg.evaluate(async () => ({ ls: !!localStorage.getItem('zy.pinBackup') && /rec/.test(localStorage.getItem('zy.pinBackup')), cache: !!(await (await caches.open('zy-pin')).match('./__zy_pin__')) }));
  ok(copies.ls && copies.cache, `副本：localStorage（含恢复码哈希）${copies.ls}、Cache Storage ${copies.cache}`);
  // ① 设置 + localStorage + Cache 全删，只剩孩子档案里的副本 → 自动恢复，旧密码照用
  await wipe(pg, false); await pg.reload(); await w(1200); await pg.click('[data-testid=parent]'); await w(400);
  ok(await pg.isVisible('[data-testid=pin-1]') && !(await pg.isVisible('[data-testid=pin-lost]')) && !(await pg.isVisible('text=请爸爸妈妈来设置')), '设置、localStorage、Cache 都删了：从孩子档案里的副本恢复，要输旧密码');
  await pinIn('2468'); await w(500); ok(await pg.isVisible('[data-testid=parent-close]'), '旧密码 2468 照常能进'); await pg.screenshot({ path: OUT + 'r11-pin-modal.png' }); if (await pg.isVisible('.modal >> text=稍后')) { await pg.click('.modal >> text=稍后'); await w(300); }
  await pg.click('[data-testid=parent-help]'); await w(200); const ht = await pg.textContent('[data-testid=parent-help-pop]');
  ok(/清除浏览器数据/.test(ht) && /进度/.test(ht) && /备份/.test(ht), '❓ 家长帮助：写明清浏览器数据会清掉进度、建议定期导出备份'); await pg.screenshot({ path: OUT + 'r11-parent-help.png' });
  await pg.click('[data-testid=parent-close]'); await w(500);
  // ② 4 处全删（含每个档案）→ 不能直接设新密码；恢复码这时也找不到（同在 4 处），只能 24 小时延时重设
  await wipe(pg, true); await pg.reload(); await w(1200); await pg.click('[data-testid=parent]'); await w(800);
  ok(await pg.isVisible('[data-testid=pin-lost]') && !(await pg.isVisible('text=请爸爸妈妈来设置')), '所有副本都没了、有孩子档案：不出现「首次设置」');
  await pg.screenshot({ path: OUT + 'r11-pin-lost.png' });
  await pg.click('[data-testid=reset-request]'); await w(400); await pg.click('text=返回'); await w(500);
  // r12 起规则（策划 / 技术QA R11-1）：72 小时；到期也要找回问题或恢复码；每次启动全屏提示一次；改时钟拿不到权限
  const ban = await pg.textContent('[data-testid=pin-reset-pending]').catch(() => '');
  ok(/有人申请重设家长密码.*到期/.test(ban), `每个页面顶部提示（${ban.slice(0, 40)}）`); await pg.screenshot({ path: OUT + 'r11-pin-pending.png' });
  await pg.goto(URL); await w(1200);
  ok(await pg.isVisible('[data-testid=pin-reset-notice-full]'), '重新打开：全屏提示一次'); await pg.screenshot({ path: OUT + 'r12-pin-reset-full.png' });
  await pg.click('[data-testid=pin-reset-full-cancel]'); await w(400); ok(!(await pg.isVisible('[data-testid=pin-reset-pending]')), '〔取消申请〕不要密码，提示消失');
  await pg.click('[data-testid=parent]'); await w(600); await pg.click('[data-testid=reset-request]'); await w(300); await pg.click('text=返回'); await w(300);
  await pg.evaluate(() => sessionStorage.setItem('zyOff', String(25 * 3600e3))); await pg.reload(); await w(2500);
  if (await pg.isVisible('[data-testid=pin-reset-full-ok]')) await pg.click('[data-testid=pin-reset-full-ok]');
  await pg.click('[data-testid=parent]'); await w(600);
  ok(!(await pg.isVisible('text=请爸爸妈妈来设置')), '把时钟往前拨 25 小时：拿不到设置新密码的权限');
  await pg.screenshot({ path: OUT + 'r12-pin-clock-fwd.png' });
  await ctx.close();
}
if (on('pinrec')) {
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } }); const pg = await ctx.newPage(); const w = ms => pg.waitForTimeout(ms);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; });
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]');
  await pg.waitForSelector('[data-testid=rec-code]'); const code = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, ''); await pg.click('[data-testid=rec-done]'); await w(300);
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click('[data-testid=home-grade-7]'); await w(600);
  await pg.click('[data-testid=parent]'); await w(300); await pg.click('[data-testid=forgot]'); await w(300);
  await pg.fill('[data-testid=rec-input]', code.toLowerCase().slice(0, 4) + ' ' + code.slice(4)); await pg.click('[data-testid=rec-ok]'); await w(500);
  ok(await pg.isVisible('text=设置新的家长密码'), '正确的恢复码（小写、带空格也行）：立即重设，不用等');
  await pinIn('1357'); await pinIn('1357'); await pg.waitForSelector('[data-testid=hint-answer]'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]');
  await pg.waitForSelector('[data-testid=rec-code]'); const c2 = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, ''); ok(c2 !== code, '重设后给新的恢复码'); await pg.click('[data-testid=rec-done]'); await w(500);
  ok(await pg.isVisible('[data-testid=parent-close]'), '新密码设好进入家长页'); await ctx.close();
}
// 技术QA R10-1：收尾倒计时暂停不走（测试构建把 3 分钟缩成 20 秒）
if (on('grace')) {
  const { ctx, pg, w } = await session('7', { __zyGraceMs: 20000 });
  await enterMap(pg, w); await pg.click('[data-testid=level-1]'); await w(1200); await tutSkip(pg, w); await skipTut(pg, w);
  await pg.evaluate(() => { window.__zyTestSpentSec = 1e7; }); await pg.waitForSelector('[data-testid=grace-bar]', { timeout: 10000 });
  const sec = async () => { const t = await pg.textContent('[data-testid=grace-bar]'); const m = t.match(/(\d+):(\d\d)/); return m ? +m[1] * 60 + +m[2] : -1; };
  await w(3000); const a = await sec(); await pg.click('[data-testid=pause]'); await w(8000); const b2 = await sec();
  ok(a > 0 && b2 === a, `暂停 8 秒：倒计时不动（${a} → ${b2}）`); await pg.screenshot({ path: OUT + 'r11-grace-paused.png' });
  await pg.click('[data-testid=resume]'); await w(4000); const c = await sec(); ok(c >= a - 6 && c <= a - 2, `继续 4 秒：走了约 4 秒（${a} → ${c}）`);
  await pg.waitForSelector('[data-testid=result-stats], text=时间到', { timeout: 30000 }).catch(() => {}); ok(await pg.isVisible('text=时间到'), '到 0 结算「时间到」');
  await ctx.close();
}
// 技术QA R9-2：首页返回确认一次就离开
if (on('back')) {
  const { ctx, pg, w } = await session('7');
  await pg.goto('about:blank'); await pg.goto(URL); await w(1200);
  await enterMap(pg, w); for (let i = 0; i < 3; i++) { await pg.goBack(); await w(500); }   // 地图 → 年级 → 学段 → 首页（中间各压历史）
  let n = 0; pg.on('dialog', d => { n++; d.accept(); });
  for (let i = 0; i < 4 && !pg.url().startsWith('about:'); i++) { await pg.goBack().catch(() => {}); await w(1500); }
  ok(pg.url().startsWith('about:') && n === 1, `首页按返回：确认 ${n} 次就离开（${pg.url()}）`); await ctx.close();
}
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
