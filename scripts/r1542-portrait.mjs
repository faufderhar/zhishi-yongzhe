// r15.4.2 技术QA P1-1 / P2-2 / P4：竖屏。
//  T（平板竖屏 768×1024 / 800×1280 / 820×1180，所有年级抽样）：选项卡 / 判断 / 多选 / 键盘 / 小班卡片都能看到、能点——
//     横向不出屏；纵向在屏里或能滚到（scrollIntoView 后完整在屏里）；选项文字不溢出卡片。抽样：每年级每种题型取最长的 2 题（小班取数数图题 6 道 + K-037..040）。
//  P（手机竖屏 360×640 / 390×844）：进战斗 → 全屏「请把手机横过来」；计时暂停（每日用时不涨、题目倒计时不走）；横过来后同一道题、没有暂停框、倒计时接着走；
//     小班盖层放录音 p:rotate_k；手机竖屏的地图 / 家长页 / 首页都能滚到底（不卡住）。
//  N（360×640 / 640×360）：朗读提示条高度。
// 用法：URL=… [PARTS=T,P,N] [VPS=768x1024,…] [GRADES=K1,1,…] node scripts/r1542-portrait.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4325/'; const OUT = process.env.OUT || '/workspace/playtest/r1542-portrait/'; mkdirSync(OUT, { recursive: true });
const PARTS = (process.env.PARTS || 'T,P,N').split(','); const on = k => PARTS.includes(k);
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ALLVP = { '768x1024': { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, hasTouch: true },
  '800x1280': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true, userAgent: UA },
  '820x1180': { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true } };
