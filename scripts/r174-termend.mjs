// r17.4 小萌新 r17.1 §庆祝关 1：结尾（收尾闹钟条在顶上时）不挤乱：页面不滚动、伙伴的话不挡题干、结算页没滚动条。
// 用法：URL=http://127.0.0.1:4471/ [VPS=665x357,800x600] [TERMS=1,2] node scripts/r174-termend.mjs
// （下面是 r17-term.mjs 的公共部分）
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
const URL = process.env.URL || 'http://127.0.0.1:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/termend/'; mkdirSync(OUT, { recursive: true });
const GRADE = 'K1'; const TERMS = (process.env.TERMS || '1,2').split(',').map(Number);
const VPS = (process.env.VPS || '665x357,800x600,1024x600,1280x420').split(','); const ALLVP = Object.fromEntries(VPS.map(s => { const [w, h] = s.split('x').map(Number); return [s, { viewport: { width: w, height: h } }]; }));
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

const layout = (pg, sels) => pg.evaluate(sels => { const vw = innerWidth, vh = innerHeight; const se = document.scrollingElement; const out = [];
  for (const s of sels) { const e = document.querySelector(s); if (!e) { out.push(s + ' 没有'); continue; } const r = e.getBoundingClientRect(); if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) out.push(`${s} 出界 ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`); }
  if (se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1) out.push(`页面滚动 ${se.scrollWidth}x${se.scrollHeight}`); return out; }, sels);
const toNode = async (pg, t, subj = '数数') => { await pg.click(`[data-testid="chapter-${subj}"]`); await pg.waitForTimeout(300); return pg.$(`[data-testid=term-node-${t}]`); };
const enterTerm = async (pg, t) => { await pg.click(`[data-testid=term-node-${t}]`); await pg.waitForTimeout(400);
  for (let i = 0; i < 10; i++) { const x = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!x) break; await x.click().catch(() => {}); await pg.waitForTimeout(300); }
  await pg.waitForSelector('[data-testid=term-mon]', { timeout: 10000 }); };
const answerRight = async pg => { for (let i = 0; i < 80; i++) { if (await pg.$('[data-testid=term-medal]')) return false; const c = await pg.$('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])'); if (c) { await c.click(); return true; } await pg.waitForTimeout(100); } return false; };

const inter = (pg, a, b) => pg.evaluate(([a, b]) => { const A = document.querySelector(a), B = document.querySelector(b); if (!A || !B) return null; if ([A, B].some(e => { const cs = getComputedStyle(e); return cs.visibility === 'hidden' || +cs.opacity < 0.05; })) return ''; const r = A.getBoundingClientRect(), s = B.getBoundingClientRect(); const ix = Math.min(r.right, s.right) - Math.max(r.left, s.left), iy = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top); return ix > 1 && iy > 1 ? `${Math.round(ix)}×${Math.round(iy)}` : ''; }, [a, b]);
const GRACE = process.env.GRACE !== '0';
for (const vp of Object.keys(ALLVP)) for (const t of TERMS) {
  const tag = `${vp}_term${t}${GRACE ? '_grace' : ''}`;
  const { ctx, pg, w } = await session(vp, false); await toNode(pg, t); await enterTerm(pg, t); await w(300);
  if (GRACE) { await pg.evaluate(() => { window.__zyTestSpentSec = 1e7; }); for (let i = 0; i < 30 && !(await pg.isVisible('[data-testid=grace-icon]')); i++) await w(300); ok(await pg.isVisible('[data-testid=grace-icon]'), `${tag} 收尾闹钟条出现`); await w(4500); }
  let n = 0; const worst = [];
  for (let i = 0; i < 40; i++) { const r = await answerRight(pg); if (!r) break; n++; await w(250);
    const lay = await layout(pg, ['[data-testid=term-mon]', '.kopts']); if (lay.length) worst.push(`第${n}题 ${lay.join('；')}`);
    const ov = await inter(pg, '[data-testid=ksay]', '.kbubble'); if (ov) worst.push(`第${n}题 ksay∩题干 ${ov}`); }
  await pg.waitForSelector('[data-testid=term-medal]', { timeout: 15000 }).catch(() => {}); await w(500);
  await pg.screenshot({ path: OUT + `${tag}_medal.png` });
  const lay = await layout(pg, ['[data-testid=term-medal]', '[data-testid=term-mon]']); const ov = await inter(pg, '[data-testid=ksay]', '.kbubble'); const ovm = await inter(pg, '[data-testid=ksay]', '[data-testid=term-medal] b');
  ok(lay.length === 0, `${tag} 奖章时 不出界 / 不滚动 ${lay.join('；')}`);
  ok(!ov, `${tag} 奖章时 伙伴的话不挡题干 ${ov ?? '(无)'}`); ok(!ovm, `${tag} 伙伴的话不挡奖章名 ${ovm ?? '(无)'}`);
  ok(worst.length === 0, `${tag} 答题过程中 ${n} 题 不出界 / 不挡题干 ${worst.slice(0, 3).join(' | ')}`);
  await pg.waitForSelector('[data-testid=result-screen]', { timeout: 25000 }).catch(() => {}); await w(1500);
  await pg.screenshot({ path: OUT + `${tag}_result.png` });
  const rs = await pg.evaluate(() => { const out = []; const se = document.scrollingElement; if (se.scrollHeight > se.clientHeight + 1) out.push(`页面 ${se.clientHeight}/${se.scrollHeight}`); for (const e of document.querySelectorAll('.result-screen, .result-screen *')) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1) out.push(`${e.className || e.tagName} ${e.clientHeight}/${e.scrollHeight}`); } const b = document.querySelector('[data-testid=to-map], .result-screen .btn'); const r = b?.getBoundingClientRect(); if (r && r.bottom > innerHeight + 1) out.push('回地图按钮出界'); return out; });
  ok(rs.length === 0, `${tag} 结算页没有滚动条 ${rs.join('；')}`);
  if (rs.length || process.env.DUMP) console.log(await pg.evaluate(() => [...document.querySelectorAll('.result-screen > *')].map(e => `${e.tagName}.${e.className}[${e.dataset.testid ?? ''}] h=${Math.round(e.getBoundingClientRect().height)} y=${Math.round(e.getBoundingClientRect().top)}`).join('\n')));
  await ctx.close();
}
await b.close(); console.log(bad ? `FAIL ${bad}` : 'ALL PASS'); process.exit(bad ? 1 : 0);
