import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4320/'; const OUT = '/workspace/playtest/r1542-wager-repro/';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1024, height: 500 } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s); const cl = s => pg.click(s).catch(e => console.log('click fail', s));
const pinIn = async p => { for (const d of p) await cl(`[data-testid=pin-${d}]`); await cl('[data-testid=pin-ok]'); await w(300); };
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
await cl('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await cl('[data-testid=hint-ok]'); await w(500); if (await vis('[data-testid=rec-done]')) await cl('[data-testid=rec-done]'); await w(300);
await pg.fill('[data-testid=add-name]', 'xb'); await cl('[data-testid=home-grade-10]'); await w(400);
for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')); i++) { if (await vis('[data-testid=pin-ok]')) await pinIn('2468'); else if (await vis('[data-testid=stage-pick]')) await cl('[data-testid=stage-pick] .stage-btn.on'); else if (await vis('[data-testid=grade-pick]')) await cl('[data-testid=grade-pick] .stage-btn.on'); else if (await vis('[data-testid=char-confirm]')) { await cl('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await cl('[data-testid=char-confirm]'); } else if (await vis('text=xb')) await cl('text=xb'); await w(500); }
console.log('tips before', await pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('profiles'); g.onsuccess = () => res(JSON.stringify(g.result.map(p => [p.name, p.grade, p.tips]))); }; })));
await cl('[data-testid=level-1]'); await w(1500);
for (let i = 0; i < 40; i++) { if (await vis('[data-testid=wager]')) break; if (await vis('[data-testid=tutorial-next]')) { await cl('[data-testid=tutorial-next]'); await w(300); continue; } if (await vis('[data-testid=card-std]')) { await cl('[data-testid=card-std]'); await w(300); continue; } await w(500); }
console.log('wager html:', (await pg.innerHTML('[data-testid=wager]').catch(() => 'none')).slice(0, 600));
await pg.screenshot({ path: OUT + 'r1.png' });
console.log('tips after', await pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('profiles'); g.onsuccess = () => res(JSON.stringify(g.result.map(p => [p.name, p.tips]))); }; })));
await b.close();
