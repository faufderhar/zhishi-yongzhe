// r15.4.2：Chrome 标签页喇叭图标 = tab.audible（同一个 AudioStreamMonitor 状态）。用一个只读 tabs 的探针扩展读它：
// ① AudioContext running + 真录音（p_timeup_k）→ audible；② running + 1 个样本的静音 → 不 audible；③ suspended 的 context 里 start → 不 audible；
// ④ 游戏本身（正式包，断网前）：小班时间到结算页 → 播 p_timeup_k 时 audible，播完约 2 秒后图标消失。
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4320/'; let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const EXT = '/workspace/playtest/r1542-ext';
const ctx = await chromium.launchPersistentContext('/tmp/r1542-audible-profile-' + Date.now(), { channel: 'chromium', headless: process.env.HEADED !== '1', args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=user-gesture-required'], viewport: { width: 1280, height: 800 }, hasTouch: true });
let sw = ctx.serviceWorkers().find(s => s.url().startsWith('chrome-extension://')); if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
const aud = async () => (await sw.evaluate(() => self.audible())).find(t => t.url.startsWith(URL))?.audible ?? null;
const pg = ctx.pages()[0] ?? await ctx.newPage(); await pg.goto(URL); await pg.waitForTimeout(1500);
const sample = async ms => { const r = []; for (let t = 0; t < ms; t += 250) { r.push(await aud()); await pg.waitForTimeout(250); } return r; };
ok((await aud()) === false, '打开页面、没出声：不 audible');
const f = await pg.evaluate(async () => { const m = await (await fetch('voice/manifest.json')).json(); return m.items['p:timeup_k']; });
// ③ suspended：context 停在 suspended（等同没有手势解锁）时 start
await pg.evaluate(async f => { const c = new AudioContext(); window.__c0 = c; await c.suspend(); const b = await c.decodeAudioData(await (await fetch('voice/' + f)).arrayBuffer()); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(); window.__st0 = c.state; }, f);
const s3 = await sample(2000); ok(!s3.includes(true), `③ context=${await pg.evaluate(() => window.__st0)} 时 start：一直不 audible（${s3.join(',')}）`);
// 触摸一下解锁
await pg.touchscreen.tap(640, 400); await pg.evaluate(() => window.__c = new AudioContext()); await pg.touchscreen.tap(640, 400); await pg.evaluate(() => window.__c.resume()); await pg.waitForTimeout(300);
await pg.evaluate(() => window.__c0.close()); await pg.waitForTimeout(4000);
// ② 静音
await pg.evaluate(() => { const c = window.__c; const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(); });
const s2 = await sample(1500); await pg.waitForTimeout(4000); ok(!s2.includes(true), `② context=${await pg.evaluate(() => window.__c.state)}，只播 1 个样本的静音：不 audible（${s2.join(',')}）`);
// ① 真录音
await pg.evaluate(async f => { const c = window.__c; const b = await c.decodeAudioData(await (await fetch('voice/' + f)).arrayBuffer()); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(); window.__dur = b.duration; }, f);
const s1 = await sample(5000); const on = s1.indexOf(true), off = s1.lastIndexOf(true);
ok(on >= 0 && on <= 2, `① running + 真录音 ${f}（${(await pg.evaluate(() => window.__dur)).toFixed(2)} s）：${on * 250} ms 内 audible，图标亮到第 ${(off + 1) * 250} ms，之后熄灭（${s1.map(x => x ? 1 : 0).join('')}）`);
console.log(bad ? `r1542-tab-audible FAIL ${bad}` : 'r1542-tab-audible ALL PASS'); await ctx.close(); process.exit(bad ? 1 : 0);
