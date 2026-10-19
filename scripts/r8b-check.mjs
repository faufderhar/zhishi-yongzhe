// r8b 验收（测试构建）：两级入口（横竖屏截图、敬请期待、朗读、记住选择、非档案年级要家长确认）；技能音效按技能 ID 播放（小班用 kindergarten 版）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4183/'; const OUT = process.env.OUT || 'screenshots/r8b/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(vp, grade, init = {}) {
  const ctx = await b.newContext({ viewport: vp }); const pg = await ctx.newPage();
  await pg.addInitScript(o => { window.__zyTest = true; window.__zyTestNoTts = true; window.__said = []; Object.assign(window, o);
    const S = window.speechSynthesis; if (S) S.speak = u => { window.__said.push(u.text); }; }, init);
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r8b'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400); await pg.click('text=r8b'); await w(800);
  return { ctx, pg, w, pinIn };
}
const said = pg => pg.evaluate(() => window.__said.splice(0));
for (const [vp, tag] of [[{ width: 1180, height: 820 }, 'landscape'], [{ width: 820, height: 1180 }, 'portrait']]) {
  const { ctx, pg, w, pinIn } = await session(vp, '5');
  ok(await pg.isVisible('[data-testid=stage-pick]'), `${tag}：选档案后先出「选学段」`);
  const on = await pg.textContent('[data-testid=stage-pick] .stage-btn.on'); ok(/小学/.test(on), `${tag}：默认选中档案学段（${on.trim()}）`);
  const bx = await pg.locator('[data-testid=stage-K]').boundingBox(); ok(bx.width >= 140 && bx.height >= 140, `${tag}：学段按钮是平板大按钮（${Math.round(bx.width)}×${Math.round(bx.height)}）`);
  await pg.screenshot({ path: `${OUT}r8b-stage-${tag}.png` });
  await pg.click('[data-testid=stage-J]'); await w(400);
  ok((await said(pg)).includes('初中'), `${tag}：点学段朗读「初中」`);
  ok(await pg.isVisible('[data-testid=grade-pick]'), `${tag}：第 2 级选年级总是显示`);
  await pg.screenshot({ path: `${OUT}r8b-grade-J-${tag}.png` });
  const lk = await pg.getAttribute('[data-testid=grade-8]', 'aria-disabled'); const txt = await pg.textContent('[data-testid=grade-8]');
  await pg.click('[data-testid=grade-8]', { force: true }); await w(400); const s8 = await said(pg);
  ok(lk === 'true' && /🔒/.test(txt) && /敬请期待/.test(txt) && await pg.isVisible('[data-testid=grade-pick]') && s8.some(x => /快要来啦/.test(x)), `${tag}：初二灰色带锁「敬请期待」，点了不进、朗读提示（${s8}）`);
  for (const g of ['9']) ok(await pg.getAttribute(`[data-testid=grade-${g}]`, 'aria-disabled') === 'true', `${tag}：初三锁定`);
  await pg.click('[data-testid=grade-back]'); await w(300); await pg.click('[data-testid=stage-H]'); await w(300);
  ok(['11', '12'].every(() => true) && await pg.getAttribute('[data-testid=grade-11]', 'aria-disabled') === 'true' && await pg.getAttribute('[data-testid=grade-12]', 'aria-disabled') === 'true', `${tag}：高二、高三锁定`);
  await pg.screenshot({ path: `${OUT}r8b-grade-H-${tag}.png` });
  // 非档案年级（高一）→ 家长确认
  await pg.click('[data-testid=grade-10]'); await w(400);
  ok(await pg.isVisible('[data-testid=pin-ok]') && await pg.isVisible('text=需要家长确认'), `${tag}：选非档案年级（高一）要家长确认`);
  await pinIn('2468'); await w(600);
  ok(await pg.isVisible('[data-testid^=char-]'), `${tag}：确认后进高一（高中先选研究员）`);
  await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600);
  const hasHs = await pg.isVisible('[data-testid="chapter-政治"]'); ok(hasHs, `${tag}：进了高一地图`);
  // 回首页再进：记住上次选择
  await pg.goto(URL); await w(800); await pg.click('text=r8b'); await w(600);
  const on2 = await pg.textContent('[data-testid=stage-pick] .stage-btn.on'); await pg.click('[data-testid=stage-pick] .stage-btn.on'); await w(300);
  const on3 = await pg.textContent('[data-testid=grade-pick] .stage-btn.on');
  ok(/高中/.test(on2) && /高一/.test(on3), `${tag}：记住上次选的（${on2.trim()} / ${on3.trim()}）`);
  await ctx.close();
}
// 小班：档案年级直接进；技能音效按 ID 播放、用 kindergarten 版
{
  const { ctx, pg, w } = await session({ width: 1180, height: 820 }, 'K1');
  await pg.click('[data-testid=stage-K]'); await w(300); ok((await said(pg)).includes('幼儿园'), '小班：点「幼儿园」朗读');
  await pg.click('[data-testid=grade-K1]'); await w(600);
  await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600);
  await pg.click('[data-testid=level-1]'); await w(800);
  if (await pg.isVisible('[data-testid=tut-apple]')) { await w(4500); await pg.click('[data-testid=tut-apple]').catch(() => {}); await w(500); }
  for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
  await pg.evaluate(() => { Math.random = () => 0; });
  for (let i = 0; i < 6 && await pg.isVisible('[data-testid=tutorial-kinder]'); i++) { if (await pg.isVisible('[data-testid=tut-apple]')) await pg.click('[data-testid=tut-apple]', { force: true }).catch(() => {}); await w(1200); if (await pg.isVisible('[data-testid=tutorial-skip]')) await pg.click('[data-testid=tutorial-skip]', { force: true }).catch(() => {}); await w(800); }
  for (let i = 0; i < 3; i++) { await pg.waitForSelector('[data-testid=kopts]', { timeout: 10000 }).catch(() => {}); const o = await pg.$('[data-testid^=opt-][data-correct="1"]'); console.log('  k', i, !!o, await pg.$$eval('[data-testid]', es => es.map(e => e.dataset.testid).join(' '))); if (!o) { await pg.screenshot({ path: OUT + 'dbg-k.png' }); break; } await o.click(); await w(3000); }
  const st = await pg.evaluate(() => window.__zySfxStats); console.log('  kinder stats', JSON.stringify(st), await pg.evaluate(() => (window.__fxLog || []).length));
  ok(st && st.skillPlayed >= 1 && st.paths.every(x => /^k_\w+=skills\/kindergarten\/sfx_skill_k_\w+\.mp3$/.test(x)), `小班技能音效按技能 ID 播放、用 kindergarten 版（${st && st.paths.join(', ')}）`);
  await ctx.close();
}
{
  const { ctx, pg, w } = await session({ width: 1180, height: 820 }, '7');
  await pg.click('[data-testid=stage-J]'); await w(300); await pg.click('[data-testid=grade-7]'); await w(600);
  await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600);
  await pg.click('[data-testid="chapter-数学"]'); await pg.click('[data-testid=level-1]'); await w(800);
  for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
  await pg.waitForSelector('.quiz .opt, .keypad');
  const ids = ['j1_suansuan_1', 'j1_momo_2']; for (const id of ids) { await pg.evaluate(id => window.__zyPlaySkill?.(id), id); await w(2000); }
  const st = await pg.evaluate(() => window.__zySfxStats);
  ok(st.paths.includes('j1_suansuan_1=skills/sfx_skill_j1_suansuan_1.mp3') && st.paths.includes('j1_momo_2=skills/sfx_skill_j1_momo_2.mp3') && st.skillFallback === 0, `初一技能音效按 ID 播放正式版（${st.paths.join(', ')}；合成兜底 ${st.skillFallback}）`);
  await ctx.close();
}
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
