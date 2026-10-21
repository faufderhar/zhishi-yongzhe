// r17 总管上线条件：小班期末庆祝乐句离线也能放——孩子第一次玩期末关就是断网的，也要有音乐。
// 联网装好 SW（测试构建 dist-test），从没放过这段乐句；把运行时缓存 zy-sfx-term 删掉（证明不是靠「听过一次」或离线预下载），断网：
// ① 预缓存（workbox-precache）里有 sfx/sfx_k_term_celebrate.mp3，没有 _alt；② 页面 fetch 这个文件 = 200、字节数对、能解码；_alt 断网取不到；
// ③ 断网玩一遍上学期期末关到奖章：庆祝乐句走的是文件（__zySfxStats 记 term=…），没有页面错误。
// 用法：URL=http://localhost:4471/ [OUT=…] node scripts/r17-term-offline.mjs
import { chromium } from 'playwright';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/term-offline/'; mkdirSync(OUT, { recursive: true });
const SFX = 'sfx/sfx_k_term_celebrate.mp3', ALT = 'sfx/sfx_k_term_celebrate_alt.mp3', SIZE = statSync('public/' + SFX).size;
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1280, height: 600 } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.addInitScript(() => { window.__zyTest = true; window.__zyUnlockAll = true; window.__zyTestSpentSec = -1e7; window.__zyTestNoTts = true; });
const w = ms => pg.waitForTimeout(ms);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
const toMap = async () => { for (let i = 0; i < 30 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468');
  if (await pg.isVisible('text=off1') && !(await pg.isVisible('[data-testid=levels]'))) await pg.click('text=off1').catch(() => {});
  for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.locator(`[data-testid=${sp}] .stage-btn.on`).first().click().catch(() => {});
  if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]) >> nth=0'); await w(200); await pg.click('[data-testid=char-confirm]'); }
  if (await pg.isVisible('.modal >> text=稍后')) await pg.click('.modal >> text=稍后'); await w(400); } };
// ---- 联网：装 SW、建小班档案
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]');
await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]');
await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {});
await pg.fill('[data-testid=add-name]', 'off1'); await pg.click('[data-testid=home-grade-K1]'); await w(400);
await pg.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 }).catch(() => {});
ok(await pg.evaluate(() => !!navigator.serviceWorker?.controller), 'SW 已接管页面');
// 后台小班录音下完（离线时开场白 / 奖章语也有录音），最多 150 s
let vs = null; for (let i = 0; i < 150; i++) { vs = await pg.evaluate(() => JSON.parse(localStorage.getItem('zy-offline-voice') || 'null')); if (vs && vs.state === 'done') break; await w(1000); }
ok(!!vs && vs.state === 'done' && vs.failed === 0, `后台录音下完 ${JSON.stringify(vs)}`);
await w(9000);   // 让 8 s 后的离线预下载（cacheForOffline，含 zy-sfx-term）也跑完——下面再把它删掉
const pre = await pg.evaluate(async ([s, a]) => { const names = await caches.keys(); const out = { names, precache: null, alt: [], term: [] };
  for (const n of names) { const keys = (await (await caches.open(n)).keys()).map(r => r.url); if (/precache/.test(n)) out.precache = keys.filter(u => u.includes(s)); out.alt.push(...keys.filter(u => u.includes(a))); if (n === 'zy-sfx-term') out.term = keys; }
  return out; }, [SFX, ALT]);
ok(pre.precache?.length === 1, `预缓存里有庆祝乐句：${JSON.stringify(pre.precache)}`);
ok(pre.alt.length === 0, `_alt 不在任何缓存里 ${JSON.stringify(pre.alt)}`);
const del = await pg.evaluate(() => caches.delete('zy-sfx-term'));
ok(!(await pg.evaluate(() => caches.keys())).includes('zy-sfx-term'), `删掉运行时缓存 zy-sfx-term（原有 ${pre.term.length} 条，删除 ${del}）——只剩预缓存`);
const played0 = await pg.evaluate(() => (window.__zySfxStats?.paths ?? []).filter(p => p.startsWith('term=')).length);
ok(played0 === 0, '断网前从没放过庆祝乐句');
// ---- 断网
await ctx.setOffline(true); await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=pin-ok], [data-testid=levels]', { timeout: 15000 }); await w(500);
ok(await pg.evaluate(() => !navigator.onLine && !!navigator.serviceWorker?.controller), '已断网，页面由 SW 提供');
const f = await pg.evaluate(async ([s, a]) => { const r = await fetch(s).catch(e => ({ ok: false, status: String(e) })); let n = 0, dec = false; if (r.ok) { const buf = await r.arrayBuffer(); n = buf.byteLength; try { const c = new AudioContext(); const ab = await c.decodeAudioData(buf); dec = ab.duration > 3 && ab.duration < 6; } catch { dec = false; } }
  const r2 = await fetch(a).then(x => x.status, e => 'error:' + String(e).slice(0, 40)); return { status: r.status, n, dec, alt: r2 }; }, [SFX, ALT]);
ok(f.status === 200 && f.n === SIZE && f.dec, `断网 fetch ${SFX} → ${f.status}，${f.n} 字节（文件 ${SIZE}），能解码 4 s 左右 ${f.dec}`);
ok(f.alt !== 200, `断网取 _alt → ${f.alt}（没接、没缓存）`);
// ---- 断网玩上学期期末关到奖章
await toMap(); await pg.click('[data-testid="chapter-数数"]'); await w(300);
await pg.click('[data-testid=term-node-1]'); await w(400);
for (let i = 0; i < 10; i++) { const x = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!x) break; await x.click().catch(() => {}); await w(300); }
await pg.waitForSelector('[data-testid=term-mon]', { timeout: 10000 });
for (let k = 0; k < 40 && !(await pg.$('[data-testid=term-medal]')); k++) { const c = await pg.$('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])'); if (c) { await c.click(); await w(700); } else await w(300); }
await pg.waitForSelector('[data-testid=term-medal]', { timeout: 20000 }).catch(() => {});
ok(!!(await pg.$('[data-testid=term-medal]')), '断网：上学期期末关打到奖章');
let st = null; for (let i = 0; i < 40; i++) { st = await pg.evaluate(() => window.__zySfxStats); if (st?.paths?.some(p => p.startsWith('term='))) break; await w(100); }
ok(!!st?.paths?.includes('term=sfx_k_term_celebrate.mp3') && st.last === 'sfx_k_term_celebrate.mp3', `断网：庆祝乐句放的是文件（不是合成音兜底）${JSON.stringify(st?.paths?.filter(p => p.startsWith('term=')))}`);
await pg.screenshot({ path: OUT + 'offline_term1_medal.png' });
await pg.waitForSelector('[data-testid=result-actions]', { timeout: 20000 }).catch(() => {});
ok(await pg.isVisible('[data-testid=result-term-medal]'), '断网：结算页有奖章');
await pg.screenshot({ path: OUT + 'offline_term1_result.png' });
const post = await pg.evaluate(async s => { const names = await caches.keys(); return { term: names.includes('zy-sfx-term') ? (await (await caches.open('zy-sfx-term')).keys()).map(r => r.url) : null, online: navigator.onLine }; }, SFX);
ok(!errs.length, `没有页面错误 ${JSON.stringify(errs)}`);
writeFileSync(OUT + 'report.json', JSON.stringify({ pre, fetch: f, stats: st, post }, null, 1));
await b.close(); console.log(bad ? `FAILED ${bad}` : 'r17-term-offline ALL PASS'); process.exit(bad ? 1 : 0);
