// r16 D15 浏览器验证（测试包）：高一 / 初一实战，每次我方答对命中：
//  结果行下摘要只占一行（768 竖屏也不换行）、明细浮层最后一行 ≈ 实际伤害（差 ≤1）、重击 + 押注时出「已到上限 ×1.8」；
//  明细展开后下一次默认展开（按设备记住），点空白处关闭；题卡上摘要一行；小学 1–2 年级 / 幼儿园没有摘要。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/d15/'; mkdirSync(OUT, { recursive: true });
const VPS = (process.env.VPS || '768x1024,1280x690').split(',');
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; }; const rep = [];
let pg; const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s);
const tap = async sel => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const bb = await l.boundingBox().catch(() => null); if (!bb) return false; await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
const pinIn = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(250); };
async function toMap() { for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')); i++) {
  if (await vis('[data-testid=pin-ok]')) await pinIn('2468'); else if (await vis('[data-testid=stage-pick]')) await tap('[data-testid=stage-pick] .stage-btn.on'); else if (await vis('[data-testid=grade-pick]')) await tap('[data-testid=grade-pick] .stage-btn.on');
  else if (await vis('[data-testid=char-confirm]')) { await tap('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await tap('[data-testid=char-confirm]'); }
  else if (await vis('text=d15')) await tap('text=d15'); await w(400); } }
async function fresh(vp, grade) { const mob = vp === '390x844'; const [W, H] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, ...(mob ? { isMobile: true, deviceScaleFactor: 3 } : {}) }); pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; });
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
  await tap('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await tap('.pinpad input[type=radio]').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await tap('[data-testid=hint-ok]'); await w(500);
  for (const sel of ['[data-testid=rec-done]']) if (await vis(sel)) { await tap(sel); await w(300); }
  if (await vis('[data-testid=pin-verify]')) await pinIn('2468');   // r16 8c：设完密码再输一次
  await pg.fill('[data-testid=add-name]', 'd15'); await tap(`[data-testid=home-grade-${grade}]`); await w(400); await toMap(); return ctx; }
async function answer() {
  if (await vis('.ime-input')) { const a = await pg.$eval('.qtext', e => e.getAttribute('data-ans') || '1').catch(() => '1'); await pg.fill('.ime-input', a); await tap('[data-testid=ok]'); return; }   // r16.1：系统输入法填空
  if (await vis('.keypad')) { const a = await pg.$eval('.qtext', e => e.getAttribute('data-ans') || '1').catch(() => '1'); for (const ch of a) await tap(`.keypad [data-key="${ch}"]`); await tap('[data-testid=ok]'); return; }
  if (await vis('.opts.multi, [data-testid=multi-ok]')) { for (const h of await pg.$$('.quiz .opt[data-correct="1"]')) { const bb = await h.boundingBox(); if (bb) await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await w(100); } await tap('[data-testid=multi-ok], [data-testid=ok]'); return; }
  await tap('.quiz .opt[data-correct="1"]'); }
