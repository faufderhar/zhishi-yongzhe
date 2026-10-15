// r2 回归：技术修复 + 策划确认单 D1–D12。node scripts/r2-check.mjs  (URL 默认 http://localhost:4180/)
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4180/';
const SUB = process.env.SUB || 'http://localhost:4181/zhishi-yongzhe/';
const OUT = process.env.OUT || 'screenshots/r2/';
const b = await chromium.launch();
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function page(vp = { width: 1180, height: 820 }) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true });
  const pg = await ctx.newPage(); pg.errs = [];
  pg.on('pageerror', e => pg.errs.push(String(e)));
  return pg;
}
const W = (pg, ms) => pg.waitForTimeout(ms);
const pin = async (pg, p) => { for (const d of p) await pg.tap(`[data-testid=pin-${d}]`); await pg.tap('[data-testid=pin-ok]'); await W(pg, 250); };
const idb = (pg, key, val) => pg.evaluate(([k, v]) => new Promise((res, rej) => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(1); tx.onerror = rej; }; }), [key, val]);

// 1. 根目录 + 子路径都能打开（X-1）
for (const u of [URL, SUB]) {
  const pg = await page(); await pg.goto(u); const okk = await pg.waitForSelector('[data-testid^=profile-]', { timeout: 20000 }).then(() => true, () => false);
  ok(okk && !pg.errs.length, `打开 ${u}`); await pg.context().close();
}
// 2. D12 全视口
for (const [w, h] of [[1024, 600], [1280, 800], [1366, 1024], [2000, 1200], [2732, 2048], [800, 1280]]) {
  const pg = await page({ width: w, height: h }); await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]');
  const r = await pg.evaluate(() => { const a = document.querySelector('.app').getBoundingClientRect(); return { w: a.width, h: a.height, sx: document.documentElement.scrollWidth, sy: document.documentElement.scrollHeight }; });
  ok(Math.abs(r.w - w) < 2 && Math.abs(r.h - h) < 2 && r.sx <= w && r.sy <= h, `D12 ${w}x${h} 根容器铺满 ${JSON.stringify(r)}`);
  if ([1024, 2000, 800].includes(w)) await pg.screenshot({ path: `${OUT}d12-home-${w}x${h}.png` });
  await pg.context().close();
}

const pg = await page();
await pg.addInitScript(() => { window.__zyTest = true; window.__spoken = []; const o = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { window.__spoken.push(u.text); try { o(u); } catch {} }; });
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]');
// 3. D7 添加孩子需要家长密码；首次设置含找回问题（X-13）
await pg.tap('[data-testid=add-child]'); await W(pg, 300);
ok(await pg.isVisible('[data-testid=pin-ok]'), 'D7 添加孩子先弹家长密码');
await pg.screenshot({ path: OUT + 'd7-add-child-pin.png' });
await pin(pg, '2468'); await pin(pg, '2468');
ok(await pg.isVisible('[data-testid=hint-answer]'), 'X-13 首次设置要求找回问题');
await pg.fill('[data-testid=hint-answer]', '豆豆'); await pg.screenshot({ path: OUT + 'x13-pin-hint.png' }); await pg.tap('[data-testid=hint-ok]'); await W(pg, 400);
ok(await pg.isVisible('[data-testid=grade-list]'), 'D7 密码通过后进入年级选择');
await pg.fill('[data-testid=add-name]', '三年级测试'); await pg.tap('[data-testid=home-grade-3]'); await W(pg, 300);
ok(await pg.isVisible('text=三年级测试') && await pg.isVisible('[data-testid=add-child]'), 'D7 新建后回到档案页（不自动进游戏）');

