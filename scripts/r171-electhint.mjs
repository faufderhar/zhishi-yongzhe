// r17.1 学霸 r16.1 裁定 §6（r17-11）：高二 / 高三建档「默认全科」三处提示
//  1 添加孩子弹窗第二行；2 新建高二档案第一次进地图 sys-bar 提示一次（N = 地图科目数），再进不出；高一新档不出
//  3 家长编辑：高一改高二 / 高三出一行，高二改高三不出。用法：URL=http://127.0.0.1:4475/ node scripts/r171-electhint.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://127.0.0.1:4475/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/electhint/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; window.__zyTestSpentSec = -1e7; });
await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
async function openAdd(first) {
  await pg.click('[data-testid=add-child]'); await w(300);
  if (first) { await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0').catch(() => {});
    await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x'); await pg.click('[data-testid=hint-ok]'); await w(500);
    if (await vis('[data-testid=rec-done]')) { await pg.click('[data-testid=rec-done]'); await w(300); } }
  if (await vis('[data-testid=pin-verify]') || await vis('[data-testid=pin-ok]')) await pinIn('2468'); await w(300);
  await pg.waitForSelector('[data-testid=add-name]'); }
async function toMap(name) { await pg.click(`[data-testid^=profile-] >> text=${name}`).catch(() => {}); await w(500);
  for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')); i++) {
    if (await vis('[data-testid=pin-ok]')) await pinIn('2468');
    else if (await vis('[data-testid=pin-nudge-skip]')) await pg.click('[data-testid=pin-nudge-skip]');
    else if (await vis('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await pg.click('[data-testid=char-confirm]', { force: true }); }
    else if (await vis('[data-testid=stage-pick]')) await pg.click('[data-testid=stage-pick] .stage-btn.on', { timeout: 1500 }).catch(() => {});
    else if (await vis('[data-testid=grade-pick]')) await pg.click('[data-testid=grade-pick] .stage-btn.on', { timeout: 1500 }).catch(() => {});
    await w(400); }
  const r = await vis('[data-testid=level-1]'); if (!r) { await pg.screenshot({ path: OUT + 'tomap-fail.png' }); console.log('toMap stuck:', await pg.evaluate(() => [...document.querySelectorAll('[data-testid]')].filter(e => e.offsetParent).map(e => e.dataset.testid).join(' '))); } return r; }
// 1 添加弹窗第二行
await openAdd(true);
const hint = await pg.textContent('[data-testid=add-hint]');
ok(hint.includes('之后可在「家长」里改名字、头像和每日时长。') && hint.includes('高二、高三默认「还没选科（全科）」，所有科目都能玩；已经选了科，到「家长 → 编辑档案 → 选科」里改。'), `添加弹窗两行：${hint.replace(/\s+/g, ' ')}`);
await pg.screenshot({ path: OUT + 'add.png' });
await pg.fill('[data-testid=add-name]', 'eh11'); await pg.click('[data-testid=home-grade-11]'); await w(500);
// 2 第一次进地图提示一次
ok(await toMap('eh11'), '新高二档进地图');
await w(500); const n = await pg.$$eval('[data-testid^=chapter-]', es => es.length);
const note = await pg.textContent('[data-testid=elect-note]').catch(() => '');
ok(note.includes(`已按「还没选科（全科）」建好：${n} 个科目都能玩，Boss 没有弱点加成。选了科？到「家长 → 编辑档案 → 选科」里改。`), `地图提示（${n} 个科目）：${note}`);
await pg.screenshot({ path: OUT + 'map-note.png' });
await pg.click('[data-testid=elect-note]'); await w(300); ok(!(await vis('[data-testid=elect-note]')), '点了关闭');
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
ok(await toMap('eh11'), '再进地图'); await w(600); ok(!(await vis('[data-testid=elect-note]')), '再进不出');
// 高一新档不出；kid-10（默认高一）也不出
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
await openAdd(false); await pg.fill('[data-testid=add-name]', 'eh10'); await pg.click('[data-testid=home-grade-10]'); await w(500);
ok(await toMap('eh10'), '新高一档进地图'); await w(600); ok(!(await vis('[data-testid=elect-note]')), '高一新档不出');
// 3 家长编辑：高一 → 高二 / 高三 出一行；高二 → 高三 不出
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500);
for (let i = 0; i < 4 && await vis('.modal-back'); i++) { const btn = await pg.$('.modal-back [data-testid$=-later], .modal-back [data-testid$=-close], .modal-back [data-testid$=-ok], .modal-back button.ghost'); if (btn) await btn.click(); else await pg.mouse.click(5, 5); await w(400); }
await pg.click('[data-testid=edit-kid-10]'); await w(300);
ok(!(await vis('[data-testid=elect-upgrade-hint]')), '高一编辑：没有提示');
await pg.click('[data-testid=grade-11]'); await w(200);
const up = await pg.textContent('[data-testid=elect-upgrade-hint]').catch(() => '');
ok(up === '升到高二后默认「还没选科（全科）」。孩子已经选科的话，在下面选「已选科」。', `高一改高二：${up}`);
ok(await pg.evaluate(() => { const h = document.querySelector('[data-testid=elect-upgrade-hint]'), a = document.querySelector('[data-testid=el-all]'); return !!h && !!a && !!(h.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING); }), '提示在选科器上方');
await pg.screenshot({ path: OUT + 'upgrade.png' });
await pg.click('[data-testid=grade-12]'); await w(200); ok(await vis('[data-testid=elect-upgrade-hint]'), '高一改高三：也出');
await pg.click('text=取消'); await w(400);
const id11 = await pg.evaluate(() => [...document.querySelectorAll('[data-testid^=el-label-]')].map(e => e.dataset.testid.slice(9)).find(x => x !== 'kid-10'));
await pg.click(`[data-testid=edit-${id11}]`); await w(300); await pg.click('[data-testid=grade-12]'); await w(200);
ok(!(await vis('[data-testid=elect-upgrade-hint]')), '高二改高三：不出');
await pg.click('text=取消'); await w(300);
ok(!errs.length, `无页面错误 ${errs.join(' | ')}`);
await b.close(); console.log(bad ? `r171-electhint FAIL ${bad}` : 'r171-electhint ALL PASS'); process.exit(bad ? 1 : 0);
