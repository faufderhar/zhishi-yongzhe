// 线上/本地验证：URL=... node scripts/live-check.mjs  → screenshots/live/
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const U = process.env.URL || 'https://faufderhar.github.io/zhishi-yongzhe/';
const OUT = process.env.OUT || 'screenshots/live/'; await mkdir(OUT, { recursive: true });
const b = await chromium.launch(); const errs = []; let fails = 0;
const fail = m => { console.error('FAIL', m); fails++; };
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
const pg = await ctx.newPage();
await pg.addInitScript(() => { window.__zyTest = true; });   // 测试钩子：题干上暴露答案（仅自动化）
pg.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
pg.on('pageerror', e => errs.push(String(e)));
const w = ms => pg.waitForTimeout(ms);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
let pinSet = false;
const resetProfiles = () => pg.url().startsWith('http') && pg.evaluate(async () => { if (!(await indexedDB.databases()).some(d => d.name === 'zhishi-yongzhe')) return; await new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) { d.close(); return res(); } const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put([], 'profiles'); t.oncomplete = () => { d.close(); res(); }; }; r.onerror = res; }); });
/** 添加孩子（D7：需家长密码）→ 回档案页 → 点进新档案 → 选伙伴并确认 → 跳过新手引导由 skipTut 处理 */
async function addChild(g) {
  await resetProfiles(); await home();
  await pg.click('[data-testid=add-child]'); await w(300);
  if (!pinSet) { await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); pinSet = true; } else await pinIn('2468');
  await w(300); await pg.click(`[data-testid=home-grade-${g}]`); await w(500);
  const cards = await pg.$$('[data-testid^=profile-]'); await cards[cards.length - 1].click(); await w(1200);
  if (await pg.$('[data-testid^=char-]')) { await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600); }
}
const skipTut = async () => { await w(400); if (await pg.$('[data-testid=tutorial-skip]')) { await pg.click('[data-testid=tutorial-skip]'); await w(1500); } };
const home = async () => { await pg.goto(U); await pg.waitForSelector('[data-testid=add-child]', { timeout: 30000 }); await w(800); };
await home(); await pg.screenshot({ path: OUT + '01-home.png' });
const names = await pg.$$eval('[data-testid^=profile-]', e => e.map(x => x.textContent));
if (names.length < 3) fail('预置档案不足 3 个: ' + names);
await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); pinSet = true; await w(400); await pg.screenshot({ path: OUT + '02-grade-list.png' });
for (const g of ['8', '9', '11', '12']) if (!(await pg.isDisabled(`[data-testid=home-grade-${g}]`))) fail(g + ' 应为即将开放');
await pg.click('.modal-back', { position: { x: 5, y: 5 } }).catch(() => {}); await pg.keyboard.press('Escape');
const SHOT = { K1: 'K', 1: 'G1', 3: 'G2', 5: 'G3', 7: 'J', 10: 'H' };
for (const g of ['K1', '1', '2', '3', '4', '5', '6', '7', '10']) {
  await addChild(g);
  await pg.waitForSelector('[data-testid=level-1]', { timeout: 15000 }).catch(() => fail(g + ' 没有地图/关卡'));
  const units = (await pg.$$('[data-testid=unit-head]')).length;
  const chapters = (await pg.$$('[data-testid^=chapter-]')).length;
  if (SHOT[g]) await pg.screenshot({ path: `${OUT}map-${g}.png` });
  await pg.click('[data-testid=level-1]'); await skipTut(); await w(1000);
  const hasQ = await pg.$('.qtext, .kq');
  const qt = hasQ ? (await hasQ.textContent()).trim() : '';
  if (!qt) fail(g + ' 战斗没有题目');
  console.log(`年级 ${g}: 章节 ${chapters}，首章单元 ${units}，首题「${qt.slice(0, 24)}」`);
  if (SHOT[g]) await pg.screenshot({ path: `${OUT}battle-${g}.png` });
  if (g === '7') {   // 连击计数：连续答对选择题，连击应递增
    const seen = [];
    for (let k = 0; k < 12 && seen.length < 3; k++) {
      await pg.waitForSelector('[data-testid=anim]', { state: 'detached', timeout: 8000 }).catch(() => {});
      const r = await pg.$('.quiz .opt[data-correct="1"]');
      if (r) { await r.click(); await pg.click('[data-testid=act-attack]', { timeout: 3000 }).catch(() => {}); }
      else if (await pg.$('.keypad')) {
        const ans = await pg.getAttribute('.qtext', 'data-ans');
        const ok = ans && [...ans].every(ch => true) && !(await Promise.all([...ans].map(ch => pg.$(`.keypad [data-key="${ch}"]`)))).some(x => !x);
        if (ok) { for (const ch of ans) await pg.click(`.keypad [data-key="${ch}"]`); await pg.click('[data-testid=ok]'); await pg.click('[data-testid=act-attack]', { timeout: 3000 }).catch(() => {}); }
        else { await pg.click('.keypad button'); await pg.click('[data-testid=ok]'); seen.length = 0; }
        await pg.waitForSelector('[data-testid=next]:not([disabled]), [data-testid=to-map]', { timeout: 10000 }).catch(() => {});
        if (ok) { { const t = await pg.textContent('[data-testid=combo]', { timeout: 2000 }).catch(() => null); if (!t) break; seen.push(t); } if (seen.length === 2) await pg.screenshot({ path: `${OUT}battle-7-combo.png` }); }
        if (!(await pg.$('[data-testid=next]'))) break;
        await pg.click('[data-testid=next]'); await w(400); continue;
      }
      else if (await pg.$('.quiz .opt')) { await pg.click('.quiz .opt'); await pg.click('[data-testid=ok]').catch(() => {}); seen.length = 0; }
      else if (await pg.$('[data-testid=act-attack]')) { await pg.click('[data-testid=act-attack]'); }
      await pg.waitForSelector('[data-testid=next]:not([disabled]), [data-testid=to-map]', { timeout: 10000 }).catch(() => {});
      if (r) { { const t = await pg.textContent('[data-testid=combo]', { timeout: 2000 }).catch(() => null); if (!t) break; seen.push(t); } if (seen.length === 2) await pg.screenshot({ path: `${OUT}battle-7-combo.png` }); }
      if (!(await pg.$('[data-testid=next]'))) break;
      await pg.click('[data-testid=next]'); await w(400);
    }
    console.log('  连击:', seen.join(' → '));
    if (seen.length >= 2 && seen[seen.length - 1] === seen[0]) fail('连击没有增长');
  }
}
  // v7
  // v7 新科目：初一道法、高一生物/地理/政治
  for (const [g, subj, tag] of [['7', '道德与法治', 'daofa'], ['10', '生物', 'bio'], ['10', '地理', 'geo'], ['10', '政治', 'zhengzhi']]) {
    await addChild(g);
    await pg.click(`[data-testid=chapter-${subj}]`); await w(400);
    await pg.screenshot({ path: `${OUT}v7-map-${tag}.png` });
    await pg.click('[data-testid=level-1]'); await skipTut(); await w(800);
    const qt = await pg.textContent('.qtext, .kq').catch(() => '');
    if (!qt?.trim()) fail(subj + ' 战斗没有题目'); else console.log(`新科目 ${subj}: 「${qt.trim().slice(0, 28)}」`);
    await pg.screenshot({ path: `${OUT}v7-battle-${tag}.png` });
  }

// 旧状态：IndexedDB 里只剩幼儿园档案（模拟老版本/误删）→ 首页仍可添加任意年级
await pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const d = r.result; const t = d.transaction('kv', 'readwrite'); const s = t.objectStore('kv');
  s.put([{ id: 'kid-k', name: '小班宝贝', avatar: '🐰', grade: 'K1', volumes: null, limit: { weekday: 15, weekend: 15 } }], 'profiles'); t.oncomplete = res; }; }));
await home(); const n2 = (await pg.$$('[data-testid^=profile-]')).length; await pg.screenshot({ path: OUT + '03-stale-only-kinder.png' });
console.log('旧状态档案数', n2, '；添加孩子入口', !!(await pg.$('[data-testid=add-child]')));
console.log(errs.length ? 'HTTP/页面错误:\n' + errs.join('\n') : '无 HTTP/页面错误');
await b.close(); process.exit(fails ? 1 : 0);
