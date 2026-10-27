// r17.4.1 技术QA r17.4 N5（P3）：600 高横屏（800–1100 宽）回合制顶栏「第 x 回合（最多 y）」+ 计时留位把 ❤ 血条挤到 ~9px（r17.1/r17.3 ~36px）
// 每个视口 × 选卡 / 答题：血条 .track ≥ 40px、回合文字完整可见（不被顶栏裁、不压 ❓ ⏸）、顶栏一行且两阶段同高、顶栏子元素都在顶栏内
// 用法：URL=http://localhost:4471/ OUT=… node scripts/r1741-hpbar.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/hpbar1741/'; mkdirSync(OUT, { recursive: true });
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
let VPS = (process.env.VPS || '800x600,820x600,880x600,960x600,1024x600,1100x600,800x700,1024x768,1280x800,844x390,667x375').split(',').map(s => s.split('x').map(Number));
const MIN_TRACK = 40; const res = [];
async function measure(tag) { const hs = {};
  for (const [W, H] of VPS) { await pg.setViewportSize({ width: W, height: H }); await w(300);
    const m = await pg.evaluate(() => { const R = e => { const r = e.getBoundingClientRect(); return { x0: Math.round(r.left), x1: Math.round(r.right), y0: Math.round(r.top), y1: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
      const hud = document.querySelector('.battle.rounds .hud'); if (!hud) return null; const hr = hud.getBoundingClientRect();
      const tr = document.querySelector('.hud .bar.hp .track'); const turn = document.querySelector('[data-testid=turn]');
      const btnL = Math.min(...['rules', 'pause'].map(t => document.querySelector(`[data-testid=${t}]`)).filter(e => e && e.offsetWidth).map(e => e.getBoundingClientRect().left));
      const tR = turn.getBoundingClientRect();
      // 回合文字每个字形都在顶栏内、不在 ❓ 下面、不被省略号截掉
      const rng = document.createRange(); rng.selectNodeContents(turn); const rects = [...rng.getClientRects()].filter(r => r.width > 0);
      const txtR = Math.max(...rects.map(r => r.right)), txtB = Math.max(...rects.map(r => r.bottom)), txtT = Math.min(...rects.map(r => r.top));
      const turnOk = txtR <= Math.min(hr.right, btnL) + 0.5 && txtT >= hr.top - 0.5 && txtB <= hr.bottom + 0.5 && turn.scrollWidth <= turn.clientWidth + 1;
      const kids = [...hud.children].filter(e => e.offsetWidth > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.matches('.rules-btn,.pause-btn,.grow'));
      const outKids = kids.filter(e => { const r = e.getBoundingClientRect(); return r.right > btnL + 0.5 || r.bottom > hr.bottom + 0.5 || r.left < hr.left - 0.5; }).map(e => e.dataset.testid || e.className);
      // 顶栏各块的实际文字 / 图形范围两两不重叠（r17.4.1 自测：只锁血条宽度时「160/160」会叠到「⏱ 45s」上）
      const ext = kids.map(e => { const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects(), e.getBoundingClientRect()].filter(r => r.width > 0);
        return { id: e.dataset.testid || e.className.split(' ')[0], l: Math.min(...rs.map(r => r.left)), r: Math.max(...rs.map(r => r.right)) }; }).sort((a, b) => a.l - b.l);
      const overlap = ext.slice(1).filter((x, i) => x.l < ext[i].r - 0.5).map((x, i) => `${ext[i].id}↔${x.id}`);
      outKids.push(...overlap.map(o => '重叠 ' + o));
      const fs = parseFloat(getComputedStyle(turn).fontSize), capEl = turn.querySelector('small'), capFs = capEl ? parseFloat(getComputedStyle(capEl).fontSize) : 0;
      return { track: tr ? R(tr) : null, hud: R(hud), turn: { ...R(turn), txt: turn.textContent, fs, capFs, ok: turnOk }, btnL: Math.round(btnL), outKids, docW: document.documentElement.scrollWidth }; });
    if (!m) { ok(false, `${tag} ${W}×${H}: 没找到回合制顶栏`); continue; }
    const landTab = W > H && H > 500; const need = landTab ? MIN_TRACK : 24;   // ≤500 高的手机横屏紧凑顶栏另有规则（r15.4.2），只要求血条看得见
    const good = m.track && m.track.w >= need && m.turn.ok && !m.outKids.length && m.docW <= W && m.turn.fs >= 13 && (!m.turn.capFs || m.turn.capFs >= 11);
    hs[`${W}x${H}`] = m.hud.h; res.push({ tag, vp: `${W}x${H}`, track: m.track?.w, turn: m.turn.txt, hudH: m.hud.h });
    ok(good, `${tag} ${W}×${H}: 血条 ${m.track?.w}px（x${m.track?.x0}–${m.track?.x1}，要 ≥${need}） 回合「${m.turn.txt}」x${m.turn.x0}–${m.turn.x1} y${m.turn.y0}–${m.turn.y1} ${m.turn.fs}/${m.turn.capFs}px${m.turn.ok ? '' : ' 被裁/压按钮'} ❓左 ${m.btnL} 顶栏 h${m.hud.h}${m.outKids.length ? ' 出界:' + m.outKids.join(',') : ''}`);
    await pg.screenshot({ path: `${OUT}${tag.replace(/[^\w-]/g, '_')}_${W}x${H}.png`, clip: { x: 0, y: 0, width: W, height: Math.min(H, m.hud.y1 + 40) } }); }
  await pg.setViewportSize({ width: 1024, height: 800 }); await w(200); return hs; }
for (const g of (process.env.GRADES || '10,12,7').split(',')) { const ctx = await ctxNew('1024x800'); await setup('n' + g, g); ok(await toMap('n' + g), `G${g} 到地图`);
  const id = await firstId('数学'); const r = await openById(id); ok(!!r, `G${g} 打开 ${id}`); if (!r) { await ctx.close(); continue; }
  for (let s = 0; s < 20 && !(await vis('[data-testid=pause]')); s++) { if (await vis('[data-testid=tutorial-skip]')) await pg.click('[data-testid=tutorial-skip]').catch(() => {}); await w(300); }
  for (let s = 0; s < 20 && !(await vis('[data-testid=card-std]')) && !(await vis('.quiz .opt, .keypad, .ime-input')); s++) { for (const t of ['bet-hint-ok']) if (await vis(`[data-testid=${t}]`)) await pg.click(`[data-testid=${t}]`).catch(() => {}); await w(300); }
  const h1 = await measure(`G${g}-${id}-card`);
  ok(await toQuestion(), `G${g} ${id} 出题`); const h2 = await measure(`G${g}-${id}-q`);
  // 最长的回合文字（两位数回合 + 题少说明）：直接改 DOM 量一遍（真实关卡里很难凑出题少的关）
  await pg.evaluate(() => { const t = document.querySelector('[data-testid=turn]'); t.innerHTML = '第 14 回合<small class="turn-note" data-testid="turn-note">（题少，最多 12 回合）</small>'; });
  { const keep = VPS; VPS = VPS.filter(([W, H]) => W > H && H > 500); await measure(`G${g}-${id}-q-最长回合字`); VPS = keep; }   // ≤500 高手机横屏紧凑顶栏不在 N5 范围
  for (const k of Object.keys(h1)) { const [W, H] = k.split('x').map(Number); if (W > H && H > 500 && W <= 1100) ok(h1[k] === h2[k], `G${g} ${k}: 选卡 / 答题顶栏同高（${h1[k]} / ${h2[k]}）`); }
  await ctx.close(); }
console.log('SUMMARY ' + JSON.stringify(res.filter(r => /^(800|1024)x600$/.test(r.vp))));
console.log(errs.length ? 'pageerrors: ' + errs.join(' | ') : 'no pageerror'); ok(!errs.length, '无 pageerror');
console.log(bad ? `r1741-hpbar FAIL ${bad}` : 'r1741-hpbar ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
