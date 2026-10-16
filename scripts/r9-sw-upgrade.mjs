// r9：旧版 SW（backup-r6 构建）→ r9 升级验收；以及 r9 → r9' 自动更新（安全页面自动刷新）
// 需要：/tmp/sw/zhishi-yongzhe 为 symlink，http.server 在 4190 服务 /tmp/sw
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
const U = 'http://localhost:4190/zhishi-yongzhe/';
const sw = v => execSync(`find /tmp/sw/v/${v} -exec touch {} + && ln -sfn /tmp/sw/v/${v} /tmp/sw/zhishi-yongzhe`);
const dir = '/tmp/sw-profile'; fs.rmSync(dir, { recursive: true, force: true });
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const open = async () => { const c = await chromium.launchPersistentContext(dir, { viewport: { width: 1024, height: 700 } }); const p = c.pages()[0] || await c.newPage(); return [c, p]; };
const bundle = p => p.evaluate(() => [...document.scripts].map(s => s.src).find(s => /index-/.test(s)) || '');
const caches_ = p => p.evaluate(async () => (await caches.keys()).join(','));
const ver = p => p.evaluate(() => document.querySelector('[data-testid=version-label]')?.textContent || '');
sw('old');
let [c, p] = await open();
await p.goto(U); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
await p.reload(); await p.waitForTimeout(1500);
const oldB = await bundle(p); console.log('old bundle', oldB, 'caches', await caches_(p));
ok(/DIcW0RJj/.test(oldB), '安装了旧版 r6 并由旧 SW 控制');
await c.close();
sw('new');
// 第一次打开：旧 SW 先给旧页面，新 SW 在后台安装+skipWaiting
[c, p] = await open(); await p.goto(U); await p.waitForTimeout(6000);
let b1 = await bundle(p); console.log('launch1 bundle', b1, 'ver', await ver(p));
if (!/r9/.test(await ver(p))) { await p.reload(); await p.waitForTimeout(3000); }
const b2 = await bundle(p), v2 = await ver(p);
console.log('after bundle', b2, 'ver', v2, 'caches', await caches_(p));
ok(/r9/.test(v2) && b2 !== oldB, `旧客户端升级到 r9（最多 1 次重新打开/刷新）：${v2}`);
const swState = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { waiting: !!r?.waiting, active: r?.active?.scriptURL }; });
ok(!swState.waiting, '没有卡在 waiting 的旧/新 SW');
// r9 → r9'：页面开着停在角色页，模拟新部署 + visibilitychange
await p.evaluate(() => { window.__mark = 1; });
sw('new2');
await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
const reloaded = await p.waitForFunction(() => !window.__mark, null, { timeout: 20000 }).then(() => true).catch(() => false);
ok(reloaded, 'r9 客户端在安全页面（角色页）检测到新版本后自动刷新');
const sk = await p.evaluate(() => sessionStorage.getItem('zy-sw-reload'));
const reg = await p.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL);
console.log('active', reg, 'caches', await caches_(p));
const ck = (await caches_(p)).split(',').filter(k => /precache/.test(k));
ok(ck.length <= 1, '旧 precache 已清理：' + ck.join(','));
await c.close();
console.log(fail ? `FAILED ${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
