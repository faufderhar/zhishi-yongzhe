// r15.2.1 验收（测试构建）：填空键盘真实点击 / 触屏 / 两指交叠快速输入，顺序不乱、不丢键（学霸：-,1 成「1-」；100 成「1」）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4183/'; const OUT = process.env.OUT || 'screenshots/r14/'; mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const on = k => !ONLY || ONLY.includes(k);
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(grade, init = {}, vp = { width: 1180, height: 820 }, opt = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(opt.ctx || {}) }); const pg = await ctx.newPage();
  if (!opt.noAuto) {
    await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
    await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  }
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });   // r12：等待重设的全屏提示
  await pg.addInitScript(o => { window.__zyTest = true; window.__zyTestNoTts = true; window.__said = []; Object.assign(window, o);
    const S = window.speechSynthesis; if (S) S.speak = u => { window.__said.push(u.text); }; }, init);
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  if (opt.clock) await pg.clock.install();
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', opt.name || 'r9'); await pg.click(`[data-testid=home-grade-${grade}]`); await w(400);
  return { ctx, pg, w, pinIn };
}
const enterMap = async (pg, w) => { await pg.click('text=r9'); await w(400); if (await pg.isVisible('[data-testid=pin-ok]')) { for (const d of '2468') await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(500); }   /* r15：选档案都要密码 */ if (!(await pg.isVisible('[data-testid=levels]'))) await pg.waitForSelector('[data-testid=char-confirm]', { timeout: 8000 }).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(700); } };
const tutSkip = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); } };
const skipTut = async (pg, w) => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip]'); await w(400); } };

// r15.3 学霸：「+1 技能」真实对局里会出现吗？初一数学（算算 / 阿算有「连击额外 +1」技能）全部答对，观察连击标签
const { ctx, pg, w } = await session('7', { __zyUnlockAll: true, __zyNoTut: true });
await enterMap(pg, w);
await pg.evaluate(() => { window.__tag = []; window.__combo = []; new MutationObserver(() => { const t = document.querySelector('[data-testid=combo-skill]'); const c = document.querySelector('[data-testid=combo]')?.textContent; if (c && window.__combo.at(-1) !== c) window.__combo.push(c); if (t && !window.__tagOn) { window.__tag.push(c); } window.__tagOn = !!t; }).observe(document.body, { subtree: true, childList: true, characterData: true }); });
let seen = 0, skills = new Set(); const results = [];
await pg.click('[data-testid=level-1]'); await w(900); await tutSkip(pg, w); await skipTut(pg, w);
for (let i = 0; i < 160 && !(seen && results.length >= 4); i++) {
  if (await pg.isVisible('[data-testid=result-title]')) { results.push(await pg.textContent('[data-testid=result-capped]', { timeout: 300 }).catch(() => '')); await pg.click('[data-testid=again]'); await w(1000); await tutSkip(pg, w); continue; }
  if (await pg.isVisible('[data-testid=chal-normal]')) { await pg.click('[data-testid=chal-normal]'); await w(250); }
  const o = await pg.$('.quiz .opt[data-correct="1"]');
  if (o) { await o.click().catch(() => {}); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); }
  else if (await pg.isVisible('.keypad')) { const a = String(await pg.evaluate(() => window.__zyAnswer?.() ?? '')); await pg.keyboard.type(a); await w(100); await pg.keyboard.press('Enter'); }
  await w(1500); const fb = await pg.textContent('[data-testid=feedback]', { timeout: 300 }).catch(() => ''); const m = fb && fb.match(/✨([^：]+)/); if (m) skills.add(m[1]);
  for (const s of ['[data-testid=next]', '[data-testid=fb-next]']) if (await pg.isVisible(s)) await pg.click(s);
  await w(300); seen = await pg.evaluate(() => window.__tag.length);
}
const combos = await pg.evaluate(() => window.__combo.join(' → ')); console.log('触发的技能：', [...skills].join('、') || '无'); console.log('连击变化：', combos.slice(0, 400));
ok(seen > 0, `真实对局里出现「+1 技能」标签（${await pg.evaluate(() => JSON.stringify(window.__tag))}）`);
console.log('结算页：', JSON.stringify(results));
ok(results.length >= 4 && /第 3 次/.test(results[2]) && /第 4 次/.test(results[3]), '小萌新：结算页写「这是今天第 N 次」，第 4 次不再显示 3');
await pg.screenshot({ path: '/workspace/playtest/r153-combo-skill.png' });
await b.close(); console.log(bad ? `FAIL ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
