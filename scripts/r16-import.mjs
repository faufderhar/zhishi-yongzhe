// r16 第 9 步 技术QA：导入题库（测试包）——超大文件 / 超题数一条提示、GBK CSV 一条「另存为 UTF-8」、换新文件清掉旧错误、
//  上限内最大的 6000 题文件：进度提示出现、到预览 / 导入用时；同一份再导一次不被总数上限挡住
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4471/'; const D = '/workspace/playtest/r16dev/import/';
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const pg = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); pg.setDefaultTimeout(20000);
await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; });
const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false); const txt = s => pg.textContent(s).catch(() => null);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x'); await pg.click('[data-testid=hint-ok]');
await pg.waitForSelector('[data-testid=rec-code]').then(() => pg.click('[data-testid=rec-done]')); await pg.waitForSelector('[data-testid=pin-verify]').then(() => pinIn('2468'));
if (await vis('.modal >> text=稍后')) await pg.click('.modal >> text=稍后');
await pg.click('[data-testid=ptab-bank]').catch(() => pg.click('text=题库')); await pg.waitForSelector('[data-testid=bank-table]');
const pick = async f => { await pg.setInputFiles('[data-testid=import-file]', D + f); };
const closePv = async () => { if (await vis('[data-testid=import-preview]')) { await pg.click('[data-testid=import-preview] >> text=取消，修改后重新导入'); await w(200); } };
await pick('big.json'); await w(300); ok(/文件太大（9\.0 MB）/.test(await txt('[data-testid=import-msg]') ?? ''), `9 MB 文件：${await txt('[data-testid=import-msg]')}`);
await pick('over6001.json'); await pg.waitForSelector('[data-testid=import-msg]'); await w(500); ok(/6001 题.*最多导入 6000 题/.test(await txt('[data-testid=import-msg]') ?? ''), `6001 题：${await txt('[data-testid=import-msg]')}`);
await pick('gbk.csv'); await w(500); const g = await txt('[data-testid=import-msg]');
ok(/不是 UTF-8/.test(g ?? '') && !(await vis('[data-testid=import-preview]')) && !/status 非法/.test(await txt('body')), `GBK CSV 只一条：${g}`);
await pg.screenshot({ path: D + 'gbk.png' });
await pick('bad.csv'); await w(500); ok(await vis('[data-testid=import-preview]') && !(await vis('[data-testid=import-msg]')), '换新文件 → 上一个文件的提示清掉了');
const issues = await txt('[data-testid=import-preview] .issues'); await closePv();
await pick('good.csv'); await w(500); ok(await vis('[data-testid=import-preview]') && !(await txt('[data-testid=import-preview]'))?.includes('第 2 行'), `再换一个正确文件 → 预览里没有上一个文件的错误（上一个：${issues?.slice(0, 60)}）`); await closePv();
// 6000 题
const t0 = Date.now(); await pick('max6000.json'); const sawBusy = await pg.waitForSelector('[data-testid=import-busy]', { timeout: 3000 }).then(() => true).catch(() => false);
await pg.waitForSelector('[data-testid=import-preview]', { timeout: 30000 }); const tPv = Date.now() - t0; await pg.screenshot({ path: D + 'preview6000.png' });
ok(sawBusy, '6000 题：有进度提示'); ok(tPv < 6000, `6000 题到预览 ${tPv} ms`);
const t1 = Date.now(); await pg.click('[data-testid=import-confirm]'); await pg.waitForSelector('[data-testid=import-msg]', { timeout: 30000 }); const tImp = Date.now() - t1;
ok(/已导入 6000 题/.test(await txt('[data-testid=import-msg]') ?? ''), `导入 ${tImp} ms：${await txt('[data-testid=import-msg]')}`);
await pick('max6000.json'); await pg.waitForSelector('[data-testid=import-preview]'); await pg.click('[data-testid=import-confirm]'); await w(800);
ok(/已导入 6000 题/.test(await txt('[data-testid=import-msg]') ?? ''), '同一份再导一次（全是更新）不会被总数上限挡住');
console.log(JSON.stringify({ tPv, tImp })); await b.close(); console.log(bad ? `FAILED ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
