// r16.1 (p)(q)(s)(t) 较真家长_r16：1280×600 修改家长密码（键盘不用滚就看得见、当场再验、第二次改完按钮还在）；恢复码重设答案输两次
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/r161/pin/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1280, height: 600 } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; });
const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false); const txt = s => pg.textContent(s).catch(() => null);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(400); };
const inView = async s => { const bb = await pg.locator(s).first().boundingBox().catch(() => null); return !!bb && bb.y >= 0 && bb.y + bb.height <= 600; };
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-], [data-testid=add-child]'); await w(300);
await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468');
await pg.click('.pinpad input[type=radio] >> nth=0'); await pg.fill('[data-testid=hint-answer]', 'ab'); await pg.fill('[data-testid=hint-answer2]', 'ab'); await pg.click('[data-testid=hint-ok]');
await pg.waitForSelector('[data-testid=rec-code]'); const code = (await txt('[data-testid=rec-code]')).replace(/\s/g, '');
await pg.click('[data-testid=rec-done]'); await w(400); await pinIn('2468'); await w(400);
if (await vis('[data-testid=add-name]')) { await pg.fill('[data-testid=add-name]', 'pin'); await pg.click('[data-testid=home-grade-1]').catch(() => {}); await w(300); }
const home = async () => { for (let i = 0; i < 12 && !(await vis('[data-testid=parent]')); i++) { if (await vis('[data-testid=parent-close]')) await pg.click('[data-testid=parent-close]'); else if (await vis('[data-testid=map-back]')) await pg.click('[data-testid=map-back]'); else await pg.goto(URL); await w(400); } };
await home(); await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); if (await vis('.modal >> text=稍后')) await pg.click('.modal >> text=稍后');
await pg.click('[data-testid=ptab-pin]'); await w(300);
const change = async (oldP, newP, tag) => {
  await pg.click('[data-testid=pintab-change]'); await w(400);
  ok(await inView('[data-testid=pin-ok]') && await inView('[data-testid=pin-1]'), `${tag} 输入旧密码：键盘在 1280×600 视野内`); await pg.screenshot({ path: `${OUT}${tag}-old.png` });
  await pinIn(oldP); ok(await inView('[data-testid=pin-ok]'), `${tag} 输入新密码：键盘在视野内`); await pinIn(newP); await pinIn(newP);
  ok(await vis('[data-testid=pintab-verify]') && await inView('[data-testid=pin-ok]'), `${tag} 存好后当场再验（键盘在视野内）`); await pg.screenshot({ path: `${OUT}${tag}-verify.png` });
};
await change('2468', '1357', 'c1');
await pinIn('9999'); const e1 = await txt('[data-testid=pin-error]'); ok(/不一样/.test(e1 ?? '') && await vis('[data-testid=pintab-verify]'), `再验输错 → 提示、仍在再验：${e1}`);
await pinIn('1357'); ok(await vis('[data-testid=pintab-done]') && await vis('[data-testid=pintab-change]'), '再验输对 → ✔ 密码已修改，「修改家长密码…」还在');
await change('1357', '2468', 'c2'); await pinIn('2468');
ok(await vis('[data-testid=pintab-done]') && await vis('[data-testid=pintab-change]'), '第二次改完（1357→2468）按钮还在'); await pg.screenshot({ path: OUT + 'c2-done.png' });
await change('2468', '5555', 'c3'); await pg.click('[data-testid=pintab-verify-reset]'); await w(300);
ok(/输入新密码/.test(await txt('.pinpad h2, .pinpad h3, .pinpad') ?? ''), '再验页「重新设置」→ 回到输入新密码'); await pinIn('1357'); await pinIn('1357'); await pinIn('1357');
ok(await vis('[data-testid=pintab-done]'), '重新设置 1357 → 再验 → 完成');
// 锁屏用新密码
await pg.goto(URL); await w(800); await home(); await pg.click('[data-testid=parent]'); await w(300); await pinIn('1357'); if (await vis('.modal >> text=稍后')) await pg.click('.modal >> text=稍后');
ok(await vis('[data-testid=parent-close]'), '刷新后锁屏 1357 通过');
// (q) 恢复码重设：答案两个框
await home(); await pg.click('[data-testid=parent]'); await w(300); await pg.click('[data-testid=forgot]'); await w(400);
await pg.fill('[data-testid=rec-input]', code); await pg.click('[data-testid=rec-ok]'); await w(600);
await pg.fill('[data-testid=recset-pin1]', '4321'); await pg.fill('[data-testid=recset-pin2]', '4321'); await pg.click('[data-testid=recset] input[type=radio] >> nth=0');
await pg.fill('[data-testid=recset-answer]', 'mimi'); await pg.fill('[data-testid=recset-answer2]', 'mimj');
ok(await vis('[data-testid=recset-answer-mismatch]') && await pg.isDisabled('[data-testid=recset-ok]') && /再输一次相同的答案/.test(await txt('[data-testid=recset-why]') ?? ''), '恢复码重设：答案不一致 → 提示 + 确定变灰 + 还差说明');
await pg.screenshot({ path: OUT + 'recset-mismatch.png' });
await pg.fill('[data-testid=recset-answer2]', 'mimi'); ok(!(await pg.isDisabled('[data-testid=recset-ok]')) && !(await vis('[data-testid=recset-answer-mismatch]')), '一致 → 可以确定');
console.log(bad ? `FAILED ${bad}` : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
