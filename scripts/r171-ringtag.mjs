// r17.1 学霸 r17-6：能量环标签「满5必放」/「答对必放」。初一（kid-7）、高一（kid-10）各进第一关普通关：
// 各视口下标签 ≥13px / 600、点击区（含 ::after 外扩 6px）≥44、不撑宽页面、环中心点得到；连续答对，能量到 4（或保底）时标签变「答对必放」，下一题放技能。
// 用法：URL=http://127.0.0.1:4475/ OUT=… node scripts/r171-ringtag.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://127.0.0.1:4475/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/ringtag/shots/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const VPS = [[1280, 800], [1024, 600], [800, 600], [844, 390], [740, 360]];   // 竖屏手机是「请横过来」，不测
for (const kid of ['kid-7', 'kid-10']) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; window.__zyTestSpentSec = -1e7; });
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });
  const w = ms => pg.waitForTimeout(ms);
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click(`[data-testid=profile-${kid}]`); await w(600);
  for (let i = 0; i < 20 && !(await pg.isVisible('[data-testid=levels]')); i++) {
    if (await pg.isVisible('[data-testid=pin-nudge-skip]')) await pg.click('[data-testid=pin-nudge-skip]');
    if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm])'); await pg.click('[data-testid=char-confirm]'); }
    for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {});
    await w(400);
  }
  await pg.locator('.level:not(.boss)').first().click(); await w(900);
  const step = async () => {
    for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
    for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip]'); await w(300); }
    for (const t of await pg.$$('.first-tip')) await t.click().catch(() => {});
    for (const id of ['chal-normal', 'card-std', 'wager-sure', 'next']) if (await pg.isVisible(`[data-testid=${id}]`)) { await pg.click(`[data-testid=${id}]`).catch(() => {}); await w(250); }
  };
  const atQ = () => pg.evaluate(() => !!document.querySelector('.quiz .opt, .keypad, .quiz input') && !!document.querySelector('[data-testid=energy]'));
  for (let i = 0; i < 40 && !(await atQ()); i++) { await step(); await w(250); }
  ok(await atQ(), `${kid} 进到出题、有能量环`);
  for (const [W, H] of VPS) { await pg.setViewportSize({ width: W, height: H }); await w(300);
    const m = await pg.evaluate(() => { const e = document.querySelector('[data-testid=energy]'), t = document.querySelector('[data-testid=energy-tag]'); const r = e.getBoundingClientRect(); const cs = getComputedStyle(t);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { txt: t.textContent, tag: e.dataset.tag, e: e.dataset.e, fs: parseFloat(cs.fontSize), fw: +cs.fontWeight, op: +cs.opacity, w: Math.round(r.width) + 12, h: Math.round(r.height) + 12,
        in: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, hit: !!hit && (hit === e || e.contains(hit)), docW: document.documentElement.scrollWidth, tagClip: t.scrollWidth > t.clientWidth + 1,
        svgW: Math.round(e.querySelector('svg').getBoundingClientRect().width), inHud: (() => { const h = e.closest('.hud').getBoundingClientRect(), tr = t.getBoundingClientRect(); return tr.right <= h.right + 1 && tr.left >= h.left && tr.right <= r.right + 1; })(),
        overlap: (() => { const n = e.nextElementSibling; if (!n) return false; const nr = n.getBoundingClientRect(), tr = t.getBoundingClientRect(); return nr.width > 0 && nr.left < tr.right - 1; })() }; });
    const short = H <= 500;   // 短横屏：顶栏 32 高、按钮 28 高（r15 起），能量环按内容撑宽
    ok(m.txt === '满5必放' && m.tag === 'cap' && m.e === '0' && m.fs >= 13 && m.fw >= 600 && m.op === 1 && (short ? m.w - 12 >= 44 && m.h - 12 >= 28 && m.svgW >= 20 && m.inHud && !m.overlap : m.w >= 44 && m.h >= 44) && m.in && m.hit && m.docW <= W && !m.tagClip, `${kid} ${W}×${H} 开局：${JSON.stringify(m)}`);
    await pg.screenshot({ path: `${OUT}${kid}_${W}x${H}_cap.png` }); }
  await pg.setViewportSize({ width: 1280, height: 800 }); await w(200);
  const seen = []; let must = null, fired = null;
  let lv = 0;
  for (let s = 0; s < 900 && seen.length < 120 && !(must && fired !== null); s++) {   // r17.1 加固：随机触发的技能会把能量清零，高一偶尔 4 关内到不了 ⚡4 → 最多 10 关、120 题
    if (await pg.isVisible('[data-testid=result-title]')) { if (++lv > 9) break; seen.push('|'); await pg.click('[data-testid=to-map]').catch(() => {}); await w(800); await pg.locator('.level:not(.boss)').nth(lv).click().catch(() => {}); await w(900); continue; }
    await step();
    if (!(await atQ())) { await w(250); continue; }
    const st = await pg.evaluate(() => { const e = document.querySelector('[data-testid=energy]'); return { e: +e.dataset.e, tag: e.dataset.tag, txt: document.querySelector('[data-testid=energy-tag]').textContent }; });
    seen.push(`${st.e}:${st.txt}`);
    if (st.tag === 'must' && !must) { must = st; await pg.screenshot({ path: `${OUT}${kid}_must.png` }); }
    const log0 = await pg.evaluate(() => window.__zyBossLog?.rounds?.length ?? 0);
    const o = await pg.$$('.quiz .opt[data-correct="1"]');
    if (o.length) { for (const x of o) await x.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); }
    else if (await pg.$('.keypad')) { const a = String(await pg.evaluate(() => window.__zyAnswer?.())); for (const ch of a) await pg.click(`.keypad [data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]').catch(() => {}); }
    else if (await pg.$('.quiz input')) { await pg.fill('.quiz input', String(await pg.evaluate(() => window.__zyAnswer?.()))); await pg.click('[data-testid=ok]').catch(() => {}); }
    await w(500);
    if (st.tag === 'must' && fired === null) { const L = await pg.evaluate(() => window.__zyBossLog?.rounds ?? []); const last = L.at(-1); fired = L.length > log0 ? !!(last?.skill) : 'nolog'; if (fired === true || fired === 'nolog') { const sk = await pg.isVisible('.skill-banner, [data-testid=skill-banner]').catch(() => false); fired = fired === true || sk; } }
    for (let i = 0; i < 12 && await atQ(); i++) await w(250);
  }
  ok(!!must && must.txt === '答对必放', `${kid} 答对过程标签：${seen.join(' → ')}；「答对必放」出现在能量 ${must?.e}`);
  ok(seen.filter(x => +x.split(':')[0] === 4).every(x => x.endsWith('答对必放') || kid === 'kid-10'), `${kid} 能量 4 时都是「答对必放」（高中冷却池空时可为「满5必放」）`);
  ok(fired !== false, `${kid} 「答对必放」那题答对后放了技能（${fired}）`);
  ok(!errs.length, `${kid} 无 pageerror ${errs.join(' | ')}`);
  await ctx.close(); }
await b.close(); console.log(bad ? `r171-ringtag FAIL ${bad}` : 'r171-ringtag ALL PASS'); process.exit(bad ? 1 : 0);
