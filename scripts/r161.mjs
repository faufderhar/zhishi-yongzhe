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

// K
for (const [vp, mobile] of [['1200x800', false], ['844x390', true]]) { const ctx = await ctxNew(vp, mobile); await setup('kb'); ok(await toMap('kb'), `K ${vp} 到地图`);
  ok(await openLevel('诗词', '天生我材必有用', 'S11-007'), `K ${vp} 找到 S11-007 所在关`);
  ok(await toQuestion(), `K ${vp} 出题`);
  const st = await pg.evaluate(() => ({ q: document.querySelector('.qtext')?.textContent ?? '', ime: !!document.querySelector('.ime-input'), num: !!document.querySelector('.keypad.num3'), alpha: !!document.querySelector('.keypad.alpha'),
    im: document.querySelector('.ime-input')?.getAttribute('inputmode'), type: document.querySelector('.ime-input')?.getAttribute('type'), focus: document.activeElement?.classList.contains('ime-input') }));
  ok(st.q.includes('天生我材必有用') && st.ime && !st.num && !st.alpha && st.im === 'text' && st.type === 'text', `K ${vp} 系统输入法文本框，没有数字 / 字母键盘 ${JSON.stringify(st)}`);
  await pg.click('.ime-input'); await pg.keyboard.insertText('千金散尽还复来');   // 相当于输入法上屏
  ok(await pg.inputValue('.ime-input') === '千金散尽还复来', `K ${vp} 文本框里是汉字答案`);
  await pg.screenshot({ path: `${OUT}K-${vp}-typed.png` });
  if (mobile) await pg.tap('[data-testid=ok]'); else await pg.click('[data-testid=ok]');
  await pg.waitForSelector('[data-testid=feedback]', { timeout: 6000 }).catch(() => {});
  const fb = await pg.evaluate(() => document.querySelector('[data-testid=feedback]')?.className ?? '');
  await pg.screenshot({ path: `${OUT}K-${vp}-feedback.png` });
  ok(/\bok\b/.test(fb), `K ${vp} 判对（${fb}）`);
  await ctx.close(); }

// E
{ const ctx = await ctxNew('1200x800', false); await setup('el'); ok(await toMap('el'), 'E 新建高二档案（没选科）直接到地图');
  const subs = await pg.evaluate(() => window.__zyLevels.map(c => c.subject)); const want = ['语文', '诗词', '数学', '英语', '化学', '生物', '历史', '地理', '政治'];
  ok(want.every(s => subs.includes(s)), `E 全科：地图上 ${[...new Set(subs)].join(' ')}`);
  ok(await openLevel('地理', 'boss'), 'E 打开高二地理 Boss'); ok(await toQuestion(), 'E Boss 出题');
  const n1 = await pg.textContent('.monster-info, [data-testid=monster-name] >> xpath=..').catch(() => '');
  ok(/第 1 阶段/.test(n1) && !/弱点/.test(n1), `E 全科：Boss 没有弱点「${n1.trim().slice(0, 40)}」`);
  await pg.screenshot({ path: `${OUT}E-boss-all.png` }); await quit();
  // 家长页改选科
  await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(500);
  const pid = await pg.evaluate(() => [...document.querySelectorAll('[data-testid^=el-label-]')].map(e => [e.dataset.testid.slice(9), e.textContent]));
  ok(pid.some(([, t]) => t.includes('还没选科（全科）')), `E 家长页档案卡：${JSON.stringify(pid)}`);
  const id = pid.find(([, t]) => t.includes('全科'))?.[0];
  for (let i = 0; i < 4 && await vis('.modal-back'); i++) { const m = await pg.evaluate(() => [...document.querySelectorAll('.modal-back [data-testid], .modal-back button')].map(e => e.dataset.testid || e.textContent.trim()).slice(0, 12)); console.log('modal on parent page:', JSON.stringify(m)); await pg.screenshot({ path: OUT + `E-parent-modal-${i}.png` });
    const btn = await pg.$('.modal-back [data-testid$=-later], .modal-back [data-testid$=-close], .modal-back [data-testid$=-ok], .modal-back button.ghost'); if (btn) await btn.click(); else await pg.mouse.click(5, 5); await w(400); }
  await pg.click(`[data-testid=edit-${id}]`); await w(300);
  ok(await vis('[data-testid=el-all].on') || await pg.evaluate(() => document.querySelector('[data-testid=el-all]')?.classList.contains('on')), 'E 编辑：默认「还没选科（全科）」选中');
  await pg.click('[data-testid=el-picked]'); await pg.click('[data-testid=el-first-物理]'); await pg.click('[data-testid=el-second-化学]');
  ok(await vis('[data-testid=el-invalid]') && await pg.isDisabled('[data-testid=profile-save]'), 'E 只选了一门再选：不能保存、有提示');
  await pg.click('[data-testid=el-second-地理]'); ok(!(await vis('[data-testid=el-invalid]')) && !(await pg.isDisabled('[data-testid=profile-save]')), 'E 物理 + 化学 + 地理：可以保存');
  await pg.click('[data-testid=profile-save]'); await w(500);
  const lab = await pg.textContent(`[data-testid=el-label-${id}]`); ok(lab.includes('物理 + 化学 + 地理'), `E 档案卡：${lab}`);
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300); await pg.click('text=el'); await w(300); ok(await toMap('el'), 'E 回到地图');
  const subs2 = await pg.evaluate(() => window.__zyLevels.map(c => c.subject)); ok(want.every(s => subs2.includes(s)), 'E 选了科：所有科目仍可玩');
  ok(await openLevel('地理', 'boss'), 'E 再开地理 Boss'); ok(await toQuestion(), 'E Boss 出题');
  const n2 = await pg.textContent('.monster-info, [data-testid=monster-name] >> xpath=..').catch(() => '');
  ok(/弱点 地理/.test(n2), `E 已选科：一阶段弱点 = 地理「${n2.trim().slice(0, 40)}」`);
  await pg.screenshot({ path: `${OUT}E-boss-picked.png` });
  // 刷新后还在
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await w(400);
  ok((await pg.textContent(`[data-testid=el-label-${id}]`)).includes('物理 + 化学 + 地理'), 'E 刷新后选科还在');
  await ctx.close(); }
ok(errs.length === 0, `没有页面错误 ${errs.slice(0, 3).join(' | ')}`);
console.log(bad ? `r161 FAIL ${bad}` : 'r161 ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
