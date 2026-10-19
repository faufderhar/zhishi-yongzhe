// r15.4.3 较真家长 P1（丢字 / 串字）：CPU 降速下快速点数字键盘、连发触摸、键盘快速输入恢复码 / 新密码 / 答案框，看有没有丢字、多字、串框。
//  A 逐个快速 tap；B 用 CDP 连发 4 个触摸（不等页面渲染，模拟卡顿时手指很快）；C 触摸后再用鼠标点确定（混合输入）；D 设新密码页三个输入框快速打字。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4341/'; const OUT = process.env.OUT || '/workspace/playtest/r1543final/rapidkeys/'; mkdirSync(OUT, { recursive: true });
const RATE = Number(process.env.RATE || 20), N = Number(process.env.N || 8);
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true }); const pg = await ctx.newPage(); pg.setDefaultTimeout(15000);
const cdp = await ctx.newCDPSession(pg);
const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false);
const ctr = async s => { const bb = await pg.locator(s).first().boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
const tap = async s => { const [x, y] = await ctr(s); await pg.touchscreen.tap(x, y); };
const dots = () => pg.locator('[data-testid=pin-dots] span.on').count();
const burst = async digits => { const pts = []; for (const d of digits) pts.push(await ctr(`[data-testid=pin-${d}]`));
  await Promise.all(pts.flatMap(([x, y]) => [cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }), cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })])); };
const throttle = r => cdp.send('Emulation.setCPUThrottlingRate', { rate: r });
await pg.goto(URL); await pg.waitForSelector('[data-testid=add-child]'); await w(500);
await throttle(RATE);
// 设密码（快速 tap）
await tap('[data-testid=parent]'); await w(800);
for (const d of '2468') await tap(`[data-testid=pin-${d}]`); const d0 = await dots(); await tap('[data-testid=pin-ok]'); await w(800);
for (const d of '2468') await tap(`[data-testid=pin-${d}]`); const d1 = await dots(); await tap('[data-testid=pin-ok]'); await w(1200);
ok(d0 === 4 && d1 === 4 && await vis('[data-testid=hint-answer]'), `设密码：CPU ÷${RATE} 快速点 2468 两次，圆点 ${d0}/${d1}，进了找回问题页`);
await pg.locator('.pinpad input[type=radio]').first().check(); await pg.locator('[data-testid=hint-answer]').fill('x'); await tap('[data-testid=hint-ok]'); await w(1500);
const R = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, ''); await tap('[data-testid=rec-done]').catch(() => {}); await w(800); if (await vis('.modal >> text=稍后')) await tap('.modal >> text=稍后');
const lockOpen = async () => { for (let i = 0; i < 8 && !(await vis('[data-testid=add-child]')); i++) { if (await vis('[data-testid=parent-close]')) await tap('[data-testid=parent-close]'); else if (await vis('text=返回')) await tap('text=返回'); await w(600); } await tap('[data-testid=parent]'); await w(800); };
// A：逐个快速 tap 输入 N 次
let aOk = 0, aLog = []; for (let i = 0; i < N; i++) { await lockOpen(); for (const d of '2468') await tap(`[data-testid=pin-${d}]`); const n = await dots(); await tap('[data-testid=pin-ok]'); await w(1000); const inn = await vis('[data-testid=parent-close]'); aLog.push(`${n}${inn ? '✓' : '✗'}`); if (n === 4 && inn) aOk++; if (await vis('.modal >> text=稍后')) await tap('.modal >> text=稍后'); }
ok(aOk === N, `A 锁屏快速 tap 2468 × ${N}：${aLog.join(' ')}`);
// B：CDP 连发（不等渲染）
let bOk = 0, bLog = []; for (let i = 0; i < N; i++) { await lockOpen(); await burst('2468'); await w(600); const n = await dots(); await tap('[data-testid=pin-ok]'); await w(1000); const inn = await vis('[data-testid=parent-close]'); bLog.push(`${n}${inn ? '✓' : '✗'}`); if (n === 4 && inn) bOk++; else if (!inn) { const e = await pg.textContent('[data-testid=pin-error]').catch(() => ''); bLog.push(`(${e})`); } }
ok(bOk === N, `B 锁屏连发 4 个触摸（CPU ÷${RATE}）× ${N}：${bLog.join(' ')}`);
await pg.screenshot({ path: OUT + 'B-after.png' });
// C：触摸输数字 + 鼠标点确定；再触摸点确定
await lockOpen(); for (const d of '2468') await tap(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(1000); const c1 = await vis('[data-testid=parent-close]');
await lockOpen(); for (const d of '2468') await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(1000); const c2a = await vis('[data-testid=parent-close]');
await lockOpen(); for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(1000); const c2 = await vis('[data-testid=parent-close]');
ok(c1 && c2a && c2, `C 混合输入：触摸数字 + 鼠标确定 ${c1}；触摸确定 ${c2a}；之后全用鼠标 ${c2}（以前触摸确定留下的标记会吞掉下一次鼠标确定）`);
// D：恢复码 → 设新密码页快速打字
await lockOpen(); await tap('[data-testid=forgot]'); await w(800);
await tap('[data-testid=rec-input]'); await pg.keyboard.type(R, { delay: 0 }); const rv = await pg.inputValue('[data-testid=rec-input]'); await tap('[data-testid=rec-ok]'); await w(1500);
const dv = []; for (const [s, t] of [['recset-pin1', '9753'], ['recset-pin2', '9753'], ['recset-answer', '测试答案']]) { await tap(`[data-testid=${s}]`); await pg.keyboard.type(t, { delay: 0 }); dv.push(await pg.inputValue(`[data-testid=${s}]`)); }
// 多打一位 / 切框后接着打：maxLength 4 + 只留数字
await tap('[data-testid=recset-pin1]'); await pg.keyboard.type('12', { delay: 0 }); const over = await pg.inputValue('[data-testid=recset-pin1]');
await pg.screenshot({ path: OUT + 'D-recset.png' });
ok(rv === R && dv[0] === '9753' && dv[1] === '9753' && dv[2] === '测试答案' && over === '9753', `D 快速打字：恢复码 ${rv === R}，新密码 ${dv[0]}/${dv[1]}，答案 ${dv[2]}；满 4 位再打不串进别的框（${over}）`);
await pg.locator('[data-testid=recset] .toggle-line input[type=radio]').first().check(); await tap('[data-testid=recset-ok]'); await w(2500);
const c3 = ((await pg.textContent('[data-testid=rec-code]').catch(() => '')) || '').replace(/\s/g, ''); await tap('[data-testid=rec-type]'); await pg.keyboard.type(c3, { delay: 0 }); await tap('[data-testid=rec-type-ok]'); await w(1500);
if (await vis('.modal >> text=稍后')) await tap('.modal >> text=稍后');
await lockOpen(); await burst('9753'); await w(600); await tap('[data-testid=pin-ok]'); await w(1000); const d2 = await vis('[data-testid=parent-close]');
ok(d2, 'D 重设成 9753 后锁屏连发输入 9753 一次通过');
await throttle(1); console.log(bad ? `r1543-rapidkeys FAIL ${bad}` : 'r1543-rapidkeys ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
