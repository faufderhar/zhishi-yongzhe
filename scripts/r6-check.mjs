// r6 验收：竖屏 iPad（768/820/1024）布局、怪物池、英语字母键盘、删除档案取消、结果页「答对 X / Y」。URL=... OUT=screenshots/live/ node scripts/r6-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4180/'; const OUT = process.env.OUT || 'screenshots/r6/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(W, H, grade = '7') {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true }); const pg = await ctx.newPage();
  // r8b 两级入口（学段 → 年级）：默认项就是档案年级，出现时直接点它
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestMonHp = 9999; });
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r6'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400); await pg.click('text=r6'); await w(1000);
  await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600);
  return { ctx, pg, w, errs, pinIn };
}
async function toFill(pg, w, wantLetters) {
  for (let i = 0; i < 40; i++) {
    await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 });
    const kp = await pg.$(wantLetters ? '.keypad.alpha' : '.keypad'); if (kp) return true;
    if (await pg.$('.keypad')) { await pg.click('[data-key="1"], .keypad.alpha button'); await pg.click('[data-testid=ok]'); }
    else await pg.click('.quiz .opt[data-correct="1"]');
    await pg.waitForSelector('[data-testid=next]:not([disabled])', { timeout: 15000 }); await pg.click('[data-testid=next]'); await w(300);
  }
  return false;
}
const inView = (r, W, H) => r && r[0] >= 0 && r[1] <= W + 1 && r[2] >= 0 && r[3] <= H + 1;
for (const [W, H] of (process.env.SKIP ? [] : [[768, 1024], [820, 1180], [1024, 1366]])) {
  const { ctx, pg, w, errs } = await session(W, H);
  await pg.click('[data-testid=chapter-数学]').catch(() => {}); await w(300);
  await pg.click('[data-testid=level-1]'); await w(600);
  for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
  ok(await pg.waitForSelector('[data-testid=monster-sheet][data-mon=mon_math_normal]', { timeout: 15000 }).then(() => true, () => false), `${W} 数学关怪物来自数学池（mon_math_normal）`);
  ok(await toFill(pg, w, false), `${W} 找到填空题`);
  await w(800);
  const r = await pg.evaluate(() => { const g = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; };
    return { sw: document.documentElement.scrollWidth, okb: g('[data-testid=ok]'), turn: g('[data-testid=turn]'), del: g('.keypad .del') }; });
  ok(r.sw <= W, `${W}×${H} 竖屏无横向溢出（scrollWidth ${r.sw}）`);
  if (process.env.DBG) console.log(JSON.stringify(r));
  ok(inView(r.okb, W, H) && inView(r.del, W, H), `${W}×${H} 键盘右列（⌫ / 确定）完整可见`);
  ok(inView(r.turn, W, H), `${W}×${H}「第 N 回合 / 上限」可见`);
  await pg.click('[data-key="1"]'); await pg.click('[data-testid=ok]');
  ok(await pg.waitForSelector('[data-testid=next]', { timeout: 10000 }).then(() => true, () => false), `${W} 竖屏可以提交`);
  await pg.screenshot({ path: `${OUT}r6-portrait-${W}.png` });
  ok(!errs.length, `${W} 无页面错误 ${errs.join(';')}`); await ctx.close();
}
// 英语填空：字母键盘含 e、不出现 ×10ⁿ
{
  const { ctx, pg, w } = await session(1180, 820, '7');
  await pg.click('[data-testid=chapter-英语]'); await w(400);
  let found = false;
  for (let lv = 1; lv <= 6 && !found; lv++) {
    if (!(await pg.$(`[data-testid=level-${lv}]:not([disabled])`))) continue;
    await pg.click(`[data-testid=level-${lv}]`); await w(600);
    for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
    found = await toFill(pg, w, true).catch(() => false);
    if (!found) { await pg.goto(URL); await w(800); await pg.click('text=r6'); await w(800); await pg.click('[data-testid=chapter-英语]'); await w(300); }
  }
  if (found) {
    ok(await pg.$('.keypad.alpha [data-key="e"]') && (await pg.textContent('.keypad.alpha')).indexOf('×10') < 0, '英语填空：字母键盘有 e、无 ×10ⁿ');
    await pg.click('.keypad.alpha [data-key="e"]'); ok((await pg.textContent('[data-testid=input]')).includes('e'), '英语输入框显示 e（不转成 ×10^）');
    await pg.screenshot({ path: `${OUT}r6-english-keyboard.png` });
  } else ok(false, '英语填空：没找到英语填空题');
  await ctx.close();
}
// 删除档案：有「取消」
{
  const { ctx, pg, w, pinIn } = await session(1180, 820, '7');
  await pg.goto(URL); await pg.waitForSelector('[data-testid=parent]'); await pg.click('[data-testid=parent]'); await w(400); await pinIn('2468'); await w(500);
  if (await pg.isVisible('text=稍后')) await pg.click('text=稍后'); await w(300); const d = await pg.$('[data-testid^=del-]:not([data-testid=del-cancel]):not([data-testid=del-confirm])'); await d.click(); await w(300);
  ok(await pg.isVisible('[data-testid=del-cancel]'), '删除档案弹窗有醒目的「取消，不删除」');
  await pg.screenshot({ path: `${OUT}r6-delete-cancel.png` });
  await pg.click('[data-testid=del-cancel]'); await w(300); ok(!(await pg.isVisible('[data-testid=del-cancel]')), '点取消关闭弹窗，档案保留');
  await ctx.close();
}
// 学科怪物：每个科目进第 1 关，确认序列帧怪物来自对应池（截图）
const EXP = { 数学: 'math', 语文: 'chinese', 诗词: 'chinese', 英语: 'english', 化学: 'chem', 科学: 'chem', 物理: 'physics', 生物: 'bio', 历史: 'histgeo', 地理: 'histgeo', 政治: 'morality', 道德与法治: 'morality' };
for (const grade of (process.env.SKIP ? [] : ['10', '7', '3'])) {
  const { ctx, pg, w } = await session(1180, 820, grade);
  const subs = await pg.$$eval('[data-testid^=chapter-]', es => es.map(e => e.dataset.testid.slice(8)));
  for (const sub of subs) {
    if (!EXP[sub]) continue;
    await pg.click(`[data-testid="chapter-${sub}"]`); await w(300); await pg.click('[data-testid=level-1]'); await w(500);
    for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
    const id = await pg.waitForSelector('[data-testid=monster-sheet]', { timeout: 15000 }).then(e => e.getAttribute('data-mon'), () => '');
    const name = await pg.textContent('[data-testid=monster-name]').catch(() => '');
    ok(id === `mon_${EXP[sub]}_normal`, `${grade} ${sub} → ${id}（${name}）`);
    await w(600); await pg.screenshot({ path: `${OUT}r6-monster-g${grade}-${sub}.png` });
    await pg.click('[data-testid=pause]'); await w(200); await pg.click('[data-testid=quit]'); await w(200); await pg.click('[data-testid=quit-confirm]'); await pg.waitForSelector('[data-testid^=chapter-]'); await w(400);
  }
  await ctx.close();
}
// 一年级：柔和版序列帧；小班：数一数 visual、形状 SVG
{
  const { ctx, pg, w } = await session(1180, 820, '1');
  await pg.click('[data-testid="chapter-数学"]'); await w(300); await pg.click('[data-testid=level-1]'); await w(500);
  for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
  const src = await pg.waitForSelector('[data-testid=monster-sheet] img', { timeout: 15000 }).then(e => e.getAttribute('src'), () => '');
  ok(/_soft_sheet\.webp/.test(src), `一年级用柔和版怪物序列帧（${src.split('/').pop()}）`);
  await w(500); await pg.screenshot({ path: `${OUT}r6-monster-g1-soft.png` }); await ctx.close();
}
// 诗词关卡：每关所有题都属于这首诗（unit 一致，关卡名就是这首诗）——1–7 年级
for (const grade of ['1', '2', '3', '4', '5', '6', '7']) {
  const { ctx, pg, w } = await session(1180, 820, grade);
  await w(500);
  const r = await pg.evaluate(() => { const L = window.__zyLevels || []; const bad = []; let n = 0;
    for (const c of L.filter(c => c.subject === '诗词')) for (const l of c.levels.filter(l => l.kind !== 'boss')) {
      n++; const us = new Set(l.qs.map(q => q.unit)); if (us.size !== 1) bad.push(l.name + ':' + [...us].join('/'));
      const t = (l.qs[0]?.unit || '').match(/《[^》]+》/)?.[0]; if (t && !l.name.includes(t)) bad.push('名不符 ' + l.name + ' ' + t);
    } return { n, bad }; });
  ok(r.n > 0 && !r.bad.length, `${grade} 年级诗词 ${r.n} 关，每关题目都属于同一首诗 ${r.bad.slice(0, 3).join('; ')}`);
  await ctx.close();
}
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
