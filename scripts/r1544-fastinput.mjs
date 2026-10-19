// r15.4.4 较真家长 c)：快速输入丢字排查——设置找回问题答案、恢复码抄回确认、恢复码输入、恢复码重设页的新密码 / 再输一次 / 答案。
// 每个框用三种方式各输一次：fill（一次设值）、keyboard.type delay 0（逐键 keydown/input/keyup）、CDP Input.insertText 逐字（像输入法上屏），
// 读回 value 对比；每种方式前清空。另外在输入中途让页面失焦再回焦（窗口切换后第一键）。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4352/'; const OUT = process.env.OUT || '/workspace/playtest/r1544-fastinput/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
const cdp = await ctx.newCDPSession(pg);
await pg.addInitScript(() => { window.__zyTest = true; });
const w = ms => pg.waitForTimeout(ms);
const tap = async sel => { const l = pg.locator(sel).first(); const bb = await l.boundingBox(); if (!bb) return false; await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
const pinIn = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(300); };
const val = sel => pg.inputValue(sel);
const clear = async sel => { await pg.fill(sel, ''); };
async function tryAll(sel, text, name, expectFn = v => v) {
  const res = {};
  for (const how of ['fill', 'type0', 'insertText', 'blur-type0']) {
    await clear(sel); await pg.focus(sel);
    if (how === 'fill') await pg.fill(sel, text);
    else if (how === 'type0') await pg.keyboard.type(text, { delay: 0 });
    else if (how === 'insertText') { for (const ch of text) await cdp.send('Input.insertText', { text: ch }); }
    else { await pg.evaluate(() => { document.activeElement?.blur(); window.dispatchEvent(new Event('blur')); }); await w(50); await pg.focus(sel); await pg.evaluate(() => window.dispatchEvent(new Event('focus'))); await pg.keyboard.type(text, { delay: 0 }); }
    await w(1300);   // 跨过一次 1 秒的重渲染
    res[how] = await val(sel);
  }
  const exp = expectFn(text); const okAll = Object.values(res).every(v => v === exp);
  ok(okAll, `${name}「${text}」：${Object.entries(res).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`);
  await clear(sel); if (exp) await pg.fill(sel, exp);
}
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]');
await tap('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468');
await tap('.pinpad input[type=radio]'); await w(200);
await tryAll('[data-testid=hint-answer]', '测试答案', '设置找回问题答案');
await tryAll('[data-testid=hint-answer]', 'ab测试cd', '设置找回问题答案（中英混合）');
await tap('[data-testid=hint-ok]'); await w(600);
const code = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, '');
await tryAll('[data-testid=rec-type]', code, '恢复码抄回确认');
await tryAll('[data-testid=rec-type]', code.slice(0, 4) + ' ' + code.slice(4), '恢复码抄回确认（带空格）');
await tap('[data-testid=rec-type-ok]'); await w(500);
if (await pg.isVisible('[data-testid=add-name]')) { await pg.fill('[data-testid=add-name]', 'fi'); await tap('[data-testid=home-grade-1]'); await w(500); }
// 回首页 → 家长 → 忘记密码 → 恢复码
for (let i = 0; i < 10 && !(await pg.isVisible('[data-testid=parent]')); i++) { for (const s of ['[data-testid=to-map]', '[data-testid=map-back]', '[data-testid=grade-back]', '[data-testid=back-char]', '.modal >> text=稍后']) if (await pg.isVisible(s)) { await tap(s); break; } await w(400); }
await tap('[data-testid=parent]'); await w(400); await tap('[data-testid=forgot]'); await w(400);
await tryAll('[data-testid=rec-input]', code, '忘记密码：恢复码输入');
await tap('[data-testid=rec-ok]'); await w(800);
ok(await pg.isVisible('[data-testid=recset]'), '恢复码通过，进了设新密码页');
await tryAll('[data-testid=recset-pin1]', '1357', '设新密码：新密码');
await tryAll('[data-testid=recset-pin2]', '1357', '设新密码：再输一次');
await tryAll('[data-testid=recset-answer]', '测试答案', '设新密码：找回问题答案');
await pg.screenshot({ path: OUT + 'recset.png' });
console.log(bad ? `r1544-fastinput FAIL ${bad}` : 'r1544-fastinput ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
