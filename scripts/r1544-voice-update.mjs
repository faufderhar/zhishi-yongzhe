// r15.4.4 音频设计换整包（小班语速 1.5 → 1.2）：已经装好旧录音包（SW + zy-voice 离线录音）的平板，更新后用新录音。
// 同一个网址先放旧包构建（OLD），装好 SW、后台把旧录音全部放进 zy-voice；再换成新包构建（NEW），SW 更新、重开：
// ① voice/manifest.json 是新的（SW 预缓存 revision 变了）；② 换了内容的键放的是新文件（文件名带内容哈希 = 新网址）；
// ③ zy-voice 里不在新 manifest 里的旧录音被删掉，新录音全部在；④ 断网后新录音全部能取到、旧录音取不到；⑤ 播一句换过的提示语，放的是新文件。
// 用法：OLD=dist-r1543f NEW=dist-r1544g [PORT=4359] node scripts/r1544-voice-update.mjs（两个都要是测试构建 ZY_TEST=1）
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
const OLD = resolve(process.env.OLD || 'dist-r1543f'), NEW = resolve(process.env.NEW || 'dist-r1544g'), PORT = +(process.env.PORT || 4359);
const OUT = process.env.OUT || '/workspace/playtest/r1544-voice-update/'; mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
let root = OLD;
const srv = createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = join(root, p);
  if (!f.startsWith(root) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(PORT, r)); const URL0 = `http://localhost:${PORT}/`;
const manOf = d => JSON.parse(readFileSync(join(d, 'voice/manifest.json'), 'utf8')).items;
const filesOf = it => [...new Set(Object.values(it).flatMap(v => Array.isArray(v) ? v : [v]).filter(f => /\.(mp3|m4a)$/.test(f)))];
const mo = manOf(OLD), mn = manOf(NEW), fo = filesOf(mo), fn = filesOf(mn), sn = new Set(fn);
const changed = Object.keys(mn).filter(k => mo[k] && JSON.stringify(mo[k]) !== JSON.stringify(mn[k])), gone = fo.filter(f => !sn.has(f));
console.log(`旧包 ${fo.length} 个文件，新包 ${fn.length} 个；换了内容的键 ${changed.length} 个，新包里没有的旧文件 ${gone.length} 个`);
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
ok(changed.length > 0 && gone.length > 0, '两个构建的录音包确实不同');
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
await pg.addInitScript(() => { window.__zyTest = true; window.__zyUnlockAll = true;
  try { delete window.speechSynthesis; delete Window.prototype.speechSynthesis; } catch { /* */ } Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); window.SpeechSynthesisUtterance = undefined; });
