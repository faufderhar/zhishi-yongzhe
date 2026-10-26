// r17.3 技术QA r17.1 P3-1（N3）：高中回合制「选一张题卡」三张卡在 800×600 / 1024×600 放不下（轻击 / 重击标题被切成「击」「重」，左边溢出滑不出来）
// 每个视口：三张卡都完整在 .quiz 可见区和视口里、卡名完整（elementFromPoint 命中卡自己）、卡里文字不超出卡、.quiz 没有横向溢出
// 用法：URL=http://localhost:4471/ OUT=… node scripts/r173-cards.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/cards173/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
let pg; const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
const errs = [];
async function ctxNew(vp, mobile) { const [W, H] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) }); pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; window.__zyUnlockAll = true; });
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300); return ctx; }
async function setup(name, g) {
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0').catch(() => {});
  await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x'); await pg.click('[data-testid=hint-ok]'); await w(500);
  if (await vis('[data-testid=rec-done]')) { await pg.click('[data-testid=rec-done]'); await w(300); } if (await vis('[data-testid=pin-verify]')) await pinIn('2468'); await w(300);
  await pg.fill('[data-testid=add-name]', name); await pg.click(`[data-testid=home-grade-${g}]`); await w(500); }
async function toMap(name) { for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')); i++) {
    if (await vis('[data-testid=pin-ok]')) await pinIn('2468');
    else if (await vis('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await pg.click('[data-testid=char-confirm]', { force: true }); }
    else if (await vis('[data-testid=stage-pick]')) await pg.click('[data-testid=stage-pick] .stage-btn.on', { timeout: 1500 }).catch(() => pg.click('[data-testid=stage-H]').catch(() => {}));
    else if (await vis('[data-testid=grade-pick]')) await pg.click('[data-testid=grade-pick] .stage-btn.on', { timeout: 1500 }).catch(() => pg.click('[data-testid=grade-pick] .stage-btn >> nth=0').catch(() => {}));
    else if (await vis('[data-testid=add-child]')) await pg.click(`[data-testid^=profile-] >> text=${name}`).catch(() => {});
    await w(400); }
  const r = await vis('[data-testid=level-1]'); if (!r) { await pg.screenshot({ path: OUT + 'tomap-fail.png' }); console.log('toMap stuck:', await pg.evaluate(() => [...document.querySelectorAll('[data-testid]')].filter(e => e.offsetParent).map(e => e.dataset.testid).join(' '))); } return r; }
async function openLevel(subj, pick, fq) {
  await pg.click(`[data-testid="chapter-${subj}"]`).catch(() => {}); await w(400);
  const idx = await pg.evaluate(([s, p]) => { const c = window.__zyLevels.find(c => c.subject === s); return c ? c.levels.findIndex(l => p === 'boss' ? l.kind === 'boss' : l.qs.some(q => (q.question ?? '').includes(p))) : -1; }, [subj, pick]);
  if (idx < 0) { console.log('levels:', await pg.evaluate(([s, p]) => JSON.stringify({ subs: window.__zyLevels?.map(c => c.subject), has: window.__zyLevels?.flatMap(c => c.levels.flatMap(l => l.qs.filter(q => q.id === p).map(q => c.subject + ' ' + l.name))) , sample: window.__zyLevels?.find(c => c.subject === s)?.levels[0]?.qs?.[0] }), [subj, pick])); return false; }
  await pg.evaluate(f => { window.__zyForceQ = f || undefined; }, fq); await pg.click(`[data-testid=level-${idx + 1}]`); await w(900); return true; }
async function toQuestion(max = 40) { for (let s = 0; s < max; s++) {
    if (await vis('.quiz .opt, .keypad, .ime-input')) return true;
    for (const t of ['tutorial-skip', 'bet-hint-ok', 'card-std', 'bet-go']) if (await vis(`[data-testid=${t}]`)) { await pg.click(`[data-testid=${t}]`, { force: true }).catch(() => {}); await w(300); }
    if (await vis('[data-testid=chal-normal]')) { await w(2700); await pg.click('[data-testid=chal-normal]').catch(() => {}); }
    await w(300); } return false; }
const quit = async () => { await pg.click('[data-testid=pause]').catch(() => {}); await w(300); for (const t of ['quit', 'pause-quit', 'confirm-quit']) if (await vis(`[data-testid=${t}]`)) { await pg.click(`[data-testid=${t}]`); await w(400); } await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300); };


async function openById(id) {
  const r = await pg.evaluate(id => { for (const c of window.__zyLevels ?? []) { const i = c.levels.findIndex(l => l.id === id); if (i >= 0) return { subj: c.subject, i, name: c.levels[i].name }; } return null; }, id);
  if (!r) return null; await pg.click(`[data-testid="chapter-${r.subj}"]`).catch(() => {}); await w(400);
  const idx = await pg.evaluate(([s, id]) => window.__zyLevels.find(c => c.subject === s).levels.findIndex(l => l.id === id), [r.subj, id]);
  await pg.click(`[data-testid=level-${idx + 1}]`); await w(900); return r; }
async function firstId(subj) { return pg.evaluate(s => window.__zyLevels?.find(c => c.subject === s)?.levels.find(l => l.kind !== 'boss')?.id, subj); }

