// r7 验收：选角色、答题时限（含「时限宽松」）、0 血不停顿（倒地/怪物 defeat ≤0.8 s 后直接复活或结算）、语文 0 题古诗课指向诗词关。URL=... OUT=screenshots/live/ node scripts/r7-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4180/'; const OUT = process.env.OUT || 'screenshots/r7/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(grade, init = {}) {
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } }); const pg = await ctx.newPage();
  // r8b 两级入口（学段 → 年级）：默认项就是档案年级，出现时直接点它
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.addInitScript(o => { window.__zyTest = true; window.__zyTestNoTts = true; Object.assign(window, o); }, init);
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r7'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400); await pg.click('text=r7'); await w(1000);
  await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600);
  const enter = async (sub, lv = 1) => { if (sub) { await pg.click(`[data-testid="chapter-${sub}"]`); await w(300); } await pg.click(`[data-testid=level-${lv}]`); await w(600);
    for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
    await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 }); };
  return { ctx, pg, w, errs, pinIn, enter };
}
const timerOf = async pg => +((await pg.textContent('[data-testid=timer]').catch(() => '')).match(/(\d+)/) || [0, 0])[1];
const metaOf = pg => pg.textContent('.qmeta').catch(() => '');
// 1. 选角色
{
  const { ctx, pg, w } = await session('7');
  const t = await pg.textContent('[data-testid=change-char]'); ok(/选角色/.test(t) && !/换角色/.test(t), `地图按钮叫「选角色」（${t.trim()}）`);
  await pg.click('[data-testid=change-char]'); await w(500); const h = await pg.textContent('h2'); ok(/选角色/.test(h), `角色页标题一致（${h}）`);
  await pg.screenshot({ path: `${OUT}r7-select-char.png` }); await ctx.close();
}
// 2. 时限：初一 25s，计算/填空 ×1.5；时限宽松再 ×1.5
for (const [lenient, tag] of [[false, '默认'], [true, '时限宽松']]) {
  const { ctx, pg, w, pinIn, enter } = await session('7');
  if (lenient) { await pg.goto(URL); await pg.waitForSelector('[data-testid=parent]'); await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(400);
    if (await pg.isVisible('text=稍后')) await pg.click('text=稍后');
    await pg.click('text=时长').catch(() => {}); await w(300);
    const tg = await pg.$('[data-testid=lenient-time]'); if (!tg) { await pg.click('text=题库').catch(() => {}); await w(300); }
    await pg.check('[data-testid=lenient-time]'); await w(300); await pg.screenshot({ path: `${OUT}r7-lenient-toggle.png` });
    await pg.goto(URL); await w(800); await pg.click('text=r7'); await w(800); }
  const seen = [];
  await enter('数学');
  for (let i = 0; i < 6; i++) {
    await w(300); const m = await metaOf(pg); const t = await timerOf(pg); const calc = /填空/.test(m) || /计算|求|多少|=\s*\?|＝/.test(await pg.textContent('.qtext'));
    seen.push(`${m.split('·')[2]?.trim()}:${t}`);
    const exp = Math.round(25 * (calc ? 1.5 : 1) * (lenient ? 1.5 : 1));
    if (!(t === exp || t === exp - 1)) { ok(false, `${tag} 时限 ${t}s ≠ ${exp}s（${m}）`); }
    if (i === 0) await pg.screenshot({ path: `${OUT}r7-timer-${lenient ? 'lenient' : 'default'}.png` });
    if (await pg.$('.keypad')) { await pg.click('[data-key="1"]'); await pg.click('[data-testid=ok]'); } else await pg.click('.quiz .opt[data-correct="1"]');
    await pg.waitForSelector('[data-testid=next]:not([disabled]), [data-testid=result-stats]', { timeout: 15000 }); if (await pg.$('[data-testid=result-stats]')) break; await pg.click('[data-testid=next]'); await w(300);
    await pg.waitForSelector('.quiz .opt, .keypad, [data-testid=result-stats]', { timeout: 15000 });
  }
  ok(seen.length >= 3, `${tag} 时限：初一 25s，计算/填空 ×1.5${lenient ? '，再 ×1.5' : ''}（${seen.join(' ')}）`);
  await ctx.close();
}
// 3. 0 血：主角倒地 ≤0.8 s 后直接出复活挑战；不出现「战斗中…」
{
  const { ctx, pg, w, enter } = await session('7', { __zyTestHp: 1 });
  await enter('数学');
  // 一直答错，直到被打到 0 血（对方回合有「运气好闪开」的随机）；从最后一次提交开始计时
  let t0 = 0, sawWait = false, poll;
  for (let i = 0; i < 10; i++) {
    t0 = Date.now();
    if (await pg.$('.keypad')) { await pg.click('[data-key="9"]'); await pg.click('[data-key="9"]'); await pg.click('[data-key="7"]'); await pg.click('[data-testid=ok]'); } else await pg.click('.quiz .opt:not([data-correct="1"])');
    poll = setInterval(async () => { const hud = await pg.textContent('.hud').catch(() => ''); if (/(^|\D)0\/100/.test(hud) && await pg.isVisible('[data-testid=anim]').catch(() => false)) sawWait = true; }, 100);
    const r = await pg.waitForSelector('[data-testid=revive-yes], [data-testid=result-stats], [data-testid=next]:not([disabled])', { timeout: 15000 });
    if (await pg.$('[data-testid=revive-yes], [data-testid=result-stats]')) break;
    clearInterval(poll); await pg.click('[data-testid=next]'); await w(300); await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 });
  }
  const got = await pg.waitForSelector('[data-testid=revive-yes], [data-testid=result-stats]', { timeout: 8000 }).then(() => Date.now() - t0, () => -1);
  clearInterval(poll);
  ok(got > 0 && got <= 3200, `主角 0 血：攻击演出 + 倒地 ≤0.8 s 后直接出复活/结算（实测 ${got} ms）`);
  ok(!sawWait, '0 血后没有「战斗中…」停顿');
  await pg.screenshot({ path: `${OUT}r7-zero-hp-revive.png` }); await ctx.close();
}
// 4. 怪物 0 血：defeat 动作后直接结算
{
  const { ctx, pg, w, enter } = await session('7', { __zyTestMonHp: 1 });
  await enter('数学');
  await w(300); const t0 = Date.now();
  if (await pg.$('.keypad')) { const a = await pg.evaluate(() => window.__zyAnswer?.() ?? null); if (a) { for (const ch of String(a)) await pg.click(`[data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]'); } }
  else await pg.click('.quiz .opt[data-correct="1"]');
  let shot = false;
  const s0 = Date.now(); while (Date.now() - s0 < 1500 && !shot) { if (await pg.$('[data-testid=monster-sheet]')) { await w(1000); await pg.screenshot({ path: `${OUT}r7-monster-defeat.png` }); shot = true; } else await w(100); }
  const got = await pg.waitForSelector('[data-testid=result-stats]', { timeout: 8000 }).then(() => Date.now() - t0, () => -1);
  ok(got > 0 && got <= 3500, `怪物 0 血：攻击演出 + defeat ≤0.8 s 后直接结算（实测 ${got} ms）`);
  await pg.screenshot({ path: `${OUT}r7-result.png` }); await ctx.close();
}
// 5. 二下《赋得古原草送别》：语文卡片指向同名诗词关
{
  const { ctx, pg, w } = await session('2');
  await pg.click('[data-testid="chapter-语文"]'); await w(400);
  const card = pg.locator('.level', { hasText: '赋得古原草送别' }).first();
  const has = await card.count(); ok(has > 0, '语文地图上有《赋得古原草送别》卡片（指向古诗关）');
  if (has) { await card.scrollIntoViewIfNeeded(); await pg.screenshot({ path: `${OUT}r7-poem-redirect-card.png` }); await card.click(); await w(800);
    for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
    await pg.waitForSelector('.quiz, .kq, [data-testid=timer]', { timeout: 15000 }).catch(() => {});
    const title = await pg.textContent('.lvl-title, .hud').catch(() => ''); const sub = await pg.textContent('.qmeta, .quiz').catch(() => '');
    ok(/诗词/.test(sub) || /赋得/.test(title), `点卡片进入诗词关（${title.slice(0, 40)}）`); await pg.screenshot({ path: `${OUT}r7-poem-redirect-battle.png` }); }
  await ctx.close();
}
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