const w = ms => pg.waitForTimeout(ms);
const tap = async sel => { const l = pg.locator(sel).first(); const bb = await l.boundingBox(); if (!bb) return false; await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
const pinIn = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(300); };
const vstat = () => pg.evaluate(() => JSON.parse(localStorage.getItem('zy-offline-voice') || 'null'));
const cached = () => pg.evaluate(async () => (await (await caches.open('zy-voice')).keys()).map(r => r.url.split('?')[0].split('/voice/').pop()));
async function waitVoice(total, after) { let st = null; for (let i = 0; i < 150; i++) { st = await vstat(); if (st && st.total === total && st.done >= st.total && (!after || st.at > after)) break; await w(1000); } return st; }
// ---- 旧包：装 SW、建小班档案、后台下完旧录音
await pg.goto(URL0); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]');
await tap('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await tap('.pinpad input[type=radio]').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await tap('[data-testid=hint-ok]'); await w(500); if (await pg.isVisible('[data-testid=rec-done]')) await tap('[data-testid=rec-done]'); await w(300);
await pg.fill('[data-testid=add-name]', 'vu'); await tap('[data-testid=home-grade-K1]'); await w(400);   // 和 r1541-offline-voice 同样的建档步骤
await pg.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 }).catch(() => {});
ok(await pg.evaluate(() => !!navigator.serviceWorker?.controller), '旧包：SW 已接管页面');
const st0 = await waitVoice(fo.length);
ok(!!st0 && st0.state === 'done' && st0.failed === 0, `旧包：后台下完旧录音 ${JSON.stringify(st0)}`);
const c0 = new Set(await cached()); ok(fo.every(f => c0.has(f)), `旧包：zy-voice 里旧录音 ${fo.filter(f => c0.has(f)).length}/${fo.length}`);
const oldLabel = await pg.evaluate(() => document.body.innerText.match(/r1[\d.]+ · 题库v\d+ · \w+/)?.[0] ?? '');
// ---- 换成新包，SW 更新后重开
root = NEW; const tSwitch = Date.now();
const swOld = await pg.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; navigator.serviceWorker.addEventListener('controllerchange', fin, { once: true }); r?.update().catch(fin); setTimeout(fin, 20000); }); });
await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=pin-ok], [data-testid=levels]', { timeout: 15000 }); await w(500);
const swState = await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { active: r?.active?.state, waiting: !!r?.waiting, ctl: !!navigator.serviceWorker.controller }; });
ok(swState.active === 'activated' && !swState.waiting && swState.ctl, `新包：新 SW 已激活、接管页面 ${JSON.stringify(swState)}（旧 ${swOld?.split('/').pop()}）`);
const manNow = await pg.evaluate(async () => (await (await fetch('voice/manifest.json')).json()).items);
ok(JSON.stringify(manNow) === JSON.stringify(mn), '新包：页面拿到的 voice/manifest.json 是新的');
const st1 = await waitVoice(fn.length, tSwitch);
ok(!!st1 && st1.state === 'done' && st1.failed === 0, `新包：后台补齐新录音 ${JSON.stringify(st1)}`);
const c1 = new Set(await cached());
ok(fn.every(f => c1.has(f)), `新包：zy-voice 里新录音 ${fn.filter(f => c1.has(f)).length}/${fn.length}`);
const stale = [...c1].filter(f => !sn.has(f)); ok(stale.length === 0, `新包：zy-voice 里没有旧录音（剩 ${stale.length}：${stale.slice(0, 5).join(',')}）`);
// ---- 播一句换过内容的提示语：放的是新文件
const pk = changed.find(k => k.startsWith('p:')) ?? changed[0];
await tap('body'); await w(300);
await pg.evaluate(k => { window.__zyRecLog.length = 0; window.__zyAudioLog.length = 0; window.__zySpeak('测试', 'zh-CN', { keys: [k] }); }, pk); await w(4000);
const played = await pg.evaluate(() => [...(window.__zyRecLog || []).map(x => x.url.split('/').pop()), ...(window.__zyAudioLog || []).filter(x => x.ev === 'el-start' || x.ev === 'start').map(x => x.url)]);
const nf = [mn[pk]].flat(), of = [mo[pk]].flat();
ok(played.length > 0 && played.every(f => nf.includes(f)) && !played.some(f => of.includes(f)), `播 ${pk}：放的是新文件 ${[...new Set(played)].join(',')}（旧 ${of.join(',')}）`);
// ---- 断网：新录音全部能取到，旧录音取不到
await ctx.setOffline(true); await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=pin-ok], [data-testid=levels]', { timeout: 15000 }); await w(500);
const off = await pg.evaluate(async ([fs, gs]) => { const get = async f => { try { const r = await fetch('voice/' + f); return r.ok; } catch { return false; } };
  let okN = 0; for (const f of fs) if (await get(f)) okN++; let oldN = 0; for (const f of gs.slice(0, 20)) if (await get(f)) oldN++; return { okN, oldN }; }, [fn, gone]);
ok(off.okN === fn.length, `断网：新录音 ${off.okN}/${fn.length} 能取到`);
ok(off.oldN === 0, `断网：旧录音（抽 ${Math.min(20, gone.length)} 个）都不在缓存里（取到 ${off.oldN}）`);
const newLabel = await pg.evaluate(() => document.body.innerText.match(/r1[\d.]+ · 题库v\d+ · \w+/)?.[0] ?? '');
console.log(`版本标签：${oldLabel || '?'} → ${newLabel || '?'}`);
await pg.screenshot({ path: OUT + 'after-update.png' });
console.log(bad ? `r1544-voice-update FAIL ${bad}` : 'r1544-voice-update ALL PASS'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