const VPS = (process.env.VPS || Object.keys(ALLVP).join(',')).split(',');
const GRADES = (process.env.GRADES || 'K1,1,2,3,4,5,6,7,10').split(',');
const b = await chromium.launch(); let bad = 0, pass = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (c) pass++; else bad++; };
const E = /[\p{Extended_Pictographic}]/u;
function sample(g) {
  const qs = JSON.parse(readFileSync(new globalThis.URL(`../public/banks/bank_${g}.json`, import.meta.url))).questions.filter(q => q.game_ready !== false);
  if (g === 'K1') { const vis = qs.filter(q => q.visual || E.test(q.question)); const pick = [...vis.filter((_, i) => i % Math.max(1, Math.floor(vis.length / 6)) === 0).slice(0, 6), ...qs.filter(q => ['K-037', 'K-038', 'K-039', 'K-040'].includes(q.id))]; return [...new Map(pick.map(q => [q.id, q])).values()]; }
  const N = Number(process.env.PER || 2); const out = [];
  for (const t of ['选择', '判断', '填空', '多选']) { const xs = qs.filter(q => q.type === t && !q.image && !(q.options || []).some(o => o.image));
    const len = q => t === '填空' ? q.question.length : Math.max(0, ...(q.options || []).map(o => (o.text || '').length)) * 3 + q.question.length;
    out.push(...xs.sort((a, c) => len(c) - len(a)).slice(0, N)); }
  return out;
}
async function session(vp, grade, extra = {}) {
  const ctx = await b.newContext({ ...(ALLVP[vp] || { viewport: { width: +vp.split('x')[0], height: +vp.split('x')[1] }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: UA }), ...extra }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; window.__zyTestSpentSec = -1e7; });
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).catch(() => {});
  for (const sel of ['[data-testid=rec-confirm-skip]', '[data-testid=rec-done]', 'text=我已经抄好了']) if (await pg.isVisible(sel)) { await pg.click(sel).catch(() => {}); await w(300); }
  if (await pg.isVisible('[data-testid=rec-code]')) { const code = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, ''); const inp = await pg.$('[data-testid=rec-confirm-input]'); if (inp) { await inp.fill(code); await pg.click('[data-testid=rec-confirm-ok]').catch(() => {}); } }
  await w(300); if (await pg.isVisible('.modal >> text=稍后')) await pg.click('.modal >> text=稍后');
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400);
  const toMap = async () => { await pg.click('text=r9').catch(() => {}); await w(400); for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468');
      for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) { const on = pg.locator(`[data-testid=${sp}] .stage-btn.on`); await ((await on.count()) ? on.first() : pg.locator(`[data-testid=${sp}] .stage-btn`).first()).click().catch(() => {}); }
      if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0').catch(() => {}); await pg.click('[data-testid=char-confirm]').catch(() => {}); }
      await w(400); } };
  await toMap();
  const usage = () => pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const db = r.result; const t = db.transaction('kv'); const g = t.objectStore('kv').getAllKeys(); g.onsuccess = () => { const k = g.result.find(x => String(x).startsWith('usage:')); if (!k) { db.close(); res(0); return; } const g2 = t.objectStore('kv').get(k); g2.onsuccess = () => { db.close(); const v = g2.result || {}; res(Object.values(v).reduce((a, x) => a + (x.used || 0), 0)); }; }; }; }));
  return { ctx, pg, w, toMap, usage };
}
const enter = async (pg, w, id) => {
  if (!(await pg.isVisible('[data-testid=level-1]'))) { await pg.click('[data-testid=to-map]').catch(() => {}); await w(600); }
  await pg.evaluate(x => { window.__zyForceQ = x; }, id); await pg.click('[data-testid=level-1]'); await w(900);
  for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
  for (let i = 0; i < 40; i++) { for (const sel of ['[data-testid=card-std]', '[data-testid=bet-go]', '[data-testid=chal-normal]']) if (await pg.isVisible(sel)) { await pg.click(sel, { timeout: 3000 }).catch(() => {}); await w(300); } if (await pg.isVisible('.kopt, .opts .opt, .quiz .opt, .keypad-wrap, .keypad')) break; await w(500); }
  await w(1300);
};
const quit = async (pg, w) => { const box = await pg.locator('[data-testid=pause]').boundingBox().catch(() => null); if (box) { await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pg.mouse.down(); await w(2300); await pg.mouse.up(); }
  for (let k = 0; k < 2 && box && !(await pg.isVisible('[data-testid=quit]')) && (await pg.isVisible('[data-testid=pause]')); k++) { const bx = await pg.locator('[data-testid=pause]').boundingBox(); if (!bx) break; await pg.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await pg.mouse.down(); await w(3000); await pg.mouse.up(); await w(300); }   // r15.4.2：忙时按住不够 2 秒，重试
  await pg.click('[data-testid=quit]', { timeout: 3000 }).catch(() => {}); await pg.click('[data-testid=quit-confirm]', { timeout: 3000 }).catch(() => {}); await pg.waitForSelector('[data-testid=level-1]', { timeout: 8000 }).catch(() => {}); };
