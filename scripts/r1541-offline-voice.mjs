// r15.4.1 技术QA P2-1：小班录音离线可播。没有 speechSynthesis（华为浏览器）：
// ① 第一次联网打开、建小班档案后，后台把 manifest 里全部录音放进 zy-voice（家长页显示进度）；首屏不等它。
// ② 断网（context.setOffline）后重开：manifest 里每个录音文件都能从缓存取到（200）；打小班第 1 关全程有录音、不出「不能朗读」。
// ③ ZIP=1：用离线包解压出来的 dist 起本地服务，屏蔽所有外网请求，录音文件都在、能播。
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4305/'; const OUT = process.env.OUT || '/workspace/playtest/r1541-offline/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] }); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const man = JSON.parse(readFileSync(new globalThis.URL('../public/voice/manifest.json', import.meta.url)));
const files = [...new Set(Object.values(man.items).flatMap(v => Array.isArray(v) ? v : [v]).filter(f => /\.(mp3|m4a)$/.test(f)))];
const TEST = process.env.PROD !== '1';   // 测试构建才有 __zyRecLog / data-correct
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
if (process.env.ZIP === '1') { const host = new globalThis.URL(URL).host; await ctx.route('**/*', r => new globalThis.URL(r.request().url()).host === host ? r.continue() : r.abort()); }
const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
await pg.addInitScript(t => { if (t) { window.__zyTest = true; window.__zyUnlockAll = true; } window.__ttsIssues = []; addEventListener('zy-tts-issue', e => window.__ttsIssues.push(e.detail));
  try { delete window.speechSynthesis; delete Window.prototype.speechSynthesis; } catch { /* */ } Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); window.SpeechSynthesisUtterance = undefined; }, TEST);
const w = ms => pg.waitForTimeout(ms);
const tap = async sel => { const l = pg.locator(sel).first(); const bb = await l.boundingBox(); if (!bb) return false; await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
const pinIn = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(300); };
async function toMap() { for (let i = 0; i < 30 && !(await pg.isVisible('[data-testid=level-1]')); i++) {
  if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); else if (await pg.isVisible('[data-testid=stage-pick]')) await tap('[data-testid=stage-pick] .stage-btn.on'); else if (await pg.isVisible('[data-testid=grade-pick]')) await tap('[data-testid=grade-pick] .stage-btn.on');
  else if (await pg.isVisible('[data-testid=char-confirm]')) { await tap('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await tap('[data-testid=char-confirm]'); } else if (await pg.isVisible('text=r9')) await tap('text=r9'); await w(500); } }
const t0 = Date.now(); await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); const fp = Date.now() - t0;
ok(fp < 8000, `首屏 ${fp} ms 出现（不等录音下载）`);
await tap('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await tap('.pinpad input[type=radio]').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await tap('[data-testid=hint-ok]'); await w(500); if (await pg.isVisible('[data-testid=rec-done]')) await tap('[data-testid=rec-done]'); await w(300);
await pg.fill('[data-testid=add-name]', 'r9'); await tap('[data-testid=home-grade-K1]'); await w(400);
await pg.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 }).catch(() => {});
let st = null; for (let i = 0; i < 120; i++) { st = await pg.evaluate(() => JSON.parse(localStorage.getItem('zy-offline-voice') || 'null')); if (st && st.done >= st.total && st.total) break; await w(1000); }
ok(!!st && st.total === files.length && st.done === st.total && st.failed === 0, `后台下载小班录音：${JSON.stringify(st)}（manifest 文件 ${files.length} 个）`);
const n = await pg.evaluate(async () => (await (await caches.open('zy-voice')).keys()).length);
ok(n >= files.length, `zy-voice 缓存 ${n} 条 ≥ ${files.length}`);
ok(await pg.evaluate(() => !!navigator.serviceWorker?.controller), 'SW 已接管页面');
await ctx.setOffline(true); await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=pin-ok], [data-testid=levels]', { timeout: 15000 }); await w(800);
const got = await pg.evaluate(async fs => { let okN = 0; const bad = []; for (const f of fs) { try { const r = await fetch('voice/' + f); if (r.ok) okN++; else bad.push(f + ':' + r.status); } catch { bad.push(f + ':err'); } } return { okN, bad: bad.slice(0, 5) }; }, files);
ok(got.okN === files.length, `断网后 manifest 里每个录音都能取到：${got.okN}/${files.length}${got.bad.length ? ' 缺 ' + got.bad.join(',') : ''}`);
await toMap(); await tap('[data-testid=level-1]'); await w(1500);
for (let i = 0; i < 10; i++) { if (await pg.isVisible('[data-testid=tutorial-skip]')) { await tap('[data-testid=tutorial-skip]'); await w(400); } else break; }
let answered = 0;
for (let step = 0; step < 40; step++) {
  if (await pg.isVisible('[data-testid=kinder-sub], [data-testid=result-stats]')) break;
  if (await pg.isVisible('.kopt')) { await w(3000); if (await pg.isVisible('[data-testid=speak]')) { await tap('[data-testid=speak]'); await w(2500); }
    if (!(await pg.waitForSelector('.kopt:not([disabled])', { timeout: 15000 }).catch(() => null))) continue;   // 读题时选项先锁住
    const sel = TEST && await pg.$('.kopt[data-correct="1"]:not([disabled])') ? '.kopt[data-correct="1"]:not([disabled])' : '.kopt:not([disabled])'; if (await tap(sel).catch(() => false)) answered++; await w(2500); continue; }
  await w(500);
}
await pg.screenshot({ path: OUT + 'offline-k1-level1.png' });
if (TEST) { const log = await pg.evaluate(() => (window.__zyRecLog || []).map(x => x.url.split('/').pop())); const miss = await pg.evaluate(() => window.__zyMissLog || []);
  ok(log.length >= 6, `断网打小班第 1 关：放了 ${log.length} 段录音（答了 ${answered} 题）`); ok(!miss.length, `没有缺录音的句子（${JSON.stringify(miss.slice(0, 5))}）`); }
const iss = await pg.evaluate(() => window.__ttsIssues); ok(!iss.includes('unavailable'), `断网全程没有「不能朗读」（${JSON.stringify(iss)}）`);
console.log(bad ? `r1541-offline-voice FAIL ${bad}` : 'r1541-offline-voice ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
