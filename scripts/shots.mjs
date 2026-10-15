// 截图 + 端到端检查：node scripts/shots.mjs（需先 npx vite preview --port 4173）
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4173/zhishi-yongzhe/';
const OUT = 'screenshots/';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await pg.addInitScript(() => { window.__spoken = []; const o = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = u => { window.__spoken.push(u.text); try { o(u); } catch {} }; });
const shot = n => pg.screenshot({ path: OUT + n + '.png' });
const tap = s => pg.click(s);
const wait = ms => pg.waitForTimeout(ms);
const fail = m => { console.error('ASSERT FAIL:', m); process.exitCode = 1; };
const home = async () => { await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]', { timeout: 20000 }); await wait(300); };
const pin = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await wait(200); };

await home(); await shot('01-profiles');
// ---- 家长：设置密码 → 档案/题库/时长/备份
await tap('[data-testid=parent]'); await wait(200); await shot('02-parent-set-password');
await pin('2468'); await pin('2468');
await pg.waitForSelector('[data-testid=ptab-profiles]');
for (const [name, grade] of [['一年级小宝', '1'], ['三年级同学', '3'], ['五年级同学', '5']]) {
  await tap('[data-testid=add-profile]'); await wait(200);
  await pg.fill('[data-testid=profile-editor] input', name);
  await tap(`[data-testid=grade-${grade}]`); await wait(100);
  if (grade === '5') await shot('04-parent-profile-editor');
  await tap('[data-testid=profile-save]'); await wait(200);
}
await shot('03-parent-profiles');
await tap('[data-testid=ptab-bank]'); await wait(300); await shot('05-parent-bank');
await pg.setInputFiles('[data-testid=import-file]', '/workspace/questions/题库_6年级.csv'); await pg.waitForSelector('[data-testid=import-preview]', { timeout: 15000 }); await wait(300);
await shot('06-parent-import-preview');
const pvText = await pg.textContent('[data-testid=import-preview]');
if (!/可玩 306/.test(pvText) || !/待家长确认 10/.test(pvText)) fail('导入预览计数不对: ' + pvText.slice(0, 200));
await pg.keyboard.press('Escape'); await pg.click('.modal-back', { position: { x: 5, y: 5 } }); await wait(200);
await tap('[data-testid=ptab-time]'); await wait(200); await shot('07-parent-time');
await tap('[data-testid=ptab-backup]'); await wait(200); await shot('08-parent-backup');
const [dl] = await Promise.all([pg.waitForEvent('download'), tap('[data-testid=backup-export]')]);
const bpath = '/tmp/zsyz-backup.json'; await dl.saveAs(bpath);
const bk = JSON.parse(await (await import('node:fs/promises')).readFile(bpath, 'utf8'));
if (bk.app !== 'zhishi-yongzhe' || !bk.stores.kv.length) fail('备份内容不对');
await tap('[data-testid=parent-close]'); await wait(300);

