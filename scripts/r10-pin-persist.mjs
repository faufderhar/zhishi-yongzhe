// r10 回归：设了家长密码后，关标签页 / 强制刷新（绕过缓存和 SW）/ SW 更新后，「添加孩子」不能出现「密码数据丢失」
import { chromium } from 'playwright';
import fs from 'fs';
const U = process.env.URL || 'http://localhost:4183/';
const dir = '/tmp/pin-profile'; fs.rmSync(dir, { recursive: true, force: true });
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const c = await chromium.launchPersistentContext(dir, { viewport: { width: 1024, height: 640 } });
let pg = c.pages()[0]; const w = ms => pg.waitForTimeout(ms);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
await pg.goto(U); await pg.waitForSelector('[data-testid=add-child]');
await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
await pg.fill('[data-testid=add-name]', '豆豆'); await pg.click('[data-testid=home-grade-K1]'); await w(600);
await pg.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
const check = async (how) => {
  await pg.waitForSelector('[data-testid=add-child]', { timeout: 20000 }); await pg.click('[data-testid=add-child]'); await w(700);
  const lost = await pg.locator('text=密码数据丢失').count(); const pad = await pg.locator('[data-testid=pin-1]').count();
  ok(!lost && pad, `${how}：点「添加孩子」要求输入密码，没有「密码数据丢失」`);
  await pg.screenshot({ path: `screenshots/r10/r10-pin-${how.replace(/\W+/g, '')}.png` });
  if (pad && !lost) { await pinIn('2468'); ok(await pg.locator('[data-testid=add-name]').count() > 0, `${how}：原密码 2468 仍然有效`); }
};
fs.mkdirSync('screenshots/r10', { recursive: true });
// 1 关标签页后重新打开
await pg.close(); pg = await c.newPage(); await pg.goto(U); await check('close-tab');
// 2 强制刷新：禁用缓存 + 绕过 SW
const cdp = await c.newCDPSession(pg); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }); await cdp.send('Network.setBypassServiceWorker', { bypass: true });
await pg.reload(); await check('hard-reload');
// 3 快速点击：页面一出来立刻点（加载竞争）
await pg.reload(); await pg.waitForSelector('[data-testid=add-child]'); await pg.click('[data-testid=add-child]'); await w(500);
ok(!(await pg.locator('text=密码数据丢失').count()), '刷新后立刻点「添加孩子」也不误报');
await cdp.send('Network.setBypassServiceWorker', { bypass: false });
// 4 模拟 SW 更新：sw-extra 激活清理缓存后刷新
await pg.goto(U); await pg.evaluate(async () => { for (const k of await caches.keys()) await caches.delete(k); const r = await navigator.serviceWorker.getRegistration(); await r?.update(); }); await pg.reload(); await check('sw-update');
// 5 关闭整个浏览器再开
await c.close(); const c2 = await chromium.launchPersistentContext(dir, { viewport: { width: 1024, height: 640 } }); pg = c2.pages()[0]; await pg.goto(U); await check('browser-restart');
await c2.close(); console.log(fail ? `FAILED ${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
