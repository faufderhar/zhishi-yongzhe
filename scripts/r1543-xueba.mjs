// r15.4.3 学霸复测项浏览器验证（测试构建，触摸点屏）：⑤全新高一档案第一次出押注开关时弹「新玩法：押注」说明（点〔知道了〕才记看过；之后、刷新后都不再弹）；
//  ④开关下「每回合重新选」、每回合回到关；②开关文字「能量额外 +1」、押对「能量 +2（含押注额外 +1）」；①重击 + 押注到顶时结果写「加成 ×…，已到上限，按 ×1.8 算」；
//  ③押错结果写「押注失手：反击 ×1.25」和倍率明细；⑥初一预计伤害旁「技能另算」（有护盾时一起截图）。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4340/'; const OUT = process.env.OUT || '/workspace/playtest/r1543/xueba/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
let pg; const VP = (process.env.VP || '1280x690').split('x').map(Number);

const w = ms => pg.waitForTimeout(ms); const vis = sel => pg.isVisible(sel);
const tap = async sel => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const bb = await l.boundingBox().catch(() => null); if (!bb) return false; await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
const pinIn = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(300); };
async function toMap() { for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')); i++) {
  if (await vis('[data-testid=pin-ok]')) await pinIn('2468'); else if (await vis('[data-testid=pin-reset-full-ok]')) await tap('[data-testid=pin-reset-full-ok]');
  else if (await vis('[data-testid=stage-pick]')) await tap('[data-testid=stage-pick] .stage-btn.on'); else if (await vis('[data-testid=grade-pick]')) await tap('[data-testid=grade-pick] .stage-btn.on');
  else if (await vis('[data-testid=char-confirm]')) { await tap('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await tap('[data-testid=char-confirm]'); }
  else if (await vis('text=r9')) await tap('text=r9'); await w(500); } }
async function fresh(grade, init) { const ctx = await b.newContext({ viewport: { width: VP[0], height: VP[1] }, hasTouch: true }); pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(init);
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await tap('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await tap('.pinpad input[type=radio]').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await tap('[data-testid=hint-ok]'); await w(500);
  for (const sel of ['[data-testid=rec-done]', 'text=我已经抄好了']) if (await vis(sel)) { await tap(sel); await w(300); }
  if (await vis('.modal >> text=稍后')) await tap('.modal >> text=稍后');
  await pg.fill('[data-testid=add-name]', 'r9'); await tap(`[data-testid=home-grade-${grade}]`); await w(400); await toMap();
  return ctx; }
async function answer(right) {
  if (await vis('.keypad')) { const a = right ? await pg.$eval('.qtext', e => e.getAttribute('data-ans') || '1').catch(() => '1') : '98765'; for (const ch of a) await tap(`.keypad [data-key="${ch}"]`); await tap('[data-testid=ok]'); return; }
  const multi = await vis('.opts.multi, [data-testid=multi-ok]');
  if (multi) { const sel = right ? '.quiz .opt[data-correct="1"]' : '.quiz .opt[data-correct="0"]'; for (const h of await pg.$$(sel)) { const bb = await h.boundingBox(); if (bb) await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await w(120); } await tap('[data-testid=multi-ok], [data-testid=ok]'); return; }
  const want = right ? '1' : '0'; await tap((await pg.$(`.quiz .opt[data-correct="${want}"]`)) ? `.quiz .opt[data-correct="${want}"]` : '.quiz .opt');
}

const fbText = async () => { for (let i = 0; i < 30; i++) { if (await vis('[data-testid=feedback]')) return (await pg.textContent('[data-testid=feedback] h3')).trim(); await w(200); } return ''; };
const energy = async () => Number(((await pg.textContent('[data-testid=energy]').catch(() => '')) || '').match(/(\d+)\/\d/)?.[1] ?? NaN);
const R = { pops: [], resetLine: 0, setups: 0, defaultOff: 0, label: '', betRight: [], betWrong: [], capped: [], j: [] };
async function playH(lv, tag, plan, maxP) {
  await tap(`[data-testid=level-${lv}]`); await w(1200); let pTurn = 0;
  for (let step = 0; step < 300; step++) {
    if (await vis('[data-testid=result-title], [data-testid=result-stats]')) break;
    if (await vis('[data-testid=tutorial-skip]')) { await tap('[data-testid=tutorial-skip]'); await w(400); continue; }
    if (await vis('[data-testid=revive-no]')) { await tap('[data-testid=revive-no]'); await w(300); continue; }
    if (await vis('[data-testid=bet-hint]')) { R.pops.push(`${tag}#${pTurn + 1}`); await pg.screenshot({ path: `${OUT}${tag}-betpop-${pTurn + 1}.png` }); R.popText = (await pg.textContent('[data-testid=bet-hint]')).trim(); await tap('[data-testid=bet-hint-ok]'); await w(300); continue; }
    const setup = await vis('[data-testid=cards]') || await vis('[data-testid=bet-phase]');
    if (setup) {
      if (pTurn >= maxP) { await tap('[data-testid=pause]'); await w(400); await tap('[data-testid=quit]'); await w(300); await tap('[data-testid=quit-confirm]').catch(() => {}); await w(800); break; }
      pTurn++; R.setups++; if (await vis('[data-testid=bet-reset]')) R.resetLine++;
      if ((await pg.getAttribute('[data-testid=bet-toggle]', 'data-on').catch(() => null)) === '0') R.defaultOff++;
      R.label = (await pg.textContent('[data-testid=bet-toggle]').catch(() => '')).trim();
      const p = plan(pTurn); const key = p.card || 'std';
      if (p.bet) { await tap('[data-testid=bet-toggle]'); await w(150); }
      if (pTurn <= 2 || p.shot) await pg.screenshot({ path: `${OUT}${tag}-setup-${pTurn}.png` });
      const e0 = await energy();
      if (await vis('[data-testid=cards]')) await tap(`[data-testid=card-${key}]`); else await tap('[data-testid=bet-go]'); await w(350);
      for (let i = 0; i < 20 && !(await vis('.quiz .opt, .keypad')); i++) await w(200);
      await answer(p.right); const t = await fbText();
      const rec = { tag, turn: pTurn, card: key, e0, text: t };
      if (p.bet) { (p.right ? R.betRight : R.betWrong).push(rec); await pg.screenshot({ path: `${OUT}${tag}-fb-${pTurn}-${p.right ? 'right' : 'wrong'}.png` }); }
      if (/已到上限/.test(t)) { R.capped.push(rec); await pg.screenshot({ path: `${OUT}${tag}-capped-${pTurn}.png` }); }
      if (await vis('[data-testid=next]')) await tap('[data-testid=next]'); await w(300); continue;
    }
    if (await vis('.quiz .opt, .keypad')) { await answer(true); await fbText(); if (await vis('[data-testid=next]')) await tap('[data-testid=next]'); await w(300); continue; }
    if (await vis('[data-testid=next]')) { await tap('[data-testid=next]'); await w(300); continue; }
    await w(300);
  }
  if (await vis('[data-testid=to-map]')) await tap('[data-testid=to-map]'); await w(800);
}
// 高一：第 1 回合不押（看弹窗），2 押对（标准），3 押错（轻击），4 押对（重击，内层 1.6×1.25 = 2.0 → 到顶），5 押错（标准），6 押对重击
let ctx = await fresh(10, () => { window.__zyTest = true; window.__zyUnlockAll = true; window.__zyTestNoTts = true; window.__zyTestMonHp = 5000; window.__zyTestHp = 900; window.__zyTestBetPop = true; });
await playH(1, 'H1', n => n === 2 ? { bet: true, right: true } : n === 3 ? { bet: true, right: false, card: 'light' } : n === 4 ? { bet: true, right: true, card: 'heavy' } : n === 5 ? { bet: true, right: false } : n === 6 ? { bet: true, right: true, card: 'heavy' } : { bet: false, right: true }, 7);
await toMap(); await playH(2, 'H2', () => ({ bet: false, right: true }), 2);
await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=pin-ok], [data-testid=levels]'); await w(600); await toMap(); await playH(1, 'H1-reload', () => ({ bet: false, right: true }), 2);
await ctx.close();
// 初一：看「技能另算」；对方回合遇到 🛡 意图时答错让怪物开盾，下一题截图
ctx = await fresh(7, () => { window.__zyTest = true; window.__zyUnlockAll = true; window.__zyTestNoTts = true; window.__zyTestMonHp = 5000; window.__zyTestHp = 900; });
await tap('[data-testid=level-1]'); await w(1200); let shieldShot = false;
for (let step = 0; step < 160 && R.j.length < 8; step++) {
  if (await vis('[data-testid=tutorial-skip]')) { await tap('[data-testid=tutorial-skip]'); await w(400); continue; }
  if (await vis('[data-testid=chal-normal]')) { await tap('[data-testid=chal-normal]'); await w(400); continue; }
  if (await vis('.quiz .opt, .keypad')) {
    const side = await pg.getAttribute('[data-testid=banner]', 'data-side').catch(() => '');
    if (await vis('[data-testid=q-dmg]')) { const t = (await pg.textContent('[data-testid=q-dmg]')).trim(); const sk = await vis('[data-testid=q-dmg-sk]'); const sh = await vis('[data-testid=q-dmg-shield]'); R.j.push({ t, sk, sh });
      if (sh && !shieldShot) { shieldShot = true; await pg.screenshot({ path: `${OUT}J-shield-qdmg.png` }); } else if (R.j.length === 1) await pg.screenshot({ path: `${OUT}J-qdmg.png` }); }
    const intent = (await pg.textContent('[data-testid=intent]').catch(() => '')) || '';
    await answer(!(side === 'M' && /🛡/.test(intent))); await fbText(); if (await vis('[data-testid=next]')) await tap('[data-testid=next]'); await w(300); continue; }
  if (await vis('[data-testid=next]')) { await tap('[data-testid=next]'); await w(300); continue; }
  await w(300);
}
await ctx.close();
writeFileSync(OUT + 'result.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R));

ok(R.pops.length === 1 && R.pops[0] === 'H1#1', `⑤押注说明弹窗只在全新档案第一次出开关时弹 1 次（${R.pops.join(',') || '没弹'}；共 ${R.setups} 个选卡步，含第 2 关和刷新后）`);
ok(/每回合重新选/.test(R.popText || '') && /能量额外 \+1/.test(R.popText || ''), `⑤④弹窗写明「每回合重新选」「能量额外 +1」：${R.popText}`);
ok(R.resetLine === R.setups && R.defaultOff === R.setups, `④每个选卡步都有「每回合重新选」（${R.resetLine}/${R.setups}），开关默认关（${R.defaultOff}/${R.setups}）`);
ok(/能量额外 \+1/.test(R.label) && !/，能量 \+1/.test(R.label), `②开关文字：${R.label}`);
ok(R.betRight.length >= 2 && R.betRight.every(r => r.e0 >= 4 || /能量 \+2（含押注额外 \+1）|能量 \+3（含押注额外 \+1）/.test(r.text) || /✨/.test(r.text)), `②押对能量写「+2（含押注额外 +1）」：${R.betRight.map(r => r.text).join(' | ')}`);
ok(R.capped.length >= 1 && R.capped.every(r => /加成：.*(重击卡|押注).* = ×\d+\.\d\d，已到上限，按 ×1\.8 算/.test(r.text)), `①到顶时写明封顶前倍率：${R.capped.map(r => r.text).join(' | ')}`);
ok(R.betWrong.length >= 2 && R.betWrong.every(r => /押注失手：反击 ×1\.25/.test(r.text) && /受到 \d+（基础 \d+( × [^）]*)? = \d+）/.test(r.text) && (r.card === 'std' || /(轻击卡|重击卡) ×/.test(r.text)) && /押注 ×1\.25/.test(r.text)), `③押错写倍率：${R.betWrong.map(r => r.text).join(' | ')}`);
ok(R.j.length >= 3 && R.j.every(x => x.sk), `⑥初一预计伤害旁都有「技能另算」（${R.j.length} 题；有护盾的 ${R.j.filter(x => x.sh).length} 题：${R.j.filter(x => x.sh).map(x => x.t).join(' | ')}）`);
console.log(bad ? `r1543-xueba FAIL ${bad}` : 'r1543-xueba ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
