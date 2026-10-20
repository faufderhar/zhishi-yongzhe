// r16.2 较真家长 文案（测试包）：加时取消后表格写时长、首页卡片 / 地图写「加时已取消」；名字 8 字计数 + 粘贴超长明说；家长页 F5 提示只说一遍
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/parentcopy/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const pg = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); pg.setDefaultTimeout(15000);
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; });
const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false); const txt = s => pg.textContent(s).catch(() => null);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x'); await pg.click('[data-testid=hint-ok]');
await pg.waitForSelector('[data-testid=rec-code]').then(() => pg.click('[data-testid=rec-done]')); await pg.waitForSelector('[data-testid=pin-verify]');
await pinIn('1111'); const e1 = await txt('[data-testid=pin-error]'); await pinIn('1111'); const e2 = await txt('[data-testid=pin-error]');
ok(/不一样/.test(e2 ?? '') && !/第 \d+ 次/.test((e1 ?? '') + (e2 ?? '')), `确认页输错两次：不数次数 → ${e2}`);
await pinIn('2468'); if (await vis('.modal >> text=稍后')) await pg.click('.modal >> text=稍后');
// 名字计数
await pg.click('[data-testid=ptab-profiles]'); await pg.click('[data-testid^=edit-]'); await pg.waitForSelector('[data-testid=profile-name]');
await pg.fill('[data-testid=profile-name]', ''); await pg.click('[data-testid=profile-name]'); await pg.keyboard.type('一二三四五六七八九十');
ok((await pg.inputValue('[data-testid=profile-name]')) === '一二三四五六七八' && /8\/8 字，名字最多 8 个字/.test(await txt('[data-testid=profile-name-count]') ?? ''), `打 10 个字 → 只留 8 个、写明：${await txt('[data-testid=profile-name-count]')}`);
await pg.fill('[data-testid=profile-name]', '小明');
await pg.$eval('[data-testid=profile-name]', el => { const dt = new DataTransfer(); dt.setData('text/plain', '一二三四五六七八九'); el.setSelectionRange(2, 2); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }); await w(200);
ok(/粘贴的名字太长/.test(await txt('[data-testid=profile-name-count]') ?? ''), `粘贴超长 → ${await txt('[data-testid=profile-name-count]')}`);
await pg.screenshot({ path: OUT + 'name-count.png' }); await pg.click('[data-testid=profile-editor] >> text=取消'); await w(300);
// 加时 → 取消
await pg.click('[data-testid=ptab-time]'); await w(300);
const pid = (await pg.getAttribute('[data-testid^=bonus-]:not([data-testid^=bonus-cancel])', 'data-testid')).slice(6);
await pg.click(`[data-testid=bonus-${pid}]`); await w(300); await pg.click(`[data-testid=bonus-cancel-${pid}]`); await pg.click('[data-testid=bonus-cancel-ok]'); await w(400);
const lt = await txt(`[data-testid=limit-today-${pid}]`); ok(!!lt && !/\d:\d\d/.test(lt), `今天上限写成时长：${lt}`);
await pg.screenshot({ path: OUT + 'time-cancelled.png' });
// F5 在家长页里
await pg.reload(); await pg.waitForSelector('[data-testid^=profile-]'); await w(800);
const note = await txt('[data-testid=exit-note]'); ok(!!note && (note.match(/重新加载/g) ?? []).length === 1, `家长页 F5 提示只说一遍：${note}`);
const card = await pg.textContent('.left-time'); ok(/加时已取消/.test(card ?? ''), `首页卡片：${card}`);
await pg.screenshot({ path: OUT + 'home-cancelled.png' });
await pg.click(`[data-testid=profile-${pid}]`); for (let i = 0; i < 25 && !(await vis('[data-testid=time-left]')); i++) { if (await vis('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await vis(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await vis('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } await w(300); }
const tl = await txt('[data-testid=time-left]'); ok(/加时已取消/.test(tl ?? ''), `地图：${tl}`); await pg.screenshot({ path: OUT + 'map-cancelled.png' });
ok(!errs.length, 'no pageerror ' + errs.join(' | '));
console.log(bad ? `r162-parentcopy FAIL ${bad}` : 'r162-parentcopy ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
