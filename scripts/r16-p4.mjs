// r16 第 9 步 技术QA_r1544 P4 复测（测试包，手机横屏 DPR 2）：
//  P4-a 押注说明 800×280 / 640×360：4 条都能看到（或有「下面还有」提示）、〔知道了〕在屏内
//  P4-b 初一选题页 800×280 / 800×360 / 915×412：💡 挑战题提示不盖住「普通题」卡（卡中心点到的就是卡）
//  P4-c 800×280 设置密码：最后一排（⌫ 0 确定）不用滚就在屏内
//  P4-d 字体 130% 640×360 高一：朗读按钮在屏内（多道题）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/p4/'; mkdirSync(OUT, { recursive: true });
const PARTS = (process.env.PARTS || 'A,B,C,D').split(',');
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
let pg; const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false);
const tap = async sel => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const bb = await l.boundingBox().catch(() => null); if (!bb) return false; await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
const pinIn = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(250); };
const FZ = k => { const run = () => { const els = [...document.querySelectorAll('body, body *')]; els.forEach(e => { if (e.dataset.fzk) e.style.removeProperty('font-size'); }); const f = els.map(e => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => { e.style.setProperty('font-size', (f[i] * k).toFixed(2) + 'px', 'important'); e.dataset.fzk = '1'; }); };
  const go = () => { run(); setInterval(run, 300); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); };
async function ctxNew(vp, { betPop = false, font = 0 } = {}) { const [W, H] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(bp => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; if (bp) window.__zyTestBetPop = true; }, betPop);
  if (font) await pg.addInitScript(`(${FZ.toString()})(${font})`);
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300); return ctx; }
async function setup() { await tap('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await tap('.pinpad input[type=radio]'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x'); await tap('[data-testid=hint-ok]'); await w(500);
  if (await vis('[data-testid=rec-done]')) { await tap('[data-testid=rec-done]'); await w(300); } if (await vis('[data-testid=pin-verify]')) await pinIn('2468'); }
async function toLevel(grade) { await pg.fill('[data-testid=add-name]', 'p4'); await tap(`[data-testid=home-grade-${grade}]`); await w(400);
  for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')); i++) {
    if (await vis('[data-testid=pin-ok]')) await pinIn('2468'); else if (await vis('[data-testid=stage-pick]')) await tap('[data-testid=stage-pick] .stage-btn.on'); else if (await vis('[data-testid=grade-pick]')) await tap('[data-testid=grade-pick] .stage-btn.on');
    else if (await vis('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await pg.click('[data-testid=char-confirm]', { force: true }); }
    else if (await vis('text=p4')) await tap('text=p4'); await w(400); }
  if (!(await vis('[data-testid=level-1]'))) { await pg.screenshot({ path: OUT + 'tolevel-fail.png' }); console.log('toLevel stuck:', await pg.evaluate(() => [...document.querySelectorAll('[data-testid]')].filter(e => e.offsetParent).map(e => e.dataset.testid).slice(0, 30).join(','))); return false; }
  await w(800); await pg.click('[data-testid=level-1]'); await w(1000); return true; }
const inView = (sel) => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), ok: r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 }; }, sel);
const answer = async () => { if (await vis('.keypad')) { const a = await pg.$eval('.qtext', e => e.getAttribute('data-ans') || '1').catch(() => '1'); for (const ch of a) await tap(`.keypad [data-key="${ch}"]`); await tap('[data-testid=ok]'); return; }
  if (await vis('[data-testid=multi-ok]')) { for (const h of await pg.$$('.quiz .opt[data-correct="1"]')) { const bb = await h.boundingBox(); if (bb) await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); } await tap('[data-testid=multi-ok]'); return; }
  await tap('.quiz .opt[data-correct="1"]'); };
async function drive(until, max = 120) { for (let s = 0; s < max; s++) { const r = await until(); if (r) return r;
    if (await vis('[data-testid=result-actions]')) { if (!(await tap('[data-testid=next-level]'))) return null; await w(900); continue; }
    if (await vis('[data-testid=tutorial-skip]')) { await pg.click('[data-testid=tutorial-skip]', { force: true }).catch(() => {}); await w(300); continue; }
    if (await vis('[data-testid=bet-hint-ok]')) { await tap('[data-testid=bet-hint-ok]'); await w(200); continue; }
    if (await vis('[data-testid=chal-normal]')) { await w(2700); await tap('[data-testid=chal-normal]'); await w(300); continue; }
    if (await vis('[data-testid=card-std]')) { await tap('[data-testid=card-std]'); await w(300); continue; }
    if (await vis('[data-testid=bet-go]')) { await tap('[data-testid=bet-go]'); await w(300); continue; }
    if (await vis('.quiz .opt, .keypad')) { await answer(); await w(500); continue; }
    if (await vis('[data-testid=next]')) { await tap('[data-testid=next]'); await w(400); continue; }
    await w(300); } return null; }

