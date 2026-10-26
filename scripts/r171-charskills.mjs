// r17.1 学霸 r17-1：角色卡技能块 +〔技能详情〕。kid-k（幼儿园：不显示）、kid-7（初一）、kid-10（高一）：
// 从地图〔选角色〕进角色页：每张卡 ⚔/🛡 两行、名字和详情列表一致；各视口（含 768 竖屏）卡片不溢出、页面不横向撑宽；
// 点〔技能详情〕= 选中该卡并打开详情（不触发卡片别的行为）；然后进战斗点能量环，弹窗文字和角色卡详情完全一样。
// 用法：URL=http://127.0.0.1:4475/ OUT=… node scripts/r171-charskills.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://127.0.0.1:4475/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/charskills/shots/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const VPS = [[1280, 800], [1024, 768], [768, 1024], [1024, 600], [844, 390]];
const detailText = (pg, id) => pg.evaluate(id => { const l = document.querySelector(`[data-testid=${id}-list]`); if (!l) return null;
  const parts = [l.textContent, l.nextElementSibling?.textContent, document.querySelector(`[data-testid=${id}]`)?.textContent, document.querySelector(`[data-testid=${id}-cd]`)?.textContent ?? ''];
  return parts.join('¶').replace(/\s+/g, ' ').trim(); }, id);
for (const kid of ['kid-k', 'kid-7', 'kid-10']) {
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
  await pg.click('[data-testid=change-char]'); await pg.waitForSelector('[data-testid=char-confirm]'); await w(300);
  const cards = await pg.evaluate(() => [...document.querySelectorAll('.char-card')].map(c => ({ id: c.dataset.testid.slice(5), sk: !!c.querySelector('.char-skill'),
    mine: c.querySelector('[data-testid^=char-skill-mine-]')?.textContent, theirs: c.querySelector('[data-testid^=char-skill-theirs-]')?.textContent, head: c.querySelector('.cs-head')?.textContent })));
  if (kid === 'kid-k') { ok(cards.length > 0 && cards.every(c => !c.sk) && !(await pg.isVisible('[data-testid=char-skill-detail]')), `${kid} 幼儿园：${cards.length} 张卡都没有技能块`); }
  else {
    ok(cards.length === 10 && cards.every(c => c.sk && c.head === '技能（答对时自动放，不用按）' && /^⚔ 我方回合：\S/.test(c.mine) && /^🛡 对方回合：\S/.test(c.theirs)), `${kid} 10 张卡都有技能块：${JSON.stringify(cards.map(c => c.id + ' ' + c.mine + ' / ' + c.theirs))}`);
    for (const [W, H] of VPS) { await pg.setViewportSize({ width: W, height: H }); await w(300);
      const m = await pg.evaluate(() => { const bad = []; for (const c of document.querySelectorAll('.char-card')) { const r = c.getBoundingClientRect();
          for (const e of c.querySelectorAll('.char-skill span, .char-skill')) { const er = e.getBoundingClientRect(); if (er.right > r.right + 1 || er.left < r.left - 1 || e.scrollWidth > e.clientWidth + 1) bad.push(c.dataset.testid + ':' + (e.className || e.textContent.slice(0, 8))); }
          const mr = c.querySelector('.cs-more').getBoundingClientRect(); if (er0(mr, r)) bad.push(c.dataset.testid + ':more-out'); }
        function er0(a, r) { return a.bottom > r.bottom + 1 || a.top < r.top - 1; }
        return { bad, docW: document.documentElement.scrollWidth, W: innerWidth }; });
      ok(!m.bad.length && m.docW <= m.W, `${kid} ${W}×${H} 角色卡不溢出：${JSON.stringify(m)}`);
      await pg.screenshot({ path: `${OUT}${kid}_${W}x${H}_chars.png`, fullPage: true }); }
    await pg.setViewportSize({ width: 1280, height: 800 }); await w(300);
    // 每张卡：点〔技能详情〕→ 选中这张卡 + 打开详情；详情列表名字 = 卡上两行
    let allOk = true; const det = {};
    for (const c of cards) { await pg.locator(`[data-testid=char-skill-more-${c.id}]`).scrollIntoViewIfNeeded(); await pg.click(`[data-testid=char-skill-more-${c.id}]`); await pg.waitForSelector('[data-testid=skill-detail]');
      const r = await pg.evaluate(id => ({ names: [...document.querySelectorAll('[data-testid=skill-detail-list] li b')].map(b => b.textContent), sides: [...document.querySelectorAll('[data-testid=skill-detail-list] li')].map(l => l.dataset.side).join(''),
        sel: document.querySelector(`[data-testid=char-${id}]`).getAttribute('aria-pressed'), still: !!document.querySelector('[data-testid=char-confirm]') }), c.id);
      const want = [...c.mine.replace('⚔ 我方回合：', '').split(' · '), ...c.theirs.replace('🛡 对方回合：', '').split(' · ')];
      det[c.id] = await detailText(pg, 'skill-detail');
      const good = JSON.stringify(r.names) === JSON.stringify(want) && /^P+M+$/.test(r.sides) && r.sel === 'true' && r.still && (kid !== 'kid-10' || det[c.id].includes('冷却：'));
      if (!good) { allOk = false; console.log('  ', c.id, JSON.stringify(r), want); }
      if (c === cards[0]) await pg.screenshot({ path: `${OUT}${kid}_detail.png` });
      await pg.click('[data-testid=skill-detail-ok]'); await w(150); }
    ok(allOk, `${kid} 每张卡〔技能详情〕：选中该卡、留在角色页、详情列表 = 卡上两行${kid === 'kid-10' ? '、有冷却行' : ''}`);
    // 选第一张，键盘可达的〔技能详情：X〕按钮也能开
    await pg.click(`[data-testid=char-${cards[0].id}]`); await pg.click('[data-testid=char-skill-detail]'); ok(await pg.isVisible('[data-testid=skill-detail]'), `${kid} 选中后卡片下方〔技能详情〕按钮能打开`); await pg.click('[data-testid=skill-detail-ok]');
    await pg.click('[data-testid=char-confirm]'); await pg.waitForSelector('[data-testid=levels]'); await w(400);
    await pg.locator('.level:not(.boss)').first().click(); await w(900);
    const step = async () => {
      for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
      for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip]'); await w(300); }
      for (const t of await pg.$$('.first-tip')) await t.click().catch(() => {});
      for (const id of ['chal-normal', 'card-std', 'wager-sure', 'next']) if (await pg.isVisible(`[data-testid=${id}]`)) { await pg.click(`[data-testid=${id}]`).catch(() => {}); await w(250); }
    };
    for (let i = 0; i < 40 && !(await pg.isVisible('[data-testid=energy]')); i++) { await step(); await w(250); }
    await pg.click('[data-testid=energy]'); await pg.waitForSelector('[data-testid=ring-pop]');
    const ring = await detailText(pg, 'ring-pop'); await pg.screenshot({ path: `${OUT}${kid}_ringpop.png` });
    ok(ring === det[cards[0].id], `${kid} 能量环弹窗 = 角色卡详情（${cards[0].id}）：${ring === det[cards[0].id] ? ring.slice(0, 60) + '…' : JSON.stringify({ ring, card: det[cards[0].id] })}`);
  }
  ok(!errs.length, `${kid} 无 pageerror ${errs.join(' | ')}`);
  await ctx.close(); }
await b.close(); console.log(bad ? `r171-charskills FAIL ${bad}` : 'r171-charskills ALL PASS'); process.exit(bad ? 1 : 0);
