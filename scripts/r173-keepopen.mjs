// r17.3 e2e「页开着跨发版」（学霸 r17.2.1：同址从旧版切到新版后页面一直开着，20 秒+ 没有更新条、没有自动刷新）
// 准备（脚本自己做）：测试构建目录 DIST（默认 /tmp/r173/dist-test）复制成 A；B = A 只改 version.json 的 build + sw.js 末尾加注释（模拟发了新版）
// 服务：python3 -m http.server PORT -d ROOT/srv（srv/zy → v/A 或 v/B 的符号链接）
// 场景 1：__zyUpdatePollMs=4000 → 页开着（地图页）换成 B → 轮询窗口内出现更新条或自动刷新（reloadLog 有 version.json:<B> / controllerchange）
// 场景 2：不设钩子（默认 5 分钟轮询）→ 换成 B 后立刻 focus：启动检查不到 1 分钟，被限流（不请求 version.json）；启动 ≥60 秒后 focus → 检查 → 更新
// 场景 3（对照）：不设钩子、不 focus，换成 B 后 20 秒内不检查（证明场景 1 靠的是可见轮询）
import { chromium } from 'playwright';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
const DIST = process.env.DIST || '/tmp/r173/dist-test'; const ROOT = process.env.ROOT || '/tmp/r173sw'; const PORT = +(process.env.PORT || 4482);
const U = `http://127.0.0.1:${PORT}/zy/`;
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
fs.rmSync(ROOT, { recursive: true, force: true }); fs.mkdirSync(ROOT + '/v', { recursive: true }); fs.mkdirSync(ROOT + '/srv');
execSync(`cp -r ${DIST} ${ROOT}/v/A && cp -r ${DIST} ${ROOT}/v/B`);
const vA = JSON.parse(fs.readFileSync(`${ROOT}/v/A/version.json`, 'utf8')); const NEXT = vA.build + '-next';
fs.writeFileSync(`${ROOT}/v/B/version.json`, JSON.stringify({ ...vA, build: NEXT }));
fs.appendFileSync(`${ROOT}/v/B/sw.js`, `\n// r173-keepopen ${NEXT}\n`);
// 换版时 touch：python http.server 支持 If-Modified-Since（秒级），A / B 同一秒复制会让 sw.js 更新检查拿到 304
const serveV = v => execSync(`find ${ROOT}/v/${v} -exec touch -d @${Math.floor(Date.now() / 1000) + 2} {} + && ln -sfn ${ROOT}/v/${v} ${ROOT}/srv/zy`);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '-b', '127.0.0.1', '-d', ROOT + '/srv'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const b = await chromium.launch();
async function scenario(name, { poll, body }) {
  serveV('A'); const ctx = await b.newContext({ viewport: { width: 1024, height: 700 } }); const pg = await ctx.newPage();
  const vj = []; pg.on('request', r => { if (/version\.json/.test(r.url())) vj.push(Date.now()); });
  await pg.addInitScript(p => { window.__zyTest = true; window.__zyTestNoTts = true; if (p) window.__zyUpdatePollMs = p; }, poll || 0);
  await pg.goto(U); await pg.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30000 });
  await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]', { timeout: 20000 });
  const tLoad = Date.now(); await pg.waitForTimeout(1500);
  const st = { pg, vj, tLoad, upd: async () => pg.evaluate(next => { const log = JSON.parse(localStorage.getItem('zy.reloadLog') || '[]');
      return { bar: !!document.querySelector('[data-testid=update-ready]'), reload: log.filter(x => String(x.reason).includes(next) || x.reason === 'controllerchange').map(x => x.reason) }; }, NEXT).catch(() => ({ bar: false, reload: [], nav: true })) };
  st.waitUpd = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const u = await st.upd(); if (u.bar || u.reload.length) return { ...u, s: (Date.now() - t0) / 1000 }; await pg.waitForTimeout(500); } return null; };
  console.log(`— ${name}`); await body(st); await ctx.close();
}
await scenario('1 可见轮询（钩子 4 秒）', { poll: 4000, body: async ({ pg, waitUpd, vj, upd }) => {
  const n0 = vj.length; serveV('B'); const t = Date.now(); const u = await waitUpd(15000);
  ok(!!u, `换版后 ${u ? u.s.toFixed(1) + ' 秒' : '15 秒内没有'} 出现更新条 / 自动刷新 ${JSON.stringify(u)}`);
  ok(vj.length > n0, `开着的页面自己去查了 version.json（${vj.length - n0} 次，第一次在换版后 ${vj.length > n0 ? ((vj[n0] - t) / 1000).toFixed(1) : '-'} 秒）`);
  let rl = []; for (let i = 0; i < 30 && !rl.length; i++) { await pg.waitForTimeout(500); rl = (await upd()).reload || []; }
  ok(rl.length > 0, `首页停稳后自动刷新（reloadLog：${rl.join(',') || '无'}）`);
  ok(rl.length > 0 && !rl.some(r => /no-sw/.test(r)), '刷新前新 SW 已接管（不是 8 秒超时的 :no-sw）');
  await pg.waitForTimeout(2000); const label = await pg.evaluate(() => document.querySelector('[data-testid=version-label]')?.textContent || '').catch(() => '');
  ok(await pg.isVisible('[data-testid^=profile-], [data-testid=add-child]'), '刷新后首页正常：' + label);
} });
await scenario('2 focus 限流 1 次/分钟（默认轮询）', { poll: 0, body: async ({ pg, waitUpd, vj, tLoad }) => {
  serveV('B'); const n0 = vj.length; await pg.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); }); await pg.waitForTimeout(3000);
  ok(vj.length === n0, `启动不到 1 分钟：focus / online 被限流，没查 version.json（${vj.length - n0} 次）`);
  ok(!(await waitUpd(1000)), '此时没有更新条');
  await pg.waitForTimeout(Math.max(0, tLoad + 61000 - Date.now())); const n1 = vj.length;
  await pg.evaluate(() => window.dispatchEvent(new Event('focus'))); const u = await waitUpd(12000);
  ok(vj.length > n1, `启动 ≥60 秒后 focus → 查 version.json（${vj.length - n1} 次）`);
  ok(!!u, `focus 后 ${u ? u.s.toFixed(1) + ' 秒' : '12 秒内没有'} 出现更新条 / 自动刷新 ${JSON.stringify(u)}`);
  const n2 = vj.length; await pg.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); }).catch(() => {}); await pg.waitForTimeout(2000);
  ok(vj.length - n2 <= 1, `紧接着再 focus / pageshow：限流（${vj.length - n2} 次，刷新后的启动检查算 1 次）`);
} });
await scenario('3 对照：默认 5 分钟轮询、无 focus，20 秒内不检查', { poll: 0, body: async ({ waitUpd, vj }) => {
  serveV('B'); const n0 = vj.length; const u = await waitUpd(20000);
  ok(!u && vj.length === n0, `20 秒内无检查（version.json ${vj.length - n0} 次，${u ? '有更新' : '无更新'}）——说明场景 1 靠的是缩短后的可见轮询`);
} });
await b.close(); srv.kill();
console.log(bad ? `FAILED ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
