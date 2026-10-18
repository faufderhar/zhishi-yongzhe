// r15.4.1 小萌新（r15.4 线上 1393×901 复现）：小班选项卡里的图 / emoji 不能伸出卡片、不能被屏幕边裁掉。
// 遍历小班题库里所有「选项带 emoji / 图」或「题干带数数图」的题，测试构建里用 __zyForceQ 逐题强制出成第 1 题，
// 在 6 种横屏视口下量：每个选项卡里的每个 img / 形状图（getBoundingClientRect）和每个 emoji（Range 字形框）
// 都在本卡片的框里、也在视口里；卡片本身在视口里；题干数数图（.kitem）在视口里。选项文字（Range 字形框）也一样要求。
// 可续跑：结果按视口写 OUT/res-<视口>.jsonl，已测过的题跳过。用法：URL=… VP=1393x901 [IDS=K-037,K-038] [SHOTS=…] node scripts/r1541-optimg.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync, appendFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4302/'; const OUT = process.env.OUT || '/workspace/playtest/r1541-optimg/'; mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; BTK-W00; HMSCore 6.14.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/15.0.4.312 Safari/537.36';
const ALLVP = {
  '1393x901': { viewport: { width: 1393, height: 901 }, deviceScaleFactor: 1.2 },   // 小萌新：1280×800 缩放模拟 + 浏览器栏
  '1400x920': { viewport: { width: 1400, height: 920 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA },   // 华为 MatePad 全屏
  '1244x818': { viewport: { width: 1244, height: 818 }, deviceScaleFactor: 2.25, isMobile: true, hasTouch: true, userAgent: UA },   // 显示放大一档
  '1280x800': { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  '1024x600': { viewport: { width: 1024, height: 600 }, deviceScaleFactor: 1 },
  '1180x820': { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true },   // iPad Air 横屏
  // r15.4.2 技术QA P1-1：平板竖屏（短边 ≥ 600 不盖「横过来」，必须能玩）
  '768x1024': { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA },
  '800x1280': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA },
  '820x1180': { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true },   // iPad Air 竖屏
};
const VPS = (process.env.VP || Object.keys(ALLVP).join(',')).split(',');
const E = /[\p{Extended_Pictographic}]/u;
const bank = JSON.parse(readFileSync(new globalThis.URL('../public/banks/bank_K1.json', import.meta.url))).questions;
let QS = bank.filter(q => q.game_ready !== false && ((q.options || []).some(o => E.test(o.text || '') || o.image) || q.visual || E.test(q.question)));
if (process.env.SAMPLE) { const n = +process.env.SAMPLE; QS = QS.filter((_, i) => i % n === 0); }   // 抽样：每 n 题测 1 题（竖屏三档全量太慢时用，报告里注明）
if (process.env.IDS) { const s = process.env.IDS.split(','); QS = QS.filter(q => s.includes(q.id)); }
const SHOTS = new Set((process.env.SHOTS || 'K-037,K-038,K-039,K-040').split(','));
const strip = t => t.replace(/[\p{Extended_Pictographic}\uFE0F\u200D\s，。？！、：；,.?!:;“”"'（）()]/gu, '');
const b = await chromium.launch(); let bad = 0, pass = 0, warn = 0, skip = 0;
const log = m => console.log(m);

async function session(name) {
  const ctx = await b.newContext({ ...ALLVP[name] }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; window.__zyTestSpentSec = -1e7; /* 跑很久也不触发每日时长 */ });
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click('[data-testid=home-grade-K1]'); await w(400);
  await pg.click('text=r9'); await w(500); if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468');
  for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on, [data-testid=${sp}] .stage-btn >> nth=0`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]) >> nth=0'); await w(200); await pg.click('[data-testid=char-confirm]'); } if (await pg.isVisible('.modal >> text=稍后')) await pg.click('.modal >> text=稍后'); await w(400); }
  return { ctx, pg, w };
}
const measure = pg => pg.evaluate(() => {
  const EMO = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu;
  const R = r => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const vis = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && r.width > 2 && r.height > 2; };
  const textRects = root => { const out = []; const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) { const s = n.nodeValue; if (!s.trim()) continue; const marks = []; for (const m of s.matchAll(EMO)) marks.push([m.index, m.index + m[0].length, 'emoji', m[0]]);
      let p = 0; const all = []; for (const mk of marks) { if (mk[0] > p && s.slice(p, mk[0]).trim()) all.push([p, mk[0], 'text', s.slice(p, mk[0])]); all.push(mk); p = mk[1]; } if (p < s.length && s.slice(p).trim()) all.push([p, s.length, 'text', s.slice(p)]);
      for (const [a, z, k, t] of all) { const rg = document.createRange(); rg.setStart(n, a); rg.setEnd(n, z); const rr = rg.getBoundingClientRect(); if (rr.width > 0 && rr.height > 0) out.push({ k, t: t.trim(), r: R(rr) }); } }
    return out; };
  const opts = [...document.querySelectorAll('.kopts .kopt')].filter(vis).map(card => {
    const els = [...card.querySelectorAll('img, .shape-img, svg:not(.shape-img svg)')].filter(vis).map(e => ({ k: e.tagName === 'IMG' ? 'img' : 'shape', t: e.getAttribute('data-shape') || (e.getAttribute('src') || '').split('/').pop(), r: R(e.getBoundingClientRect()) }));
    return { key: card.dataset.testid, r: R(card.getBoundingClientRect()), els: [...els, ...textRects(card)] }; });
  const stem = [...document.querySelectorAll('.kbubble .kitem')].filter(vis).map(e => R(e.getBoundingClientRect()));
  const bubble = document.querySelector('.kbubble'), busy = document.querySelector('[data-testid=kbusy]');
  return { vw: innerWidth, vh: innerHeight, opts, stem, stemText: bubble?.innerText || '', tight: !!document.querySelector('.kbattle.ktight'), kfit: document.querySelector('.kstage')?.dataset.kfit,
    busy: busy && vis(busy) ? R(busy.getBoundingClientRect()) : null, bubbleR: bubble ? R(bubble.getBoundingClientRect()) : null };
});
const T = 1;   // 容差 px
const inside = (a, c) => a.l >= c.l - T && a.t >= c.t - T && a.r <= c.r + T && a.b <= c.b + T;
const quit = async (pg, w) => {
  const box = await pg.locator('[data-testid=pause]').boundingBox(); if (box) { await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pg.mouse.down(); await w(2300); await pg.mouse.up(); }
  await pg.click('[data-testid=quit]', { timeout: 3000 }).catch(() => {}); await pg.click('[data-testid=quit-confirm]', { timeout: 3000 }).catch(() => {});
  await pg.waitForSelector('[data-testid=level-1]', { timeout: 8000 }).catch(() => {});
};
for (const vp of VPS) {
  const file = `${OUT}res-${vp}.jsonl`; const done = new Set(existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).id) : []);
  const todo = QS.filter(q => !done.has(q.id)); log(`== ${vp}: ${QS.length} 题，已测 ${QS.length - todo.length}，本次 ${todo.length}`);
  if (!todo.length) continue;
  let s = await session(vp);
  for (const q of todo) {
    const { pg, w } = s; const rec = { id: q.id, vp, fails: [], warns: [] };
    try {
      if (!(await pg.isVisible('[data-testid=level-1]'))) { await pg.click('[data-testid=to-map]').catch(() => {}); await w(600); }
      await pg.evaluate(id => { window.__zyForceQ = id; }, q.id);
      await pg.click('[data-testid=level-1]'); await w(900);
      for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
      await pg.waitForSelector('.kbattle .kopt', { timeout: 10000 }); await w(1400);
      const m = await measure(pg); rec.tight = m.tight; rec.kfit = m.kfit;
      const want = strip(q.question).slice(0, 6);
      if (!strip(m.stemText).includes(want)) { rec.skip = `没出成指定题（题干「${m.stemText.trim().slice(0, 20)}」）`; skip++; }
      else {
        for (const o of m.opts) {
          if (!inside(o.r, { l: 0, t: 0, r: m.vw, b: m.vh })) rec.fails.push(`${o.key} 卡片出屏 ${JSON.stringify(o.r, (k, v) => typeof v === 'number' ? Math.round(v) : v)}`);
          for (const e of o.els) {
            const inCard = inside(e.r, o.r), inVp = inside(e.r, { l: 0, t: 0, r: m.vw, b: m.vh });
            const msg = `${o.key} ${e.k}「${e.t}」${!inCard ? `伸出卡片（卡 ${Math.round(o.r.t)}–${Math.round(o.r.b)} / ${Math.round(o.r.l)}–${Math.round(o.r.r)}，元素 ${Math.round(e.r.t)}–${Math.round(e.r.b)} / ${Math.round(e.r.l)}–${Math.round(e.r.r)}）` : ''}${!inVp ? `出屏（视口高 ${m.vh}，元素底 ${Math.round(e.r.b)}）` : ''}`;
            if (!inCard || !inVp) rec.fails.push(msg);   // r15.4.1：选项文字伸出卡片也算失败（KC-013「三角形」110px 换行出卡）
          }
        }
        if (!m.opts.length) rec.fails.push('没有可见选项');
        for (const r of m.stem) if (!inside(r, { l: 0, t: 0, r: m.vw, b: m.vh })) rec.fails.push(`题干数数图出屏 ${Math.round(r.b)}`);
        rec.n = m.opts.reduce((a, o) => a + o.els.filter(e => e.k !== 'text').length, 0);
      }
      if (SHOTS.has(q.id)) await pg.screenshot({ path: `${OUT}${q.id}-${vp}.png` });
      await quit(pg, w);
    } catch (e) { rec.fails.push('脚本异常 ' + String(e.message || e).split('\n')[0]); await pg.screenshot({ path: `${OUT}err-${q.id}-${vp}.png` }).catch(() => {});
      await s.ctx.close().catch(() => {}); s = await session(vp); }
    if (rec.skip) log(`SKIP ${vp} ${q.id} ${rec.skip}`);
    else if (rec.fails.length) { bad++; log(`FAIL ${vp} ${q.id}：${rec.fails.join('；')}`); if (!SHOTS.has(q.id)) await s.pg.screenshot({ path: `${OUT}fail-${q.id}-${vp}.png` }).catch(() => {}); }
    else { pass++; log(`PASS ${vp} ${q.id}（${rec.n} 个图/emoji 都在卡片和屏幕里${rec.tight ? '，紧凑排版' : ''}）`); }
    if (rec.warns.length) { warn++; log(`WARN ${vp} ${q.id} 文字：${rec.warns.join('；')}`); }
    appendFileSync(file, JSON.stringify(rec) + '\n');
  }
  await s.ctx.close();
}
log(`r1541-optimg 本次：PASS ${pass} / FAIL ${bad} / SKIP ${skip} / 文字WARN ${warn}`); await b.close(); process.exit(bad || skip ? 1 : 0);
