// r15.4：没有 speechSynthesis 的安卓浏览器（模拟华为浏览器）——只用触摸（touchscreen.tap，不产生鼠标事件）解锁音效；
// 朗读走录音退路，manifest 为空 → 显示「这台平板暂时不能朗读」，且音效仍能用（AudioContext running）。
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4194/';
const UA = 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; BTK-W00; HMSCore 6.14.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/15.0.4.312 Safari/537.36';
const b = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] }); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1400, height: 792 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
const pg = await ctx.newPage();
await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestTtsDetect = true; try { delete window.speechSynthesis; delete Window.prototype.speechSynthesis; } catch { /* */ } Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); window.SpeechSynthesisUtterance = undefined; });
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await pg.waitForTimeout(500);
ok(await pg.evaluate(() => !window.speechSynthesis), '页面里没有 speechSynthesis');
const s0 = await pg.evaluate(() => window.__zyAudio());
ok(s0.ctx !== 'running', `点屏前音效未解锁（ctx=${s0.ctx}）`);
await pg.touchscreen.tap(700, 60); await pg.waitForTimeout(400);
const s1 = await pg.evaluate(() => window.__zyAudio());
ok(s1.ctx === 'running', `只用触摸点一下 → AudioContext running（ctx=${s1.ctx}，tts=${s1.tts}）`);
ok(s1.tts === 'none', `朗读检测为 none（${s1.tts}）`);
const hasSpeak = await pg.evaluate(() => typeof window.__zySpeak === 'function'); ok(hasSpeak, '测试构建有 __zySpeak');
if (hasSpeak) { await pg.evaluate(() => window.__zySpeak('测试', 'zh-CN', { keys: ['nope#stem'] })); await pg.waitForTimeout(600); ok(await pg.isVisible('[data-testid=tts-issue]'), '朗读不可用 → 显示提示'); const t = await pg.textContent('[data-testid=tts-issue]').catch(() => ''); ok(/这台平板暂时不能朗读/.test(t), `提示文字：${t}`); }
const m = await pg.evaluate(() => fetch('voice/manifest.json').then(r => r.status).catch(() => 0));
ok(m === 200, `voice/manifest.json 可取到（${m}），空清单不影响`);
console.log(bad ? `r154-nosynth FAIL ${bad}` : 'r154-nosynth ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
