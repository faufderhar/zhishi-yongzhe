// r15.4.3 较真家长 P1 复现：覆盖恢复 → 忘记密码 → 恢复码重设 2468（两次）+ 找回问题 → 确认新恢复码 → 回首页点锁 → 输 2468，应当一次通过。
//  同一份备份再覆盖恢复（从锁屏「从备份恢复」，备份时的恢复码）→ 锁屏 2468 也应通过。全部触摸点屏 + 真实键盘逐字输入。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4340/'; const OUT = process.env.OUT || '/workspace/playtest/r1543/recpin/'; mkdirSync(OUT, { recursive: true });
const ROUNDS = Number(process.env.ROUNDS || 3); const NEW = process.env.NEWPIN || '2468'; const FAST = !!process.env.FAST;   // NEWPIN：重设成和备份不同的密码，能暴露「旧密码回写」
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, acceptDownloads: true }); const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (/pin-|stale|err/i.test(m.text())) errs.push(m.type() + ':' + m.text().slice(0, 160)); });
const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false);
const tap = async s => { const l = pg.locator(s).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const bb = await l.boundingBox(); if (!bb) throw new Error('no ' + s); await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
const pin = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(500); };
const typeIn = async (s, t) => { await tap(s); await pg.locator(s).fill(''); await pg.keyboard.type(t, { delay: 40 }); };
const verify = async P => { if (await vis('[data-testid=pin-verify]')) await pin(P); };   // r16 8c：设完 / 重设完密码马上再输一次
const later = async () => { if (await vis('.modal >> text=稍后')) { await tap('.modal >> text=稍后'); await w(300); } };
const home = async () => { for (let i = 0; i < 12 && !(await vis('[data-testid=add-child]')); i++) { await later(); if (await vis('[data-testid=parent-close]')) await tap('[data-testid=parent-close]'); else if (await vis('[data-testid=map-back]')) await tap('[data-testid=map-back]'); else if (await vis('[data-testid=grade-back]')) await tap('[data-testid=grade-back]'); else if (await vis('text=返回')) await tap('text=返回'); await w(500); } };
const kv = k => pg.evaluate(k => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => { r.result.close(); res(g.result); }; }; }), k);
async function lockTry(tag, P = NEW) { await home(); await tap('[data-testid=parent]'); await w(500); await pin(P); await later(); const okIn = await vis('[data-testid=parent-close]'); const e = await pg.textContent('[data-testid=pin-error]').catch(() => null);
  const banner = okIn && await vis('[data-testid=restored-from]');
  await pg.screenshot({ path: `${OUT}${tag}.png` }); const st = await kv('settings'); return { okIn, e, banner, hash: st?.pinHash?.slice(0, 12) }; }
async function recReset(code, tag) {
  await home(); await tap('[data-testid=parent]'); await w(400); await tap('[data-testid=forgot]'); await w(400);
  await typeIn('[data-testid=rec-input]', code); await tap('[data-testid=rec-ok]'); await w(600);
  await typeIn('[data-testid=recset-pin1]', NEW); await typeIn('[data-testid=recset-pin2]', NEW);
  await tap('[data-testid=recset] .toggle-line input[type=radio]'); await typeIn('[data-testid=recset-answer]', '测试答案');
  const v = await pg.evaluate(() => [...document.querySelectorAll('[data-testid^=recset-pin]')].map(e => e.value));
  await pg.screenshot({ path: `${OUT}${tag}-recset.png` }); await tap('[data-testid=recset-ok]'); await w(FAST ? 150 : 900);
  const newCode = ((await pg.textContent('[data-testid=rec-code]').catch(() => '')) || '').replace(/\s/g, '');
  const selfErr = await pg.textContent('[data-testid=pin-selfcheck]').catch(() => null);
  await typeIn('[data-testid=rec-type]', newCode); await tap('[data-testid=rec-type-ok]'); await w(FAST ? 100 : 900); await verify(NEW); await later();
  return { v, newCode, selfErr };
}
// 1. 首次设密码 2468 + 恢复码 R1，加一个孩子
await pg.goto(URL); await pg.waitForSelector('[data-testid=add-child]'); await w(500);
await tap('[data-testid=parent]'); await w(400); await pin('2468'); await pin('2468');
await tap('.pinpad input[type=radio]'); await typeIn('[data-testid=hint-answer]', 'x'); await typeIn('[data-testid=hint-answer2]', 'x'); await tap('[data-testid=hint-ok]'); await w(600);
const R1 = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, ''); await typeIn('[data-testid=rec-type]', R1); await tap('[data-testid=rec-type-ok]'); await w(800); await verify('2468'); await later();
// 2. 家长页导出备份
if (!(await vis('[data-testid=parent-close]'))) { await home(); await tap('[data-testid=parent]'); await w(400); await pin('2468'); await later(); }
await tap('[data-testid=ptab-backup]'); await w(400);
const [dl] = await Promise.all([pg.waitForEvent('download'), tap('[data-testid=backup-export]')]); const BK = OUT + 'backup.json'; await dl.saveAs(BK); await w(500);
const lastBefore = await kv('lastBackupAt');
// 3. 改密码 1357（家长页）
await tap('[data-testid=ptab-pin]'); await w(300); await tap('[data-testid=pintab-change]'); await w(300); await pin('2468'); await pin('1357'); await pin('1357'); await w(500);
if (await vis('[data-testid=rec-keep]')) await tap('[data-testid=rec-keep]');
// 4. 覆盖恢复（家长页，现在的密码 1357）
await tap('[data-testid=ptab-backup]'); await w(300);
const [fc] = await Promise.all([pg.waitForEvent('filechooser'), tap('text=📂 从备份恢复')]); await fc.setFiles(BK); await w(500);
await typeIn('[data-testid=restore-pin]', '1357'); await tap('[data-testid=restore-go]'); await pg.waitForEvent('load', { timeout: 15000 }).catch(() => {}); await w(2500);
await pg.waitForSelector('[data-testid=add-child], [data-testid^=profile-]'); await w(800);
let res_self = {}, R1x = null; const res = { restore1: await lockTry('after-restore1', '2468') };
res.lastAfterRestore = { before: lastBefore, after: await kv('lastBackupAt') };
// 4b. 自检：测试版强制「存下来的对不上」→ 报错、停在设新密码页、不发恢复码；关掉后再点「确定」→ 正常发码
{ await home(); await tap('[data-testid=parent]'); await w(400); await tap('[data-testid=forgot]'); await w(400);
  await typeIn('[data-testid=rec-input]', R1); await tap('[data-testid=rec-ok]'); await w(600);
  await typeIn('[data-testid=recset-pin1]', '2468'); await typeIn('[data-testid=recset-pin2]', '2468'); await tap('[data-testid=recset] .toggle-line input[type=radio]'); await typeIn('[data-testid=recset-answer]', '测试答案');
  await pg.evaluate(() => { window.__zyTestPinSaveFail = true; }); await tap('[data-testid=recset-ok]'); await pg.waitForSelector('[data-testid=pin-selfcheck]', { timeout: 6000 }).catch(() => {});
  res_self = { err: await pg.textContent('[data-testid=pin-selfcheck]').catch(() => null), stay: await vis('[data-testid=recset]'), code: await vis('[data-testid=rec-code]') };
  await pg.screenshot({ path: OUT + 'selfcheck-fail.png' }); await pg.evaluate(() => { window.__zyTestPinSaveFail = false; }); await tap('[data-testid=recset-ok]'); await w(900);
  const c2 = ((await pg.textContent('[data-testid=rec-code]').catch(() => '')) || '').replace(/\s/g, ''); res_self.retryCode = c2.length === 8;
  await typeIn('[data-testid=rec-type]', c2); await tap('[data-testid=rec-type-ok]'); await w(900); await verify('2468'); await later(); res_self.lock = await lockTry('selfcheck-retry-lock', '2468'); R1x = c2; }
