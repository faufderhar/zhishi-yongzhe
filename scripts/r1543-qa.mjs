// r15.4.3 技术QA 复测项（测试构建，触摸点屏）：
//  P2-1 手机横屏 640×360 / 667×375 / 844×390：首次设密码（含 1/2/3 的密码 1231）、找回问题、恢复码各页，以及之后点 🔒 输密码页——标题、圆点、全部数字键、确定、返回、从备份恢复都在屏内（不用滚）；用 1231 真能进家长页；返回能回首页
//  P2-2 手机竖屏 360×640 首页：标题和第一张档案卡上沿不被裁，能滚到「添加孩子」并点到
//  P2-3 / P4-2 手机横屏 640×360 / 667×375：长选项多选 D7-156 的 4 个选项和确定、四选一 E7-001 的 opt-D 都在屏内
//  P4-3 640×360 小班练习关：「跳过练习」不压住选项卡
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4340/'; const OUT = process.env.OUT || '/workspace/playtest/r1543/qa/'; mkdirSync(OUT, { recursive: true });
const PARTS = (process.env.PARTS || 'PIN,HOME,MULTI,K').split(',');
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
let pg; const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false);
const tapXY = async sel => { const l = pg.locator(sel).first(); const bb = await l.boundingBox().catch(() => null); if (!bb) return false; await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
const tap = async sel => { await pg.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); return tapXY(sel); };
/** 元素是否完整在屏内（不滚动） */
const inView = sels => pg.evaluate(sels => Object.fromEntries(sels.map(s => { const e = document.querySelector(s); if (!e) return [s, 'missing']; const r = e.getBoundingClientRect(); return [s, r.width > 0 && r.top >= -0.5 && r.left >= -0.5 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5 ? true : `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`]; })), sels);
const allTrue = o => Object.values(o).every(v => v === true);
const bad1 = o => JSON.stringify(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== true)));
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(k => `[data-testid=pin-${k}]`).concat(['[data-testid=pin-ok]', '[data-testid=pin-dots]', '.pinpad h2']);
const pinTouch = async p => { for (const d of p) await tapXY(`[data-testid=pin-${d}]`); await tapXY('[data-testid=pin-ok]'); await w(400); };
async function ctxNew(W, H, init) { const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true }); pg = await ctx.newPage(); pg.setDefaultTimeout(8000); if (init) await pg.addInitScript(init); await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]'); await w(500); return ctx; }
const backBtn = '.pinpad > button.btn.ghost';
if (PARTS.includes('PIN')) for (const vp of ['640x360', '667x375', '844x390']) {
  const [W, H] = vp.split('x').map(Number); const ctx = await ctxNew(W, H);
  await tapXY('[data-testid=parent]'); await w(500);
  const s1 = await inView([...keys, backBtn]); await pg.screenshot({ path: `${OUT}pin-${vp}-set1.png` });
  ok(allTrue(s1), `P2-1 ${vp} 首次设密码页全部在屏内 ${bad1(s1)}`);
  await pinTouch('1231'); const s2 = await inView([...keys, backBtn]); const t2 = await pg.textContent('.pinpad h2'); await pg.screenshot({ path: `${OUT}pin-${vp}-set2.png` });
  ok(/再输入一次/.test(t2) && allTrue(s2), `P2-1 ${vp} 「再输入一次确认」页全部在屏内（${t2}）${bad1(s2)}`);
  await pinTouch('1231'); await w(300);
  // 找回问题页：能滚到的都要能点（页内可滚动）
  await tap('.pinpad input[type=radio]').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.screenshot({ path: `${OUT}pin-${vp}-hint.png` });
  await pg.locator('[data-testid=hint-ok]').scrollIntoViewIfNeeded(); const s3 = await inView(['[data-testid=hint-ok]']); ok(allTrue(s3), `P2-1 ${vp} 找回问题页「确定」能滚到屏内 ${bad1(s3)}`);
  await tapXY('[data-testid=hint-ok]'); await w(600);
  const code = ((await pg.textContent('[data-testid=rec-code]').catch(() => '')) || '').replace(/\s/g, ''); await pg.screenshot({ path: `${OUT}pin-${vp}-rec.png` });
  await pg.fill('[data-testid=rec-type]', code); await pg.locator('[data-testid=rec-type-ok]').scrollIntoViewIfNeeded(); const s4 = await inView(['[data-testid=rec-type-ok]']); ok(!!code && allTrue(s4), `P2-1 ${vp} 恢复码页「确定」能滚到屏内（码 ${code.length} 位）${bad1(s4)}`);
  await tapXY('[data-testid=rec-type-ok]'); await w(800); if (await vis('.modal >> text=稍后')) { await tap('.modal >> text=稍后'); await w(300); }
  for (let i = 0; i < 6 && !(await vis('[data-testid=add-child]')); i++) { if (await vis('[data-testid=parent-close]')) await tap('[data-testid=parent-close]'); else if (await vis('text=返回')) await tap('text=返回'); await w(500); }
  // 之后点 🔒：输密码页
  await tapXY('[data-testid=parent]'); await w(500);
  const s5 = await inView([...keys, backBtn, '[data-testid=forgot]', '[data-testid=restore-entry], .pinpad .link-btn:last-of-type']); await pg.screenshot({ path: `${OUT}pin-${vp}-enter.png` });
  const restore = await pg.evaluate(() => { const e = [...document.querySelectorAll('.pinpad button, .pinpad a, .pinpad label')].find(x => /从备份恢复/.test(x.textContent)); if (!e) return 'missing'; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  ok(allTrue(s5) && restore === true, `P2-1 ${vp} 输密码页：标题 / 圆点 / 1–9、0 / 确定 / 返回 / 忘记密码 / 从备份恢复都在屏内 ${bad1(s5)} 恢复=${restore}`);
  await tapXY(backBtn); await w(500); const backHome = await vis('[data-testid=add-child]');
  await tapXY('[data-testid=parent]'); await w(500); await pinTouch('1231'); await w(600); if (await vis('.modal >> text=稍后')) { await tap('.modal >> text=稍后'); await w(300); }
  const entered = await vis('[data-testid=parent-close]'); await pg.screenshot({ path: `${OUT}pin-${vp}-parent.png` });
  ok(backHome && entered, `P2-1 ${vp} 「返回」回首页=${backHome}；触摸输入 1231 进家长页=${entered}`);
  await ctx.close();
}
if (PARTS.includes('HOME')) for (const vp of ['360x640', '375x667']) {
  const [W, H] = vp.split('x').map(Number); const ctx = await ctxNew(W, H);
  const top = await pg.evaluate(() => { const t = document.querySelector('.center-screen .title, .center-screen h1'); const c = document.querySelector('.profile-card'); return { t: t ? Math.round(t.getBoundingClientRect().top) : null, c: c ? Math.round(c.getBoundingClientRect().top) : null, sh: document.querySelector('.center-screen')?.scrollHeight, ch: document.querySelector('.center-screen')?.clientHeight }; });
  await pg.screenshot({ path: `${OUT}home-${vp}-top.png` });
  // 手指往上拖
  const cdp = await pg.context().newCDPSession(pg); const x = W / 2, y = H * 0.85;
  for (let rep = 0; rep < 3; rep++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); for (let k = 1; k <= 15; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - k * 25 }] }); await w(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await w(500); }
  const st = await pg.evaluate(() => document.querySelector('.center-screen')?.scrollTop ?? 0);
  const add = await inView(['[data-testid=add-child]']); await pg.screenshot({ path: `${OUT}home-${vp}-swiped.png` });
  ok(top.t !== null && top.t >= 0 && top.c >= 0, `P2-2 ${vp} 首页上沿不裁：标题 top ${top.t}、第一张卡 top ${top.c}（内容 ${top.sh} / 可见 ${top.ch}）`);
  ok((top.sh <= top.ch + 2 || st > 0) && allTrue(add), `P2-2 ${vp} 手指拖动能滚（scrollTop ${st}），「添加孩子」到屏内 ${bad1(add)}`);
  await tapXY('[data-testid=add-child]'); await w(500); ok(await vis('[data-testid=pin-ok]'), `P2-2 ${vp} 点「添加孩子」有反应（出设密码页）`);
  await ctx.close();
}
async function newKid(grade) { await tapXY('[data-testid=add-child]'); await w(300); for (let k = 0; k < 2; k++) { for (const d of '2468') await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(300); }
  await tap('.pinpad input[type=radio]').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await tap('[data-testid=hint-ok]'); await w(500);
  for (const sel of ['[data-testid=rec-done]', 'text=我已经抄好了']) if (await vis(sel)) { await tap(sel); await w(300); }
  if (await vis('.modal >> text=稍后')) await tap('.modal >> text=稍后');
  await pg.fill('[data-testid=add-name]', 'r9'); await tap(`[data-testid=home-grade-${grade}]`); await w(400);
  for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')); i++) {
    if (await vis('[data-testid=pin-ok]')) { for (const d of '2468') await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); }
    else if (await vis('[data-testid=stage-pick]')) await tap('[data-testid=stage-pick] .stage-btn.on'); else if (await vis('[data-testid=grade-pick]')) await tap('[data-testid=grade-pick] .stage-btn.on');
    else if (await vis('[data-testid=char-confirm]')) { await tap('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await tap('[data-testid=char-confirm]'); }
    else if (await vis('text=r9')) await tap('text=r9'); await w(500); } }