// ---- 通用：答题帮助
async function answer(right) {
  const sel = right ? '[data-correct="1"]' : '[data-correct="0"]';
  if (await pg.$('.quiz .opt' + sel)) { await pg.click('.quiz .opt' + sel); }
  else if (await pg.$('.quiz [data-testid=input]')) {
    if (right) { /* 填空：读答案不可见，按错处理 */ }
    await pg.click('.keypad button'); await tap('[data-testid=ok]');
  } else if (await pg.$('.quiz .opt')) { await pg.click('.quiz .opt'); await tap('[data-testid=ok]').catch(() => {}); }
  await wait(250);
}
async function playLevel({ wrongFirst = 1, shotPrefix, maxQ = 14 } = {}) {
  let n = 0, shotWrong = false, shotAct = false;
  while (n++ < maxQ * 3) {
    await pg.waitForSelector('[data-testid=anim]', { state: 'detached', timeout: 8000 }).catch(() => {});   // 等演出播完
    if (await pg.$('[data-testid=to-map]')) return true;
    if (await pg.$('[data-testid=revive-no]')) { await tap('[data-testid=revive-no]'); await wait(300); continue; }
    if (await pg.$('[data-testid=next]')) { await pg.waitForSelector('[data-testid=next]:not([disabled])'); await tap('[data-testid=next]'); await wait(300); continue; }
    if (await pg.$('[data-testid=anim]')) continue;
    await answer(n > wrongFirst);
    await pg.waitForSelector('[data-testid=anim]', { state: 'detached', timeout: 8000 }).catch(() => {});
    if (await pg.$('[data-testid=act-attack]')) { if (shotPrefix && !shotAct) { await shot(shotPrefix + '-action'); shotAct = true; } await tap('[data-testid=act-attack]'); await wait(300); }
    if (shotPrefix && !shotWrong && await pg.$('.feedback.bad')) { await shot(shotPrefix + '-wrong'); shotWrong = true; }
  }
  return !!(await pg.$('[data-testid=to-map]'));
}
async function enter(pid) { await home(); await tap(`[data-testid=profile-${pid}]`); await wait(400);
  if (await pg.$('[data-testid^=char-]')) { await pg.click('[data-testid^=char-]'); await wait(300); } }
async function pidOf(name) { await home(); return (await pg.getAttribute(`.profile-card:has-text("${name}")`, 'data-testid')).replace('profile-', ''); }

// ---- 初一：选角色 → 地图 → 战斗 → 暂停 → 答错看解析 → 结算
await home(); await tap('[data-testid=profile-kid-7]'); await wait(300); await shot('09-char-select-g7');
await pg.click('[data-testid=char-suansuan]'); await wait(300); await shot('10-map-g7');
await tap('[data-testid=level-1]'); await wait(500); await shot('11-battle-g7');
await tap('[data-testid=pause]'); await wait(200); await shot('12-pause');
const t1 = await pg.textContent('[data-testid=timer]'); await wait(2200); const t2 = await pg.textContent('[data-testid=timer]');
if (t1 !== t2) fail(`暂停时计时没停：${t1} → ${t2}`);
await tap('[data-testid=resume]'); await wait(200);
await playLevel({ wrongFirst: 2, shotPrefix: '13-battle-g7' });
await shot('14-result-g7');
await tap('[data-testid=to-map]'); await wait(300); await shot('15-map-g7-after');
// ---- 错题本 + 复习
await tap('[data-testid=wrongbook]'); await wait(300); await shot('16-wrongbook');
await tap('[data-testid=wb-review-all]'); await wait(300); await shot('17-review');
for (let i = 0; i < 12; i++) { if (await pg.$('[data-testid=review-stats]')) break;
  if (await pg.$('[data-testid=next]')) { await tap('[data-testid=next]'); await wait(200); continue; }
  if (await pg.$('.review-card .opt[data-correct="1"]')) await pg.click('.review-card .opt[data-correct="1"]'); else { await pg.click('.keypad button'); await tap('[data-testid=ok]'); }
  await wait(200); if (i === 0) await shot('18-review-feedback'); }

// ---- 高一（公式）
await enter('kid-10'); await shot('19-map-g10');
await tap('[data-testid=chapter-物理]').catch(() => {}); await wait(200);
await tap('[data-testid=level-1]'); await wait(500);
for (let i = 0; i < 6 && !(await pg.$('.qtext .katex')); i++) { await playLevel({ maxQ: 1 }); }
await shot('20-battle-g10');

// ---- 小学
const p1 = await pidOf('一年级小宝'), p3 = await pidOf('三年级同学'), p5 = await pidOf('五年级同学');
await enter(p1); await shot('21-map-grade1'); await tap('[data-testid=level-1]'); await wait(600); await shot('22-battle-grade1-simple');
await answer(true); await wait(300); await shot('23-battle-grade1-auto-action');
const sp1 = await pg.evaluate(() => window.__spoken.filter(s => s.trim()));
if (!sp1.length) fail('1 年级没有自动朗读');
await enter(p3); await tap('[data-testid=level-1]'); await wait(500); await shot('24-battle-grade3');
await enter(p5); await tap('[data-testid=chapter-数学]'); await tap('[data-testid=level-1]'); await wait(500); await shot('25-battle-grade5');