// 4. 小班：伙伴选择需确认（D10）→ 新手引导（D5）→ D1 答错流程 → D2 结算
await pg.tap('[data-testid=profile-kid-k]'); await W(pg, 500);
await pg.tap('[data-testid^=char-]'); await W(pg, 200);
ok(await pg.isVisible('[data-testid=char-confirm]') && await pg.isVisible('[data-testid^=char-]'), 'D10 点卡片只选中，需点「就选它」');
await pg.tap('[data-testid=char-confirm]'); await pg.waitForSelector('[data-testid=levels]'); await W(pg, 300);
await pg.screenshot({ path: OUT + 'map-k1.png' });
await pg.tap('[data-testid=level-1]'); await W(pg, 600);
ok(await pg.isVisible('[data-testid=tutorial-kinder]'), 'D5 小班首次战斗有新手引导');
await W(pg, 4500); await pg.screenshot({ path: OUT + 'd5-kinder-tutorial.png' });
await pg.tap('[data-testid=tut-apple]'); await W(pg, 800); await pg.tap('[data-testid=tutorial-skip]'); await W(pg, 800);
await pg.waitForSelector('[data-testid=kopts]');
const items = await pg.$$eval('[data-testid=kitems]', els => els.map(e => +e.dataset.count));
console.log('  题干物品数', items);
await pg.screenshot({ path: OUT + 'j1-kinder-stem.png' });
// 第 1 题：先点错一个
const wrongs = await pg.$$('[data-testid^=opt-][data-correct="0"]');
const wid = await wrongs[0].getAttribute('data-testid');
await wrongs[0].tap(); await W(pg, 450);
const cls = await pg.getAttribute(`[data-testid=${wid}]`, 'class');
ok(/gone/.test(cls), 'D1 去掉的是刚点错的那个选项');
await pg.screenshot({ path: OUT + 'd1-after-wrong.png' });
await W(pg, 500);
// 再点错（若还有错误项）→ 演示
const w2 = await pg.$$('[data-testid^=opt-][data-correct="0"]:not(.gone)');
if (w2.length) { await w2[0].tap(); await W(pg, 700); ok(await pg.isVisible('.kopt.reveal'), 'D1 两次答错 → 演示正确答案'); await pg.screenshot({ path: OUT + 'd1-demo.png' }); await W(pg, 2400); }
else await W(pg, 2400);
for (let i = 0; i < 6; i++) {
  if (!(await pg.isVisible('[data-testid=kopts]').catch(() => false))) break;
  const c = await pg.$('[data-testid^=opt-][data-correct="1"]'); if (!c) break;
  await c.tap(); await W(pg, 1500);
}
await pg.waitForSelector('[data-testid=result-stats]', { timeout: 15000 });
const rt = await pg.textContent('[data-testid=result-stats]');
ok(!/0\s*\/|答对 0/.test(rt) && /看演示学会|再试一次/.test(rt), 'D2 小班结算三类明细、无「0/3」: ' + rt);
ok(await pg.isVisible('[data-testid=star-rules]'), 'D3 结算页显示星级规则');
await pg.screenshot({ path: OUT + 'd2-kinder-result.png' });

