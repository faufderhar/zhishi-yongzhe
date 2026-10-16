// 学习报告计数核对：打完一关 + 答 1 题退出，报告应 = 实际答题数。URL=... OUT=... node scripts/r3-report-check.mjs
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4180/'; const OUT = process.env.OUT || 'screenshots/r3/';
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const pg = await (await b.newContext({ viewport: { width: 1180, height: 820 } })).newPage(); const errs = [];
pg.on('pageerror', e => errs.push(String(e))); await pg.addInitScript(() => { window.__zyTest = true; });
const w = ms => pg.waitForTimeout(ms);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
await pg.goto(URL); await pg.waitForSelector('[data-testid=add-child]', { timeout: 30000 }); await w(600);
await pg.click('[data-testid=add-child]'); await w(300);
await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
await pg.fill('[data-testid=add-name]', '报告测试'); await pg.click('[data-testid=home-grade-7]'); await w(500);
await pg.click('text=报告测试'); await w(1200); await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600);
let answered = 0, right = 0;
async function one(correct) {
  await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 10000 });
  const o = await pg.$(`.quiz .opt[data-correct="${correct ? 1 : 0}"]`);
  if (o) await o.click();
  else { const ans = await pg.getAttribute('.qtext', 'data-ans'); const ks = await Promise.all([...(ans || '')].map(c => pg.$(`.keypad [data-key="${c}"]`)));
    if (correct && ks.length && ks.every(Boolean)) for (const k of ks) await k.click(); else { correct = false; await pg.click('.keypad button'); } await pg.click('[data-testid=ok]'); }
  answered++; if (correct) right++;
}
// 1) 打完一关：答 1 题错，其余对
await pg.click('[data-testid=level-1]'); await w(600);
while (await pg.isVisible('[data-testid=tutorial-next]')) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
for (let k = 0; k < 30; k++) {
  await one(k !== 1);
  await pg.waitForSelector('[data-testid=next]:not([disabled]), [data-testid=result-stats], [data-testid=act-attack]', { timeout: 15000 });
  if (await pg.$('[data-testid=act-attack]')) { await pg.click('[data-testid=act-attack]').catch(() => {}); await pg.waitForSelector('[data-testid=next]:not([disabled]), [data-testid=result-stats]', { timeout: 15000 }); }
  if (await pg.$('[data-testid=result-stats]')) break;
  await pg.click('[data-testid=next]'); await w(300);
  if (await pg.$('[data-testid=result-stats]')) break;
}
const rs = await pg.textContent('[data-testid=result-stats]'); console.log('  结算:', rs, ' 脚本计数', right, '/', answered);
// 2) 再进一关答 1 题就退出
await pg.click('[data-testid=again]'); await w(800);
await one(true); answered++; answered--; right; answered += 0;
const afterQuit = answered; await w(900);
await pg.click('[data-testid=pause]'); await w(200); await pg.click('[data-testid=quit]'); await w(150); await pg.click('[data-testid=quit-confirm]'); await w(300);
// 3) 家长报告
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(500);
await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await pg.click('text=稍后', { timeout: 3000 }).catch(() => {}); await w(300);
await pg.click('[data-testid=ptab-report]'); await w(300);
await pg.locator('.chip', { hasText: '报告测试' }).click(); await w(1000);
const txt = await pg.textContent('[data-testid=report]');
const n = +(/累计答题 (\d+) 题/.exec(txt)?.[1] ?? -1);
console.log('  报告:', txt.replace(/\s+/g, ' ').slice(0, 160));
ok(n === afterQuit, `报告累计 ${n} = 实际答题 ${afterQuit}（含退出前那 1 题）`);
ok(/错题本\s*共 [1-9]/.test(txt), '错题本计数 ≥1');
await pg.screenshot({ path: OUT + 'r3-parent-report-counts.png' });
ok(!errs.length, '无页面错误 ' + errs.join(' | '));
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