const VPS = (process.env.VPS || '800x600,960x600,1024x600,1280x600,1100x600,800x700,1024x700,800x800,1024x768,1180x820,1280x800,1366x768,1920x1080,844x390,740x360,667x375,600x800,768x1024,390x844,360x640').split(',').map(s => s.split('x').map(Number));
async function measure(tag) {
  for (const [W, H] of VPS) { await pg.setViewportSize({ width: W, height: H }); await w(300);
    if (W < H && W < 600) { const rot = await pg.evaluate(() => /请把手机横过来/.test(document.body.innerText)); ok(rot, `${tag} ${W}×${H}: 手机竖屏 → 「请把手机横过来」盖层（不测卡）`); continue; }
    const m = await pg.evaluate(() => { const vw = innerWidth, vh = innerHeight; const q = document.querySelector('.quiz'); const qr = q.getBoundingClientRect();
      const box = { l: Math.max(0, qr.left), r: Math.min(vw, qr.right), t: Math.max(0, qr.top), b: Math.min(vh, qr.bottom) };
      const cards = ['light', 'std', 'heavy'].map(k => { const c = document.querySelector(`[data-testid=card-${k}]`); if (!c) return { k, missing: true }; c.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const r = c.getBoundingClientRect(); const t = c.querySelector('b'); const tr = t.getBoundingClientRect();
        const inX = r.left >= box.l - 0.5 && r.right <= box.r + 0.5; const hitT = (() => { const pts = [[tr.left + 2, tr.top + tr.height / 2], [tr.right - 2, tr.top + tr.height / 2]]; return pts.every(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && c.contains(e); }); })();
        // 卡里每一行（直接子元素）不超出卡的左右边
        const kids = [...c.children].filter(e => e.offsetWidth > 0); const spill = kids.filter(e => { const er = e.getBoundingClientRect(); return er.left < r.left - 1 || er.right > r.right + 1; }).map(e => e.className || e.tagName);
        const tClip = t.scrollWidth > t.clientWidth + 1 || tr.left < r.left || tr.right > r.right;
        return { k, title: t.textContent, x0: Math.round(r.left), x1: Math.round(r.right), y0: Math.round(r.top), y1: Math.round(r.bottom), w: Math.round(r.width), inX, inV: r.left >= 0 && r.right <= vw, hitT, spill, tClip }; });
      return { q: { l: Math.round(qr.left), r: Math.round(qr.right), sw: q.scrollWidth, cw: q.clientWidth }, cards, docW: document.documentElement.scrollWidth }; });
    const good = m.cards.every(c => !c.missing && c.inX && c.inV && c.hitT && !c.spill.length && !c.tClip) && m.q.sw <= m.q.cw + 1 && m.docW <= W;
    ok(good, `${tag} ${W}×${H}: quiz ${JSON.stringify(m.q)} ` + m.cards.map(c => c.missing ? c.k + ' 缺' : `${c.title}[${c.x0}–${c.x1} y${c.y0}–${c.y1} w${c.w}${c.inX ? '' : ' 出quiz'}${c.inV ? '' : ' 出屏'}${c.hitT ? '' : ' 卡名被盖'}${c.tClip ? ' 卡名切' : ''}${c.spill.length ? ' 溢出:' + c.spill.join('/') : ''}]`).join(' '));
    await pg.screenshot({ path: `${OUT}${tag.replace(/[^\w-]/g, '_')}_${W}x${H}.png` }); }
  await pg.setViewportSize({ width: 1024, height: 800 }); await w(200); }
for (const g of (process.env.GRADES || '10,11,12').split(',')) { const ctx = await ctxNew('1024x800'); await setup('c' + g, g); ok(await toMap('c' + g), `G${g} 到地图`);
  const id = await firstId('数学'); const r = await openById(id); ok(!!r, `G${g} 打开 ${id}`);
  if (r) { for (let s = 0; s < 30 && !(await vis('[data-testid=card-std]')); s++) { for (const t of ['tutorial-skip', 'bet-hint-ok']) if (await vis(`[data-testid=${t}]`)) await pg.click(`[data-testid=${t}]`).catch(() => {}); await w(300); }
    ok(await vis('[data-testid=card-std]'), `G${g} 选卡阶段`); await measure(`G${g}-${id}`);
    // 800×600 点轻击能正常出题（卡完整之后照样能点）
    await pg.setViewportSize({ width: 800, height: 600 }); await w(300); await pg.click('[data-testid=card-light]'); let q = false; for (let s = 0; s < 20 && !q; s++) { for (const t of ['bet-go']) if (await vis(`[data-testid=${t}]`)) await pg.click(`[data-testid=${t}]`).catch(() => {}); q = await vis('.quiz .opt, .keypad, .ime-input'); if (!q) await w(300); }
    ok(q, `G${g} 800×600 点轻击 → 出题`); }
  await ctx.close(); }
console.log(errs.length ? 'pageerrors: ' + errs.join(' | ') : 'no pageerror'); ok(!errs.length, '无 pageerror');
console.log(bad ? `r173-cards FAIL ${bad}` : 'r173-cards ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
