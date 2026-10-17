// r15.4 学霸 r15.3 复测：①高一押注说明每个档案只出前 3 次（内置高一档案 kid-10 真玩两局 + 刷新；初一同学在高一有自己的计数；初一没有押注）
// ②内置档案 kid-7 / kid-10 页头（设了家长密码；初一同学去过高一再换高一同学；刷新恢复）③初一填空：按键和「确定」挨得很近时提交最新输入、输入框不闪
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4183/'; const OUT = process.env.OUT || 'screenshots/r14/'; mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const on = k => !ONLY || ONLY.includes(k);
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function fresh(opt = {}) {
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, ...(opt.ctx || {}) }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; });
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(300); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(500);
  if (opt.pin !== false) {   // 家长先设好密码（试玩员的状态：每次换档案都要输）
    await pg.click('[data-testid=parent]'); await w(400); await pinIn('2468'); await pinIn('2468');
    await pg.click('.pinpad input[type=radio] >> nth=0').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]');
    await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(500);
    if (await pg.isVisible('.modal >> text=稍后')) { await pg.click('.modal >> text=稍后'); await w(300); }
    if (await pg.isVisible('[data-testid=parent-close]')) await pg.click('[data-testid=parent-close]'); await w(500);
  }
  const step = async () => { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); if (await pg.isVisible('[data-testid=pin-nudge-skip]')) await pg.click('[data-testid=pin-nudge-skip]');
    if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm])'); await pg.click('[data-testid=char-confirm]'); } await w(500); };
  const click = async sel => { await step(); await pg.click(sel); await w(600); };
  const toMap = async () => { for (let i = 0; i < 10 && !(await pg.isVisible('[data-testid=levels]')); i++) { await step(); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); await w(300); } return pg.textContent('[data-testid=map-who]').catch(() => '-'); };
  const home = async () => { for (let i = 0; i < 8 && !(await pg.isVisible('[data-testid^=profile-]')); i++) { if (await pg.isVisible('[data-testid=to-map]')) await pg.click('[data-testid=to-map]'); else if (await pg.isVisible('[data-testid=map-back]')) await pg.click('[data-testid=map-back]'); else if (await pg.isVisible('[data-testid=grade-back]')) await pg.click('[data-testid=grade-back]'); else await pg.click('[data-testid=stage-pick] >> text=返回').catch(() => {}); await w(500); } };
  const tut = async () => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); } for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip]'); await w(300); } };
  /** 真玩一局：选普通 / 标准卡 / 押「确定」，按正确答案点（每隔一题答错，局长一点） */
  const play = async (maxQ = 14, rightEvery = 2) => {
    await pg.click('[data-testid=level-1]'); await w(900); await tut();
    let wagers = 0, detail = 0, qn = 0, chal = 0;
    for (let s = 0; s < 220 && qn < maxQ; s++) {
      if (await pg.isVisible('[data-testid=result-title]')) break;
      await tut();
      if (await pg.isVisible('[data-testid=chal-normal]')) { chal++; await pg.click('[data-testid=chal-normal]'); await w(200); continue; }
      if (await pg.isVisible('[data-testid=card-std]')) { await pg.click('[data-testid=card-std]'); await w(200); continue; }
      if (await pg.isVisible('[data-testid=wager-sure]')) { wagers++; if (await pg.isVisible('[data-testid=wager-hint-off]')) detail++; await pg.click('[data-testid=wager-sure]'); await w(200); continue; }
      if (await pg.isVisible('[data-testid=revive-no]')) { await pg.click('[data-testid=revive-no]'); await w(400); continue; }
      const o = await pg.$(`.quiz .opt[data-correct="${qn % rightEvery ? 0 : 1}"]`);
      if (o) { qn++; await o.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); await w(300); continue; }
      if (await pg.$('.keypad')) { qn++; const a = String(await pg.evaluate(() => window.__zyAnswer?.())); for (const ch of a) await pg.click(`.keypad [data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]').catch(() => {}); await w(300); continue; }
      if (await pg.isVisible('[data-testid=next]')) { await pg.click('[data-testid=next]').catch(() => {}); await w(300); continue; }
      await w(300);
    }
    if (process.env.DBG && !(await pg.isVisible('[data-testid=result-title]'))) console.log('  dbg stall', JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('[data-testid]')].filter(e => e.offsetParent).map(e => e.dataset.testid).slice(0, 30))));
    return { wagers, detail, qn, chal };
  };
  const tips = id => pg.evaluate(id => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('profiles'); g.onsuccess = () => res(g.result.find(p => p.id === id)?.tips ?? {}); }; }), id);
  return { ctx, pg, w, step, click, toMap, home, play, tips, pinIn };
}

if (on('seedhdr')) {
  const { ctx, pg, w, click, toMap, home, step } = await fresh();
  await click('[data-testid=profile-kid-7]'); await step(); await pg.waitForSelector('[data-testid=stage-who]', { timeout: 5000 }).catch(() => {});
  ok(/初一同学/.test(await pg.textContent('[data-testid=stage-who]').catch(() => '')), `选学段页写明是谁的档案（${await pg.textContent('[data-testid=stage-who]').catch(() => '-')}）`);
  let h = await toMap(); ok(h.includes('初一同学') && /· 初一$/.test(h.trim()), `kid-7 进初一：${h}`);
  await home(); await click('[data-testid=profile-kid-10]'); h = await toMap(); ok(h.includes('高一同学') && /· 高一$/.test(h.trim()), `kid-10 进高一：${h}`);
  // 初一同学去高一（家长密码）→ 页头写明是初一档案
  await home(); await click('[data-testid=profile-kid-7]'); await click('[data-testid=stage-H]'); await click('[data-testid=grade-10]'); h = await toMap();
  ok(/初一同学 · 初一档案 · 在玩高一的关卡/.test(h), `初一同学在高一：写明「初一档案」（${h}）`);
  // 回首页换高一同学：不能带着初一同学 / 初一同学的年级
  await home(); await click('[data-testid=profile-kid-10]'); h = await toMap(); ok(h.includes('高一同学') && !h.includes('初一'), `换高一同学：${h}`);
  ok(JSON.parse(await pg.evaluate(() => localStorage.getItem('zy.lastPlayer'))).pid === 'kid-10', '上次玩家记成 kid-10');
  await pg.reload(); await w(1800); h = await pg.textContent('[data-testid=map-who]').catch(() => '(首页)'); ok(!h.includes('初一同学'), `刷新后恢复：${h}`);
  await home(); await click('[data-testid=profile-kid-10]'); h = await toMap(); ok(h.includes('高一同学') && !h.includes('初一'), `刷新后再进高一同学：${h}`);
  await pg.screenshot({ path: OUT + 'r154-seedhdr.png' }); await ctx.close();
}
if (on('wager')) {
  const { ctx, pg, w, click, toMap, home, play, tips } = await fresh();
  await click('[data-testid=profile-kid-10]'); await toMap();
  const r1 = await play(14, 4); await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(800); await home(); await click('[data-testid=profile-kid-10]'); await toMap();
  const r2 = await play();
  console.log(`  kid-10 第1局 押注 ${r1.wagers} 次 说明 ${r1.detail} 次；第2局 押注 ${r2.wagers} 次 说明 ${r2.detail} 次`);
  ok(r1.wagers + r2.wagers >= 6, `两局一共押注 ${r1.wagers + r2.wagers} 次（够验证）`);
  ok(r1.wagers > 3, `第 1 局押注超过 3 次（${r1.wagers}），能看出局内封顶`);
  ok(r1.detail === Math.min(3, r1.wagers) && r2.detail === 0, `kid-10 押注说明只在前 3 次（${r1.detail} + ${r2.detail}）`);
  const t10 = await tips('kid-10'); ok(t10.wagerSeen1 && t10.wagerSeen2 && t10.wagerSeen3, '次数记在 kid-10 档案里');
  // 初一同学：初一没有押注；去高一时押注说明按自己的档案从头数
  await pg.click('[data-testid=to-map]').catch(() => {}); await w(500); await home(); await click('[data-testid=profile-kid-7]'); await toMap();
  const j = await play(6); ok(j.wagers === 0 && j.chal > 0, `初一：没有押注（押注 ${j.wagers} 次），我方回合是普通 / 挑战选择（${j.chal} 次）`);
  ok(!(await tips('kid-7')).wagerSeen1, '初一同学的押注计数没被高一同学用掉');
  await pg.click('[data-testid=to-map]').catch(() => {}); await w(500); await home(); await click('[data-testid=profile-kid-7]'); await click('[data-testid=stage-H]'); await click('[data-testid=grade-10]'); await toMap();
  const k1 = await play(); await pg.click('[data-testid=to-map]').catch(() => {}); await w(800); const k2 = await play();
  ok(k1.detail === Math.min(3, k1.wagers) && k2.detail === Math.max(0, Math.min(3, 3 - k1.wagers)), `初一同学在高一：自己的前 3 次（${k1.detail} + ${k2.detail}）`);
  await ctx.close();
}
if (on('keypad')) {
  const { ctx, pg, w, click, toMap } = await fresh({ pin: false, ctx: { hasTouch: true } });
  await click('[data-testid=profile-kid-7]'); await toMap();
  await pg.click('[data-testid=level-1]'); await w(900);
  const findKeypad = async () => { for (let i = 0; i < 90 && !(await pg.isVisible('.keypad')); i++) {
    for (let t = 0; t < 8 && await pg.isVisible('[data-testid=tutorial-next]'); t++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
    for (let t = 0; t < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); t++) { await pg.click('[data-testid=tutorial-skip]'); await w(300); }
    if (await pg.isVisible('[data-testid=chal-normal]')) { await pg.click('[data-testid=chal-normal]'); await w(300); continue; }
    if (await pg.isVisible('.keypad')) break;
    if (await pg.isVisible('[data-testid=result-title]')) { await pg.click('[data-testid=to-map]').catch(() => {}); await w(700); await pg.click('[data-testid=level-1]').catch(() => {}); await w(900); continue; }
    if (await pg.isVisible('[data-testid=revive-no]')) { await pg.click('[data-testid=revive-no]'); await w(400); continue; }
    const o = await pg.$('.quiz .opt[data-correct="1"]'); if (o) { await o.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); await w(300); continue; }
    if (await pg.isVisible('[data-testid=next]')) { await pg.click('[data-testid=next]'); await w(300); continue; }
    await w(400); } return pg.isVisible('.keypad'); };
  const fb = async () => { await pg.waitForSelector('[data-testid=feedback]', { timeout: 6000 }).catch(() => {}); return (await pg.textContent('[data-testid=feedback]').catch(() => '-')).slice(0, 60); };
  const mon = () => pg.evaluate(() => { window.__log = []; const t0 = performance.now(); const snap = () => { const i = document.querySelector('[data-testid=input]'); const k = document.querySelector('.keypad [data-testid=ok]'); if (!i) return; const s = (i.querySelector('.ph') ? '' : i.textContent) + '|' + (k?.disabled ? 'D' : 'E'); const L = window.__log; if (!L.length || L[L.length - 1][1] !== s) L.push([Math.round(performance.now() - t0), s]); }; window.__obs?.disconnect(); window.__obs = new MutationObserver(snap); window.__obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true }); snap(); });
  const cases = [
    ['屏幕键盘：按键和「确定」在同一帧（还没重绘就点确定）', a => { const fire = (el, t) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerType: 'touch', button: 0, isPrimary: true })); for (const k of a) fire(document.querySelector(`.keypad [data-key="${k}"]`), 'pointerdown'); const ok = document.querySelector('.keypad [data-testid=ok]'); fire(ok, 'pointerdown'); fire(ok, 'pointerup'); }],
    ['实体键盘：连打数字后马上回车（同一帧）', a => { for (const k of [...a, 'Enter']) window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); }],
    ['点按：每键间隔 80 ms，最后一键后 0 ms 点确定', null],
  ];
  for (const [name, f] of cases) {
    if (!(await findKeypad())) { ok(false, '找不到填空题：' + name); break; }
    const a = String(await pg.evaluate(() => window.__zyAnswer?.()));
    await mon();
    if (f) await pg.evaluate(f, a); else { for (const ch of a) { await pg.tap(`.keypad [data-key="${ch}"]`); await w(80); } await pg.evaluate(() => { const ok = document.querySelector('.keypad [data-testid=ok]'); ok.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', button: 0 })); }); }
    const t = await fb(); if (!/正确/.test(t)) { await pg.screenshot({ path: OUT + 'r154-keypad-fail.png' }); console.log('  dbg', await pg.evaluate(() => document.querySelector('.quiz')?.innerText.slice(0, 300))); } ok(/正确/.test(t), `${name}：答案 ${a} 判对（${t}）`);
    const log = await pg.evaluate(() => window.__log); const vals = log.map(x => x[1].split('|')[0]);
    const flick = vals.filter((v, i) => i > 0 && v.length < vals[i - 1].length).length;   // 只加不减：值变短 = 闪回旧值 / 空
    ok(flick === 0, `${name}：输入框只增不减、不闪回空（${JSON.stringify(log)}）`);
    await pg.click('[data-testid=next]').catch(() => {}); await w(500);
  }
  // 停在填空题上 3 秒：计时每秒重绘，输入框和「确定」不变
  if (await findKeypad()) { for (const ch of '36') { await pg.tap(`.keypad [data-key="${ch}"]`); await w(60); } await mon(); await w(3200);
    const log = await pg.evaluate(() => window.__log); ok(log.length === 1 && log[0][1] === '36|E', `输入「36」后 3 秒：输入框和「确定」都不变（${JSON.stringify(log)}）`); }
  await pg.screenshot({ path: OUT + 'r154-keypad.png' }); await ctx.close();
}
console.log(bad ? `FAIL ${bad}` : 'r154-xueba ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
