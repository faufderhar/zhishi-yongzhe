// r17 D：小班期末庆祝关（上学期 = 大乌云 ×1.25 + 彩虹层；下学期 = 彩虹云 intro→end）e2e。
// 两关 × 1280×420 / 600 / 800 × 正常 / 减少动态：截图 开场 / 中间（爱心点亮）/ 结局 + 奖章 / 结算页；
// 检查：全程没出现「打败 / 胜利」、没有复活 / 失败页；先点错一次 = 「再想一想」不扣分；爱心数 = 题数、答对一题亮一颗；
// 怪物、爱心、奖章都在视口里、页面不滚动；结局：下学期 end 图不透明、intro 透明，上学期彩虹层淡入（在小乌云后面）；
// 没有 brightness 滤镜；减少动态：爱心不弹、彩虹层不位移、奖章只淡入；伙伴说的话顺序 = 开场 → 爱心… → 结尾 → 奖章。
// r17 策划改版：两关放在小班主地图（各学科章：大乌云 = 上学期最后一个节点、彩虹云 = 最后）、没解锁 = 灰色剪影、解锁后第一次弹一下 + 读开场白（只一次）；
//   时间到（zy-force-end）没点完 =「X要睡觉啦，下次再来玩～」回地图、不给奖章，再进来接着点亮的爱心；彩虹云 / 大乌云不压选项按钮。
// 用法：URL=http://127.0.0.1:4471/ [HS=420,600,800] [TERMS=1,2] [PARTS=main,map,resume] node scripts/r17-term.mjs → OUT（默认 /workspace/playtest/r16dev/term/）
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://127.0.0.1:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/term/'; mkdirSync(OUT, { recursive: true });
const GRADE = 'K1'; const HS = (process.env.HS || '420,600,800').split(',').map(Number); const TERMS = (process.env.TERMS || '1,2').split(',').map(Number);
const ALLVP = Object.fromEntries(HS.map(h => [`1280x${h}`, { viewport: { width: 1280, height: h } }]));
const PARTS = (process.env.PARTS || 'main,map,resume').split(',');
const SLEEP = { 1: '大乌云要睡觉啦，下次再来玩～', 2: '彩虹云要睡觉啦，下次再来玩～' };
const MAN = await (await fetch(URL + 'voice/manifest.json')).json();
const TXT = { intro: { 1: '哎呀，大乌云有点不开心，我们一起答题逗它笑吧！', 2: '彩虹云来找你玩啦，答对题目它就会变出彩虹哦！' }, end: { 1: '大乌云被你逗笑啦！', 2: '彩虹云笑得好开心，变出了一道大彩虹！' }, medal: { 1: '你得到了上学期小勇士奖章！真棒！', 2: '你得到了下学期彩虹奖章！你长大啦！' }, heart: '点亮一颗爱心！', retry: '没关系，我们再想一想～' };
const b = await chromium.launch(); let bad = 0; const rep = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(name, rm, o = { unlock: true }) {
  const ctx = await b.newContext({ ...ALLVP[name], reducedMotion: rm ? 'reduce' : 'no-preference' }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });
  await pg.addInitScript(o => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = o.unlock; window.__zyTestTermOpen = o.termOpen; window.__seen = []; window.__says = []; new MutationObserver(() => { const t = document.body?.innerText; if (t) window.__seen.push(t); const s = document.querySelector('[data-testid=ksay]')?.textContent; if (s && window.__says[window.__says.length - 1] !== s) window.__says.push(s); }).observe(document, { subtree: true, childList: true, characterData: true }); window.__zyTestSpentSec = -1e7; /* 跑很久也不触发每日时长 */ }, { unlock: o.unlock !== false, termOpen: o.termOpen ?? null });
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
// 怪物的「可见身体」（图片不透明像素的外框，按显示比例换算）和每个选项按钮不相交（图片透明边不算）
const overlapOpts = pg => pg.evaluate(async () => { const R = e => e.getBoundingClientRect(); const opts = [...document.querySelectorAll('.kopt')]; if (!opts.length) return 'no kopt';
  const body = async img => { await img.decode().catch(() => {}); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const r = R(img), sx = r.width / c.width, sy = r.height / c.height; return { left: r.left + x0 * sx, right: r.left + (x1 + 1) * sx, top: r.top + y0 * sy, bottom: r.top + (y1 + 1) * sy }; };
  const bad = []; for (const e of document.querySelectorAll('.kterm-wrap img:not(.white-flash)')) { if (+getComputedStyle(e).opacity < 0.05) continue; const a = await body(e);
    for (const o of opts) { const b = R(o); const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 1 && iy > 1) bad.push(`${e.className} ∩ ${o.dataset.testid} ${Math.round(ix)}×${Math.round(iy)}`); } }
  return bad; });