const oneLine = sel => pg.evaluate(s => [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect(), lh = parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.4; return { h: Math.round(r.height), lh: Math.round(lh), fit: e.scrollWidth <= e.clientWidth + 1, one: r.height <= lh * 1.5 + 1, n: e.dataset.n, t: e.textContent }; }), sel);
for (const vp of VPS) for (const grade of (process.env.GR || '10,7').split(',')) {
  const ctx = await fresh(vp, grade); const hits = []; let cardN = 0, cardLines = [], remembered = null, closed = null, capSeen = false, turn = 0;
  await tap('[data-testid=level-1]'); await w(1000);
  for (let step = 0; step < 260 && hits.length < 12; step++) {
    if (await vis('[data-testid=result-actions]')) { if (!(await vis('[data-testid=next-level]'))) break; await tap('[data-testid=next-level]'); await w(1000); continue; }
    if (await vis('[data-testid=tutorial-skip]')) { await pg.click('[data-testid=tutorial-skip]', { force: true }).catch(() => {}); await w(300); continue; }
    if (await vis('[data-testid=bet-hint-ok]')) { await tap('[data-testid=bet-hint-ok]'); await w(200); continue; }
    if (await vis('[data-testid=chal-normal]')) { await tap(turn % 2 && (await vis('[data-testid=chal-on]:not(.grey)')) ? '[data-testid=chal-on]' : '[data-testid=chal-normal]'); await w(300); continue; }
    if (await vis('[data-testid=card-heavy]')) { if (!cardLines.length) { cardLines = await oneLine('.qcard .dmg-sum-line'); await pg.screenshot({ path: `${OUT}${vp}-g${grade}-cards.png` }); }
      if (await vis('[data-testid=bet-toggle][data-on="0"]')) await tap('[data-testid=bet-toggle]'); await w(100); await tap(`[data-testid=card-${['heavy', 'std', 'light'][cardN++ % 3]}]`); await w(300); continue; }
    if (await vis('[data-testid=bet-go]')) { await tap('[data-testid=bet-go]'); await w(300); continue; }
    if (await vis('.quiz .opt, .keypad, .ime-input')) { await answer(); await w(500); continue; }
    if (await vis('[data-testid=feedback]')) {
      const h3 = (await pg.textContent('[data-testid=feedback] h3')).trim(); const m = h3.match(/造成 ([\d+]+)/);
      if (m && await vis('[data-testid=dmg-sum]')) { turn++;
        const dealt = m[1].split('+').reduce((a, x) => a + +x, 0);
        const line = (await oneLine('[data-testid=feedback] .dmg-sum-line'))[0]; const row = await pg.evaluate(() => { const r = document.querySelector('[data-testid=dmg-sum]').getBoundingClientRect(); return { h: Math.round(r.height), wrapOk: r.height < 34 }; });
        if (!(await vis('[data-testid=dmg-sum-detail]'))) { if (hits.length === 1) { await tap('[data-testid=dmg-sum-more]'); await w(150); } }
        else if (hits.length >= 1 && remembered === null) remembered = true;
        let L = null; if (await vis('[data-testid=dmg-sum-detail]')) L = (await pg.textContent('[data-testid=dmg-sum-detail]')); 
        const lines = L ? await pg.$$eval('[data-testid=dmg-sum-detail] > div', es => es.map(e => e.textContent)) : [];
        const lastEq = lines.filter(l => /≈ \d+/.test(l)).pop(); const per = lastEq ? +lastEq.match(/≈ (\d+)/)[1] : null; const nh = lastEq && /共 (\d+) 段/.test(lastEq) ? +lastEq.match(/共 (\d+) 段/)[1] : 1;
        const real = lines.find(l => /实际造成 \d+/.test(l)); const fin = real ? +real.match(/实际造成 (\d+)/)[1] : per !== null ? per * nh : null;
        if (/已到上限 ×1\.8/.test(line.t)) capSeen = true;
        hits.push({ h3, sum: line.t, one: line.one && line.fit && row.wrapOk, dealt, fin, lines });
        if (hits.length === 3) await pg.screenshot({ path: `${OUT}${vp}-g${grade}-hit.png` });
        if (hits.length === 4 && await vis('[data-testid=dmg-sum-detail]')) { await pg.touchscreen.tap(5, 5); await w(150); closed = !(await vis('[data-testid=dmg-sum-detail]')); }
      }
      await tap('[data-testid=next]'); await w(400); continue; }
    if (process.env.DBG && step % 10 === 9) { await pg.screenshot({ path: `${OUT}dbg-${vp}-g${grade}-${step}.png` }); console.log('DBG', step, await pg.evaluate(() => [...document.querySelectorAll('[data-testid]')].filter(e => e.offsetParent).map(e => e.dataset.testid).join(','))); }
    await w(300);
  }
  if (process.env.DBG) { await pg.screenshot({ path: `${OUT}dbg-end-${vp}-g${grade}.png` }); console.log('END', await pg.evaluate(() => [...document.querySelectorAll('[data-testid]')].filter(e => e.offsetParent).map(e => e.dataset.testid).join(','))); }
  const withDetail = hits.filter(h => h.fin !== null);
  ok(hits.length >= 3, `${vp} 高${grade === '10' ? '一' : '/初一'} 命中 ${hits.length} 次（有明细 ${withDetail.length} 次）`);
  ok(hits.every(h => h.one), `${vp} g${grade} 摘要都只占一行：${[...new Set(hits.map(h => h.sum))].slice(0, 4).join(' | ')}`);
  ok(withDetail.length > 0 && withDetail.every(h => Math.abs(h.fin - h.dealt) <= 1), `${vp} g${grade} 明细推算 = 实际（差 ≤1）：${withDetail.map(h => `${h.fin}/${h.dealt}`).join(' ')}`);
  ok(grade !== '10' || capSeen, `${vp} g${grade} 重击 + 押注出现「已到上限 ×1.8」`);
  ok(remembered === true, `${vp} g${grade} 明细展开过 → 下一击默认展开`); ok(closed === true, `${vp} g${grade} 点空白处关闭明细`);
  ok(cardLines.length === 0 || cardLines.every(x => x.one && x.fit), `${vp} g${grade} 题卡摘要一行 ${JSON.stringify(cardLines.map(x => x.t))}`);
  rep.push({ vp, grade, hits, cardLines }); await ctx.close();
}
// 低年级没有摘要
for (const grade of ['1', 'K2']) { const ctx = await fresh('1280x690', grade); await tap('[data-testid=level-1]'); await w(1500); let seen = false;
  for (let i = 0; i < 40; i++) { if (await vis('[data-testid=tutorial-skip]')) await tap('[data-testid=tutorial-skip]'); if (await vis('[data-testid=dmg-sum], .dmg-sum')) { seen = true; break; } if (await vis('.quiz .opt[data-correct="1"]')) await tap('.quiz .opt[data-correct="1"]'); else if (await vis('.kopt[data-correct="1"]')) await tap('.kopt[data-correct="1"]'); else if (await vis('[data-testid=next]')) await tap('[data-testid=next]'); if (await vis('[data-testid=result-actions]')) break; await w(500); }
  ok(!seen, `${grade} 年级没有加成摘要`); await ctx.close(); }
writeFileSync(OUT + 'report.json', JSON.stringify(rep, null, 1));
console.log(bad ? `r16-d15 FAIL ${bad}` : 'r16-d15 ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
