// r7 追加验收：技术QA r6（离线素材、QWERTY 键盘、' - 键、命中区、选项 DOM、反馈卡、构建信息）+ 学霸全解锁报告 7 项。URL=... OUT=... node scripts/r7b-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4180/'; const OUT = process.env.OUT || 'screenshots/r7/'; mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const on = k => !ONLY || ONLY.includes(k);
const b = await chromium.launch(); let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(grade, init = {}, vp = { width: 1180, height: 820 }, test = true) {
  const ctx = await b.newContext({ viewport: vp }); const pg = await ctx.newPage();
  // r8b 两级入口（学段 → 年级）：默认项就是档案年级，出现时直接点它
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addInitScript(([o, t]) => { if (t) window.__zyTest = true; window.__zyTestNoTts = true; Object.assign(window, o); }, [init, test]);
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await w(300);
  await pg.fill('[data-testid=add-name]', 'r7'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400); await pg.click('text=r7'); await w(1000);
  await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600);
  const enter = async (sub, lv = 1) => { if (sub) { await pg.click(`[data-testid="chapter-${sub}"]`); await w(300); } await pg.click(`[data-testid=level-${lv}]`); await w(600);
    for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
    await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 }); await w(300); };
  return { ctx, pg, w, pinIn, enter };
}
const typeStr = async (pg, s) => { for (const ch of s) await pg.click(`.keypad.alpha [data-key="${ch === ' ' ? 'space' : ch}"]`); };
const inter = (a, c) => a && c && a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height;
// 1. 英语键盘：QWERTY、' -、横竖屏不溢出、不与怪物重叠；E3-078 isn't / E5-089 Mid-Autumn
if (on('kb')) for (const vp of [[768, 1024], [820, 1180], [1024, 1366], [1180, 820], [1024, 600]]) for (const [g, id, ans] of [['3', 'E3-078', "isn't"], ['5', 'E5-089', 'mid-autumn']]) {
  if (id === 'E5-089' && vp[0] !== 768 && vp[0] !== 1180) continue;
  const { ctx, pg, w, enter } = await session(g, { __zyForceQ: id }, { width: vp[0], height: vp[1] });
  await enter('英语');
  const rows = await pg.$$eval('.keypad.alpha .kp-row', rs => rs.map(r => [...r.querySelectorAll('button')].map(b => b.dataset.key || b.textContent)));
  const tag = `${vp[0]}×${vp[1]} ${id}`;
  if (id === 'E3-078') ok(rows.length === 4 && rows[0].join('') === 'qwertyuiop' && rows[1].join('') === 'asdfghjkl' && rows[2].join('') === "zxcvbnm'-" && rows[3][0] === 'space', `${tag}：QWERTY 10/9/7 + ' - ，第 4 行空格/退格/确定`);
  const okBox = await pg.locator('[data-testid=ok]').boundingBox();
  ok(okBox && okBox.y + okBox.height <= vp[1] && okBox.x + okBox.width <= vp[0], `${tag}：〔确定〕在屏内（bottom ${okBox && Math.round(okBox.y + okBox.height)} ≤ ${vp[1]}）`);
  const kp = await pg.locator('.keypad.alpha').boundingBox();
  await pg.waitForSelector('[data-testid=monster-sheet]', { timeout: 8000 }).catch(() => {}); const mon = await pg.locator('[data-testid=monster-sheet]').boundingBox().catch(() => null) ?? await pg.locator('[data-testid=monster-img]').boundingBox().catch(() => null);
  const art = mon && { x: mon.x + mon.width * 0.15, y: mon.y, width: mon.width * 0.7, height: mon.height };   // 序列帧四周约 15% 透明留边
  ok(!inter(kp, art), `${tag}：怪物立绘不压键盘`);
  const keyH = await pg.$eval('.keypad.alpha [data-key=q]', e => e.getBoundingClientRect().height);
  ok(keyH >= 44, `${tag}：字母键高 ${Math.round(keyH)} ≥ 44`);
  await pg.screenshot({ path: `${OUT}r7-kb-${vp[0]}x${vp[1]}-${id}.png` });
  await typeStr(pg, ans); const shown = await pg.textContent('[data-testid=input]');
  await pg.click('[data-testid=ok]'); await pg.waitForSelector('.feedback, [data-testid=next]', { timeout: 15000 }); await w(1500);
  const fb = await pg.textContent('.quiz').catch(() => '');
  ok(/正确/.test(fb), `${tag}：屏幕键盘打「${shown}」判对`);
  await ctx.close();
}
// 2. 意图按钮 / 能量环 ≥44×44；选项 DOM 无 data-correct（非测试模式）；反馈卡与横幅/题目标签同一回合；护盾显示
if (on('p3')) {
  const { ctx, pg, w, enter } = await session('7', {}, { width: 768, height: 1024 }, false);
  await enter('语文');
  for (const t of ['intent', 'energy']) { const bx = await pg.locator(`[data-testid=${t}]`).boundingBox(); ok(bx && bx.width >= 44 && bx.height >= 44, `${t} 点击区 ${bx && Math.round(bx.width)}×${bx && Math.round(bx.height)} ≥ 44×44（768 竖屏）`); }
  const leak = await pg.evaluate(() => document.querySelectorAll('[data-correct]').length + document.querySelectorAll('.opt[data-answer], .opt[data-right]').length);
  ok(leak === 0, `正式模式下选项 DOM 不带正确答案（data-correct 个数 ${leak}）`);
  // 我方回合答题后：反馈卡写攻击，横幅仍是我方、题目标签仍是攻击题
  const side0 = await pg.getAttribute('[data-testid=banner]', 'data-side');
  if (await pg.$('.keypad')) { await pg.click('.keypad [data-key]'); await pg.click('[data-testid=ok]'); } else await pg.click('.quiz .opt');
  await pg.waitForSelector('[data-testid=next]', { timeout: 15000 }); await w(400);
  const side1 = await pg.getAttribute('[data-testid=banner]', 'data-side'); const meta1 = await pg.textContent('.qmeta');
  ok(side0 === 'P' && side1 === 'P' && /攻击题/.test(meta1), `反馈卡阶段横幅/题目标签仍是本回合（${side0}→${side1}，${meta1.split('·')[0].trim()}）`);
  await pg.screenshot({ path: `${OUT}r7-feedback-same-turn.png` });
  await pg.waitForSelector('[data-testid=next]:not([disabled])', { timeout: 10000 }); await pg.click('[data-testid=next]'); await w(800);
  const side2 = await pg.getAttribute('[data-testid=banner]', 'data-side').catch(() => null);
  ok(side2 === 'M', `点〔继续〕后才切到对方回合（${side2}）`);
  const it = await pg.textContent('[data-testid=intent]'); ok(!/\d+\s*·\s*\d+/.test(it) && !/^\D*(\d+)\D+\1\D*$/.test(it.replace('ⓘ', '')), `意图/护盾不再显示「14·14」（${it.trim()}）`);
  await ctx.close();
}
// 3. 构建信息 + 离线就绪 + 离线后怪物序列帧/技能特效可用
if (on('offline')) {
  const { ctx, pg, w, pinIn } = await session('7');
  await pg.goto(URL); await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500); if (await pg.isVisible('text=稍后')) await pg.click('text=稍后');
  await pg.click('[data-testid=ptab-time]'); await w(400);
  const bi = await pg.textContent('[data-testid=build-info]').catch(() => ''); ok(/题库 v18/.test(bi) && /[0-9a-f]{10}/.test(bi) && /构建 [0-9a-f]{7}/.test(bi), `家长页显示真实构建信息（${bi}）`);
  let st = ''; const t0 = Date.now();
  while (Date.now() - t0 < 240000) { st = await pg.getAttribute('[data-testid=offline-ready]', 'data-ready'); if (st === '1') break; await w(3000); }
  const txt = await pg.textContent('[data-testid=offline-ready]'); ok(st === '1', `家长页离线就绪（${Math.round((Date.now() - t0) / 1000)} s：${txt.split('题库')[0]}）`);
  await pg.screenshot({ path: `${OUT}r7-offline-ready.png` });
  const counts = await pg.evaluate(async () => { const o = {}; for (const n of await caches.keys()) o[n] = (await (await caches.open(n)).keys()).length; return o; });
  console.log('  caches', JSON.stringify(counts));
  await ctx.setOffline(true); await pg.goto(URL); await w(1500); await pg.click('text=r7').catch(() => {}); await w(1000);
  await pg.click('[data-testid="chapter-数学"]'); await w(300); await pg.click('[data-testid=level-1]'); await w(600);
  for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
  const sheet = await pg.waitForSelector('[data-testid=monster-sheet][data-mon=mon_math_normal]', { timeout: 10000 }).then(() => true, () => false);
  ok(sheet, '断网：初一数学怪物序列帧从缓存加载（不是占位）');
  const fx = await pg.evaluate(async () => { const r = []; for (const u of ['fx/skills/j1_suansuan_1.json', 'fx/skills/icons/icon_j1_suansuan_1.webp']) { try { r.push((await fetch(u)).ok); } catch { r.push(false); } } return r; });
  ok(fx.every(Boolean), `断网：技能特效 JSON/图标可取（${fx}）`);
  await pg.screenshot({ path: `${OUT}r7-offline-battle.png` }); await ctx.close();
}
// 4. 学霸报告
if (on('xb')) {
  // #2 Boss 名字按学科；#4 高一政治 / 五年级英语 / 诗词有 Boss
  for (const [g, subs] of [['10', ['数学', '政治', '历史', '诗词']], ['5', ['英语', '数学', '语文']]]) {
    const { ctx, pg, w } = await session(g);
    const names = {};
    for (const s of subs) { if (!await pg.$(`[data-testid="chapter-${s}"]`)) { ok(false, `${g} 年级没有 ${s}`); continue; } await pg.click(`[data-testid="chapter-${s}"]`); await w(300);
      const t = await pg.$$eval('.level.boss [data-testid=kind-tag]', es => es.map(e => e.textContent)); names[s] = t[0];
      ok(t.length > 0, `${g === '10' ? '高一' : g + '年级'}${s} 有 Boss 关（${t.length} 个：${t[0] ?? '-'}）`); }
    const v = Object.values(names).filter(Boolean); ok(new Set(v).size === v.length || g === '10' && names['历史'] !== names['数学'], `Boss 名按学科区分（${JSON.stringify(names)}）`);
    await pg.screenshot({ path: `${OUT}r7-boss-names-${g}.png` }); await ctx.close();
  }
  // #3 失败 0★；#7 复活后出新题
  {
    const { ctx, pg, w, enter } = await session('7', { __zyTestHp: 1 });
    await enter('数学');
    let lastQ = '';
    for (let i = 0; i < 10; i++) {
      lastQ = await pg.textContent('.qtext');
      if (await pg.$('.keypad')) { for (const k of '997') await pg.click(`[data-key="${k}"]`); await pg.click('[data-testid=ok]'); } else await pg.click('.quiz .opt:not([data-correct="1"])');
      await pg.waitForSelector('[data-testid=revive-yes], [data-testid=result-stats], [data-testid=next]:not([disabled])', { timeout: 15000 });
      if (await pg.$('[data-testid=revive-yes]')) break;
      await pg.click('[data-testid=next]'); await w(300); await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 });
    }
    await pg.click('[data-testid=revive-yes]'); await w(500);
    for (let i = 0; i < 6 && await pg.isVisible('.revive-banner'); i++) {
      if (await pg.$('.keypad')) { const a = await pg.evaluate(() => window.__zyAnswer?.()); for (const ch of String(a)) await pg.click(`[data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]'); } else await pg.click('.quiz .opt[data-correct="1"]');
      await w(1500); if (await pg.isVisible('[data-testid=next]:not([disabled])')) { await pg.click('[data-testid=next]'); await w(500); }
    }
    await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 }); await w(400);
    const q2 = await pg.textContent('.qtext'); const fbv = await pg.isVisible('[data-testid=next]');
    ok(!fbv && q2 !== lastQ, `复活后直接出新题（不是刚答错的「${lastQ.slice(0, 12)}」）`);
    await pg.screenshot({ path: `${OUT}r7-after-revive.png` });
    // #6 中途退出 → 未通过结算，0★
    await pg.click('[data-testid=pause]'); await w(300); await pg.click('[data-testid=quit-confirm]').catch(async () => { await pg.click('text=回地图'); }); await w(500);
    if (await pg.isVisible('[data-testid=quit-confirm]')) await pg.click('[data-testid=quit-confirm]');
    const res = await pg.waitForSelector('[data-testid=quit]', { timeout: 8000 }).then(() => true, () => false);
    const on3 = await pg.$$eval('.center-screen .stars .on', e => e.length).catch(() => -1);
    ok(res && on3 === 0, `中途退出显示「未通过」结算，0★（亮星 ${on3}）`);
    await pg.screenshot({ path: `${OUT}r7-quit-result.png` }); await ctx.close();
  }
  {
    const { ctx, pg, w, enter } = await session('7', { __zyTestHp: 1 });
    await enter('数学');
    for (let i = 0; i < 10; i++) {
      if (await pg.$('.keypad')) { for (const k of '997') await pg.click(`[data-key="${k}"]`); await pg.click('[data-testid=ok]'); } else await pg.click('.quiz .opt:not([data-correct="1"])');
      await pg.waitForSelector('[data-testid=revive-yes], [data-testid=result-stats], [data-testid=next]:not([disabled])', { timeout: 15000 });
      if (await pg.$('[data-testid=revive-yes], [data-testid=result-stats]')) break;
      await pg.click('[data-testid=next]'); await w(300); await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 15000 });
    }
    if (await pg.$('[data-testid=revive-no]')) await pg.click('[data-testid=revive-no]');
    await pg.waitForSelector('[data-testid=result-stats]', { timeout: 10000 });
    const on3 = await pg.$$eval('.center-screen .stars .on', e => e.length); const st = await pg.textContent('[data-testid=result-stats]');
    ok(on3 === 0, `失败结算 0★（${st.trim().slice(0, 30)}，亮星 ${on3}）`);
    await pg.screenshot({ path: `${OUT}r7-fail-0star.png` }); await ctx.close();
  }
}
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
