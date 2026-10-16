// r11：复现「点挑战 / 点练习题 → 跳回谁来玩？」并检查「没打完」提示只给本人
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4183/'; const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } }); const pg = await ctx.newPage();
const navs = []; pg.on('load', () => navs.push(new Date().toISOString().slice(17, 23)));
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; });
const w = ms => pg.waitForTimeout(ms);
const toMap = async name => { await pg.click(`.profile-card:has-text("${name}")`); await w(600);
  for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const s of ['[data-testid=grade-pick] .stage-btn.on', '[data-testid=stage-pick] .stage-btn.on']) if (await pg.isVisible(s)) await pg.click(s);
    if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm])'); await pg.click('[data-testid=char-confirm]'); } await w(400); } };
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(500);
await toMap('初一同学'); await pg.click('[data-testid=level-1]'); await w(1200);
for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
if (await pg.isVisible('[data-testid=tutorial-skip]')) await pg.click('[data-testid=tutorial-skip]');
await pg.waitForSelector('[data-testid=chal-on], [data-testid=chal-none], .quiz .opt, .keypad', { timeout: 15000 }).catch(() => {});
if (await pg.isVisible('[data-testid=chal-on]')) await pg.click('[data-testid=chal-on]'); await w(1500);
console.log('初一 点挑战后：谁来玩？', await pg.isVisible('text=谁来玩'), '题目', await pg.isVisible('.quiz'));
await pg.reload(); await w(1500); console.log('刷新后首页别人的提示', await pg.isVisible('[data-testid=interrupted-home]'));
await toMap('小班宝贝'); console.log('小班地图上 初一 的提示', await pg.isVisible('[data-testid=interrupted]'));
await pg.click('[data-testid=level-1]'); await w(1500); await pg.click('[data-testid=tut-apple]').catch(() => console.log('no tut')); await w(1500);
console.log('小班 点练习题后：谁来玩？', await pg.isVisible('text=谁来玩'));
console.log('导航次数', navs.length, navs.join(' '));
await b.close();