const toNode = async (pg, t, subj = '数数') => { await pg.click(`[data-testid="chapter-${subj}"]`); await pg.waitForTimeout(300); return pg.$(`[data-testid=term-node-${t}]`); };
const enterTerm = async (pg, t) => { await pg.click(`[data-testid=term-node-${t}]`); await pg.waitForTimeout(400);
  for (let i = 0; i < 10; i++) { const x = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!x) break; await x.click().catch(() => {}); await pg.waitForTimeout(300); }
  await pg.waitForSelector('[data-testid=term-mon]', { timeout: 10000 }); };
const answerRight = async pg => { for (let i = 0; i < 80; i++) { if (await pg.$('[data-testid=term-medal]')) return false; const c = await pg.$('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])'); if (c) { await c.click(); return true; } await pg.waitForTimeout(100); } return false; };
if (PARTS.includes('main')) for (const vp of Object.keys(ALLVP)) for (const rm of [false, true]) for (const t of TERMS) {
  const tag = `${vp}${rm ? '_rm' : ''}_term${t}`;
  const { ctx, pg, w } = await session(vp, rm); const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  ok(!(await pg.$('[data-testid="chapter-期末庆祝"]')) && !!(await toNode(pg, t)), `${tag} 没有「期末庆祝」章；数数章里有期末节点 ${t}`);
  await pg.click(`[data-testid=term-node-${t}]`); await w(400);
  for (let i = 0; i < 10; i++) { const x = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!x) break; await x.click().catch(() => {}); await w(300); }
  await pg.waitForSelector('[data-testid=term-mon]', { timeout: 10000 }); await w(250);
  // 开场白气泡可能比 term-mon 晚一点出（机器忙时 >250 ms）：最多等 3 s 拿到第一句非空
  let say0 = ''; for (let i = 0; i < 30 && !say0; i++) { say0 = (await pg.textContent('[data-testid=ksay]').catch(() => '')) || ''; if (!say0) await w(100); }
  ok(say0 === TXT.intro[t], `${tag} 开场白 =「${say0}」`);
  await pg.screenshot({ path: `${OUT}${tag}_1intro.png` });
  const nH = await pg.$$eval('[data-testid=term-heart]', e => e.length); const nQ = await pg.evaluate(() => 0);
  ok(nH === 3, `${tag} 爱心一排 ${nH} 颗（= 普通关题数 3），没有血条 ${await pg.$('.hp-bar, [data-testid=hp]') ? '有' : '没有'}`);
  let lay = await layout(pg, ['[data-testid=term-mon] .kmon', '[data-testid=hearts]', '.kopts']); ok(!lay.length, `${tag} 开场：怪物 / 爱心 / 选项在视口里、不滚动 ${JSON.stringify(lay)}`);
  let ov = await overlapOpts(pg); ok(Array.isArray(ov) && !ov.length, `${tag} 开场：${t === 2 ? '彩虹云（原尺寸）' : '大乌云'}不压选项按钮 ${JSON.stringify(ov)}`);
  // 先点错一次：「再想一想」，不扣分
  await pg.waitForSelector('.kopts:not(.kwait) .kopt[data-correct="0"]', { timeout: 15000 });
  await pg.click('.kopts:not(.kwait) .kopt[data-correct="0"] >> nth=0'); await w(500);
  const sayR = await pg.textContent('[data-testid=ksay]').catch(() => '');
  const demo = /^我来帮你看看/.test(sayR || '');   // 只有两个选项的题：点错一次就是「我来帮你看看」（小班规则，也亮一颗）
  ok(sayR === TXT.retry || demo, `${tag} 点错：「${sayR}」（不扣分）`);
  ok(await answerRight(pg), `${tag} 第 1 题答对`); await w(900);
  const lit1 = await pg.$$eval('[data-testid=term-heart][data-on="1"]', e => e.length);
  ok(lit1 === (demo ? 2 : 1), `${tag} 答对一题亮一颗爱心（${lit1}${demo ? '，前一题演示也亮了一颗' : ''}）`);
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
  ov = await overlapOpts(pg); ok(Array.isArray(ov) && !ov.length, `${tag} 结局图不压选项按钮 ${JSON.stringify(ov)}`);
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
  ok(order.every(x => x >= 0) && order[0] < order[1] && order[1] < order[2] && (says.includes(TXT.retry) || says.some(x => /^我来帮你看看/.test(x))), `${tag} 说话顺序：${says.join(' → ')}`);
  // 地图：这关拿到奖章
  await pg.click('[data-testid=to-map]'); await w(600); await toNode(pg, t, '认识动物');
  ok(await pg.isVisible(`[data-testid=term-node-${t}] [data-testid=term-medal-${t}]`), `${tag} 地图上期末节点 ${t} 显示奖章（别的学科章里同一关）`);
  await pg.screenshot({ path: `${OUT}${tag}_5map.png` });
  rep.push({ tag, says, end, title });
  await ctx.close();
}

