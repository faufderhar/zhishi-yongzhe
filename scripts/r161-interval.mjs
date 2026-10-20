// r16.1 e2e（测试包）：
//  K 高二诗词 S11-007「补全诗句：天生我材必有用，____。」→ 系统输入法文本框（不是数字键盘），打汉字答案判对（桌面 1200×800 + 手机横屏 844×390）
//  E 新建高二档案不用选科：默认「还没选科（全科）」，地图上所有可见科目都在，Boss 没有弱点；之后在家长页改成 物理 + 化学 + 地理 → Boss 一阶段弱点 = 本科
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/r161/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
let pg; const w = ms => pg.waitForTimeout(ms); const vis = s => pg.isVisible(s).catch(() => false);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
const errs = [];
async function ctxNew(vp, mobile) { const [W, H] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) }); pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyNoOfflineCache = true; window.__zyUnlockAll = true; });
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300); return ctx; }
async function setup(name) {
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0').catch(() => {});
  await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x'); await pg.click('[data-testid=hint-ok]'); await w(500);
  if (await vis('[data-testid=rec-done]')) { await pg.click('[data-testid=rec-done]'); await w(300); } if (await vis('[data-testid=pin-verify]')) await pinIn('2468'); await w(300);
  await pg.fill('[data-testid=add-name]', name); await pg.click('[data-testid=home-grade-11]'); await w(500); }
async function toMap(name) { for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')); i++) {
    if (await vis('[data-testid=pin-ok]')) await pinIn('2468');
    else if (await vis('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await pg.click('[data-testid=char-confirm]', { force: true }); }
    else if (await vis('[data-testid=stage-pick]')) await pg.click('[data-testid=stage-pick] .stage-btn.on', { timeout: 1500 }).catch(() => pg.click('[data-testid=stage-H]').catch(() => {}));
    else if (await vis('[data-testid=grade-pick]')) await pg.click('[data-testid=grade-pick] .stage-btn.on', { timeout: 1500 }).catch(() => pg.click('[data-testid=grade-pick] [data-testid$="-11"]').catch(() => {}));
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

// r16.1 (r)：高二 M11-001 选项 A「[0,π)」B「[0,π]」在真浏览器里要显示得不一样；M11-009 B 以「π)」结尾
for (const [vp, mobile] of [['1280x600', false], ['844x390', true]]) { const ctx = await ctxNew(vp, mobile); await setup('iv'); ok(await toMap('iv'), `${vp} 到地图`);
  for (const id of ['M11-001', 'M11-009']) {
    ok(await openLevel('数学', id === 'M11-001' ? '倾斜角 $\\alpha$ 的取值范围' : '斜率 $k\\in[-1,1]$', id), `${vp} 找到 ${id}`); ok(await toQuestion(), `${vp} ${id} 出题`);
    const o = await pg.evaluate(() => [...document.querySelectorAll('.quiz .opt')].map(b => ({ k: b.dataset.testid, ann: [...b.querySelectorAll('annotation')].map(a => a.textContent).join(' '), txt: b.querySelector('.katex-html')?.textContent ?? b.textContent })));
    console.log(id, JSON.stringify(o)); await pg.screenshot({ path: `${OUT}interval-${id}-${vp}.png` });
    if (id === 'M11-001') ok(o.length === 4 && new Set(o.map(x => x.txt)).size === 4 && o.some(x => /π\)$/.test(x.txt)) && o.some(x => /π\]$/.test(x.txt)), `${vp} M11-001 四个选项显示各不相同，有「π)」也有「π]」`);
    else ok(o.some(x => /π\)$/.test(x.txt)), `${vp} M11-009 有以「π)」结尾的选项`);
    await quit(); ok(await toMap('iv'), `${vp} 回地图`);
  }
  await ctx.close(); }
console.log(errs.length ? 'pageerrors: ' + errs.join(' | ') : 'no pageerror');
console.log(bad ? `r161-interval FAIL ${bad}` : 'r161-interval ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