if (PARTS.includes('MULTI')) for (const [id, vp] of [['D7-156', '640x360'], ['D7-156', '667x375'], ['E7-001', '640x360'], ['E7-001', '667x375']]) {
  const [W, H] = vp.split('x').map(Number); const ctx = await ctxNew(1180, 820, `window.__zyTest = true; window.__zyTestNoTts = true; window.__zyForceQ = ${JSON.stringify(id)};`);
  await newKid(7); await pg.setViewportSize({ width: W, height: H }); await w(600);
  const subj = id.startsWith('D') ? '道德与法治' : '英语'; if (await vis(`[data-testid="chapter-${subj}"]`)) { await tap(`[data-testid="chapter-${subj}"]`); await w(400); }
  await tap('[data-testid=level-1]'); await w(1200);
  for (let i = 0; i < 10; i++) { if (await vis('[data-testid=tutorial-skip]')) { await tap('[data-testid=tutorial-skip]'); await w(400); } else if (await vis('[data-testid=chal-normal]')) { await tap('[data-testid=chal-normal]'); await w(600); } else if (await vis('.quiz .opt')) break; else await w(400); }
  const qid = await pg.evaluate(() => document.querySelector('.qtext')?.textContent?.slice(0, 20));
  const sels = ['A', 'B', 'C', 'D'].map(k => `[data-testid=opt-${k}]`).concat(id.startsWith('D') ? ['[data-testid=ok]'] : []);
  const r = await inView(sels); const widths = await pg.$$eval('[data-testid^=opt-]', a => a.map(e => Math.round(e.getBoundingClientRect().width)));
  await pg.screenshot({ path: `${OUT}opts-${vp}-${id}.png` });
  ok(allTrue(r) && Math.min(...widths) >= 150, `${id.startsWith('D') ? 'P2-3' : 'P4-2'} ${vp} ${id}（${qid}…）选项${id.startsWith('D') ? '和确定' : ''}都在屏内、宽 ${widths.join('/')} ${bad1(r)}`);
  await ctx.close();
}
if (PARTS.includes('K')) for (const vp of ['640x360', '667x375']) {
  const [W, H] = vp.split('x').map(Number); const ctx = await ctxNew(1180, 820, 'window.__zyTest = true; window.__zyTestNoTts = true;');
  await tapXY('[data-testid=add-child]'); await w(300); for (let k = 0; k < 2; k++) { for (const d of '2468') await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(300); }
  await tap('.pinpad input[type=radio]').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await tap('[data-testid=hint-ok]'); await w(500);
  for (const sel of ['[data-testid=rec-done]', 'text=我已经抄好了']) if (await vis(sel)) { await tap(sel); await w(300); }
  if (await vis('.modal >> text=稍后')) await tap('.modal >> text=稍后');
  await pg.fill('[data-testid=add-name]', 'r9'); await tap('[data-testid=home-grade-K1]').catch(() => {}); await w(400);
  for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')) && !(await vis('[data-testid=tutorial-skip]')); i++) {
    if (await vis('[data-testid=pin-ok]')) { for (const d of '2468') await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); }
    else if (await vis('[data-testid=stage-pick]')) await tap('[data-testid=stage-pick] .stage-btn.on'); else if (await vis('[data-testid=grade-pick]')) await tap('[data-testid=grade-pick] .stage-btn.on');
    else if (await vis('[data-testid=char-confirm]')) { await tap('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await tap('[data-testid=char-confirm]'); }
    else if (await vis('text=r9')) await tap('text=r9'); await w(500); }
  await pg.setViewportSize({ width: W, height: H }); await w(500);
  if (await vis('[data-testid=level-1]')) { await tap('[data-testid=level-1]'); await w(1500); }
  for (let i = 0; i < 10 && !(await vis('[data-testid=tutorial-skip]')); i++) await w(400);
  const ov = await pg.evaluate(() => { const s = document.querySelector('[data-testid=tutorial-skip]'); if (!s) return 'no-skip'; const a = s.getBoundingClientRect(); const hits = [...document.querySelectorAll('.kopt, [data-testid^=kopt], .kopts button')].filter(e => { const b = e.getBoundingClientRect(); return b.width && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom); }).map(e => e.className); return { skip: [a.left, a.top, a.right, a.bottom].map(Math.round), hits }; });
  await pg.screenshot({ path: `${OUT}kpractice-${vp}.png` });
  ok(ov !== 'no-skip' && !ov.hits.length, `P4-3 ${vp} 小班练习「跳过练习」不压选项卡 ${JSON.stringify(ov)}`);
  await ctx.close();
}

