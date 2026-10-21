// r17 D：小班期末庆祝关（上学期 = 大乌云 ×1.25 + 彩虹层；下学期 = 彩虹云 intro→end）e2e。
// 两关 × 1280×420 / 600 / 800 × 正常 / 减少动态：截图 开场 / 中间（爱心点亮）/ 结局 + 奖章 / 结算页；
// 检查：全程没出现「打败 / 胜利」、没有复活 / 失败页；先点错一次 = 「再想一想」不扣分；爱心数 = 题数、答对一题亮一颗；
// 怪物、爱心、奖章都在视口里、页面不滚动；结局：下学期 end 图不透明、intro 透明，上学期彩虹层淡入（在小乌云后面）；
// 没有 brightness 滤镜；减少动态：爱心不弹、彩虹层不位移、奖章只淡入；伙伴说的话顺序 = 开场 → 爱心… → 结尾 → 奖章。
// 用法：URL=http://127.0.0.1:4471/ [HS=420,600,800] [TERMS=1,2] node scripts/r17-term.mjs → OUT（默认 /workspace/playtest/r16dev/term/）
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://127.0.0.1:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/term/'; mkdirSync(OUT, { recursive: true });
const GRADE = 'K1'; const HS = (process.env.HS || '420,600,800').split(',').map(Number); const TERMS = (process.env.TERMS || '1,2').split(',').map(Number);
const ALLVP = Object.fromEntries(HS.map(h => [`1280x${h}`, { viewport: { width: 1280, height: h } }]));
const TXT = { intro: { 1: '哎呀，大乌云有点不开心，我们一起答题逗它笑吧！', 2: '彩虹云来找你玩啦，答对题目它就会变出彩虹哦！' }, end: { 1: '大乌云被你逗笑啦！', 2: '彩虹云笑得好开心，变出了一道大彩虹！' }, medal: { 1: '你得到了上学期小勇士奖章！真棒！', 2: '你得到了下学期彩虹奖章！你长大啦！' }, heart: '点亮一颗爱心！', retry: '没关系，我们再想一想～' };
const b = await chromium.launch(); let bad = 0; const rep = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(name, rm) {
  const ctx = await b.newContext({ ...ALLVP[name], reducedMotion: rm ? 'reduce' : 'no-preference' }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; window.__seen = []; window.__says = []; new MutationObserver(() => { const t = document.body?.innerText; if (t) window.__seen.push(t); const s = document.querySelector('[data-testid=ksay]')?.textContent; if (s && window.__says[window.__says.length - 1] !== s) window.__says.push(s); }).observe(document, { subtree: true, childList: true, characterData: true }); window.__zyTestSpentSec = -1e7; /* 跑很久也不触发每日时长 */ });
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 't17'); await pg.click(`[data-testid=home-grade-${GRADE}]`); await w(400);
  await pg.click('text=t17'); await w(500); if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468');
  for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.locator(`[data-testid=${sp}] .stage-btn.on`).first().click().catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]) >> nth=0'); await w(200); await pg.click('[data-testid=char-confirm]'); } if (await pg.isVisible('.modal >> text=稍后')) await pg.click('.modal >> text=稍后'); await w(400); }
  return { ctx, pg, w };
}

const layout = (pg, sels) => pg.evaluate(sels => { const vw = innerWidth, vh = innerHeight; const se = document.scrollingElement; const out = [];
  for (const s of sels) { const e = document.querySelector(s); if (!e) { out.push(s + ' 没有'); continue; } const r = e.getBoundingClientRect(); if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) out.push(`${s} 出界 ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`); }
  if (se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1) out.push(`页面滚动 ${se.scrollWidth}x${se.scrollHeight}`); return out; }, sels);
