// r15.4.1 较真家长（第 4 批）：
//  T：小班上限 5 分钟用完 → 两次「+10 分钟」都玩完 → 家长把上限改回 15 →「取消今天没用的加时」：家长页收尾 ≤ 3:00，「加时已用」单独显示；
//     时间到的小班结算页：自动放「今天玩够啦，明天见」录音、不显示「这次 0★，没有超过最佳」。page.clock 快进；去掉系统朗读，走录音。
//  P：家长文案——取消重设申请后「已取消申请」；忘记密码页 ② 两件事分开写；恢复确认框没有「平板时钟记录」、两个密码框说明分开；「上次备份」带时分。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4308/'; const OUT = process.env.OUT || '/workspace/playtest/r1541-parent/'; mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const on = k => !ONLY || ONLY.includes(k);
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(grade, { clock = false, noSynth = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, acceptDownloads: true }); const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
  await pg.addInitScript(ns => { window.__zyTest = true; window.__zyUnlockAll = true; if (ns) { try { delete window.speechSynthesis; } catch { /* */ } Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); window.SpeechSynthesisUtterance = undefined; } else window.__zyTestNoTts = true; }, noSynth);
  const w = ms => clock ? pg.clock.runFor(ms) : pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(300); };
  if (clock) await pg.clock.install();
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400);
  const pid = await pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('profiles'); g.onsuccess = () => { r.result.close(); res(g.result.find(p => p.name === 'r9')?.id); }; }; }));
  const usage = () => pg.evaluate(id => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('usage:' + id); g.onsuccess = () => { r.result.close(); const d = new Date(); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; res(g.result?.[day] ?? null); }; }; }), pid);
  const toParent = async () => { for (let i = 0; i < 12 && !(await pg.isVisible('[data-testid=parent]')); i++) {   // 地图「返回」→ 选年级「返回选学段」→ 选学段「返回」→ 首页
      for (const sel of ['[data-testid=to-map]', '[data-testid=map-back]', '[data-testid=grade-back]', '[data-testid=stage-pick] >> text=返回', '[data-testid=back-char]']) if (await pg.isVisible(sel)) { await pg.click(sel); break; }
      await w(500); }
    if (!(await pg.isVisible('[data-testid=parent]'))) { await pg.screenshot({ path: OUT + 'stuck-parent.png' }); console.log('  卡住：' + (await pg.textContent('body')).replace(/\s+/g, ' ').slice(0, 200)); }
    await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('.modal >> text=稍后')) { await pg.click('.modal >> text=稍后'); await w(300); } };
  const leaveParent = async () => { await pg.click('[data-testid=parent-close]').catch(() => {}); await w(500); };
  const toMap = async () => { for (let i = 0; i < 30 && !(await pg.isVisible('[data-testid=level-1]')); i++) {
    if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468');
    else if (await pg.isVisible('[data-testid=stage-pick]')) await pg.click('[data-testid=stage-pick] .stage-btn.on').catch(() => {});
    else if (await pg.isVisible('[data-testid=grade-pick]')) await pg.click('[data-testid=grade-pick] .stage-btn.on').catch(() => {});
    else if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); }
    else if (await pg.isVisible('[data-testid=to-map]')) await pg.click('[data-testid=to-map]');
    else if (await pg.isVisible('text=r9')) await pg.click('text=r9').catch(() => {});
    await w(500); } };
  return { ctx, pg, w, pinIn, pid, usage, toParent, leaveParent, toMap };
}
if (on('T')) {
  const S = await session('K1', { clock: true, noSynth: true }); const { pg, w, pid, usage, toParent, leaveParent, toMap } = S;
  const setLimit = async target => { await pg.click('[data-testid=ptab-profiles]'); await w(300); await pg.click(`[data-testid=edit-${pid}]`); await w(400);
    for (const k of ['weekday', 'weekend']) for (let i = 0; i < 8; i++) { const v = Number((await pg.textContent(`[data-testid=limit-${k}-val]`).catch(() => '')).match(/\d+/)?.[0]); if (!v || v === target) break; await pg.click(`[data-testid=limit-${k}-${v > target ? 'minus' : 'plus'}]`); await w(150); } };
  const save = async () => { await pg.click('[data-testid=profile-save]'); await w(500); };
  const playOut = async (tag, maxSteps = 80) => {   // 进第 1 关，不答题（小班不会输），每 20 秒按一下键，直到收尾走完强制结算
    await toMap(); await pg.click('[data-testid=level-1]'); await w(1500); for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next], [data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip], [data-testid=tutorial-next]').catch(() => {}); await w(300); }
    let grace = false; for (let i = 0; i < maxSteps && !(await pg.isVisible('[data-testid=timeup], [data-testid=result-title]')); i++) { await pg.keyboard.press('Shift'); await w(20000); if (await pg.isVisible('[data-testid=grace-icon], [data-testid=grace-bar]')) grace = true; }
    await w(2500); const u = await usage(); console.log(`  ${tag}：收尾 ${grace ? '出现' : '没出现'}，结算页 ${await pg.isVisible('[data-testid=timeup]')}，用时 ${JSON.stringify(u)}`); return { grace, u }; };
  await toParent(); await setLimit(5); await save(); await leaveParent();
  const r1 = await playOut('上限 5 分钟');
  ok(r1.grace && r1.u?.used === 480, `上限 5:00 + 收尾 3:00 → 今天用时 480 秒（${r1.u?.used}）`);
  // 小班时间到结算页
  await w(2000); const rec = await pg.evaluate(() => (window.__zyRecLog || []).map(x => x.url.split('/').pop()));
  const txt = await pg.textContent('.center-screen');
  ok(rec.some(f => /^p_timeup_k\./.test(f)), `小班时间到结算页自动放录音「今天玩够啦，明天见」（最近：${rec.slice(-3).join(', ')}）`);
  ok(/今天玩够啦，明天见/.test(txt) && !/没有超过最佳|0★|最佳/.test(txt) && !(await pg.isVisible('[data-testid=star-rules]')), `小班时间到结算页不显示星星比较 / 星星规则（「${txt.replace(/\s+/g, ' ').slice(0, 60)}」）`);
  await pg.screenshot({ path: OUT + 'k-timeup-result.png' });
  for (const n of [1, 2]) { await toParent(); await pg.click('[data-testid=ptab-time]'); await w(300); await pg.click(`[data-testid=bonus-${pid}]`); await w(300); await leaveParent(); const r = await playOut(`第 ${n} 次 +10`); ok(r.grace && r.u?.used === 480 + n * 600, `第 ${n} 次「+10 分钟」玩完（又一次收尾）→ 用时 ${480 + n * 600} 秒（${r.u?.used}）`); }
  await toParent(); await pg.click('[data-testid=ptab-time]'); await w(300);
  const before = await pg.textContent(`[data-testid=used-${pid}]`); console.log('  取消前家长页：' + before + ' / ' + await pg.textContent(`[data-testid=bonus-now-${pid}]`));
  await setLimit(15); const note = await pg.textContent('[data-testid=bonus-note]'); console.log('  编辑页：' + note);
  // r15.4.2：最后那段刚走完的收尾 3:00 不算加时已用（技术QA P3-6）→ 15 分钟上限下加时已用 10:00；（r15.4.4 删掉了旁边的「按现在的每日上限计算」）
  ok(/加时已用 10:00/.test(note) && !/按现在的每日上限/.test(note) && await pg.isVisible('[data-testid=bonus-cancel]'), `改成 15 分钟后编辑页显示「加时已用 10:00（按现在的每日上限计算）」并可以取消没用的部分（${note}）`);
  // r15.4.2 较真家长：取消先确认，写明取消后今天还能玩多久；点「算了」不生效
  await pg.click('[data-testid=bonus-cancel]'); await w(300);
  const ct = await pg.textContent('[data-testid=bonus-cancel-confirm]').catch(() => ''); ok(/会取消 10:00/.test(ct) && /取消后今天还能玩 0:00/.test(ct), `编辑页取消前弹确认：取消 10:00、取消后还能玩 0:00（${ct.replace(/\s+/g, ' ')}）`);
  await pg.click('[data-testid=bonus-cancel-no]'); await w(300); ok((await usage()).bonus === 1200 && !(await pg.isVisible('[data-testid=bonus-cancel-confirm]')), '点「算了」不取消');
  await pg.click('[data-testid=bonus-cancel]'); await w(300); await pg.click('[data-testid=bonus-cancel-ok]'); await w(300); await save();
  await pg.click('[data-testid=ptab-time]'); await w(400);
  const used = await pg.textContent(`[data-testid=used-${pid}]`); const bu = await pg.textContent(`[data-testid=bonus-used-${pid}]`).catch(() => ''); const row = await pg.textContent(`tr:has([data-testid=used-${pid}])`);
  const wrapM = used.match(/收尾 (\d+):(\d+)/); const wrapS = wrapM ? Number(wrapM[1]) * 60 + Number(wrapM[2]) : 0;
  ok(wrapS <= 180, `取消后家长页收尾 ≤ 3:00（「${used}」）`); ok(/加时已用 10:00/.test(bu) && !/按现在的每日上限/.test(bu), `取消后单独显示「加时已用 10:00，按现在的每日上限计算」（${bu}）`);
  ok(!/收尾 (2[0-9]|1[0-9]|[4-9]):/.test(row), `整行没有超过 3 分钟的收尾（${row.replace(/\s+/g, ' ').slice(0, 160)}）`);
  ok(Number(await pg.getAttribute(`[data-testid=left-${pid}]`, 'data-left-sec')) === 0, '取消后今天剩余 0（没有因为取消多出时间）');
  const u = await usage(); ok(u.used === 1680 && u.bonus === 600, `记录：用时 ${u.used}（1680）、加时留下已用的 ${u.bonus}（600）、收尾记录 ${u.wrap}`);
  await pg.screenshot({ path: OUT + 'time-after-cancel.png', fullPage: true });
  await S.ctx.close();
}
/* r15.4.2 技术QA P3-6：收尾 3:00 走完 → +10 → 立刻取消（时长页确认框）：回到「已用 5:00 + 收尾 3:00」，没有「加时已用」；反复 3 次用时不涨（以前每次 +1 秒） */
if (on('B')) {
  const S = await session('K1', { clock: true, noSynth: true }); const { pg, w, pid, usage, toParent, leaveParent, toMap } = S;
  await toParent(); await pg.click('[data-testid=ptab-profiles]'); await w(300); await pg.click(`[data-testid=edit-${pid}]`); await w(400);
  for (const k of ['weekday', 'weekend']) for (let i = 0; i < 8; i++) { const v = Number((await pg.textContent(`[data-testid=limit-${k}-val]`).catch(() => '')).match(/\d+/)?.[0]); if (!v || v === 5) break; await pg.click(`[data-testid=limit-${k}-minus]`); await w(150); }
  await pg.click('[data-testid=profile-save]'); await w(500); await leaveParent();
  await toMap(); await pg.click('[data-testid=level-1]'); await w(1500); for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next], [data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip], [data-testid=tutorial-next]').catch(() => {}); await w(300); }
  for (let i = 0; i < 80 && !(await pg.isVisible('[data-testid=timeup], [data-testid=result-title]')); i++) { await pg.keyboard.press('Shift'); await w(20000); }
  await w(2500); const u0 = await usage(); ok(u0?.used === 480 && u0?.wrap === 180, `5:00 + 收尾 3:00（${JSON.stringify(u0)}）`);
  await toParent(); await pg.click('[data-testid=ptab-time]'); await w(300);
  for (let n = 1; n <= 3; n++) {
    await pg.click(`[data-testid=bonus-${pid}]`); await w(300);
    const lab = await pg.textContent(`[data-testid=bonus-cancel-${pid}]`); ok(/取消没用的 10:00/.test(lab), `第 ${n} 次 +10：按钮「${lab}」（收尾不算用掉的加时）`);
    await pg.click(`[data-testid=bonus-cancel-${pid}]`); await w(300);
    const ct = (await pg.textContent('[data-testid=bonus-cancel-confirm]').catch(() => '')).replace(/\s+/g, ' '); ok(/会取消 10:00/.test(ct) && /今天还能玩 0:00/.test(ct), `确认框：${ct.slice(0, 90)}`);
    if (n === 1) await pg.screenshot({ path: OUT + 'bonus-cancel-confirm.png' });
    await pg.click('[data-testid=bonus-cancel-ok]'); await w(1500);
    const used = await pg.textContent(`[data-testid=used-${pid}]`); const row = (await pg.textContent(`tr:has([data-testid=used-${pid}])`)).replace(/\s+/g, ' '); const u = await usage();
    ok(/已用 5:00 \+ 收尾 3:00/.test(used) && !/加时已用/.test(row) && !/今天已加/.test(row), `第 ${n} 次立刻取消后回到「${used}」，没有「加时已用 / 今天已加」`);
    ok(u.used === 480 && u.bonus === 0, `第 ${n} 次取消后记录 used ${u.used}（480，不 +1 秒）bonus ${u.bonus}（0）`);
    ok(Number(await pg.getAttribute(`[data-testid=left-${pid}]`, 'data-left-sec')) === 0, `第 ${n} 次取消后剩余 0`);
    if (n === 2) { await leaveParent(); await toMap(); await w(3000); await toParent(); await pg.click('[data-testid=ptab-time]'); await w(300); const u2 = await usage(); ok(u2.used === 480, `回地图再回来用时不涨（${u2.used}）`); }
  }
  await pg.screenshot({ path: OUT + 'bonus-cancel-after.png', fullPage: true });
  await S.ctx.close();
}
if (on('P')) {
  const S = await session('3'); const { pg, w, pinIn, toParent } = S;
  // 备份：上次备份带时分
  await toParent(); await pg.click('[data-testid=ptab-backup]'); await w(300);
  const dl = pg.waitForEvent('download'); await pg.click('[data-testid=backup-export]'); const d = await dl; const fp = OUT + 'backup.json'; await d.saveAs(fp); await w(500);
  const age = await pg.textContent('[data-testid=backup-age]'); ok(/上次备份：今天（\d+月\d+日 \d\d:\d\d）/.test(age), `「上次备份」带时分（${age}）`);
  await pg.setInputFiles('input[type=file] >> nth=0', fp); await w(600);
  const keep = await pg.textContent('[data-testid=restore-will-keep]'); ok(!/平板时钟记录/.test(keep) && /防改时间记录/.test(keep), `恢复确认框「会保留」不写「平板时钟记录」（${keep}）`);
  const lab = await pg.textContent('[data-testid=restore-pin-label]'); const alt = await pg.textContent('[data-testid=restore-alt]'); const note = await pg.textContent('[data-testid=restore-pin-note]');
  ok(/现在的家长密码/.test(lab) && /备份时/.test(alt) && /忘了现在的密码/.test(alt) && /两个框填一个/.test(note), `「现在的密码」「备份时的密码」两个说明分开（${lab} | ${alt.slice(0, 40)}）`);
  await pg.screenshot({ path: OUT + 'restore-confirm.png' }); await pg.click('.modal button:text-is("取消")'); await w(300);
  // 忘记密码页 ② + 申请重设 → 取消 → 已取消申请
  await pg.click('[data-testid=parent-close]'); await w(500); await pg.click('[data-testid=parent]'); await w(300); await pg.click('[data-testid=forgot]'); await w(400);
  const o2 = await pg.textContent('[data-testid=forgot-opt-backup]'); const a = await pg.textContent('[data-testid=forgot-backup-pin]'); const bb = await pg.textContent('[data-testid=forgot-backup-today]');
  ok(/备份时的/.test(a) && /密码/.test(a) && /今天已经玩的时长/.test(bb) && /这台平板/.test(bb), `忘记密码页 ②：密码 / 今天时长分成两条（${a} | ${bb}）`);
  await pg.screenshot({ path: OUT + 'forgot-page.png' });
  await pg.click('[data-testid=reset-request]'); await w(800);
  for (let i = 0; i < 5 && !(await pg.isVisible('[data-testid=pin-reset-cancel], [data-testid=pin-reset-full-cancel]')); i++) await w(400);
  await pg.click('[data-testid=pin-reset-full-cancel], [data-testid=pin-reset-cancel] >> nth=0'); await w(300);
  await pg.fill('[data-testid=reset-cancel-input]', '2468'); await pg.click('[data-testid=reset-cancel-ok]'); await w(600);
  const done = await pg.isVisible('[data-testid=reset-cancel-done]'); ok(done && /已取消申请/.test(await pg.textContent('[data-testid=reset-cancel-done]')), '取消重设申请后显示「已取消申请」');
  ok(!(await pg.isVisible('[data-testid=pin-reset-pending]')), '取消后不再显示「有人申请重设」');
  await pg.screenshot({ path: OUT + 'reset-cancelled.png' }); void pinIn;
  await S.ctx.close();
}
console.log(bad ? `r1541-parent FAIL ${bad}` : 'r1541-parent ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
