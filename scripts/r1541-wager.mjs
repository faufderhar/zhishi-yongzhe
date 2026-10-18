// r15.4.1 学霸（第三次）：高一押注说明每档案只显示 3 次——全新高一档案，只用点屏（touch tap）作答，不用 __zyAnswer / 不改状态；
// 连打第 1、2 关（中间不刷新），再刷新页面打第 1 关：押注说明（确定 / 不太确定下面的小字 +「不再提示」）和 💡 押注气泡一共各自出现次数。
// 只为读出哪个选项是对的、全解锁第 2 关而开 __zyTest / __zyUnlockAll（测试构建）。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4302/'; const OUT = process.env.OUT || '/workspace/playtest/r1541-wager/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
await pg.addInitScript(() => { window.__zyTest = true; window.__zyUnlockAll = true; });
const w = ms => pg.waitForTimeout(ms);
const tap = async sel => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const bb = await l.boundingBox(); if (!bb) return false; await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
const vis = sel => pg.isVisible(sel);
const pinIn = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(300); };
async function toMap() {
  for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')); i++) {
    if (await vis('[data-testid=pin-ok]')) await pinIn('2468');
    else if (await vis('[data-testid=pin-reset-full-ok]')) await tap('[data-testid=pin-reset-full-ok]');
    else if (await vis('[data-testid=stage-pick]')) await tap('[data-testid=stage-pick] .stage-btn.on');
    else if (await vis('[data-testid=grade-pick]')) await tap('[data-testid=grade-pick] .stage-btn.on');
    else if (await vis('[data-testid=char-confirm]')) { await tap('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await tap('[data-testid=char-confirm]'); }
    else if (await vis('text=r9')) await tap('text=r9');
    await w(500);
  }
}
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
await tap('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await tap('.pinpad input[type=radio]').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await tap('[data-testid=hint-ok]'); await w(500); if (await vis('[data-testid=rec-done]')) await tap('[data-testid=rec-done]'); await w(300);
await pg.fill('[data-testid=add-name]', 'r9'); await tap('[data-testid=home-grade-10]'); await w(400);
await toMap();
let detailTot = 0, bubbleTot = 0, wagerTot = 0; const per = [];
async function play(lv, tag) {
  await tap(`[data-testid=level-${lv}]`); await w(1200);
  let wagers = 0, details = 0, bubbles = 0, qn = 0; const seenB = new Set();
  for (let step = 0; step < 200; step++) {
    if (await vis('[data-testid=result-title], [data-testid=result-stats]')) break;
    for (const t of await pg.$$eval('.first-tip', es => es.map(e => e.getAttribute('data-testid')))) if (/wager/.test(t) && !seenB.has(t + step)) { seenB.add(t + step); }
    if (await vis('[data-testid=tutorial-skip]')) { await tap('[data-testid=tutorial-skip]'); await w(400); continue; }
    if (await vis('[data-testid=tutorial-next]')) { await tap('[data-testid=tutorial-next]'); await w(300); continue; }
    if (await vis('[data-testid=wager-sure]')) {
      wagers++; const d = await vis('[data-testid=wager-hint-off]'); if (d) details++;
      const bt = await pg.$$eval('.first-tip', es => es.map(e => e.getAttribute('data-testid'))); if (bt.some(t => /wager/.test(t))) bubbles++;
      if (wagers <= 5 || d) await pg.screenshot({ path: `${OUT}${tag}-wager${wagers}.png` });
      await tap(wagers % 2 ? '[data-testid=wager-sure]' : '[data-testid=wager-unsure]'); await w(350); continue; }
    if (await vis('[data-testid=card-std]')) { await tap('[data-testid=card-std]'); await w(300); continue; }
    if (await vis('[data-testid=chal-normal]')) { await tap('[data-testid=chal-normal]'); await w(300); continue; }
    if (await vis('.quiz .opt')) { qn++; const want = qn % 3 === 0 ? '0' : '1'; const r = await pg.$(`.quiz .opt[data-correct="${want}"]`) ? `.quiz .opt[data-correct="${want}"]` : '.quiz .opt'; await tap(r); /* 每 3 题答错 1 题，回合多一些 */ await w(150); if (await vis('[data-testid=ok]')) await tap('[data-testid=ok]'); await w(400); continue; }
    if (await vis('.keypad')) { qn++; const a = qn % 3 === 0 ? '9999' : await pg.$eval('.qtext', e => e.getAttribute('data-ans') || '1').catch(() => '1'); for (const ch of a) await tap(`.keypad [data-key="${ch}"]`); await tap('[data-testid=ok]'); await w(400); continue; }
    if (await vis('[data-testid=next]')) { await tap('[data-testid=next]'); await w(300); continue; }
    if (await vis('[data-testid=revive-no]')) { await tap('[data-testid=revive-no]'); await w(300); continue; }
    await w(400);
  }
  per.push(`${tag}：押注 ${wagers} 次，说明小字 ${details} 次，💡押注气泡 ${bubbles} 次`); detailTot += details; bubbleTot += bubbles; wagerTot += wagers;
  await pg.screenshot({ path: `${OUT}${tag}-end.png` });
  if (await vis('[data-testid=result-map]')) await tap('[data-testid=result-map]'); else await tap('[data-testid=to-map]'); await w(800);
}
await play(1, 'L1'); await toMap(); await play(2, 'L2');
const tips1 = await pg.evaluate(() => new Promise(r => { const q = indexedDB.open('zhishi-yongzhe'); q.onsuccess = () => r([...q.result.objectStoreNames]); q.onerror = () => r(null); }));
await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=pin-ok], [data-testid=levels]'); await w(600); await toMap(); await play(1, 'L1-reload');
console.log(per.join('\n'));
ok(wagerTot >= 6, `一共押注 ${wagerTot} 次（够判断）`);
ok(detailTot === 3, `押注说明小字一共出现 ${detailTot} 次（应为 3）`);
ok(bubbleTot <= 2, `💡押注气泡一共 ${bubbleTot} 次（我方 / 对方各最多 1 次）`);
console.log(bad ? `r1541-wager FAIL ${bad}` : 'r1541-wager ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