// 5. 恢复码重设 × ROUNDS
let code = R1x || R1; res.rounds = [];
for (let r = 1; r <= ROUNDS; r++) { const x = await recReset(code, `rec${r}`); const t = await lockTry(`rec${r}-lock`); res.rounds.push({ ...x, ...t }); code = x.newCode || code; }
// 6. 锁屏「从备份恢复」同一份备份两次（备份时的恢复码 R1 / 备份时的密码 2468）
res.gate = [];
for (const [i, sec] of [[1, R1], [2, '2468']]) { await home(); await tap('[data-testid=parent]'); await w(400);
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), tap('[data-testid=gate-restore]')]); await fc2.setFiles(BK); await w(500);
  await typeIn('[data-testid=gate-restore-sec]', sec); await tap('[data-testid=gate-restore-go]'); await pg.waitForEvent('load', { timeout: 15000 }).catch(() => {}); await w(2500);
  await pg.waitForSelector('[data-testid=add-child], [data-testid^=profile-]'); await w(800); res.gate.push(await lockTry(`gate${i}-lock`, '2468'));
  // 再用 R1 重设一次
  const x = await recReset(R1, `gate${i}-rec`); res.gate.push({ ...x, ...(await lockTry(`gate${i}-rec-lock`)) }); }
writeFileSync(OUT + 'result.json', JSON.stringify({ res, errs }, null, 1)); console.log(JSON.stringify(res));
ok(res.restore1.okIn, `覆盖恢复后锁屏 ${NEW} 一次通过 ${JSON.stringify(res.restore1)}`);
res.rounds.forEach((x, i) => ok(x.okIn && x.v.every(v => v === NEW), `恢复码重设第 ${i + 1} 次（输入框 ${x.v.join('/')}）后锁屏 ${NEW} 一次通过 ${JSON.stringify({ okIn: x.okIn, e: x.e, selfErr: x.selfErr })}`));
res.gate.forEach((x, i) => ok(x.okIn, `锁屏从备份恢复 / 再重设 #${i + 1} 后锁屏 ${NEW} 一次通过 ${JSON.stringify({ okIn: x.okIn, e: x.e })}`));
ok(!!res_self.err && res_self.stay && !res_self.code, `自检失败时报错、停在设新密码页、不发恢复码 ${JSON.stringify(res_self.err)}`);
ok(res_self.retryCode && res_self.lock?.okIn, '自检恢复正常后再点确定 → 发新码，锁屏 2468 通过');
ok(res.restore1.banner === true && res_self.lock?.banner === false, `P3 「已从备份恢复」横幅：恢复后第一次进家长页显示（${res.restore1.banner}），下次进家长页自动收起（${res_self.lock?.banner}）`);
ok(!!res.lastAfterRestore.after, `P2-1 覆盖恢复后「上次备份」还在（导出后 ${res.lastAfterRestore.before} → 恢复后 ${res.lastAfterRestore.after}）`);
ok(!errs.filter(e => !/pin-stale/.test(e)).length, `没有页面错误 ${errs.slice(0, 4).join(' | ')}`);
if (errs.length) console.log('LOG', errs.join(' | '));
console.log(bad ? `r1543-recpin FAIL ${bad}` : 'r1543-recpin ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