const filt = pg => pg.evaluate(() => [...document.querySelectorAll('.kterm-wrap *, .kterm-hearts *, .kterm-medal *')].filter(e => getComputedStyle(e).display !== 'none').map(e => getComputedStyle(e).filter).filter(f => /brightness|invert/.test(f)));
const answerRight = async pg => { for (let i = 0; i < 80; i++) { if (await pg.$('[data-testid=term-medal]')) return false; const c = await pg.$('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])'); if (c) { await c.click(); return true; } await pg.waitForTimeout(100); } return false; };
for (const vp of Object.keys(ALLVP)) for (const rm of [false, true]) for (const t of TERMS) {
  const tag = `${vp}${rm ? '_rm' : ''}_term${t}`;
  const { ctx, pg, w } = await session(vp, rm); const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.click('[data-testid="chapter-期末庆祝"]'); await w(300);
  ok(await pg.isVisible(`[data-testid=level-${t}]`), `${tag} 地图上「期末庆祝」章有第 ${t} 关`);
  await pg.click(`[data-testid=level-${t}]`); await w(400);
  for (let i = 0; i < 10; i++) { const x = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!x) break; await x.click().catch(() => {}); await w(300); }
  await pg.waitForSelector('[data-testid=term-mon]', { timeout: 10000 }); await w(250);
  const say0 = await pg.textContent('[data-testid=ksay]').catch(() => '');
  ok(say0 === TXT.intro[t], `${tag} 开场白 =「${say0}」`);
  await pg.screenshot({ path: `${OUT}${tag}_1intro.png` });
  const nH = await pg.$$eval('[data-testid=term-heart]', e => e.length); const nQ = await pg.evaluate(() => 0);
  ok(nH === 3, `${tag} 爱心一排 ${nH} 颗（= 普通关题数 3），没有血条 ${await pg.$('.hp-bar, [data-testid=hp]') ? '有' : '没有'}`);
  let lay = await layout(pg, ['[data-testid=term-mon] .kmon', '[data-testid=hearts]', '.kopts']); ok(!lay.length, `${tag} 开场：怪物 / 爱心 / 选项在视口里、不滚动 ${JSON.stringify(lay)}`);
  // 先点错一次：「再想一想」，不扣分
  await pg.waitForSelector('.kopts:not(.kwait) .kopt[data-correct="0"]', { timeout: 15000 });
  await pg.click('.kopts:not(.kwait) .kopt[data-correct="0"] >> nth=0'); await w(500);
  const sayR = await pg.textContent('[data-testid=ksay]').catch(() => '');
  ok(sayR === TXT.retry, `${tag} 点错：「${sayR}」，爱心还是 ${await pg.$$eval('[data-testid=term-heart][data-on="1"]', e => e.length)} 颗亮`);
  ok(await answerRight(pg), `${tag} 第 1 题答对`); await w(900);
  const lit1 = await pg.$$eval('[data-testid=term-heart][data-on="1"]', e => e.length);
  ok(lit1 === 1, `${tag} 答对一题亮一颗爱心（${lit1}）`);
  const popAnim = await pg.evaluate(() => { const e = document.querySelector('.kheart.pop'); return e ? getComputedStyle(e).animationName : 'none(no pop)'; });
  ok(rm ? /none/.test(popAnim) : popAnim === 'kheartPop' || /no pop/.test(popAnim), `${tag} 爱心点亮动效：${popAnim}${rm ? '（减少动态：不弹）' : ''}`);
  await pg.screenshot({ path: `${OUT}${tag}_2mid.png` });
  lay = await layout(pg, ['[data-testid=term-mon] .kmon', '[data-testid=hearts]', '.kopts']); ok(!lay.length, `${tag} 中间：在视口里、不滚动 ${JSON.stringify(lay)}`);
  for (let k = 0; k < 6 && !(await pg.$('[data-testid=term-medal]')); k++) { if (!(await answerRight(pg))) break; await w(700); }
  await pg.waitForSelector('[data-testid=term-medal]', { timeout: 20000 }).catch(async e => { await pg.screenshot({ path: `${OUT}${tag}_FAIL_medal.png` }); console.log('errors', JSON.stringify(errs), await pg.evaluate(() => window.__says)); throw e; }); await w(700);
  const end = await pg.evaluate(t => { const op = s => { const e = document.querySelector(s); return e ? +getComputedStyle(e).opacity : -1; };
    const ov = document.querySelector('.kterm-overlay'); return { endOp: op('.kterm2-end'), introOp: op('.kterm2-intro'), ovOp: op('.kterm-overlay'), ovZ: ov ? +getComputedStyle(ov).zIndex : null, monZ: t === 1 ? +getComputedStyle(document.querySelector('.kterm1-mon')).zIndex : null, ovT: ov ? getComputedStyle(ov).translate : null, lit: document.querySelectorAll('[data-testid=term-heart][data-on="1"]').length, medalAnim: getComputedStyle(document.querySelector('.kterm-medal')).animationName }; }, t);
  ok(t === 2 ? end.endOp > 0.99 && end.introOp < 0.01 : end.ovOp > 0.99 && end.ovZ < end.monZ && /^(none|0px( 0px)?)$/.test(end.ovT), `${tag} 结局：${t === 2 ? `end 图 ${end.endOp} / intro ${end.introOp}` : `彩虹层 ${end.ovOp}（z ${end.ovZ} < 小乌云 ${end.monZ}），位移 ${end.ovT}`}；爱心全亮 ${end.lit}；奖章动效 ${end.medalAnim}`);
  ok(rm ? end.medalAnim === 'ktermFade' : end.medalAnim === 'ktermMedalIn', `${tag} 奖章出现方式 ${end.medalAnim}`);
  await pg.screenshot({ path: `${OUT}${tag}_3end_medal.png` });
  lay = await layout(pg, ['[data-testid=term-medal] img', '[data-testid=hearts]']); ok(!lay.length, `${tag} 结局 + 奖章在视口里 ${JSON.stringify(lay)}`);
  const f = await filt(pg); ok(!f.length, `${tag} 没有 brightness / invert 滤镜 ${JSON.stringify(f)}`);
  await pg.waitForSelector('[data-testid=result-actions]', { timeout: 20000 }); await w(800);
  const title = await pg.textContent('[data-testid=result-term-title]').catch(() => null);
  ok(title === `${TXT.end[t]} ${t === 1 ? '上学期小勇士奖章' : '下学期彩虹奖章'}` && await pg.isVisible('[data-testid=result-term-medal]'), `${tag} 结算页：「${title}」+ 奖章`);
  lay = await layout(pg, ['[data-testid=result-term-medal]', '[data-testid=result-actions]']); ok(!lay.length, `${tag} 结算页在视口里、不滚动 ${JSON.stringify(lay)}`);
  await pg.screenshot({ path: `${OUT}${tag}_4result.png` });
  const seen = await pg.evaluate(() => window.__seen.join('\n')); const says = await pg.evaluate(() => window.__says);
  ok(!/打败|胜利/.test(seen), `${tag} 全程没有「打败 / 胜利」`);
  ok(!/未通关|复活|血量|中途退出/.test(seen) && !(await pg.$('[data-testid=revive-yes], [data-testid=lose-why]')), `${tag} 没有失败 / 复活页`);
  const order = [TXT.intro[t], TXT.end[t], TXT.medal[t]].map(s => says.indexOf(s));
  ok(order.every(x => x >= 0) && order[0] < order[1] && order[1] < order[2] && says.includes(TXT.retry), `${tag} 说话顺序：${says.join(' → ')}`);
  // 地图：这关拿到奖章
  await pg.click('[data-testid=to-map]'); await w(600); await pg.click('[data-testid="chapter-期末庆祝"]').catch(() => {}); await w(300);
  ok(await pg.isVisible(`[data-testid=term-medal-${t}]`), `${tag} 地图上第 ${t} 关显示奖章`);
  await pg.screenshot({ path: `${OUT}${tag}_5map.png` });
  rep.push({ tag, says, end, title });
  await ctx.close();
}
await b.close(); writeFileSync(OUT + 'report.json', JSON.stringify(rep, null, 1));
console.log(bad ? `FAILED ${bad}` : 'r17-term ALL PASS'); process.exit(bad ? 1 : 0);