if (PARTS.includes('C')) { const ctx = await ctxNew('800x280'); await pg.click('[data-testid=add-child]'); await w(600);   // 不用 tap（会先滚到元素）：进来时什么都不动就量
  const r = await inView('[data-testid=pin-ok]'), z = await inView('[data-testid=pin-0]'); await pg.screenshot({ path: OUT + 'C-800x280-pin.png' });
  ok(r?.ok && z?.ok, `P4-c 800×280 设置密码第 2 遍：最后一排在屏内 确定 ${JSON.stringify(r)} 0 ${JSON.stringify(z)}`);
  const v = await pg.evaluate(() => { const s = document.scrollingElement; return [s.scrollTop, ...[...document.querySelectorAll('.pinpad, .center-screen')].map(e => e.scrollTop)]; }); ok(v.every(x => x === 0), `没滚动 ${v}`); await ctx.close(); }

if (PARTS.includes('A')) for (const vp of ['800x280', '640x360']) { const ctx = await ctxNew(vp, { betPop: true }); await setup(); await toLevel('10');
  const got = await drive(async () => await vis('[data-testid=bet-hint]'), 80);
  await pg.screenshot({ path: `${OUT}A-${vp}-bethint.png` });
  const m = got && await pg.evaluate(() => { const ul = document.querySelector('[data-testid=bet-hint]'), ur = ul.getBoundingClientRect(); const lis = [...ul.querySelectorAll('li')].map(li => { const r = li.getBoundingClientRect(); return r.top >= ur.top - 1 && r.bottom <= ur.bottom + 1 && r.bottom <= innerHeight; });
    return { n: lis.length, shown: lis.filter(Boolean).length, scroll: ul.scrollHeight > ul.clientHeight + 1, more: !!document.querySelector('[data-testid=bet-hint-more]') && getComputedStyle(document.querySelector('[data-testid=bet-hint-more]')).display !== 'none', fs: getComputedStyle(ul).fontSize }; });
  const okb = got && await inView('[data-testid=bet-hint-ok]');
  ok(got && m.n === 4 && (m.shown === 4 || (m.scroll && m.more)) && okb?.ok, `P4-a ${vp} 押注说明 ${JSON.stringify(m)} 知道了 ${JSON.stringify(okb)}`); await ctx.close(); }

if (PARTS.includes('B')) for (const vp of ['800x280', '800x360', '915x412']) { const ctx = await ctxNew(vp); await setup(); await toLevel('7');
  const got = await drive(async () => (await vis('[data-testid=chal-normal]')) && (await vis('[data-testid=tip-challenge]')), 60);
  await pg.screenshot({ path: `${OUT}B-${vp}-chal.png` });
  const m = got && await pg.evaluate(() => { const n = document.querySelector('[data-testid=chal-normal]'), t = document.querySelector('[data-testid=tip-challenge]'), a = n.getBoundingClientRect(), c = t.getBoundingClientRect();
    const hit = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2); const over = !(a.right <= c.left || a.left >= c.right || a.bottom <= c.top || a.top >= c.bottom);
    return { over, hitCard: !!hit && n.contains(hit), card: [a.left, a.top, a.right, a.bottom].map(Math.round), tip: [c.left, c.top, c.right, c.bottom].map(Math.round), cardIn: a.bottom <= innerHeight && a.top >= 0, tipIn: c.right <= innerWidth + 0.5 && c.left >= 0, on: (() => { const o = document.querySelector('[data-testid=chal-on]').getBoundingClientRect(); return o.bottom <= innerHeight; })() }; });
  ok(got && !m.over && m.hitCard && m.cardIn && m.tipIn && m.on, `P4-b ${vp} 💡 不盖「普通题」卡 ${JSON.stringify(m)}`);
  if (got) { await tap('[data-testid=chal-normal]'); await w(400); ok(!(await vis('[data-testid=chal-normal]')), `P4-b ${vp} 第一下就选上普通题`); }
  await ctx.close(); }

if (PARTS.includes('D')) { const ctx = await ctxNew('640x360', { font: 1.3 }); await setup(); await toLevel('10'); const seen = [];
  await drive(async () => { if (await vis('[data-testid=tts]') && await vis('.quiz .opt, .keypad')) { const r = await inView('[data-testid=tts]'); const id = await pg.$eval('.qtext', e => e.textContent.slice(0, 12)).catch(() => '?');
      if (!seen.find(x => x.id === id)) { seen.push({ id, ...r }); if (seen.length === 1 || !r.ok) await pg.screenshot({ path: `${OUT}D-640x360-130-${seen.length}.png` }); } } return seen.length >= 8; }, 160);
  ok(seen.length >= 3 && seen.every(x => x.ok), `P4-d 130% 640×360 高一 ${seen.length} 题朗读按钮都在屏内 ${JSON.stringify(seen.filter(x => !x.ok).slice(0, 3))}`); await ctx.close(); }
console.log(bad ? `r16-p4 FAIL ${bad}` : 'r16-p4 ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
