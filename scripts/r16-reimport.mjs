// r16 技术QA P4-I5 评估：内置题导出（JSON / CSV）原样导回——不变成「导入题」（清除已导入计数不涨）、提示「和内置题一样」；改一题再导 → 只存这一题（带 base_rev）
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const D = '/workspace/playtest/r16dev/reimport/'; mkdirSync(D, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true }); const pg = await ctx.newPage(); pg.setDefaultTimeout(20000);
await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; });
const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false); const txt = s => pg.textContent(s).catch(() => null);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x'); await pg.click('[data-testid=hint-ok]');
await pg.waitForSelector('[data-testid=rec-code]').then(() => pg.click('[data-testid=rec-done]')); await pg.waitForSelector('[data-testid=pin-verify]').then(() => pinIn('2468'));
if (await vis('.modal >> text=稍后')) await pg.click('.modal >> text=稍后');
await pg.click('[data-testid=ptab-bank]'); await pg.waitForSelector('[data-testid=bank-table]');
const cleared = async () => Number(((await txt('text=/清除已导入（\\d+）/')) || '').match(/（(\d+)）/)?.[1]);
const exp = async (row, fmt) => { const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click(`[data-testid=bank-table] tbody tr:nth-child(${row}) >> text=${fmt}`)]); const p = D + dl.suggestedFilename(); await dl.saveAs(p); return p; };
const imp = async p => { await pg.setInputFiles('[data-testid=import-file]', p); await pg.waitForSelector('[data-testid=import-preview], [data-testid=import-msg]'); if (await vis('[data-testid=import-confirm]')) { await pg.click('[data-testid=import-confirm]'); await pg.waitForSelector('[data-testid=import-msg]'); } await w(600); return txt('[data-testid=import-msg]'); };
const rows = await pg.$$eval('[data-testid=bank-table] tbody tr', t => t.map(r => r.cells[0].textContent));
const res = [];
for (const [g, fmt] of [['一年级', 'JSON'], ['高一', 'JSON'], ['高一', 'CSV'], ['幼儿园中班', 'JSON']]) { const p = await exp(rows.indexOf(g) + 1, fmt); const m = await imp(p); const n = await cleared(); res.push({ g, fmt, m, n }); }
for (const r of res) ok(r.n === 0 && /和内置题一样，不另存/.test(r.m ?? ''), `${r.g} ${r.fmt} 原样导回：清除已导入（${r.n}）· ${r.m}`);
const p = res.length && D + '题库导出_高一.json'; const j = JSON.parse(readFileSync(p, 'utf8')); j.questions[0].question += '（家长改过）'; writeFileSync(D + 'edited.json', JSON.stringify(j));
const m2 = await imp(D + 'edited.json'); const n2 = await cleared(); ok(n2 === 1 && /已导入 1 题/.test(m2 ?? ''), `改 1 题再导：只存 1 题 · ${m2}`);
const st = await pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const db = r.result; const t = db.transaction('bank').objectStore('bank').getAll(); t.onsuccess = () => res(t.result.map(x => ({ key: x.key, base_rev: x.base_rev }))); }; }));
ok(st.length === 1 && !!st[0].base_rev, `存下的那题带 base_rev ${JSON.stringify(st)}`);
await b.close(); console.log(bad ? `FAILED ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