const measure = pg => pg.evaluate(async () => {
  const vw = innerWidth, vh = innerHeight; const out = []; const R = e => e.getBoundingClientRect();
  const targets = [...document.querySelectorAll('.kopts .kopt, .opts .opt, .quiz .opt, .keypad-wrap button, .keypad button, .kbubble .kitem, .qtext, .multi-ok')].filter(e => { const s = getComputedStyle(e), r = R(e); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 2 && r.height > 2; });
  for (const e of targets) { const name = (e.dataset.testid || e.className.split(' ')[0]) + '「' + (e.textContent || '').trim().slice(0, 10) + '」';
    let r = R(e); if (r.left < -1 || r.right > vw + 1) { out.push(`${name} 横向出屏 ${Math.round(r.left)}–${Math.round(r.right)} / ${vw}`); continue; }
    if (r.top < -1 || r.bottom > vh + 1) { e.scrollIntoView({ block: 'nearest' }); await new Promise(z => setTimeout(z, 80)); r = R(e); if (r.top < -1 || r.bottom > vh + 1) out.push(`${name} 纵向出屏且滚不到 ${Math.round(r.top)}–${Math.round(r.bottom)} / ${vh}`); }
    if (!e.matches('.qtext') && e.scrollWidth > e.clientWidth + 2) out.push(`${name} 文字溢出 ${e.scrollWidth}>${e.clientWidth}`); }
  for (const e of document.querySelectorAll('.hearts, .kbubble, .hud, .side-banner, .quiz, .unit-wrap, .pause-btn')) { const r = R(e); if (r.width > 2 && (r.left < -1 || r.right > vw + 1)) out.push(`${e.tagName}.${String(e.className).split(' ')[0]}${e.getAttribute('src') ? '[' + e.getAttribute('src').split('/').pop().slice(0, 24) + ']' : ''}（${e.closest('[data-testid]')?.dataset.testid || ''}） 被裁（横向 ${Math.round(r.left)}–${Math.round(r.right)} / ${vw}）`); }
  return { n: targets.length, out, vw, vh };
});
// 技术QA（r15.4.2 最终回归）：竖屏提示条「横过来玩更舒服哦」不能挡点按（kb360 曾报 intercepts pointer events），7 秒内一定消失
if (on('TIP')) for (const vp of (process.env.TVPS || '360x640,390x844,768x1024,800x1280').split(',')) {
  const [W, H] = vp.split('x').map(Number); const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: UA }); const pg = await ctx.newPage(); pg.setDefaultTimeout(4000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; });
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); const t0 = Date.now();
  const tip = await pg.locator('.portrait-tip').boundingBox().catch(() => null);
  const info = tip ? await pg.evaluate(r => { const tipEl = document.querySelector('.portrait-tip'); const cx = r.x + r.width / 2, cy = r.y + r.height / 2; const hit = document.elementFromPoint(cx, cy);
      const under = [...document.querySelectorAll('button, [role=button], input')].find(e => { const q = e.getBoundingClientRect(); return q.width > 2 && q.left < r.x + r.width && q.right > r.x && q.top < r.y + r.height && q.bottom > r.y; });
      if (under) under.setAttribute('data-under-tip', '1');
      return { pe: getComputedStyle(tipEl).pointerEvents, hitIsTip: hit === tipEl || tipEl.contains(hit), under: under ? (under.dataset.testid || under.textContent.trim().slice(0, 10)) : null }; }, tip) : null;
  let tapOk = null; if (info?.under) { tapOk = await pg.locator('[data-under-tip]').first().tap({ timeout: 3000, trial: true }).then(() => true, e => String(e.message).split('\n')[0]); }
  // 首页 → 添加孩子按钮：提示条在的时候真点一下要能点开
  const addOk = await pg.locator('[data-testid=add-child]').tap({ timeout: 3000 }).then(() => Date.now() - t0 < 6000 ? 'ok(<6s)' : 'ok(late)', e => String(e.message).split('\n')[0]);
  await pg.waitForTimeout(Math.max(0, 7600 - (Date.now() - t0))); const still = await pg.locator('.portrait-tip').count();
  ok(tip && info.pe === 'none' && !info.hitIsTip && (tapOk === null || tapOk === true) && /^ok/.test(addOk) && still === 0, `${vp}：竖屏提示条点击穿透（pointer-events ${info?.pe}，中心点命中提示条 ${info?.hitIsTip}，下面的按钮「${info?.under}」tap ${tapOk}，提示条在时点「添加孩子」${addOk}），7.6 秒后已移除（剩 ${still}）`);
  await pg.screenshot({ path: `${OUT}TIP-${vp}.png` }); await ctx.close();
}
// 调试：PARTS=D IDS=K-049 GRADES=K1 VPS=768x1024 → 打印气泡 / 选项 / 暂停钮位置并截图
if (on('D')) for (const vp of VPS) { const s = await session(vp, GRADES[0]); for (const id of (process.env.IDS || '').split(',')) { await enter(s.pg, s.w, id);
  console.log(vp, id, JSON.stringify(await s.pg.evaluate(() => { const r = q => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }; const wide = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map(e => e.tagName + '.' + String(e.className).split(' ').slice(0, 2).join('.') + ':' + Math.round(e.getBoundingClientRect().width)); return { iw: innerWidth, sw: document.documentElement.scrollWidth, wide, scrollH: document.documentElement.scrollHeight, scrollY, kb: r('.kbubble'), qt: r('.kbubble .qtext'), items: r('.kitems'), opts: r('.kopts'), pause: r('[data-testid=pause]'), stage: r('.kstage'), cls: document.querySelector('.kbattle')?.className }; })));
  await s.pg.screenshot({ path: `${OUT}D-${vp}-${id}.png` }); await quit(s.pg, s.w); } await s.ctx.close(); }
