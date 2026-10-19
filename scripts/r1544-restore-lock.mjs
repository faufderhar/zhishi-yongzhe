// r15.4.4 技术QA P3：密码页 / 忘记密码页覆盖恢复后，活跃的锁必须清零（不被 ParentGate 1 秒计时器盖回去）
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4353/'; const OUT = process.env.OUT || '/workspace/playtest/r1544dev/restore-lock/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const LOCKS = ['zy.pinLock', 'zy.hintLock', 'zy.recLock', 'zy.cancelLock', 'zy.importLock'];
async function run(from) {
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, acceptDownloads: true });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(12000);
  const w = ms => pg.waitForTimeout(ms);
  const tap = async s => { const l = pg.locator(s).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const bb = await l.boundingBox(); if (!bb) throw new Error('no ' + s); await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
  const pin = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(400); };
  const typeIn = async (s, t) => { await tap(s); await pg.locator(s).fill(''); await pg.keyboard.type(t, { delay: 30 }); };
  const later = async () => { if (await pg.isVisible('.modal >> text=稍后')) { await tap('.modal >> text=稍后'); await w(300); } };
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyUnlockAll = true; window.__zyTestSpentSec = -1e7; });
  await pg.goto(URL); await pg.waitForSelector('[data-testid=add-child]'); await w(400);
  await tap('[data-testid=parent]'); await w(400); await pin('2468'); await pin('2468');
  await tap('.pinpad input[type=radio]'); await typeIn('[data-testid=hint-answer]', 'x'); await tap('[data-testid=hint-ok]'); await w(600);
  const R1 = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, ''); await typeIn('[data-testid=rec-type]', R1); await tap('[data-testid=rec-type-ok]'); await w(800); await later();
  // export backup
  if (!(await pg.isVisible('[data-testid=parent-close]'))) { await tap('[data-testid=parent]'); await pin('2468'); await later(); }
  await tap('[data-testid=ptab-backup]'); await w(300);
  const [dl] = await Promise.all([pg.waitForEvent('download'), tap('[data-testid=backup-export]')]); const BK = OUT + `bk-${from}.json`; await dl.saveAs(BK); await w(400);
  await tap('[data-testid=parent-close]'); await w(400);
  // lock the PIN (5 wrong tries)
  await tap('[data-testid=parent]'); await w(300);
  for (let i = 0; i < 5; i++) { await pin('0000'); await w(200); }
  const locked = await pg.isVisible('[data-testid=pin-error]'); ok(locked || /锁定|小时|分钟/.test(await pg.textContent('.pinpad').catch(() => '')), `${from}: 锁上了`);
  // also seed locks in storage so remain is high
  await pg.evaluate(ks => { const huge = { fails: 4, level: 3, until: Date.now() + 9e5, remain: 9e5, seenAt: Date.now() - 5e3 }; for (const k of ks) if (k !== 'zy.importLock') localStorage.setItem(k, JSON.stringify(huge)); }, LOCKS);   // 导入锁留给 GateRestore 自己计，不然输入框会灰掉
  // restore from PIN or forgot page
  if (from === 'forgot') { await tap('[data-testid=forgot]'); await w(800); await pg.waitForSelector('[data-testid=forgot-page], [data-testid=forgot-old-hint], [data-testid=gate-restore]'); }
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), tap('[data-testid=gate-restore]')]); await fc.setFiles(BK); await w(500);
  await typeIn('[data-testid=gate-restore-sec]', '2468'); await tap('[data-testid=gate-restore-go]');
  await pg.waitForEvent('load', { timeout: 20000 }).catch(() => {}); await w(2500);
  await pg.waitForSelector('[data-testid=add-child], [data-testid^=profile-]'); await w(1500);
  // check locks cleared in IDB + localStorage; also that PIN works once
  const locks = await pg.evaluate(async ks => {
    const idb = await new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const d = r.result; const tx = d.transaction('kv'); const st = tx.objectStore('kv'); Promise.all(ks.map(k => new Promise(rr => { const g = st.get(k); g.onsuccess = () => rr([k, g.result]); }))).then(a => { d.close(); res(Object.fromEntries(a)); }); }; });
    const ls = Object.fromEntries(ks.map(k => [k, JSON.parse(localStorage.getItem(k) || 'null')]));
    return { idb, ls, restoring: !!window.__zyRestoring };
  }, LOCKS);
  writeFileSync(OUT + `locks-${from}.json`, JSON.stringify(locks, null, 1));
  for (const k of LOCKS) {
    const a = locks.idb[k], b = locks.ls[k];
    ok(a && a.fails === 0 && (a.remain ?? 0) === 0 && a.level === 0, `${from}: IDB ${k} 清零 ${JSON.stringify(a)}`);
    ok(b && b.fails === 0 && (b.remain ?? 0) === 0 && b.level === 0, `${from}: LS ${k} 清零 ${JSON.stringify(b)}`);
  }
  // snooze cleared
  const snooze = await pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('backupSnoozeUntil'); g.onsuccess = () => { r.result.close(); res(g.result); }; }; }));
  ok(snooze == null, `${from}: backupSnoozeUntil 清空（得 ${snooze}）`);
  // PIN works
  await tap('[data-testid=parent]'); await w(400); await pin('2468'); await later();
  ok(await pg.isVisible('[data-testid=parent-close]'), `${from}: 恢复后家长密码一次通过`);
  await pg.screenshot({ path: OUT + `after-${from}.png` });
  await ctx.close();
}
await run('pin'); await run('forgot');
// forgot single-tap（独立新档案）
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true }); const pg = await ctx.newPage();
  const tap = async s => { const l = pg.locator(s).first(); await l.waitFor({ state: 'visible', timeout: 8000 }); const bb = await l.boundingBox(); await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
  const pin = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await pg.waitForTimeout(300); };
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyUnlockAll = true; });
  await pg.goto(URL); await pg.waitForSelector('[data-testid=add-child]'); await pg.waitForTimeout(400);
  await tap('[data-testid=parent]'); await pin('2468'); await pin('2468');
  await tap('.pinpad input[type=radio]'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await tap('[data-testid=hint-ok]'); await pg.waitForTimeout(500);
  const code = (await pg.textContent('[data-testid=rec-code]')).replace(/\s/g, ''); await pg.fill('[data-testid=rec-type]', code); await tap('[data-testid=rec-type-ok]'); await pg.waitForTimeout(600);
  if (await pg.isVisible('.modal >> text=稍后')) await tap('.modal >> text=稍后');
  await tap('[data-testid=parent-close]').catch(() => {}); await pg.waitForTimeout(400);
  await tap('[data-testid=parent]'); await pg.waitForTimeout(500);
  await tap('[data-testid=forgot]'); await pg.waitForTimeout(500);
  ok(await pg.isVisible('[data-testid=forgot-page], [data-testid=rec-input], [data-testid=forgot-old-hint]'), '忘记密码：触屏一次点进');
  await ctx.close();
}
await b.close(); process.exit(bad ? 1 : 0);