// ── 地图：位置 / 剪影 / 解锁提示（弹一下 + 读开场白，只一次） ──
if (PARTS.includes('map')) for (const rm of [false, true]) {
  const vp = Object.keys(ALLVP).includes('1280x600') ? '1280x600' : Object.keys(ALLVP)[0]; const tag = `${vp}${rm ? '_rm' : ''}_map`;
  { const { ctx, pg, w } = await session(vp, rm, { unlock: false }); await toNode(pg, 1);
    const info = await pg.evaluate(() => { const L = document.querySelector('[data-testid=levels]'); const kids = [...L.children]; const n1 = document.querySelector('[data-testid=term-node-1]'), n2 = document.querySelector('[data-testid=term-node-2]');
      const img = n => { const i = n?.querySelector('img.kterm-node-img'); return i ? { sil: i.classList.contains('silhouette'), f: getComputedStyle(i).filter } : null; };
      return { n1: kids.indexOf(n1), n2: kids.indexOf(n2), last: kids.length - 1, before1: n1?.previousElementSibling?.dataset.testid, after1: n1?.nextElementSibling?.className, l1: n1?.dataset.locked, l2: n2?.dataset.locked, i1: img(n1), i2: img(n2), tabs: [...document.querySelectorAll('[data-testid^=chapter-]')].map(e => e.dataset.testid) }; });
    ok(info.n2 === info.last && info.n1 > 0 && /^level-\d+$/.test(info.before1 ?? '') && /unit-head/.test(info.after1 ?? '') && !info.tabs.includes('chapter-期末庆祝'), `${tag} 数数章：大乌云在上学期最后一关后面（下一个是下学期的单元标题）、彩虹云在最后；没有「期末庆祝」章 ${JSON.stringify(info)}`);
    ok(info.l1 === '1' && info.l2 === '1' && info.i1?.sil && info.i2?.sil && /grayscale\(1\)/.test(info.i1.f), `${tag} 没解锁：两个节点都是灰色剪影 ${JSON.stringify([info.i1, info.i2])}`);
    await pg.screenshot({ path: `${OUT}${tag}_1locked.png` });
    await pg.click('[data-testid=term-node-1]', { force: true }); await w(400); const tip = await pg.textContent('[data-testid=map-tip]').catch(() => '');
    ok(/上学期的每一课都打一关/.test(tip ?? '') && !(await pg.$('[data-testid=term-mon]')), `${tag} 点没解锁的节点：提示「${tip}」，不进关`);
    await ctx.close(); }
  { const { ctx, pg, w } = await session(vp, rm, { unlock: false, termOpen: [1] }); const n0 = (await pg.evaluate(() => window.__zyRecLog?.length ?? 0));
    await toNode(pg, 1); await w(150);
    const h = await pg.evaluate(() => { const n = document.querySelector('[data-testid=term-node-1]'), i = n?.querySelector('img'); const r = n?.getBoundingClientRect(); return { inView: !!r && r.top >= 0 && r.bottom <= innerHeight + 1, hint: n?.dataset.hint, locked: n?.dataset.locked, sil: i?.classList.contains('silhouette'), anim: i ? getComputedStyle(i).animationName : null, n2: document.querySelector('[data-testid=term-node-2]')?.dataset.locked }; });
    ok(h.inView && h.hint === '1' && h.locked === '0' && !h.sil && (rm ? h.anim === 'none' : h.anim === 'ktermNodeHop') && h.n2 === '1', `${tag} 刚解锁：大乌云彩色、滚进视野、弹一下（${h.anim}${rm ? '，减少动态不弹' : ''}），彩虹云还锁着 ${JSON.stringify(h)}`);
    await pg.screenshot({ path: `${OUT}${tag}_2unlock_hint.png` });
    let heard = false; for (let i = 0; i < 30 && !heard; i++) { heard = await pg.evaluate(f => (window.__zyRecLog ?? []).some(x => x.url.includes(f)), MAN.items['p:k_term1_intro']); if (!heard) await w(100); }
    ok(heard, `${tag} 解锁提示读了开场白录音 p:k_term1_intro（${MAN.items['p:k_term1_intro']}）`); void n0;
    await w(1800); ok(await pg.$eval('[data-testid=term-node-1]', n => n.dataset.hint) === '0', `${tag} 弹完收起`);
    await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=level-1]'); await w(300);   // 刷新后可能直接回到地图
    if (!(await pg.isVisible('[data-testid=level-1]'))) { await pg.click('text=t17'); await w(600); if (await pg.isVisible('[data-testid=pin-ok]')) { for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); } }
    await pg.waitForSelector('[data-testid=level-1]'); const m1 = await pg.evaluate(() => (window.__zyRecLog ?? []).length);
    await toNode(pg, 1); await w(400); const again = await pg.$eval('[data-testid=term-node-1]', n => n.dataset.hint);
    const heard2 = await pg.evaluate(([f, m]) => (window.__zyRecLog ?? []).slice(m).some(x => x.url.includes(f)), [MAN.items['p:k_term1_intro'], m1]);
    ok(again === '0' && !heard2, `${tag} 再进地图：不再弹、不再读（记住了）`);
    await ctx.close(); }
}
// ── 时间到半路：睡觉去、不给奖章；再进来接着点亮的爱心，全亮才颁奖章 ──
if (PARTS.includes('resume')) for (const t of TERMS) {
  const vp = Object.keys(ALLVP).includes('1280x600') ? '1280x600' : Object.keys(ALLVP)[0]; const tag = `${vp}_term${t}_resume`;
  const { ctx, pg, w } = await session(vp, false); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await toNode(pg, t); await enterTerm(pg, t);
  ok(await answerRight(pg), `${tag} 第 1 题答对`); await w(1500);
  const lit1 = await pg.$$eval('[data-testid=term-heart][data-on="1"]', e => e.length);
  await pg.evaluate(() => window.dispatchEvent(new Event('zy-force-end')));   // 家长设的时长到了
  await pg.waitForSelector('[data-testid=term-sleep]', { timeout: 8000 }).catch(() => {});
  const sl = await pg.textContent('[data-testid=term-sleep-text]').catch(() => null);
  ok(sl === SLEEP[t] && !(await pg.$('[data-testid=term-medal]')), `${tag} 时间到（亮了 ${lit1} 颗）：「${sl}」，没有奖章`);
  await pg.screenshot({ path: `${OUT}${tag}_1sleep.png` });
  await pg.waitForSelector('[data-testid=level-1]', { timeout: 12000 }).catch(() => {});
  const seen1 = await pg.evaluate(() => window.__seen.join('\n'));
  ok(await pg.isVisible('[data-testid=level-1]') && !(await pg.$('[data-testid=result-actions]')) && !/打败|胜利|失败|未通关/.test(seen1), `${tag} 睡觉后回地图（没有结算页 / 失败字样）`);
  await toNode(pg, t); const nodeAfter = await pg.evaluate(t => ({ medal: !!document.querySelector(`[data-testid=term-node-${t}] [data-testid=term-medal-${t}]`), stars: document.querySelector(`[data-testid=term-node-${t}] .stars`)?.textContent }), t);
  ok(!nodeAfter.medal, `${tag} 地图节点没有奖章 ${JSON.stringify(nodeAfter)}`);
  await enterTerm(pg, t); await w(300);
  const h2 = await pg.$$eval('[data-testid=term-heart]', e => ({ n: e.length, on: e.filter(x => x.dataset.on === '1').length }));
  ok(h2.n === 3 && h2.on === lit1, `${tag} 再进来：爱心 ${h2.on}/${h2.n}（接着上次的 ${lit1} 颗）`);
  await pg.screenshot({ path: `${OUT}${tag}_2resume.png` });
  for (let k = 0; k < 6 && !(await pg.$('[data-testid=term-medal]')); k++) { if (!(await answerRight(pg))) break; await w(700); }
  await pg.waitForSelector('[data-testid=term-medal]', { timeout: 20000 }).catch(() => {});
  ok(!!(await pg.$('[data-testid=term-medal]')), `${tag} 全部点亮 → 结局 + 奖章`);
  await pg.waitForSelector('[data-testid=result-actions]', { timeout: 20000 }).catch(() => {}); await w(500);
  ok(await pg.isVisible('[data-testid=result-term-medal]'), `${tag} 结算页有奖章`);
  await pg.click('[data-testid=to-map]'); await w(600); await toNode(pg, t);
  ok(await pg.isVisible(`[data-testid=term-node-${t}] [data-testid=term-medal-${t}]`), `${tag} 地图节点拿到奖章`);
  // 再玩一次：从 0 颗开始（完成后清掉了半截进度）
  await enterTerm(pg, t); await w(300);
  const h3 = await pg.$$eval('[data-testid=term-heart]', e => e.filter(x => x.dataset.on === '1').length);
  ok(h3 === 0, `${tag} 完成后再玩：爱心从 0 颗开始（${h3}）`); ok(!errs.length, `${tag} 没有页面错误 ${JSON.stringify(errs)}`);
  await ctx.close();
}
await b.close(); writeFileSync(OUT + 'report.json', JSON.stringify(rep, null, 1));
console.log(bad ? `FAILED ${bad}` : 'r17-term ALL PASS'); process.exit(bad ? 1 : 0);
