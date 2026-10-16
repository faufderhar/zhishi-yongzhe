// r9 线上：先 verify-live 读出 bundle，再在全新上下文确认页面加载的就是这个 bundle、版本标签含提交号
import { chromium } from 'playwright';
const U = process.env.URL || 'https://faufderhar.github.io/zhishi-yongzhe/', EXP = process.env.EXPECT;
const html = await (await fetch(U + '?cb=' + Date.now(), { cache: 'no-store' })).text(); const bn = html.match(/assets\/(index-[\w-]+\.js)/)[1];
const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 1024, height: 600 } })).newPage();
await pg.goto(U); await pg.waitForSelector('[data-testid=version-label]');
const v = await pg.textContent('[data-testid=version-label]'); const src = await pg.evaluate(() => [...document.scripts].map(s => s.src).join(' '));
await pg.screenshot({ path: 'screenshots/live/r9-live-version.png' });
const okk = src.includes(bn) && v.includes(EXP) && /^r9/.test(v); console.log(`bundle=${bn} label="${v}"`, okk ? 'ALL PASS' : 'FAIL'); await b.close(); process.exit(okk ? 0 : 1);
