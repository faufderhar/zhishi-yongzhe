// r17.2.1 e2e：旧 SW（r17.1，预缓存 v57 且忽略 ?v=）→ 部署新版后第一次打开：题库是否还是旧的
// 需要：python3 -m http.server 4291 -d /tmp/r1721/srv（srv/zhishi-yongzhe → /tmp/r1721/v/<版本> 的符号链接）；/tmp/r1721/v/{r171,r172,r1721} 为对应提交的 vite build
// 用法：node scripts/r1721-bankcache.mjs r1721   （传 r172 = 对照，复现旧问题）
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
const T = process.argv[2] || 'r1721'; const ROOT = '/tmp/r1721';
const U = 'http://127.0.0.1:4291/zhishi-yongzhe/';
const sw = v => execSync(`find ${ROOT}/v/${v} -exec touch {} + && ln -sfn ${ROOT}/v/${v} ${ROOT}/srv/zhishi-yongzhe`);
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const dir = `${ROOT}/prof-${T}`; fs.rmSync(dir, { recursive: true, force: true });
const open = async (offline = false) => { const c = await chromium.launchPersistentContext(dir, { viewport: { width: 1024, height: 700 }, offline }); return [c, c.pages()[0] || await c.newPage()]; };
/** 每次页面加载（导航）里 bank_9 的响应：[{url, sw, v}]；最后一条 = 页面最终用的 */
const watch = p => { const loads = [[]]; p.on('framenavigated', f => { if (f === p.mainFrame()) loads.push([]); });
  p.on('response', async r => { if (!/bank_9\.json/.test(r.url())) return; const e = { url: r.url().replace(/^.*\/banks\//, ''), sw: r.fromServiceWorker(), v: '?' }; loads[loads.length - 1].push(e); try { e.v = (/"version":\s*"([^"]+)"/.exec((await r.text()).slice(0, 400)) || [])[1] || '?'; } catch { e.v = 'ERR'; } });
  return loads; };
const label = p => p.evaluate(() => document.querySelector('[data-testid=version-label]')?.textContent || '').catch(() => '');
// 1) 装好 r17.1（SW 接管、预缓存 v57）
sw('r171'); let [c, p] = await open(); let L = watch(p);
await p.goto(U); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30000 }); await p.reload(); await p.waitForSelector('[data-testid^=profile-], [data-testid=add-child]', { timeout: 20000 }); await p.waitForTimeout(1500);
const last = loads => loads.filter(l => l.length).map(l => l[l.length - 1].v);
ok(last(L).pop() === 'v57', `r17.1 已安装：bank_9 = ${last(L).pop()}`); await c.close();
// 2) 部署 T，重新打开（不手动刷新），等自动更新 / 刷新
sw(T); [c, p] = await open(); L = watch(p);
await p.goto(U); await p.waitForSelector('[data-testid^=profile-], [data-testid=add-child]', { timeout: 30000 }); await p.waitForTimeout(15000);
const first = L.find(l => l.length) || [];
console.log('第一次打开 bank_9 请求：', JSON.stringify(first));
console.log('各次加载最终 bank_9：', last(L).join(' → '), '| 版本', await label(p));
const err = await p.evaluate(() => localStorage.getItem('zy.errLog') || '').catch(() => '');
ok(first.length && first[first.length - 1].v === 'v58', `部署 ${T} 后第一次打开（旧 SW 还在）：页面用的 bank_9 = ${first[first.length - 1]?.v}`);
ok(last(L).every(v => v === 'v58'), `之后每次加载都用 v58：${last(L).join(',')}`);
if (first.some(e => e.v === 'v57')) ok(/bank-stale/.test(err), '旧 SW 喂了 v57 → 记了 bank-stale 并 no-store 重拉');
// 3) 手动刷新一次（此时新 SW 已接管）
L = watch(p); await p.reload(); await p.waitForSelector('[data-testid^=profile-], [data-testid=add-child]', { timeout: 20000 }); await p.waitForTimeout(2500);
const rl = L.find(l => l.length) || []; console.log('刷新后 bank_9 请求：', JSON.stringify(rl));
ok(rl.length && rl[rl.length - 1].v === 'v58', `新 SW 下刷新：bank_9 = ${rl[rl.length - 1]?.v}（${rl.map(e => e.sw ? 'SW' : 'net').join(',')}）`);
ok((await label(p)).includes(JSON.parse(fs.readFileSync(`${ROOT}/v/${T}/version.json`, 'utf8')).build), '版本号 = ' + await label(p));
await c.close();
// 4) 断网重新打开：题库仍可用（?v= 不在预缓存 → 退回预缓存地址）
[c, p] = await open(true); L = watch(p); await p.goto(U).catch(() => {}); await p.waitForTimeout(6000);
const off = L.flat(); console.log('断网 bank_9 请求：', JSON.stringify(off));
ok(off.some(e => e.v === 'v58'), '断网：bank_9 从预缓存拿到 v58');
ok(await p.isVisible('[data-testid^=profile-], [data-testid=add-child]'), '断网：首页正常显示');
await c.close();
console.log(fail ? `FAILED ${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
