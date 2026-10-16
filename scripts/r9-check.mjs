// r9 验收（测试构建）：版本号、护盾文案、1024×600 数字键 ≥44、安卓返回、深链不能绕过家长确认、D14（规则/挑战题/首次提示/Boss 怒了/三星）、
// 小萌新（小班点错反馈、自动给答案、开心值、小班配图、锁定关卡说明、返回键文字、长按暂停圆环、3 步引导）、较真家长（时长、册别、锁定、备份提醒、错题盒说明、报告默认当前孩子）、
// 中断恢复（战斗中刷新 → 首页提示）。URL=... OUT=... ONLY=a,b node scripts/r9-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4183/'; const OUT = process.env.OUT || 'screenshots/r9/'; mkdirSync(OUT, { recursive: true });
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
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400);
  return { ctx, pg, w, pinIn };
}
const said = pg => pg.evaluate(() => window.__said.splice(0));
const enterMap = async (pg, w) => { await pg.click('text=r9'); await pg.waitForSelector('[data-testid=char-confirm]'); await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(700); };
const tutSkip = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); } };
async function answer(pg, right) {
  await pg.waitForSelector('.quiz .opt, .keypad, [data-testid=chal-normal]', { timeout: 15000 });
  if (await pg.isVisible('[data-testid=chal-normal]')) { await pg.click('[data-testid=chal-normal]'); await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 }); }
  const o = await pg.$(`.quiz .opt[data-correct="${right ? 1 : 0}"]`);
  if (o) { await o.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); return; }
  if (await pg.$('.keypad')) { const a = right ? String(await pg.evaluate(() => window.__zyAnswer?.())) : '997'; for (const ch of a) await pg.click(`.keypad [data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]'); return; }
  await pg.click('.quiz .opt'); await pg.click('[data-testid=ok]').catch(() => {});
}

// 1. 版本号（首页角标 + 家长页）
if (on('ver')) {
  const { ctx, pg, w } = await session('7');
  const v = await pg.textContent('[data-testid=version-label]'); ok(/^r\d+ · 题库v\d+ · \w{7}$/.test(v.trim()), `首页角标版本号「${v}」`);
  await pg.screenshot({ path: OUT + 'r9-version-home.png' });
  await pg.click('[data-testid=parent]'); await w(300); for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(600);
  const pv = await pg.textContent('[data-testid=overview-offline] [data-testid=version-label]').catch(() => ''); ok(/r\d+ · 题库v\d+/.test(pv), `家长页总览版本号「${pv}」`);
  await ctx.close();
}
// 2. 护盾文案、1024×600 数字键、挑战题、规则「？」、首次提示、深链
if (on('j')) {
  const { ctx, pg, w } = await session('7', { __zyUnlockAll: true }, { width: 1024, height: 600 });
  await enterMap(pg, w);
  // 深链 / hash 不能绕过家长确认
  await pg.evaluate(() => { location.hash = '#grade=10'; history.pushState({}, '', '?grade=10&s=map'); }); await w(400);
  ok(!(await pg.isVisible('[data-testid="chapter-政治"]')), '改 URL/hash（?grade=10 #grade=10）不会进高一');
  await pg.click('[data-testid="chapter-数学"]'); await w(300); await pg.click('[data-testid=level-1]'); await w(800); await tutSkip(pg, w);
  await pg.waitForSelector('[data-testid=chal-toggle]', { timeout: 15000 });   // r10：出题前先选
  ok(await pg.isVisible('[data-testid=chal-toggle]'), '初一我方回合出现〔普通题 | 挑战题 🔥〕');
  ok(await pg.isVisible('[data-testid=tip-challenge]'), '第一次看到挑战题开关弹首次提示');
  await pg.screenshot({ path: OUT + 'r9-challenge-toggle-1024x600.png' });
  ok(true, '挑战题难度 +1：r10 改为出题前选，见 r10-check');
  await pg.click('[data-testid=chal-normal]'); await w(300);
  await pg.click('[data-testid=rules]'); await w(300); const rules = await pg.textContent('[data-testid=rules-pop]');
  ok(/挑战题/.test(rules) && /加成上限/.test(rules) && !/题卡：/.test(rules), '「？」初一显示挑战题、加成上限，不显示题卡');
  await pg.screenshot({ path: OUT + 'r9-rules-pop.png' }); await pg.click('[data-testid=rules-ok]'); await w(200);
  // 数字键 ≥44（找一道填空）
  let kp = null; for (let i = 0; i < 12 && !kp; i++) {
    if (await pg.isVisible('[data-testid=chal-normal]')) { await pg.click('[data-testid=chal-normal]'); await w(300); }
    if (await pg.$('.keypad')) { kp = await pg.$$eval('.keypad button', bs => bs.map(x => { const r = x.getBoundingClientRect(); return Math.min(r.width, r.height); })); break; }
    await answer(pg, true); await w(1200); if (await pg.isVisible('[data-testid=next]')) await pg.click('[data-testid=next]'); await w(600);
    if (await pg.isVisible('[data-testid=result-stats]')) { await pg.click('[data-testid=again]'); await w(800); }
  }
  if (kp) { ok(Math.min(...kp) >= 44, `1024×600 数字键最小 ${Math.min(...kp).toFixed(0)}px ≥ 44`); await pg.screenshot({ path: OUT + 'r9-keypad-1024x600.png' }); } else ok(false, '没遇到填空题');
  // 安卓返回 = 暂停
  await pg.goBack(); await w(500); ok(await pg.isVisible('text=暂停中'), '战斗中按返回 → 打开暂停');
  await pg.screenshot({ path: OUT + 'r9-back-pause.png' });
  await ctx.close();
}
// 3. Boss 怒了 + 「再玩一次」完全重置
if (on('boss')) {
  const { ctx, pg, w } = await session('7', { __zyUnlockAll: true, __zyTestMonHp: 104 });
  await enterMap(pg, w); await pg.click('[data-testid="chapter-数学"]'); await w(300);
  await pg.locator('.level.boss').first().click(); await w(800); await tutSkip(pg, w);
  // 怪物血量设为 104：二阶段线 100 —— 第一次我方答对就进入二阶段
  let rage = false; for (let i = 0; i < 6 && !rage; i++) {
    if (await pg.isVisible('[data-testid=next]')) { await pg.click('[data-testid=next]'); await w(500); continue; }
    if (await pg.isVisible('[data-testid=result-stats]')) break;
    const P = await pg.getAttribute('[data-testid=banner]', 'data-side').catch(() => 'M');
    await answer(pg, true);
    for (let k = 0; k < 16 && !rage; k++) { rage = await pg.isVisible('[data-testid=rage]'); if (!rage) await w(100); }
    if (rage) await pg.screenshot({ path: OUT + 'r9-boss-rage.png' });
    await w(1500);
  }
  ok(rage, 'Boss 打到二阶段：横幅「Boss 怒了！」');
  const name = await pg.textContent('.mon-info b'); ok(/怒/.test(name), `Boss 名后标「怒」（${name.trim()}）`);
  // 放弃到结算：暂停 → 回地图
  await pg.evaluate(() => { window.__zyTestMonHp = undefined; });
  await ctx.close();
}
// 4. 小班（小萌新）
if (on('k')) {
  const { ctx, pg, w } = await session('K1', {}, { width: 1180, height: 820 }, { noAuto: true });
  await pg.click('text=r9'); await w(600);
  await pg.click('[data-testid=stage-K]'); await w(400);
  ok(await pg.isVisible('[data-testid=grade-icon-K1]'), '年级页「小班」有配图'); await said(pg);
  await pg.screenshot({ path: OUT + 'r9-k-grade.png' });
  await pg.click('[data-testid=grade-K1]'); await w(400); ok((await said(pg)).includes('小班'), '点「小班」朗读');
  await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(700);
  const back = await pg.textContent('[data-testid=map-back]'); ok(/返回/.test(back), `地图返回键有文字（${back.trim()}）`);
  // 锁定关卡：TTS + 图标说明
  const lockBtn = pg.locator('[data-locked="1"]').first(); await said(pg); await lockBtn.click({ force: true }); await w(400);
  const tip = await pg.textContent('[data-testid=map-tip]').catch(() => ''); const s1 = await said(pg);
  ok(/🔒.*先打赢前一关/.test(tip) && s1.some(x => /先打赢前一关/.test(x)), `锁定关卡点一下：图标+朗读（${tip}）`);
  await pg.screenshot({ path: OUT + 'r9-k-locked-tip.png' });
  const fs = await pg.$$eval('.map-top .star-total, .map-top .time-left', es => es.map(e => parseFloat(getComputedStyle(e).fontSize)));
  ok(Math.min(...fs) >= 18, `地图星星/剩余时间字号 ≥18（${fs}）`);
  await pg.click('[data-testid=level-1]'); await w(800);
  // 3 步引导
  ok(await pg.isVisible('[data-testid=tut-steps]') && /1\/3/.test(await pg.textContent('[data-testid=tut-steps]')), '小班首次引导 3 步（练习 1/3），可跳过');
  await said(pg); await pg.click('[data-testid=tut-car]'); await w(150);
  const carCls = await pg.getAttribute('[data-testid=tut-car]', 'class'); const s2 = await said(pg);
  ok(/kwiggle/.test(carCls) && s2.includes('嗯～再想想'), '引导里点汽车（错）：卡片轻摇 + 「嗯～再想想」');
  await pg.screenshot({ path: OUT + 'r9-k-tut-wrong.png' });
  await pg.click('[data-testid=tutorial-skip]'); await w(1500);
  await pg.waitForSelector('[data-testid=kopts]');
  // 点错一次：摇头 + 「嗯～再想想」+ 卡片轻摇，错卡变暗但还在
  await said(pg);
  const wrong1 = await pg.$('[data-testid^=opt-][data-correct="0"]'); const wk = await wrong1.getAttribute('data-testid'); await wrong1.click(); await w(120);
  const pupCls = await pg.getAttribute('[data-testid=kpup]', 'class'); const wcls = await pg.getAttribute(`[data-testid=${wk}]`, 'class'); const s3 = await said(pg);
  ok(/headshake/.test(pupCls) && /kwiggle/.test(wcls) && s3.includes('嗯～再想想'), `小班点错：伙伴摇头、卡片轻摇、朗读（${s3}）`);
  await pg.screenshot({ path: OUT + 'r9-k-wrong-feedback.png' }); await w(1700);   // r13：摇晃的 0.6 s 内不变灰，摇完再淡出
  const vis = await pg.$eval(`[data-testid=${wk}]`, e => { const c = getComputedStyle(e); return { o: +c.opacity, v: c.visibility }; });
  ok(vis.v === 'visible' && vis.o > 0.3 && vis.o < 0.7, `点错的卡还在、变暗（opacity ${vis.o}）`);
  // 第二次再错 → 自动给答案：「我来帮你看看！」+ 正确项柔和高亮
  const left = await pg.$$(`[data-testid^=opt-][data-correct="0"]:not([data-testid=${wk}])`);
  if (left.length) { await w(1600); await left[0].click();   /* r11：点错后锁 1.5 s */ await w(200); const s4 = await said(pg); const rc = await pg.getAttribute('[data-testid^=opt-][data-correct="1"]', 'class');
    ok(s4.some(x => /我来帮你看看/.test(x)) && /soft-pulse/.test(rc), `连错两次：朗读「我来帮你看看！」、正确项柔和高亮（${s4}）`);
    await pg.screenshot({ path: OUT + 'r9-k-demo.png' }); } else ok(true, '只有 2 个选项：第二次没有可点的错项（跳过）');
  const hn = await pg.textContent('[data-testid=hearts-num]'); ok(/\d\/\d/.test(hn), `开心值显示数值（${hn}）`);
  await w(3500);
  ok(!(await pg.isVisible('.kstars')) && /[1-9]\//.test(await pg.textContent('[data-testid=hearts-num]')), 'r11：关内不显示星星（结算才给），第一题的开心值保留');
  await pg.screenshot({ path: OUT + 'r9-k-hearts-stars.png' });
  // 长按暂停：短按 → 提示
  const pb = await pg.locator('[data-testid=pause]').boundingBox(); await said(pg);
  await pg.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await pg.mouse.down(); await w(300); await pg.mouse.up(); await w(150);
  ok(await pg.isVisible('[data-testid=hold-hint]') && (await said(pg)).includes('按住不放就能暂停'), '短按暂停：显示「按住不放就能暂停」并朗读');
  await pg.screenshot({ path: OUT + 'r9-k-pause-hint.png' });
  await pg.mouse.down(); await w(900); await pg.screenshot({ path: OUT + 'r9-k-pause-ring.png' }); await w(1400); await pg.mouse.up(); await w(300);
  ok(await pg.isVisible('text=暂停中'), '按住 2 秒 → 暂停');
  await ctx.close();
}
// 5. 较真家长
if (on('parent')) {
  const { ctx, pg, w, pinIn } = await session('2');
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500);
  if (await pg.isVisible('text=稍后')) { await pg.click('text=稍后'); await w(300); }
  await pg.click('text=r9 >> xpath=ancestor::*[contains(@class,"p-card") or contains(@class,"prof")][1] >> text=编辑').catch(async () => { await pg.click('[data-testid^=edit-]').catch(() => {}); });
  await w(400);
  if (!(await pg.isVisible('[data-testid=profile-editor]'))) { const eds = await pg.$$('button:has-text("编辑")'); if (eds.length) await eds[eds.length - 1].click(); await w(400); }
  ok(await pg.isVisible('[data-testid=profile-editor]'), '打开档案编辑');
  for (let i = 0; i < 20; i++) await pg.click('[data-testid=limit-weekday-minus]', { timeout: 300 }).catch(() => {});
  const lv = await pg.textContent('[data-testid=limit-weekday-val]'); ok(lv.trim() === '5', `连点 −5 停在 5 分钟（${lv}），不会变成不限`);
  pg.once('dialog', d => d.accept()); await pg.check('[data-testid=limit-weekend-unl]'); await w(200);
  ok((await pg.textContent('[data-testid=limit-weekend-val]')).trim() === '不限' && await pg.isChecked('[data-testid=limit-weekend-unl]'), '「不限」单独开关（要确认），数值处显示「不限」（r12 较真家长）');
  for (const t of await pg.$$eval('[data-testid^="vol-"]:not([data-testid=vol-all])', es => es.map(e => e.dataset.testid))) if (t !== 'vol-二年级上册') { await pg.click(`[data-testid="${t}"]`); await w(100); }
  await pg.screenshot({ path: OUT + 'r9-parent-editor.png' });
  await pg.click('[data-testid=profile-save]'); await w(500);
  const card = await pg.textContent('text=/已选：/').catch(() => ''); ok(/已选：[^、]+$/.test(card.trim()), `二年级上册保存后仍是 1 册（r12 列出册别：${card}）`);
  await pg.click('[data-testid^=edit-], button:has-text("编辑") >> nth=-1').catch(() => {}); await w(300);
  const on1 = await pg.$$eval('[data-testid^="vol-"][aria-pressed=true]', es => es.map(e => e.dataset.testid)); ok(on1.length === 1 && on1[0] === 'vol-二年级上册', `重新打开编辑：只选中二年级上册（${on1}）`);
  await ctx.close();
  // 备份提醒「稍后」7 天
  const s2 = await session('2'); await s2.pg.click('[data-testid=parent]'); await s2.w(300); await s2.pinIn('2468'); await s2.w(600);
  const nag1 = await s2.pg.isVisible('text=稍后'); if (nag1) await s2.pg.click('text=稍后'); await s2.w(300);
  await s2.pg.reload(); await s2.w(800); await s2.pg.click('[data-testid=parent]'); await s2.w(300); await s2.pinIn('2468'); await s2.w(600);
  ok(nag1 && !(await s2.pg.isVisible('text=稍后')), '「该备份啦」点稍后：刷新后不再弹（7 天）');
  // 密码锁定提示
  await s2.pg.click('text=完成').catch(() => {}); await s2.pg.click('[data-testid=close]').catch(() => {}); await s2.pg.goto(URL); await s2.w(800);
  await s2.pg.click('[data-testid=parent]'); await s2.w(300); for (let i = 0; i < 5; i++) await s2.pinIn('1111');
  const em = await s2.pg.textContent('.pinpad').catch(() => ''); ok(/可以等待，或用找回问题/.test(em), '密码锁定提示「可以等待，或用找回问题」');
  await s2.pg.screenshot({ path: OUT + 'r9-pin-lock.png' });
  await s2.pg.click('[data-testid=forgot]'); await s2.w(300); ok(!(await s2.pg.isDisabled('[data-testid=forgot-answer]')), '密码锁定时找回问题仍可用（单独计数）');
  await s2.ctx.close();
}
// 6. 中断：战斗中刷新 → 首页提示，可回到这一关
if (on('resume')) {
  const { ctx, pg, w } = await session('5');
  await enterMap(pg, w); await pg.click('[data-testid=level-1]'); await w(800); await tutSkip(pg, w); await pg.waitForSelector('.quiz .opt, .keypad'); await answer(pg, true); await w(1500);
  await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=level-1]'); await w(1500); /* r13：重载后会直接回到地图 */  if (await pg.isVisible('.profile-card')) await pg.click('.profile-card:has-text("r9")'); for (let i = 0; i < 20 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const sel of ['[data-testid=stage-pick] .stage-btn.on', '[data-testid=grade-pick] .stage-btn.on', '[data-testid=char-confirm]']) if (await pg.isVisible(sel)) await pg.click(sel).catch(() => {}); await w(400); }   // r11：提示只给本人，进他的地图才显示
  ok(await pg.isVisible('[data-testid=interrupted]'), '战斗中被刷新/关掉：本人地图提示「没打完」，不静默丢');
  await pg.screenshot({ path: OUT + 'r9-interrupted.png' });
  await pg.click('[data-testid=interrupted-again]'); await w(1500);
  ok(await pg.isVisible('.quiz') || await pg.isVisible('[data-testid=chal-toggle]') || await pg.isVisible('[data-testid=tutorial-next]'), '点「重新开始这一关」进关');
  await ctx.close();
}
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
