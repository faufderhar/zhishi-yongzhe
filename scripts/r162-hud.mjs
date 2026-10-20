// r16.2 技术QA B1 顶栏 e2e
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/hud/'; mkdirSync(OUT, { recursive: true });
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


// r16.2 技术QA B1：回合制战斗顶栏在 800 / 960 / 1024 宽（600 / 800 高）不能把 ❓ / ⏸ 挤出屏幕；用最长的关名（r16.2 恢复全名的 4 关）+ 各年级第 1 关
async function openById(id) {
  const r = await pg.evaluate(id => { for (const c of window.__zyLevels ?? []) { const i = c.levels.findIndex(l => l.id === id); if (i >= 0) return { subj: c.subject, i, name: c.levels[i].name }; } return null; }, id);
  if (!r) return null; await pg.click(`[data-testid="chapter-${r.subj}"]`).catch(() => {}); await w(400);
  const idx = await pg.evaluate(([s, id]) => window.__zyLevels.find(c => c.subject === s).levels.findIndex(l => l.id === id), [r.subj, id]);
  await pg.click(`[data-testid=level-${idx + 1}]`); await w(900); return r; }
async function firstId(subj) { return pg.evaluate(s => window.__zyLevels?.find(c => c.subject === s)?.levels.find(l => l.kind !== 'boss')?.id, subj); }
const VPS = [[800, 600], [960, 600], [1024, 600], [800, 800], [960, 800], [1024, 800]];
async function measure(tag) {
  for (const [W, H] of VPS) { await pg.setViewportSize({ width: W, height: H }); await w(250);
    const m = await pg.evaluate(() => { const vw = innerWidth, vh = innerHeight; const out = {};
      for (const t of ['rules', 'pause']) { const e = document.querySelector(`[data-testid=${t}]`); if (!e) { out[t] = 'missing'; continue; } const r = e.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const hit = document.elementFromPoint(cx, cy);
        out[t] = { x0: Math.round(r.left), x1: Math.round(r.right), y0: Math.round(r.top), y1: Math.round(r.bottom), in: r.left >= 0 && r.right <= vw && r.top >= 0 && r.bottom <= vh && r.width > 0, hit: !!hit && (hit === e || e.contains(hit)), w: Math.round(r.width), h: Math.round(r.height) }; }
      const hud = document.querySelector('.hud'); out.hud = hud ? { h: Math.round(hud.getBoundingClientRect().height), sw: hud.scrollWidth, cw: hud.clientWidth } : null;
      const t = document.querySelector('[data-testid=lvl-title]'); out.title = t ? { txt: t.textContent, vis: t.offsetWidth > 0, clip: t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1 } : null;
      out.docW = document.documentElement.scrollWidth; return out; });
    const rounds = await pg.evaluate(() => !!document.querySelector('.battle.rounds'));   // 小学非回合制战斗没有 ❓
    const good = ['rules', 'pause'].every(t => (t === 'rules' && !rounds && m[t] === 'missing') || (m[t] !== 'missing' && m[t].in && m[t].hit && m[t].w >= 28 && m[t].h >= 28)) && m.docW <= W;
    ok(good, `${tag} ${W}×${H}: ❓ ${JSON.stringify(m.rules)} ⏸ ${JSON.stringify(m.pause)} hud ${JSON.stringify(m.hud)} 关名 ${JSON.stringify(m.title)}`);
    await pg.screenshot({ path: `${OUT}${tag.replace(/[^\w-]/g, '_')}_${W}x${H}.png` }); }
  await pg.setViewportSize({ width: 1024, height: 800 }); await w(200); }
const CASES = [['10', ['语文|N|10:Y10-001'], ['数学']], ['11', ['语文|N|11:Y11-113'], ['数学']], ['4', ['语文|N|4:Y4-022'], ['数学']], ['6', ['语文|N|6:Y6-022'], ['数学']], ['7', [], ['数学']], ['8', [], ['数学']], ['1', [], ['数学']]];
for (const [g, ids, subs] of CASES) { const ctx = await ctxNew('1024x800'); await setup('h' + g, g); ok(await toMap('h' + g), `G${g} 到地图`);
  const list = [...ids]; for (const s of subs) { const f = await firstId(s); if (f) list.push(f); }
  for (const id of list) { const r = await openById(id); ok(!!r, `G${g} 打开 ${id}`); if (!r) continue;
    for (let s = 0; s < 20 && !(await vis('[data-testid=pause]')); s++) { if (await vis('[data-testid=tutorial-skip]')) await pg.click('[data-testid=tutorial-skip]').catch(() => {}); await w(300); }
    await measure(`G${g}-${id}-card「${r.name}」`);
    ok(await toQuestion(), `G${g} ${id} 出题`); await measure(`G${g}-${id}-q「${r.name}」`);
    await quit(); ok(await toMap('h' + g), `G${g} 回地图`); }
  await ctx.close(); }
console.log(errs.length ? 'pageerrors: ' + errs.join(' | ') : 'no pageerror');
console.log(bad ? `r162-hud FAIL ${bad}` : 'r162-hud ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
