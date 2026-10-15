// 检查：页面能加载、Service Worker 生效后断网仍可打开并进入关卡
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:8099/';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } }); const pg = await ctx.newPage();
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]', { timeout: 20000 });
await pg.evaluate(async () => { await navigator.serviceWorker.ready; });
await pg.waitForTimeout(3000);
await ctx.setOffline(true);
await pg.reload(); await pg.waitForSelector('[data-testid^=profile-]', { timeout: 20000 });
await pg.click('[data-testid=profile-kid-7]'); await pg.waitForTimeout(400);
if (await pg.$('[data-testid^=char-]')) await pg.click('[data-testid^=char-]');
await pg.click('[data-testid=level-1]'); await pg.waitForSelector('.qtext', { timeout: 10000 });
console.log('offline OK:', (await pg.textContent('.qtext')).slice(0, 40)); await b.close();
