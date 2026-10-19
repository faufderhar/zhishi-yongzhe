// r15.4：小班录音包——没有 speechSynthesis（华为浏览器）时点 🔊：先放录音题干再放各选项（来自 voice/，停顿 200 / 100 ms），不出「不能朗读」；
// 录音不发 Range 请求（整段 200 → 进 SW 缓存 zy-voice）；没录音的题（三年级）仍提示「这台平板暂时不能朗读」。
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4194/'; const OUT = process.env.OUT || '/workspace/playtest/shots_android_r154/'; mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; BTK-W00; HMSCore 6.14.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/15.0.4.312 Safari/537.36';
const b = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] }); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const man = JSON.parse(readFileSync(new globalThis.URL('../public/voice/manifest.json', import.meta.url)));
async function session([name, W, H, dpr, z], grade, FQ) {
  const ctx = await b.newContext({ viewport: { width: Math.round(W / z), height: Math.round(H / z) }, deviceScaleFactor: dpr * z, isMobile: true, hasTouch: true, userAgent: UA });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addInitScript(FQ => { window.__zyTest = true; window.__zyTestTtsDetect = true; window.__zyUnlockAll = true; if (FQ) window.__zyForceQ = FQ; window.__ttsIssues = []; addEventListener('zy-tts-issue', e => window.__ttsIssues.push({ k: e.detail, t: performance.now() })); try { delete window.speechSynthesis; delete Window.prototype.speechSynthesis; } catch { /* */ } Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); window.SpeechSynthesisUtterance = undefined; }, FQ);
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400);
  await pg.click('text=r9'); await w(500); if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468');
  for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on, [data-testid=${sp}] .stage-btn >> nth=0`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('.char-card >> nth=0'); await w(200); await pg.click('[data-testid=char-confirm]'); } if (await pg.isVisible('.modal >> text=稍后')) await pg.click('.modal >> text=稍后'); await w(400); }
  if (!(await pg.isVisible('[data-testid=level-1]'))) { await pg.screenshot({ path: `${OUT}fail-setup-${grade}.png` }); console.log('  setup: ' + (await pg.evaluate(() => document.body.innerText.slice(0, 200))).replace(/\n/g, ' ')); }
  return { ctx, pg, w };
}
const skipTut = async (pg, w) => { for (let i = 0; i < 10; i++) { const s = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!s) break; await s.click().catch(() => {}); await w(300); } };

const QID = process.env.QID || 'K-004';
const { ctx, pg, w } = await session(['1400x792-浏览器', 1400, 792, 2, 1], 'K1', QID);
const reqs = []; pg.on('request', r => { if (/\/voice\/.+\.mp3/.test(r.url())) reqs.push({ url: r.url(), range: r.headers()['range'] || '' }); });
ok(await pg.evaluate(() => !window.speechSynthesis), '页面里没有 speechSynthesis');
await pg.tap('[data-testid=level-1]'); await w(1500); await skipTut(pg, w);
await pg.waitForSelector('[data-testid=speak]', { timeout: 10000 }).catch(() => {});
const a0 = await pg.evaluate(() => window.__zyAudio());
ok(a0.ctx === 'running' && a0.tts === 'none', `只用触摸进关：AudioContext ${a0.ctx}，朗读 ${a0.tts}`);
await w(5000); await pg.evaluate(() => { window.__zyRecLog.length = 0; });
const qid = await pg.evaluate(() => document.querySelector('[data-testid=kopts] .kopt') ? 1 : 0);
await pg.tap('[data-testid=speak]'); await w(7000);
const log = await pg.evaluate(() => window.__zyRecLog.map(x => ({ ...x })));
const exp = [QID + '#stem', ...[0, 1, 2, 3].map(i => `${QID}#opt${i}`)].filter(k => man.items[k]);
const shown = await pg.$$eval('[data-testid=kopts] .kopt', es => es.length);
ok(log.length >= 2 && log.length === Math.min(exp.length, 1 + shown), `点 🔊 播了 ${log.length} 段录音（期望 ${Math.min(exp.length, 1 + shown)}：题干 + ${shown} 个选项）`);
ok(log.every(x => /\/voice\/[^/]+\.mp3$/.test(x.url)), '都来自 voice/：' + log.map(x => x.url.split('/').pop()).join(', '));
ok(log[0] && log[0].url.includes(man.items[QID + '#stem']), `第一段是题干 ${man.items[QID + '#stem']}`);
const gaps = log.slice(1).map((x, i) => Math.round(x.t - log[i].t - log[i].dur * 1000));
ok(gaps.length && gaps[0] >= 185 && gaps[0] <= 290, `题干 → 选项停顿 ${gaps[0]} ms（规格 200）`);
ok(gaps.slice(1).every(g => g >= 90 && g <= 190), `选项之间停顿 ${gaps.slice(1).join(' / ')} ms（规格 100）`);
const iss = await pg.evaluate(() => window.__ttsIssues); console.log('  本局朗读问题事件：' + JSON.stringify(iss) + '；没录音的文字：' + JSON.stringify(await pg.evaluate(() => window.__zyMissLog || [])));
ok(!(await pg.isVisible('[data-testid=tts-issue]')), '有录音：点 🔊 后不出「不能朗读」提示');
ok(reqs.length > 0 && reqs.every(r => !r.range), `录音请求不带 Range（${reqs.length} 个）`);
const cached = await pg.evaluate(async () => { try { const c = await caches.open('zy-voice'); return (await c.keys()).length; } catch { return -1; } });
const swOn = await pg.evaluate(() => !!navigator.serviceWorker?.controller);
console.log(`  SW 控制页面：${swOn}，zy-voice 缓存条目：${cached}`);
if (swOn) ok(cached > 0, `录音进了运行时缓存 zy-voice（${cached} 条）`);
await pg.screenshot({ path: OUT + 'voice-k1-speaker.png' });
/* r15.4：从选角色到打完一关（含答错再试、自动给答案、答对夸奖 + 技能 + 开心值、结算），再打一个温和关（怪兽回家）：全程不该有「不能朗读」 */
async function playLevel(pg, w, tag) {
  for (let step = 0; step < 60; step++) {
    if (await pg.isVisible('[data-testid=kinder-sub]')) { await w(2500); return true; }
    const opts = await pg.$$('[data-testid=kopts] .kopt:not([disabled])');
    if (!opts.length) { await w(400); continue; }
    const wrong = await pg.$('[data-testid=kopts] .kopt[data-correct="0"]:not([disabled])');
    const n = await pg.evaluate(() => window.__zyStepN = (window.__zyStepN || 0) + 1);
    if (wrong && n % 3 !== 0) await wrong.tap().catch(() => {}); else await (await pg.$('[data-testid=kopts] .kopt[data-correct="1"]'))?.tap().catch(() => {});
    await w(2600);
  }
  console.log('  ' + tag + '：60 步内没到结算'); return false;
}
ok(await playLevel(pg, w, '第 1 关'), '小班第 1 关打到结算（答错再试 / 自动给答案 / 答对都走过）');
await pg.tap('[data-testid=to-map]').catch(() => {}); await w(1500);
const gentleLv = await pg.$$eval('[data-testid^=level-]', es => { const e = es.find(x => /⚡|👑/.test(x.textContent || '')); return e ? e.getAttribute('data-testid') : null; });
ok(!!gentleLv, '地图上找到温和关（⚡/👑）：' + gentleLv);
if (gentleLv) { await pg.tap(`[data-testid="${gentleLv}"]`); await w(1500); await skipTut(pg, w); ok(await playLevel(pg, w, gentleLv), `温和关 ${gentleLv} 打到结算（怪兽变朋友回家）`); }
for (const t of ['还要先打赢前面的关，才能打开这一关哦', '真棒！开心值两个，一共3个。']) await pg.evaluate(t => window.__zySpeak(t), t);
await w(3000);
const pl = await pg.evaluate(() => [...new Set(window.__zyRecLog.map(x => x.url.split('/').pop().replace(/\.[0-9a-f]{10}\.mp3$/, '')))]);
console.log('  放过的录音（' + pl.length + '）：' + pl.filter(x => x.startsWith('p_')).join(' '));
ok(pl.some(x => /^p_(home|cloud_friend)/.test(x)) && pl.some(x => /^p_happy_/.test(x)) && pl.some(x => /^p_demo_/.test(x)), '放到了怪兽回家 / 开心值 / 自动给答案的录音');
const miss = await pg.evaluate(() => window.__zyMissLog || []), iss2 = await pg.evaluate(() => window.__ttsIssues);
ok(!miss.length && !iss2.length, `小班从选角色到打完两关：没有一句缺录音、没有「不能朗读」${miss.length ? '；缺：' + JSON.stringify([...new Set(miss)]) : ''}`);
await ctx.close();
{ const { ctx, pg, w } = await session(['1400x792-浏览器', 1400, 792, 2, 1], '3');
  await pg.tap('[data-testid=level-1]'); await w(1500); await skipTut(pg, w);
  await pg.evaluate(() => window.__zySpeak('三年级的题', 'zh-CN', { keys: ['M3-001#stem'] })); await w(800);
  console.log('  三年级：事件 ' + JSON.stringify(await pg.evaluate(() => window.__ttsIssues)) + ' 文字 ' + JSON.stringify(await pg.evaluate(() => window.__zyMissLog || [])));
  const ev = await pg.evaluate(() => window.__ttsIssues), miss = await pg.evaluate(() => window.__zyMissLog || []);
  ok(ev.some(e => e.k === 'unavailable') && miss.includes('三年级的题'), '没录音的题（三年级）：走「这台平板暂时不能朗读」（本次打开提示一次、6 秒收起）');
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('zy-tts-issue', { detail: 'unavailable' }))); await w(300);
  ok(/这台平板暂时不能朗读/.test(await pg.textContent('[data-testid=tts-issue]').catch(() => '')), '提示条文字「这台平板暂时不能朗读」'); await ctx.close(); }
console.log(bad ? `r154-voice FAIL ${bad}` : 'r154-voice ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