// P3-2 / P4-1 字体 130%（每 300 ms 把各元素原始计算字号 ×1.3 写回，同技术QA）：高一历史超长关卡名完整、初一 Boss 卡的星星行在卡片里
const FZ = k => { const run = () => { const els = [...document.querySelectorAll('body, body *')]; els.forEach(e => { if (e.dataset.fzk) e.style.removeProperty('font-size'); }); const f = els.map(e => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => { e.style.setProperty('font-size', (f[i] * k).toFixed(2) + 'px', 'important'); e.dataset.fzk = '1'; }); };
  const go = () => { run(); setInterval(run, 300); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); };
if (PARTS.includes('FONT')) for (const vp of ['1400x800', '1400x840', '920x1320']) for (const [grade, subj] of [[10, '历史'], [7, null]]) {
  const [W, H] = vp.split('x').map(Number); const ctx = await ctxNew(W, H, `(${FZ.toString()})(1.3)`);
  await newKid(grade); await w(800);
  const chs = await pg.$$eval('[data-testid^=chapter-]', a => a.map(x => x.getAttribute('data-testid')));
  const cuts = [], over = [];
  for (const ch of (subj ? chs.filter(c => c.includes(subj)) : chs)) { await tap(`[data-testid="${ch}"]`); await w(900);
    const m = await pg.evaluate(() => ({ cut: [...document.querySelectorAll('.lv-name')].filter(e => e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2).map(e => e.textContent),
      over: [...document.querySelectorAll('.level')].filter(lv => { const b = lv.getBoundingClientRect(); return [...lv.querySelectorAll('*')].some(d => { const r = d.getBoundingClientRect(); return r.width && r.height && d.textContent.trim() && (r.bottom > b.bottom + 1 || r.top < b.top - 1); }); }).map(lv => lv.textContent.trim().slice(0, 24)) }));
    cuts.push(...m.cut.map(t => ch + ':' + t)); over.push(...m.over.map(t => ch + ':' + t)); }
  await pg.screenshot({ path: `${OUT}font130-${vp}-map-${grade}.png` });
  if (grade === 10) ok(chs.some(c => c.includes(subj)) && !cuts.length, `P3-2 ${vp} 字体 130% 高一历史关卡名都完整（截断 ${cuts.length}：${cuts.slice(0, 3).join('；')}）`);
  else ok(chs.length > 0 && !over.length, `P4-1 ${vp} 字体 130% 初一 ${chs.length} 个章节，卡片内容（含 Boss 星星行）都在卡片里（溢出 ${over.length}：${over.slice(0, 3).join('；')}）`);
  await ctx.close();
}
console.log(bad ? `r1543-qa FAIL ${bad}` : 'r1543-qa ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
