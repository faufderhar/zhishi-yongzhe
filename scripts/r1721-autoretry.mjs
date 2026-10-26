// r17.2.1：首页有新版本时，刚点过（5 秒内）先不刷新——以前只试一次就放弃；现在停手后会再试并刷新
// 用法：URL=http://127.0.0.1:4292/ node scripts/r1721-autoretry.mjs（测试构建）
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:4292/';
const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]'); await pg.waitForTimeout(800);
await pg.evaluate(() => window.dispatchEvent(new CustomEvent('zy-update-ready', { detail: () => { localStorage.setItem('zy.r1721reload', String(Date.now())); } })));
const t0 = Date.now(); for (let i = 0; i < 12; i++) { await pg.mouse.click(5, 790); await pg.waitForTimeout(500); }   // 6 秒里一直在点（空白处）
const called = () => pg.evaluate(() => localStorage.getItem('zy.r1721reload'));
ok(!(await called()), '一直在点：不刷新');
await pg.waitForTimeout(9000);
const c = await called(); ok(!!c, `停手后自动重试并刷新（${c ? ((Number(c) - t0) / 1000).toFixed(1) + ' 秒' : '没有'}）`);
await b.close(); console.log(bad ? `FAILED ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