const multiOk = [], multiSkip = [];
if (on('T')) for (const vp of VPS) for (const g of GRADES) {
  const qs = sample(g); let s = await session(vp, g); const fails = []; let n = 0;
  for (const q of qs) { const { pg, w } = s;
    try { await enter(pg, w, q.id); const m = await measure(pg); n += m.n; if (!m.n) fails.push(`${q.id} 没有选项 / 键盘`); for (const f of m.out) fails.push(`${q.id}（${q.type}）${f}`);
      if (q.type === '多选' && (await pg.locator('.opts .opt, .quiz .opt').count()) < 2) multiSkip.push(`${vp}/${g}:${q.id}`);   // 高一选卡后出的是卡对应的题，指定题没出成
      else if (q.type === '多选') {   // 技术QA P2-3：竖屏多选要能选两个再点「确定（多选）」
        const os = pg.locator('.opts .opt, .quiz .opt'); await os.nth(0).tap(); await os.nth(1).tap(); await w(200);
        const okb = pg.locator('[data-testid=ok].multi-ok'); await okb.scrollIntoViewIfNeeded(); const bb = await okb.boundingBox(); const vp2 = pg.viewportSize();
        if (!bb || bb.y < 0 || bb.y + bb.height > vp2.height + 1 || bb.x + bb.width > vp2.width + 1 || !(await okb.isEnabled())) fails.push(`${q.id} 多选「确定」够不着 ${JSON.stringify(bb)}`);
        else { await okb.tap(); await pg.waitForSelector('[data-testid=feedback], [data-testid=next]', { timeout: 9000 }).then(() => multiOk.push(`${g}:${q.id}`)).catch(() => fails.push(`${q.id} 多选点「确定」后没有反馈`)); }
        await pg.screenshot({ path: `${OUT}T-${vp}-${g}-${q.id}-multi.png` }); }
      if (m.out.length || !m.n) await pg.screenshot({ path: `${OUT}T-${vp}-${g}-${q.id}.png` }); await quit(pg, w); }
    catch (e) { fails.push(`${q.id} 脚本异常 ${String(e.message).split('\n')[0]}`); await s.pg.screenshot({ path: `${OUT}T-${vp}-${g}-${q.id}-err.png` }).catch(() => {}); await s.ctx.close().catch(() => {}); s = await session(vp, g); } }
  if (multiSkip.length) console.log('NOTE 多选指定题没出成（不算失败）：' + multiSkip.join(' '));
  await s.pg.screenshot({ path: `${OUT}T-${vp}-${g}-map.png` }).catch(() => {});
  ok(!fails.length, `${vp} ${g} 年级：多选点通 ${multiOk.filter(x => x.startsWith(g + ':')).length} 题；抽样 ${qs.length} 题、量 ${n} 个元素都看得到、能点${fails.length ? '；' + fails.slice(0, 5).join('；') : ''}`); await s.ctx.close();
}
if (on('P')) for (const vp of (process.env.PVPS || '390x844,360x640').split(',')) for (const g of (process.env.PGRADES || 'K1,7,10').split(',')) {
  const s = await session(vp, g); const { pg, w, usage } = s; const [W, H] = vp.split('x').map(Number);
  // 页面能滚到底：地图
  const scr = async tag => pg.evaluate(t => { const els = [document.scrollingElement, ...document.querySelectorAll('*')].filter(e => e && e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) || e === document.scrollingElement);
      const all = [...document.querySelectorAll('button, a, input, [role=button]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden'; });
      const last = all.sort((a, c) => c.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0]; if (!last) return { ok: true, t };
      last.scrollIntoView({ block: 'nearest' }); const r = last.getBoundingClientRect(); return { ok: r.bottom <= innerHeight + 1 && r.top >= -1, t, el: (last.textContent || last.dataset.testid || '').trim().slice(0, 12), b: Math.round(r.bottom), vh: innerHeight }; }, tag);
  const ms = await scr('地图'); ok(ms.ok, `${vp} ${g}：手机竖屏地图能滚到最下面的按钮（「${ms.el}」底 ${ms.b} / ${ms.vh}）`);
  const qid = sample(g)[0].id; await pg.evaluate(x => { window.__zyForceQ = x; }, qid); await pg.click('[data-testid=level-1]'); await w(1200);
  for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
  await w(1500); const ov = await pg.isVisible('[data-testid=rotate-overlay]'); const txt = ov ? (await pg.textContent('[data-testid=rotate-overlay]')).replace(/\s+/g, ' ') : '';
  const box = ov ? await pg.locator('[data-testid=rotate-overlay]').boundingBox() : null;
  ok(ov && /请把手机横过来/.test(txt) && box && box.width >= W - 1 && box.height >= H - 1, `${vp} ${g}：进战斗出全屏「请把手机横过来」（${txt.slice(0, 30)}）`);
  if (g === 'K1') { await w(1500); const al = await pg.evaluate(() => (window.__zyAudioLog || []).filter(x => x.ev === 'start').map(x => x.key)); ok(al.includes('p:rotate_k'), `${vp} 小班盖层放录音 p:rotate_k（${al.slice(-3).join(', ')}）`); }
  await pg.screenshot({ path: `${OUT}P-${vp}-${g}-overlay.png` });
  const u0 = await usage(); const t0 = await pg.textContent('[data-testid=timer]').catch(() => null);
  for (let i = 0; i < 4; i++) { await pg.mouse.move(10 + i, 10); await w(3500); }   // 有操作（不算空闲），但竖屏盖层期间不计时
  const u1 = await usage(); const t1 = await pg.textContent('[data-testid=timer]').catch(() => null);
  ok(u1 === u0, `${vp} ${g}：盖层 14 秒每日用时不涨（${u0} → ${u1} 秒）`); if (t0) ok(t0 === t1, `${vp} ${g}：题目倒计时停住（${t0} → ${t1}）`);
  const qBefore = await pg.evaluate(() => (() => { const tut = document.querySelector('[data-testid=tutorial-std] .tut-card'); if (tut) return '教程 ' + tut.textContent.replace(/\s+/g, '').slice(0, 24); const q = (document.querySelector('.kbubble, .qtext')?.textContent || '').trim(); if (q) return q.slice(0, 30); return document.querySelector('[data-testid=cards]') ? '选题卡 ' + (document.querySelector('.round-no, [data-testid=round]')?.textContent || '') : ''; })());   // 小学 full / 初一 / 高一第一次进会先出新手引导（盖层下面停在第 1 步）
  await pg.setViewportSize({ width: H, height: W }); await w(1200);
  const ov2 = await pg.isVisible('[data-testid=rotate-overlay]'), pz = await pg.isVisible('text=暂停中'); const qAfter = await pg.evaluate(() => (() => { const tut = document.querySelector('[data-testid=tutorial-std] .tut-card'); if (tut) return '教程 ' + tut.textContent.replace(/\s+/g, '').slice(0, 24); const q = (document.querySelector('.kbubble, .qtext')?.textContent || '').trim(); if (q) return q.slice(0, 30); return document.querySelector('[data-testid=cards]') ? '选题卡 ' + (document.querySelector('.round-no, [data-testid=round]')?.textContent || '') : ''; })());
  ok(!ov2 && !pz && qAfter && qAfter === qBefore, `${vp} ${g}：横过来后盖层消失、没有暂停框、还是同一个画面（「${qAfter}」）`);
  if (/^教程/.test(qAfter)) { for (let i = 0; i < 8 && (await pg.isVisible('[data-testid=tutorial-next]')); i++) { const ok1 = await pg.click('[data-testid=tutorial-next]', { timeout: 3000 }).then(() => true, async () => { await pg.screenshot({ path: `${OUT}P-${vp}-${g}-tut-${i}.png` }); console.log('tut step', i, JSON.stringify(await pg.locator('[data-testid=tutorial-next]').boundingBox()), JSON.stringify(pg.viewportSize())); return false; }); if (!ok1) break; await w(300); } ok(!(await pg.isVisible('[data-testid=tutorial-std]')) && (await pg.isVisible('[data-testid=cards], .qtext, [data-testid=chal-normal], .opts .opt')), `${vp} ${g}：横过来后新手引导能点完、接着出题卡 / 题目`); }
  if (t0) { await w(3500); const t2 = await pg.textContent('[data-testid=timer]').catch(() => null); ok(t2 !== t1, `${vp} ${g}：横过来后倒计时接着走（${t1} → ${t2}）`); }
  await pg.screenshot({ path: `${OUT}P-${vp}-${g}-landscape.png` });
  // 手机竖屏：首页、家长页能滚到底
  await pg.setViewportSize({ width: W, height: H }); await w(800); await quit(pg, w); await pg.setViewportSize({ width: H, height: W }); await quit(pg, w); await pg.setViewportSize({ width: W, height: H }); await w(500);
  for (let i = 0; i < 8 && !(await pg.isVisible('[data-testid=parent]')); i++) { for (const sel of ['[data-testid=to-map]', '[data-testid=map-back]', '[data-testid=grade-back]', '[data-testid=stage-pick] >> text=返回', '[data-testid=back-char]']) if (await pg.isVisible(sel)) { await pg.click(sel).catch(() => {}); break; } await w(500); }
  const hs = await scr('首页'); ok(hs.ok, `${vp} ${g}：手机竖屏首页能滚到底（「${hs.el}」）`);
  if (await pg.isVisible('[data-testid=parent]')) { await pg.click('[data-testid=parent]'); await w(300); for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(600); if (await pg.isVisible('.modal >> text=稍后')) await pg.click('.modal >> text=稍后');
    for (const tab of ['profiles', 'time', 'backup']) { await pg.click(`[data-testid=ptab-${tab}]`).catch(() => {}); await w(300); const ps = await scr('家长页 ' + tab); ok(ps.ok, `${vp} ${g}：手机竖屏家长页「${tab}」能滚到底（「${ps.el}」底 ${ps.b} / ${ps.vh}）`); }
    await pg.screenshot({ path: `${OUT}P-${vp}-${g}-parent.png` }); }
  await s.ctx.close();
}
if (on('N')) for (const vp of ['360x640', '640x360']) {
  const s = await session(vp, '3'); const { pg, w } = s;
  if (vp === '640x360') { await pg.click('[data-testid=level-1]'); await w(1200); for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); } }
  // 360×640 手机竖屏：战斗会被「请横过来」盖住，提示条量在地图上
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('zy-tts-issue', { detail: 'unavailable' }))); await w(400);
  const h = await pg.evaluate(() => { const e = document.querySelector('[data-testid=tts-issue]'); return e ? Math.round(e.getBoundingClientRect().height) : -1; });
  ok(h > 0 && h <= 48, `${vp}（量在 ${await pg.evaluate(() => innerWidth + 'x' + innerHeight)}）：朗读提示条高 ${h}px（≤ 48，以前 360×640 是 103）`); await pg.screenshot({ path: `${OUT}N-${vp}.png` });
  await s.ctx.close();
}
console.log(`r1542-portrait PASS ${pass} / FAIL ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