// ---- 幼儿园：重答规则 + 不读选项 + 暂停
await enter('kid-k'); await shot('26-map-kinder');
await tap('[data-testid=level-1]'); await wait(600); await shot('27-kinder-battle');
await pg.evaluate(() => { window.__spoken = []; });
const optTexts = new Set(); let retryShot = false, demoShot = false;
for (let i = 0; i < 20; i++) {
  if (await pg.$('[data-testid=to-map]')) break;
  for (const t of await pg.$$eval('.kopt', els => els.map(e => e.textContent.trim()))) optTexts.add(t);
  const wrong = await pg.$$('.kopt[data-correct="0"]'); const n0 = (await pg.$$('.kopt')).length;
  if (!wrong.length) { await pg.click('.kopt[data-correct="1"]'); await wait(1700); continue; }
  await wrong[0].click(); await wait(250);
  if (await pg.$('.kopt.reveal')) fail('幼儿园第一次答错就演示了答案');
  if (n0 >= 3 && (await pg.$$('.kopt')).length !== n0 - 1) fail('幼儿园第一次答错后选项没有减少 1');
  await wait(700); if (!retryShot) { await shot('28-kinder-retry'); retryShot = true; }
  const w2 = await pg.$('.kopt[data-correct="0"]');
  if (!demoShot && w2) { await w2.click(); await wait(300); if (!(await pg.$('.kopt.reveal'))) fail('第二次答错没演示'); await shot('29-kinder-demo'); demoShot = true; await wait(2000); continue; }
  await pg.click('.kopt[data-correct="1"]'); await wait(1700);
}
await wait(400); await shot('30-kinder-result');
const spoken = await pg.evaluate(() => window.__spoken);
if (spoken.some(s => [...optTexts].some(o => o && s.trim() === o))) fail('幼儿园朗读了选项');
await tap('[data-testid=to-map]'); await wait(200); await tap('[data-testid=level-2]'); await wait(400); await tap('[data-testid=pause]'); await wait(200); await shot('31-kinder-pause');

// ---- 时间用完
await home(); await tap('[data-testid=parent]'); await pin('2468'); await tap('[data-testid=ptab-profiles]');
await tap(`[data-testid=edit-${p3}]`); await wait(200);
for (let i = 0; i < 12; i++) await pg.click('.stepper:first-of-type .chip:first-of-type');
for (let i = 0; i < 14; i++) await pg.click('.stepper:nth-of-type(2) .chip:first-of-type');
await tap('[data-testid=profile-save]'); await tap('[data-testid=parent-close]'); await wait(200);
// 0 = 不限；改为 1 分钟并用掉
await home(); await pg.evaluate(async (id) => {
  const r = indexedDB.open('zhishi-yongzhe'); await new Promise(ok => r.onsuccess = ok);
  const db = r.result; const tx = db.transaction('kv', 'readwrite'); const st = tx.objectStore('kv');
  const g = st.get('profiles'); await new Promise(ok => g.onsuccess = ok);
  const ps = g.result.map(p => p.id === id ? { ...p, limit: { weekday: 1, weekend: 1 } } : p); st.put(ps, 'profiles');
  const d = new Date(); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  st.put({ [day]: { used: 120, bonus: 0 } }, 'usage:' + id); await new Promise(ok => tx.oncomplete = ok);
}, p3);
await home(); await shot('32-profiles-timeup'); await tap(`[data-testid=profile-${p3}]`); await wait(300); await shot('33-map-timeup');

// ---- 竖屏
await pg.setViewportSize({ width: 820, height: 1180 }); await enter('kid-7'); await tap('[data-testid=level-1]'); await wait(400); await shot('34-portrait-g7');
console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
