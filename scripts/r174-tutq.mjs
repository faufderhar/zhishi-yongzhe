// r17.4 小萌新 r17.1 问题 2：练习关（新手引导）小乌云 = Q 版三态（和正式题一样），不再是旧扁平 sprite。
// 用法：URL=http://127.0.0.1:4471/ node scripts/r174-tutq.mjs
// （session() 等登录 / 建档辅助抄自 r17-term.mjs，下面几行注释是原文件的说明）
// r17 D：小班期末庆祝关（上学期 = 大乌云 ×1.25 + 彩虹层；下学期 = 彩虹云 intro→end）e2e。
// 两关 × 1280×420 / 600 / 800 × 正常 / 减少动态：截图 开场 / 中间（爱心点亮）/ 结局 + 奖章 / 结算页；
// 检查：全程没出现「打败 / 胜利」、没有复活 / 失败页；先点错一次 = 「再想一想」不扣分；爱心数 = 题数、答对一题亮一颗；
// 怪物、爱心、奖章都在视口里、页面不滚动；结局：下学期 end 图不透明、intro 透明，上学期彩虹层淡入（在小乌云后面）；
// 没有 brightness 滤镜；减少动态：爱心不弹、彩虹层不位移、奖章只淡入；伙伴说的话顺序 = 开场 → 爱心… → 结尾 → 奖章。
// r17 策划改版：两关放在小班主地图（各学科章：大乌云 = 上学期最后一个节点、彩虹云 = 最后）、没解锁 = 灰色剪影、解锁后第一次弹一下 + 读开场白（只一次）；
//   时间到（zy-force-end）没点完 =「X要睡觉啦，下次再来玩～」回地图、不给奖章，再进来接着点亮的爱心；彩虹云 / 大乌云不压选项按钮。
// 用法：URL=http://127.0.0.1:4471/ [HS=420,600,800] [TERMS=1,2] [PARTS=main,map,resume] node scripts/r17-term.mjs → OUT（默认 /workspace/playtest/r16dev/term/）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://127.0.0.1:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/tutq/'; mkdirSync(OUT, { recursive: true });
const GRADE = 'K1';
const VPS = (process.env.VPS || '1280x800,800x600').split(','); const ALLVP = Object.fromEntries(VPS.map(s => { const [w, h] = s.split('x').map(Number); return [s, { viewport: { width: w, height: h } }]; }));
const b = await chromium.launch(); let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function session(name, rm, o = { unlock: true }) {
  const ctx = await b.newContext({ ...ALLVP[name], reducedMotion: rm ? 'reduce' : 'no-preference' }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });
  await pg.addInitScript(o => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = o.unlock; window.__zyTestTermOpen = o.termOpen; window.__seen = []; window.__says = []; new MutationObserver(() => { const t = document.body?.innerText; if (t) window.__seen.push(t); const s = document.querySelector('[data-testid=ksay]')?.textContent; if (s && window.__says[window.__says.length - 1] !== s) window.__says.push(s); }).observe(document, { subtree: true, childList: true, characterData: true }); window.__zyTestSpentSec = -1e7; /* 跑很久也不触发每日时长 */ }, { unlock: o.unlock !== false, termOpen: o.termOpen ?? null });
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 't17'); await pg.click(`[data-testid=home-grade-${GRADE}]`); await w(400);
  await pg.click('text=t17'); await w(500); if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468');
  for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.locator(`[data-testid=${sp}] .stage-btn.on`).first().click().catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]) >> nth=0'); await w(200); await pg.click('[data-testid=char-confirm]'); } if (await pg.isVisible('.modal >> text=稍后')) await pg.click('.modal >> text=稍后'); await w(400); }
  return { ctx, pg, w };
}


for (const vp of Object.keys(ALLVP)) {
  const { ctx, pg, w } = await session(vp, false, { unlock: false }); const tag = vp;
  await pg.click('[data-testid=level-1]'); await w(800);
  const ok1 = await pg.waitForSelector('[data-testid=tut-mon]', { timeout: 8000 }).then(() => true, () => false); ok(ok1, `${tag} 练习关出现小乌云`);
  if (ok1) { const m = await pg.evaluate(async () => { const e = document.querySelector('[data-testid=tut-mon]'); await e.decode?.().catch(() => {}); return { src: e.getAttribute('src'), q: e.dataset.qban, nw: e.naturalWidth, cls: e.className }; });
    ok(/mon_k_naughty_cloud/.test(m.src) && !/_sprite\.png/.test(m.src) && m.nw > 0 && /qban/.test(m.cls), `${tag} Q 版图 ${m.src} (${m.q}, ${m.nw}px)`);
    await pg.screenshot({ path: OUT + `${tag}_tut.png` }); }
  await ctx.close();
}
await b.close(); console.log(bad ? `FAIL ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
