// r10：持久化旧档案（r6 / r9 SW）→ r10 升级；r10 → 下一次部署：普通刷新一次就是新版（导航 network-first + version.json 自愈）
// 需要：http.server 在 4190 服务 /tmp/sw；/tmp/sw/v/{old(r6),r9,r10,r10b}
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
const U = 'http://localhost:4190/zhishi-yongzhe/';
const sw = v => execSync(`find /tmp/sw/v/${v} -exec touch {} + && ln -sfn /tmp/sw/v/${v} /tmp/sw/zhishi-yongzhe`);
const B = v => JSON.parse(fs.readFileSync(`/tmp/sw/v/${v}/version.json`, 'utf8')).build;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const ver = p => p.evaluate(() => document.querySelector('[data-testid=version-label]')?.textContent || '');
for (const start of ['old', 'r9']) {
  const dir = '/tmp/sw-profile-' + start; fs.rmSync(dir, { recursive: true, force: true });
  const open = async () => { const c = await chromium.launchPersistentContext(dir, { viewport: { width: 1024, height: 700 } }); return [c, c.pages()[0] || await c.newPage()]; };
  sw(start); let [c, p] = await open();
  await p.goto(U); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {}); await p.reload(); await p.waitForTimeout(1500);
  const v0 = await ver(p); console.log(start, 'installed', v0); await c.close();
  sw('r10'); [c, p] = await open(); await p.goto(U); await p.waitForTimeout(6000);
  let n = 0; while (!(await ver(p)).includes(B('r10')) && n < 2) { n++; await p.reload(); await p.waitForTimeout(3000); }
  ok((await ver(p)).includes(B('r10')), `${start === 'old' ? 'r6' : 'r9'} 旧档案 → r10：重新打开后 ${n} 次普通刷新即是新版（${await ver(p)}）`);
  await c.close();
  // r10 → 下一次部署：关掉 App，部署，重新打开（不手动刷新）
  sw('r10b'); [c, p] = await open(); await p.goto(U); await p.waitForTimeout(6000);
  const v1 = await ver(p); let m = 0; while (!v1.includes(B('r10b')) && !(await ver(p)).includes(B('r10b')) && m < 1) { m++; await p.reload(); await p.waitForTimeout(3000); }
  ok((await ver(p)).includes(B('r10b')), `r10 → 新部署：重新打开${m ? '后普通刷新 1 次' : '即'}是新版（${await ver(p)}）`);
  const ck = (await p.evaluate(async () => (await caches.keys()).join(','))).split(',').filter(k => /precache/.test(k)); ok(ck.length <= 1, '旧 precache 已清理：' + ck.join(','));
  // 断网仍能打开（network-first 超时回退缓存）
  await c.close(); [c, p] = await open(); await c.setOffline(true); await p.goto(U).catch(() => {}); await p.waitForTimeout(5000);
  ok((await ver(p)).includes(B('r10b')), '断网重新打开：从缓存打开新版'); await c.close();
}
console.log(fail ? `FAILED ${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
