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
for (let i = 0; i < 40 && !(await pg.isVisible('[data-testid=level-1]')); i++) {
  for (const sel of ['[data-testid=grade-pick] .stage-btn.on', '[data-testid=stage-pick] .stage-btn.on']) if (await pg.isVisible(sel)) await pg.click(sel);
  if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm])'); await pg.click('[data-testid=char-confirm]'); }
  await pg.waitForTimeout(500);
}
await pg.screenshot({ path: '/workspace/tmp/off.png' }); await pg.click('[data-testid=level-1]'); await pg.waitForTimeout(1500); for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) await pg.click('[data-testid=tutorial-next]'); if (await pg.isVisible('[data-testid=tutorial-skip]')) await pg.click('[data-testid=tutorial-skip]'); await pg.waitForSelector('[data-testid=chal-normal], .qtext', { timeout: 15000 }); if (await pg.isVisible('[data-testid=chal-normal]')) await pg.click('[data-testid=chal-normal]'); await pg.waitForSelector('.qtext', { timeout: 10000 });
console.log('offline OK:', (await pg.textContent('.qtext')).slice(0, 40)); await b.close();
