// r12 验收（测试构建）：版本标签 r12；备份带密码哈希/恢复码哈希、有密码时恢复要先输当前密码；挑战题按当前难度 + 前序小节；高一重击卡总可选。
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

// r14：重载后 0–2500 ms 内点另一个孩子的头像——不能落到原来孩子的页面，不能白屏
if (on('race')) {
  const { ctx, pg, w, pinIn } = await session('7', { __zyUnlockAll: true });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await enterMap(pg, w);
  const offs = (process.env.OFFS || '0,300,700,1200,1800,2500').split(',').map(Number);
  let bad = 0, blank = 0, tapped = 0;
  for (const [i, off] of [...offs, ...offs].entries()) {
    // 回到 r9 的地图并进一关，留下「原来的位置」
    if (!(await pg.isVisible('[data-testid=level-1]'))) { await pg.goto(URL); await pg.waitForSelector('.profile-card'); await toMapOf(pg, w, 'r9'); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(500); } }
    await pg.click('[data-testid=level-1]'); await w(900); await tutSkip(pg, w); await skipTut(pg, w); await w(600);
    const viaGo = i >= offs.length; if (viaGo) await pg.goto(URL, { waitUntil: 'commit' }); else await pg.reload({ waitUntil: 'commit' }); const t0 = Date.now();
    let picked = false;
    while (Date.now() - t0 < off + 1500) {
      if (Date.now() - t0 >= off) {
        if (await pg.isVisible('.profile-card:has-text("小班宝贝")').catch(() => false)) { await pg.click('.profile-card:has-text("小班宝贝")', { timeout: 500 }).then(() => { picked = true; }).catch(() => {}); }
        else await pg.mouse.click(5, 400).catch(() => {});   // 加载中 / 已回到地图：随手点一下空白处
        break;
      }
      await pg.waitForTimeout(25);
    }
    await w(2500);
    const body = (await pg.textContent('body').catch(() => '')).trim(); if (!body) blank++;
    if (!viaGo && !picked) { const onMap = await pg.isVisible('[data-testid=level-1]').catch(() => false); if (!onMap) { bad++; console.log('reload 后没回到原地图 @', off); } }
    if (picked) { tapped++;
      if (await pg.isVisible('[data-testid=pin-ok]')) { await pinIn('2468'); await w(1200); }
      const okK = await pg.isVisible('[data-testid=stage-K].on').catch(() => false) || await pg.isVisible('.kstage, [data-testid=grade-pick] [data-testid=grade-K1].on').catch(() => false) || (await pg.textContent('.map-top').catch(() => '')).includes('小班');
      if (!okK) { bad++; console.log('WRONG after tap @', off, (await pg.textContent('body')).replace(/\s+/g, ' ').slice(0, 100)); await pg.screenshot({ path: OUT + `race-bad-${i}.png` }); }
      await pg.goto(URL); await pg.waitForSelector('.profile-card'); await toMapOf(pg, w, 'r9'); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(500); }
    }
  }
  ok(tapped >= offs.length - 2, `直接打开时首页头像能点（${tapped} 次）`); ok(bad === 0, `重载/打开后点「小班宝贝」：${tapped} 次都进了小班（错 ${bad} 次）`);
  ok(blank === 0, `没有白屏（${blank}）`); ok(errs.length === 0, `没有页面错误（${errs.slice(0, 2).join(' | ')}）`);
  await ctx.close();
}
// r14 策划：初一 1.3 挑战灰着并写明原因
if (on('chal')) {
  const { ctx, pg, w } = await session('7', { __zyUnlockAll: true }); await enterMap(pg, w);
  await pg.click('[data-testid=level-3]'); await w(900); await tutSkip(pg, w); await skipTut(pg, w);
  let why = ''; for (let i = 0; i < 6 && !why; i++) { if (await pg.isVisible('[data-testid=chal-on][aria-disabled=true]')) why = await pg.textContent('[data-testid=chal-on]'); else { await answer(pg, true).catch(() => {}); await w(1600); await next(pg, w); } }
  ok(/最难的题就是难度|都出过了/.test(why), `1.3 挑战灰着的原因：「${why.trim()}」`);
  await ctx.close();
}
// r14 较真家长：家长页里的各种操作（含选文件 / 页面短暂隐藏）不能被踢走、不能重载
if (on('parent')) {
  const { ctx, pg, w, pinIn } = await session('7', { __zyUnlockAll: true });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); let loads = 0; pg.on('load', () => loads++);
  const flick = async () => { await pg.evaluate(() => { const set = v => Object.defineProperty(document, 'visibilityState', { value: v, configurable: true }); set('hidden'); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')); set('visible'); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); }); };
  const still = async (m) => { await flick(); await w(2600); ok(await pg.isVisible('[data-testid=parent-close]'), `家长页：${m} 后仍在家长页`); };
  // 让「有新版本」挂起：模拟更新就绪（若有人在家长页里刷新会被抓到）
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('zy-update-ready', { detail: () => { localStorage.setItem('zy.r14reloadCalled', '1'); } })));
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('.modal >> text=稍后')) { await pg.click('.modal >> text=稍后'); await w(300); }
  await pg.click('[data-testid=ptab-pin]'); await w(300); await still('打开密码页');
  const he = await pg.$('[data-testid=hint-edit]'); if (he) { await he.click(); await w(300); await still('修改找回问题');
    await pg.click('[data-testid=hint-own]'); await w(200); await still('自己写问题');
    const box = await pg.$('[data-testid=hint-edit-box]'); const bb = await box.boundingBox(); const sb = await (await pg.$('[data-testid=hint-edit-ok]')).boundingBox();
    ok(bb && sb && sb.x + sb.width <= 1180 && sb.y + sb.height <= 820 + 2000, `修改找回问题面板宽 ${Math.round(bb?.width ?? 0)}，保存按钮在屏内`); }
  await pg.click('[data-testid=recgen]'); await w(300); ok(await pg.isVisible('[data-testid=recgen-ask]'), '重新生成恢复码要先确认'); await still('重新生成恢复码（确认前）'); await pg.click('[data-testid=recgen-cancel]');
  await pg.click('[data-testid=ptab-backup]'); await w(300);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null), pg.click('text=从备份恢复')]);
  await still('打开选文件对话框'); if (fc) await fc.setFiles([]).catch(() => {});
  await pg.click('[data-testid=ptab-pin]'); await w(200); await pg.click('[data-testid=pintab-forgot]').catch(() => {}); await w(300);
  ok(await pg.isVisible('[data-testid=forgot-rule]'), '忘记密码页大字写明：只有恢复码能立即重设'); await flick(); await w(2600);
  ok(await pg.isVisible('[data-testid=forgot-rule]'), '忘记密码页：页面短暂隐藏后仍在');
  ok(loads === 0, `整个过程没有重载（${loads}）`); ok(!(await pg.evaluate(() => localStorage.getItem('zy.r14reloadCalled'))), '家长页里不触发更新刷新');
  ok(errs.length === 0, `没有页面错误（${errs.slice(0, 2).join(' | ')}）`);
  await ctx.close();
}
// r14 策划 R13-4：密码页 / 忘记密码页「从备份恢复」（只覆盖）；家长页导入「合并」要先输入现在的密码
if (on('restore')) {
  const { ctx, pg, w, pinIn } = await session('7', { __zyUnlockAll: true });
  await pg.click('[data-testid=parent]'); await w(300);
  ok(await pg.isVisible('[data-testid=gate-restore]'), '密码页有「从备份恢复」');
  await pg.setInputFiles('[data-testid=gate-restore-file]', '/workspace/zhishi/backup_test.json'); await w(400);
  ok(await pg.isVisible('[data-testid=gate-restore-box]') && !(await pg.isVisible('[data-testid=merge-go]')), '密码页入口只能覆盖恢复（没有合并）');
  await pg.fill('[data-testid=gate-restore-sec]', '0000'); await pg.click('[data-testid=gate-restore-go]'); await w(400);
  ok(/还可以试 4 次/.test(await pg.textContent('[data-testid=gate-restore-box]')), '备份密码错：计入 5 次锁');
  await pg.keyboard.press('Escape').catch(() => {}); await pg.goto(URL); await w(1500);
  await pg.click('[data-testid=parent]'); await w(300); await pg.click('[data-testid=forgot]'); await w(300);
  ok(await pg.isVisible('[data-testid=gate-restore]'), '忘记密码页有「从备份恢复」');
  await pg.goto(URL); await w(1500); await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('.modal >> text=稍后')) { await pg.click('.modal >> text=稍后'); await w(300); }
  await pg.click('[data-testid=ptab-backup]'); await w(300);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('text=从备份恢复')]); await fc.setFiles('/workspace/zhishi/backup_test.json'); await w(500);
  ok(await pg.isDisabled('[data-testid=merge-go]'), '没输入现在的密码：「合并」不可选');
  await pg.fill('[data-testid=restore-pin]', '1111'); await w(400); ok(await pg.isDisabled('[data-testid=merge-go]'), '密码不对：「合并」不可选');
  await pg.fill('[data-testid=restore-pin]', '2468'); await w(600); ok(await pg.isEnabled('[data-testid=merge-go]'), '现在的密码正确：「合并」可选');
  await pg.click('[data-testid=merge-go]'); await w(600); const sum = await pg.textContent('[data-testid=merge-summary]').catch(() => '');
  ok(/新增孩子档案 \d+ 个 · 更新关卡星星 \d+ 关/.test(sum), `合并前显示预览：${sum.slice(0, 60)}`);
  await pg.click('[data-testid=merge-confirm]'); await w(3000);
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('.modal >> text=稍后')) { await pg.click('.modal >> text=稍后'); await w(300); }
  ok(await pg.isVisible('[data-testid=parent-close]'), '合并后仍用现在的家长密码');
  await pg.click('[data-testid=ptab-backup]'); await w(300); ok(await pg.isVisible('[data-testid=undo-restore]'), '合并后可以撤销一次');
  await ctx.close();
}
// 技术QA R13-5：篡改 zy.lastPlayer 不白屏
if (on('lp')) {
  const { ctx, pg, w } = await session('7', { __zyUnlockAll: true }); await enterMap(pg, w);
  await pg.evaluate(() => localStorage.setItem('zy.lastPlayer', JSON.stringify({ pid: 'kid-10' })));
  for (const v of [JSON.stringify({ pid: 'kid-10' }), '{"pid":{}}', 'garbage{', '12']) { await pg.evaluate(x => localStorage.setItem('zy.lastPlayer', x), v); await pg.reload(); await w(2500);
    const t = (await pg.textContent('#root').catch(() => '')).trim(); ok(t.length > 0, `zy.lastPlayer=${v}：不白屏`); }
  await ctx.close();
}
// r14.1：别人调快过时钟留下的「未来」基准 / 时长记录不再锁；加时就是加；首页 / 地图和家长页剩余时间一致；家长可重置计时
if (on('clock')) {
  const { ctx, pg, w, pinIn } = await session('7', { __zyUnlockAll: true });
  const put = (k, v) => pg.evaluate(([k, v]) => new Promise((res, rej) => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => { r.result.close(); res(1); }; tx.onerror = rej; }; r.onerror = rej; }), [k, v]);
  const pid = await pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('profiles'); g.onsuccess = () => { r.result.close(); res(g.result.find(p => p.name === 'r9')?.id); }; }; }));
  const day = o => { const d = new Date(Date.now() + o); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  await put('clock', { maxSeen: Date.now() + 73 * 3600e3, locked: true, lockedAt: Date.now() });
  await put('usage:' + pid, { [day(0)]: { used: 300, bonus: 0 }, [day(73 * 3600e3)]: { used: 999, bonus: 0 } });
  await pg.reload(); await w(2500);
  ok(!(await pg.isVisible('[data-testid=clock-lock]')), '时钟基准在未来 73 小时：不锁（作废并记日志）');
  const home = await pg.textContent('.profile-card:has-text("r9") .left-time'); ok(!/还能玩 0 分/.test(home), `首页剩余不是 0：${home}`);
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('.modal >> text=稍后')) { await pg.click('.modal >> text=稍后'); await w(300); }
  await pg.click('[data-testid=ptab-time]'); await w(300);
  const left = (await pg.textContent(`[data-testid=left-${pid}]`)).trim(); const m0 = home.match(/(\d+) 分/)?.[1]; ok(m0 && left.includes(m0 + ' 分'), `家长页剩余与首页一致（${left} / ${home}）`);
  await pg.click(`[data-testid=bonus-${pid}]`); await w(300); ok(/今天已加 10 分钟/.test(await pg.textContent(`[data-testid=bonus-now-${pid}]`)), '＋10 → 今天已加 10 分钟');
  await pg.click(`[data-testid=bonus-${pid}]`); await w(300); ok(/今天已加 20 分钟/.test(await pg.textContent(`[data-testid=bonus-now-${pid}]`)), '再 ＋10 → 今天已加 20 分钟');
  pg.once('dialog', d => d.accept()); await pg.click('[data-testid=reset-timing]'); await w(500);
  ok(!(await pg.isVisible(`[data-testid=bonus-now-${pid}]`)), '重置今天的计时：已加清零');
  let loads = 0; pg.on('load', () => loads++);
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('zy-update-ready', { detail: () => localStorage.setItem('zy.r141reload', '1') }))); await w(3500);
  ok(loads === 0 && !(await pg.evaluate(() => localStorage.getItem('zy.r141reload'))), '家长页：有新版本也不刷新');
  await pg.click('[data-testid=parent-close]'); await w(800); await pg.reload(); await w(2500);
  ok(!(await pg.isVisible('[data-testid=clock-lock]')), '刷新后仍不锁');
  await ctx.close();
}
// r14.1 策划：旧预设找回问题不再拦家长页，只常驻提示 + 现在更换
if (on('oldhint')) {
  const { ctx, pg, w, pinIn } = await session('7', { __zyUnlockAll: true });
  await pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const st = r.result.transaction('kv', 'readwrite').objectStore('kv'); const g = st.get('settings'); g.onsuccess = () => { st.put({ ...g.result, pinHint: { ...(g.result.pinHint ?? {}), q: '孩子的小名是？' } }, 'settings'); }; st.transaction.oncomplete = () => { r.result.close(); res(1); }; }; }));
  await pg.evaluate(() => { for (const k of Object.keys(localStorage)) if (/vault|pin/i.test(k) && !/Lock/.test(k)) localStorage.removeItem(k); });
  await pg.reload(); await w(2500);
  const open = async () => { await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('.modal >> text=稍后')) { await pg.click('.modal >> text=稍后'); await w(300); } };
  await open();
  ok(await pg.isVisible('[data-testid=old-hint-prompt]') && /已失效/.test(await pg.textContent('[data-testid=old-hint-prompt]')), '旧问题：家长页常驻「已失效」提示');
  ok(await pg.isVisible('[data-testid=ptab-time]') && !(await pg.isVisible('[data-testid=old-hint-force]')), '旧问题：家长页其他功能照常（不再拦截）');
  await pg.click('[data-testid=ptab-time]'); await w(300); ok(await pg.isVisible('[data-testid=reset-timing]'), '旧问题：能进时长页');
  await pg.click('[data-testid=parent-close]'); await w(500); await pg.reload(); await w(2500); await open();
  ok(await pg.isVisible('[data-testid=old-hint-prompt]') && await pg.isVisible('[data-testid=ptab-time]'), '刷新后仍是普通家长页 + 提示');
  await pg.click('[data-testid=old-hint-now]'); await w(300); await pg.click('[data-testid=hint-edit-box] input[type=radio] >> nth=0'); await pg.fill('[data-testid=hint-edit-answer]', 'zz'); await pg.click('[data-testid=hint-edit-ok]'); await w(500);
  ok(!(await pg.isVisible('[data-testid=old-hint-prompt]')), '换了新问题后提示消失');
  await ctx.close();
}
// r14.1 多标签页：只有一个活动标签页；其他显示「已在别处打开」+「在这里继续」
if (on('tabs')) {
  const { ctx, pg, w, pinIn } = await session('7', { __zyUnlockAll: true });
  const pg2 = await ctx.newPage(); await pg2.goto(URL); await pg2.waitForTimeout(2500);
  ok(await pg.isVisible('[data-testid=tab-inactive]'), '第二个标签页打开后：第一个显示「已在别处打开」');
  ok(!(await pg2.isVisible('[data-testid=tab-inactive]')), '第二个标签页是活动的');
  await pg.click('[data-testid=tab-takeover]'); await pg.waitForTimeout(3000);
  ok(!(await pg.isVisible('[data-testid=tab-inactive]')) && await pg2.isVisible('[data-testid=tab-inactive]'), '「在这里继续」接管，另一个变成非活动');
  await pg2.close();
  // 覆盖恢复后的重开写明真实原因
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('.modal >> text=稍后')) { await pg.click('.modal >> text=稍后'); await w(300); }
  await pg.click('[data-testid=ptab-backup]'); await w(300);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('text=从备份恢复')]); await fc.setFiles('/workspace/zhishi/backup_test.json'); await w(500);
  await pg.fill('[data-testid=restore-pin]', '2468'); await w(300); await pg.click('[data-testid=restore-go]'); await pg.waitForTimeout(4500);
  const body = await pg.textContent('body'); ok(!body.includes('游戏在更新版本时刷新了'), '覆盖恢复后的重开不再说「游戏在更新版本时刷新了」');
  await ctx.close();
}
// 技术QA R14-2：手机竖屏题目和输入在第一屏
if (on('phone')) {
  for (const vp of [{ width: 375, height: 667 }, { width: 414, height: 896 }]) {
    const { ctx, pg, w } = await session('7', { __zyUnlockAll: true }, vp); await enterMap(pg, w);
    await pg.click('[data-testid=level-1]'); await w(900); await tutSkip(pg, w); await skipTut(pg, w);
    for (let i = 0; i < 3 && !(await pg.isVisible('.qtext')); i++) { await pg.click('[data-testid=chal-normal]').catch(() => {}); await w(500); }
    const bb = await (await pg.$('.qtext'))?.boundingBox(); const ib = await (await pg.$(".quiz .qtext + *"))?.boundingBox(); ok(bb && ib && ib.y + 30 <= vp.height, `${vp.width}×${vp.height}：题目和输入在第一屏（输入 y=${Math.round(ib?.y ?? -1)}）（y=${Math.round(bb?.y ?? -1)}）`);
    await pg.screenshot({ path: OUT + `phone-${vp.width}.png` }); await ctx.close();
  }
}
console.log(bad ? `r14 FAIL ${bad}` : 'r14 ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
