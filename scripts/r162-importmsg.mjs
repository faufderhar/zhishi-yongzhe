// r16.2 技术QA B4–B8（测试包）：导入题库没有一条无声路径
//  B4 点预览外面不关；「取消」→「未导入」  B5 IndexedDB 写失败（注入 QuotaExceededError）→ 「保存失败」、计数 0  B6 questions 不是数组 / 0 题 / 非 JSON / 不是对象 → 同一句「导入失败：…」
//  B8 选文件时先清掉旧提示；360×640 结果提示在屏幕内
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4471/'; const D = '/workspace/playtest/r16dev/importmsg/'; const OUT = process.env.OUT || D;
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const errs = [];
async function open(vp, failPut, touch = false) {
  const ctx = await b.newContext({ viewport: vp, ...(touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) }); const pg = await ctx.newPage(); pg.setDefaultTimeout(15000); pg.on('pageerror', e => errs.push(String(e)));
  await pg.addInitScript(f => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true;
    { const T = File.prototype.text; File.prototype.text = function () { return this.name === 'readfail.json' ? Promise.reject(new DOMException('NotReadableError', 'NotReadableError')) : T.call(this); }; }   // B6：读文件失败
    if (f) { const P = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...a) { if (this.name === 'bank') throw new DOMException('quota', 'QuotaExceededError'); return P.apply(this, a); }; } }, failPut);
  const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]'); await w(300);
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x'); await pg.click('[data-testid=hint-ok]');
  await pg.waitForSelector('[data-testid=rec-code]').then(() => pg.click('[data-testid=rec-done]')); await pg.waitForSelector('[data-testid=pin-verify]').then(() => pinIn('2468'));
  if (await vis('.modal >> text=稍后')) await pg.click('.modal >> text=稍后');
  await pg.click('[data-testid=ptab-bank]').catch(() => pg.click('text=题库')); await pg.waitForSelector('[data-testid=bank-table]');
  return { ctx, pg, w, vis };
}
const msgOf = pg => pg.textContent('[data-testid=import-msg]').catch(() => null);
const count = pg => pg.evaluate(() => [...document.querySelectorAll('button')].map(x => x.textContent).find(t => /清除已导入/.test(t ?? '')) ?? '');
{ const { ctx, pg, w, vis } = await open({ width: 1280, height: 800 }, false);
  await pg.setInputFiles('[data-testid=import-file]', D + 'one.json'); await pg.waitForSelector('[data-testid=import-preview]');
  await pg.mouse.click(10, 10); await w(400); ok(await vis('[data-testid=import-preview]'), 'B4 点弹窗外面：预览还在');
  await pg.click('[data-testid=import-cancel]'); await w(300); ok(!(await vis('[data-testid=import-preview]')) && /^未导入/.test(await msgOf(pg) ?? ''), `B4 取消 → ${await msgOf(pg)}`);
  ok(/（0）/.test(await count(pg)), `取消后 ${await count(pg)}`);
  for (const [f, re] of [['qobj.json', /导入失败：文件格式不对：questions 应该是题目列表/], ['empty.json', /导入失败：文件里没有题目/], ['bad.json', /导入失败：文件解析失败/], ['num.json', /导入失败：文件格式不对：找不到题目列表/], ['readfail.json', /导入失败：文件读不出来/]]) {
    await pg.setInputFiles('[data-testid=import-file]', D + f); await pg.waitForSelector('[data-testid=import-msg]'); await w(300);
    const m = await msgOf(pg); ok(re.test(m ?? '') && /没有导入任何题/.test(m ?? '') && !(await vis('[data-testid=import-preview]')), `B6 ${f} → ${m}`); }
  // B8：点「导入题库」按钮就先清掉旧提示（文件对话框取消也不会留着上一次的话）
  pg.once('filechooser', fc => fc.setFiles([]).catch(() => {})); await pg.click('[data-testid=import-pick]'); await w(500);
  ok(!(await vis('[data-testid=import-msg]')), 'B8 再点导入（取消文件对话框）→ 旧提示清掉');
  await pg.setInputFiles('[data-testid=import-file]', D + 'one.json'); await pg.waitForSelector('[data-testid=import-preview]'); await pg.click('[data-testid=import-confirm]');
  await pg.waitForSelector('[data-testid=import-msg]'); await w(500); ok(/^已导入 1 题/.test(await msgOf(pg) ?? '') && /（1）/.test(await count(pg)), `正常导入 → ${await msgOf(pg)} / ${await count(pg)}`);
  await ctx.close(); }
{ const { ctx, pg, w } = await open({ width: 1280, height: 800 }, true);
  await pg.setInputFiles('[data-testid=import-file]', D + 'one.json'); await pg.waitForSelector('[data-testid=import-preview]'); await pg.click('[data-testid=import-confirm]');
  await pg.waitForSelector('[data-testid=import-msg]'); await w(600); const m = await msgOf(pg);
  ok(/^保存失败/.test(m ?? '') && !/已导入 1 题/.test(m ?? '') && /（0）/.test(await count(pg)), `B5 写库失败 → ${m} / ${await count(pg)}`);
  await pg.screenshot({ path: OUT + 'b5-idbfail.png' }); await ctx.close(); }
{ const { ctx, pg, w } = await open({ width: 360, height: 640 }, false);
  await pg.setInputFiles('[data-testid=import-file]', D + 'one.json'); await pg.waitForSelector('[data-testid=import-preview]'); await pg.click('[data-testid=import-confirm]');
  await pg.waitForSelector('[data-testid=import-msg]'); await w(800);
  const r = await pg.$eval('[data-testid=import-msg]', e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; });
  ok(r.top >= 0 && r.bottom <= r.vh, `B8 360×640 结果提示在屏幕内 ${JSON.stringify(r)}`); await pg.screenshot({ path: OUT + 'b8-360.png' }); await ctx.close(); }
// r17.1 A3 / 技术QA r16.2 N1：360×640 触屏、QA 原文件（有错题 →「只导入正确的 1 题」）、CPU 降速 6×：成功提示 0.8 s 和 5 s 时都在屏幕内
{ const { ctx, pg, w } = await open({ width: 360, height: 640 }, false, true);
  const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await pg.setInputFiles('[data-testid=import-file]', '/workspace/playtest/r161_edited_g10.json'); await pg.waitForSelector('[data-testid=import-preview]');
  const btn = await pg.textContent('[data-testid=import-confirm]'); await pg.tap('[data-testid=import-confirm]');
  await pg.waitForSelector('[data-testid=import-msg]'); const box = () => pg.$eval('[data-testid=import-msg]', e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, txt: e.textContent.slice(0, 20) }; });
  await w(800); const r1 = await box(); await w(4200); const r2 = await box();
  ok(/已导入/.test(r2.txt) && [r1, r2].every(r => r.top >= 0 && r.bottom <= r.vh), `N1 360×640 触屏「${btn}」成功提示 0.8 s ${JSON.stringify(r1)} / 5 s ${JSON.stringify(r2)} 都在屏幕内`);
  await pg.screenshot({ path: OUT + 'n1-360x640-ok-msg.png' }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await ctx.close(); }
console.log(errs.length ? 'pageerrors: ' + errs.join(' | ') : 'no pageerror'); ok(!errs.length, '没有 pageerror');
console.log(bad ? `r162-importmsg FAIL ${bad}` : 'r162-importmsg ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
