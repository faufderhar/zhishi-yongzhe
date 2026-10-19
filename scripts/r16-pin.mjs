// r16 8c 较真家长：密码页浏览器验证（测试包，有界面 + xdotool --delay 80 逐字输入，先 focus）
//  首次设置：答案输两次（不一致提示 + 不能确定）→ 恢复码「再输一遍」计数 → verify 页（错一次提示 / 重新设置 / 对了进家长页）
//  修改家长密码后自检通过、锁屏新密码一次通过；忘记密码页恢复码计数；输错 5 次锁定倒计时在走、ParentGate 不每秒重渲染
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/pin/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: false, args: ['--window-position=0,0', '--window-size=1100,860'] }); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1080, height: 760 } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; });
const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false); const txt = s => pg.textContent(s).catch(() => null);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(400); };
const xt = async (sel, t) => { await pg.bringToFront(); await pg.click(sel); await pg.fill(sel, ''); await pg.focus(sel); await w(150); execFileSync('xdotool', ['type', '--delay', '80', t]); await w(200); return pg.inputValue(sel); };
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468');
await pg.click('.pinpad input[type=radio] >> nth=0');
const a1 = await xt('[data-testid=hint-answer]', 'doudou'); const a2 = await xt('[data-testid=hint-answer2]', 'doudo');
ok(a1 === 'doudou' && await vis('[data-testid=hint-mismatch]') && await pg.isDisabled('[data-testid=hint-ok]'), `答案两次不一致 → 提示 + 确定变灰（${a1}/${a2}）`);
await xt('[data-testid=hint-answer2]', 'doudou');
ok(!(await vis('[data-testid=hint-mismatch]')) && !(await pg.isDisabled('[data-testid=hint-ok]')), '两次一致 → 可以确定');
await pg.screenshot({ path: OUT + 'hint2.png' }); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]');
const code = (await txt('[data-testid=rec-code]')).replace(/\s/g, '');
await xt('[data-testid=rec-type]', code.slice(0, 5)); const c5 = await txt('[data-testid=rec-count]');
ok(c5?.includes(`已输入 5/8 位：${code.slice(0, 4)} ${code[4]}，还差 3 位`), `再输一遍恢复码计数：${c5}`);
await xt('[data-testid=rec-type]', code); ok((await txt('[data-testid=rec-count]'))?.includes('已输入 8/8 位'), '输满 8 位');
await pg.screenshot({ path: OUT + 'rec-count.png' }); await pg.click('[data-testid=rec-type-ok]'); await w(600);
ok(await vis('[data-testid=pin-verify]'), '记下恢复码后进入「再输一次刚设的密码」');
await pinIn('1111'); const ve = await txt('[data-testid=pin-error]'); ok(/不一样/.test(ve ?? '') && await vis('[data-testid=pin-verify]'), `verify 输错 → 提示、仍在 verify：${ve}`);
await pinIn('1111'); ok(/第 2 次/.test(await txt('[data-testid=pin-error]') ?? ''), '再错一次 → 提示更新（输入框被清空）');
await pg.screenshot({ path: OUT + 'verify-wrong.png' });
await pg.click('[data-testid=pin-verify-reset]'); await w(300); ok(/设置新的家长密码/.test(await txt('.pinpad h2') ?? ''), '点「重新设置」→ 回到设密码');
await pinIn('1357'); await pinIn('1357'); await pg.click('.pinpad input[type=radio] >> nth=0'); await xt('[data-testid=hint-answer]', 'ab'); await xt('[data-testid=hint-answer2]', 'ab'); await pg.click('[data-testid=hint-ok]');
await pg.waitForSelector('[data-testid=rec-code]'); await pg.click('[data-testid=rec-done]'); await w(400); await pinIn('1357');
ok(!(await vis('[data-testid=pin-verify]')), 'verify 输对 → 放行');
await pg.fill('[data-testid=add-name]', 'pin'); await pg.click('[data-testid=home-grade-1]').catch(() => {}); await w(300);
// 修改家长密码
const home = async () => { for (let i = 0; i < 12 && !(await vis('[data-testid=parent]')); i++) { if (await vis('[data-testid=parent-close]')) await pg.click('[data-testid=parent-close]'); else if (await vis('[data-testid=map-back]')) await pg.click('[data-testid=map-back]'); else await pg.goto(URL); await w(400); } };
await home(); await pg.click('[data-testid=parent]'); await w(300); await pinIn('1357'); if (await vis('.modal >> text=稍后')) await pg.click('.modal >> text=稍后');
await pg.click('[data-testid=ptab-pin]'); await w(300); await pg.click('[data-testid=pintab-change]'); await w(300); await pinIn('1357'); await pinIn('8642'); await pinIn('8642'); await w(800);
ok(!(await vis('[data-testid=pin-error]')) && !(await txt('body'))?.includes('没有存好'), '修改家长密码 → 自检通过');
await pg.screenshot({ path: OUT + 'change-done.png' });
await pg.goto(URL); await w(800); await home(); await pg.click('[data-testid=parent]'); await w(300); await pinIn('8642'); if (await vis('.modal >> text=稍后')) await pg.click('.modal >> text=稍后');
ok(await vis('[data-testid=parent-close]'), '刷新后锁屏新密码 8642 一次通过');
// 锁定倒计时 + 父组件不每秒重渲染（在恢复码框里一直输着字也不被打断）
await home(); await pg.click('[data-testid=parent]'); await w(300); for (let i = 0; i < 5; i++) await pinIn('0000');
const l1 = await txt('[data-testid=pin-error]'); await w(2200); const l2 = await txt('[data-testid=pin-error]');
ok(/后再试/.test(l1 ?? '') && l1 !== l2, `锁定倒计时在走：${l1} → ${l2}`);
await pg.click('[data-testid=forgot]'); await w(300);
if (await vis('[data-testid=rec-input]')) { const v = await xt('[data-testid=rec-input]', 'ABCD-EF'); ok(v === 'ABCD-EF' && (await txt('[data-testid=rec-count]'))?.includes('已输入 6/8 位：ABCD EF，还差 2 位'), `忘记密码页恢复码计数（${v}）`); }
else { await pg.click('text=恢复码').catch(() => {}); await w(300); const v = await xt('[data-testid=rec-input]', 'ABCD-EF'); ok((await txt('[data-testid=rec-count]'))?.includes('已输入 6/8 位'), `忘记密码页恢复码计数（${v}）`); }
await pg.screenshot({ path: OUT + 'forgot-count.png' });
await b.close(); console.log(bad ? `FAILED ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
