// r8 线上冒烟（不依赖任何测试钩子）：正式包里没有测试钩子；建档 → 进关答 1 题 → 家长页总览「离线就绪」+ 本地日期构建信息；高一史地 Boss 名带学科前缀
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'https://faufderhar.github.io/zhishi-yongzhe/'; const OUT = process.env.OUT || 'screenshots/live/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, timezoneId: 'America/Los_Angeles' }); const pg = await ctx.newPage();
  // r8b 两级入口（学段 → 年级）：默认项就是档案年级，出现时直接点它
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
const js = []; pg.on('response', r => { if (/\/assets\/.+\.js$/.test(r.url())) js.push(r); });
const w = ms => pg.waitForTimeout(ms);
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(800);
const main = (await pg.$$eval('script[src]', s => s.map(x => x.src))).find(s => /index-/.test(s)); console.log('  bundle', main);
let hooks = []; for (const r of js) { const t = await r.text().catch(() => ''); for (const k of ['__zyAnswer', '__zyForceQ', '__zyTestHp', '__zyTestMonHp', '__zyPlaySkill', '__zyLevels', '__zyTestNoTts', '__zyNoArt', '__zyTest']) if (t.includes(k)) hooks.push(k + '@' + r.url().split('/').pop()); }
ok(js.length > 0 && hooks.length === 0, `正式包 ${js.length} 个 JS 里没有测试钩子（${hooks.join(', ') || '无'}）`);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
const mk = async (name, g, first) => { await pg.click('[data-testid=add-child]'); await w(300); if (first) { await pinIn('2468'); await pinIn('2468'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); } else await pinIn('2468'); await w(300);
  await pg.fill('[data-testid=add-name]', name); await pg.click(`[data-testid=home-grade-${g}]`); await w(500); };
await mk('高一', '10', true);
await pg.click('text=高一'); await w(1000); await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600);
const names = {}; for (const s of ['历史', '地理']) { await pg.click(`[data-testid="chapter-${s}"]`); await w(300); names[s] = (await pg.$$eval('.level.boss [data-testid=kind-tag]', e => e.map(x => x.textContent)))[0]; }
ok(/历史·\S+/.test(names['历史']) && /地理·\S+/.test(names['地理']), `共用怪物池的 Boss 名带学科前缀（${names['历史']} / ${names['地理']}）`);
await pg.screenshot({ path: `${OUT}r8-boss-prefix.png` });
await pg.click('[data-testid="chapter-数学"]'); await w(300); await pg.click('[data-testid=level-1]'); await w(800);
for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
for (let i = 0; i < 4 && await pg.isVisible('[data-testid=cards] button'); i++) { await pg.click('[data-testid=cards] button'); await w(300); }
if (await pg.isVisible('[data-testid=wager-sure]')) await pg.click('[data-testid=wager-sure]');
await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 });
const leak = await pg.evaluate(() => document.querySelectorAll('[data-correct], [data-ans]').length + (typeof window.__zyAnswer));
ok(leak === '0undefined', `战斗页 DOM 无答案属性、无 __zyAnswer（${leak}）`);
if (await pg.$('.keypad')) { await pg.click('.keypad [data-key]'); await pg.click('[data-testid=ok]'); } else await pg.click('.quiz .opt');
const fb = await pg.waitForSelector('[data-testid=next]', { timeout: 15000 }).then(() => true, () => false); ok(fb, '正式包能正常答题、出反馈');
await pg.screenshot({ path: `${OUT}r8-battle-prod.png` });
// 家长页总览（孩子档案页）：离线就绪 + 本地日期
await pg.goto(URL); await w(800); await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('text=稍后')) await pg.click('text=稍后');
const vis = await pg.isVisible('[data-testid=overview-offline] [data-testid=offline-ready]'); ok(vis, '家长页总览（孩子档案）显示离线状态');
let st = '0'; const t0 = Date.now(); while (Date.now() - t0 < 180000) { st = await pg.getAttribute('[data-testid=overview-offline] [data-testid=offline-ready]', 'data-ready'); if (st === '1') break; await w(3000); }
ok(st === '1', `总览显示「离线就绪」（${Math.round((Date.now() - t0) / 1000)} s）`);
const bi = await pg.textContent('[data-testid=overview-offline] [data-testid=build-info]');
const m = bi.match(/(\d{4})\/(\d{2})\/(\d{2})/); const today = new Date().toLocaleDateString('zh-CN', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
ok(!!m && /题库 v\d+/.test(bi), `构建信息按本地日期显示（${bi}；今天本地 ${today}）`);
await pg.screenshot({ path: `${OUT}r8-parent-overview.png` });
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