// 5. 初一：地图（J-7 标题/锁/2.2）→ 引导 → 行动 8 秒（D6）
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]');
await pg.tap('[data-testid=profile-kid-7]'); await W(pg, 500); await pg.tap('[data-testid^=char-]'); await pg.tap('[data-testid=char-confirm]');
await pg.waitForSelector('[data-testid=levels]'); await W(pg, 400);
await pg.screenshot({ path: OUT + 'j7-map-7.png' });
const locks = await pg.$$eval('[data-testid^=level-]', els => els.map(e => [e.dataset.locked, e.querySelector('.lv-no').textContent]));
ok(locks.every(([l, t]) => (l === '1') === (t === '🔒')), 'J-7 未解锁节点一律显示 🔒');
const names = await pg.$$eval('.lv-name', els => els.map(e => e.textContent));
ok(names.some(n => /2\.2/.test(n)) , 'J-7 初一 2.2 数轴关卡存在');
const locked = await pg.$('[data-locked="1"]'); if (locked) { await locked.tap({ force: true }); await W(pg, 200); ok(await pg.isVisible('[data-testid=map-tip]'), 'X-11 点锁定关卡有提示'); await pg.screenshot({ path: OUT + 'x11-locked-tip.png' }); }
await pg.tap('[data-testid=level-1]'); await W(pg, 600);
ok(await pg.isVisible('[data-testid=tutorial-std]'), 'D5 初一首次战斗有引导卡片');
await pg.screenshot({ path: OUT + 'd5-std-tutorial.png' });
for (let i = 0; i < 5 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.tap('[data-testid=tutorial-next]'); await W(pg, 150); }
await pg.waitForSelector('[data-testid=qtext], .qtext', { timeout: 8000 }).catch(() => {});
const right = await pg.$('[data-testid^=opt-][data-correct="1"]');
if (right) { await right.tap(); } else { const ans = await pg.getAttribute('[data-ans]', 'data-ans'); for (const ch of ans) await pg.tap(`[data-key="${ch}"]`); await pg.tap('[data-testid=ok]'); }
await W(pg, 900);
const at = await pg.textContent('.actions .good').catch(() => '');
ok(/[78]s 后自动攻击/.test(at), 'D6 初一行动窗口 8 秒: ' + at);
await pg.screenshot({ path: OUT + 'd6-action-8s.png' });
await pg.tap('[data-testid=pause]'); await W(pg, 200); await pg.screenshot({ path: OUT + 'x10-pause.png' });
await pg.tap('[data-testid=quit]'); await W(pg, 150); await pg.tap('[data-testid=quit-confirm]'); await W(pg, 300);

// 6. D9 密码输错锁定
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]');
await pg.tap('[data-testid=parent]'); await W(pg, 300);
await pin(pg, '1111'); const e1 = await pg.textContent('[data-testid=pin-error]');
ok(/还可以试 4 次/.test(e1), 'D9 错误提示剩余次数: ' + e1);
for (let i = 0; i < 4; i++) await pin(pg, '1111');
const e5 = await pg.textContent('[data-testid=pin-error]');
ok(/错太多次/.test(e5), 'D9 5 次后锁定: ' + e5);
await pg.screenshot({ path: OUT + 'd9-lock.png' });
await pg.reload(); await pg.waitForSelector('[data-testid^=profile-]'); await pg.tap('[data-testid=parent]'); await W(pg, 1200);
ok(/错太多次/.test(await pg.textContent('[data-testid=pin-error]').catch(() => '')), 'D9 刷新后仍锁定');

// 7. D8 时间回拨
await idb(pg, 'clock', { maxSeen: Date.now() + 3600e3, locked: false });
await pg.reload(); await pg.waitForSelector('[data-testid^=profile-]'); await W(pg, 300);
ok(await pg.isVisible('[data-testid=clock-lock]'), 'D8 时间被调回 → 锁定提示');
ok(/今天还能玩 0 分钟/.test(await pg.textContent('[data-testid=profile-kid-k]')), 'D8 所有档案今日按已用满');
await pg.screenshot({ path: OUT + 'd8-clock-lock.png' });

// 8. T-P0-1 损坏档案不白屏
await idb(pg, 'profiles', [{ id: 'x', grade: 'zz' }, 42, { id: 'kid-7', name: '好档案', grade: '7' }]);
await idb(pg, 'settings', 'garbage');
await pg.reload(); const alive = await pg.waitForSelector('[data-testid^=profile-]', { timeout: 10000 }).then(() => true, () => false);
ok(alive && await pg.isVisible('text=好档案'), 'T-P0-1 损坏档案自动修复，不白屏');
await pg.screenshot({ path: OUT + 'p0-1-corrupt-recovered.png' });
ok(!pg.errs.length, '无页面异常 ' + pg.errs.join(' | '));
await b.close();
console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exitCode = bad ? 1 : 0;
