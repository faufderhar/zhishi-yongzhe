// r15.4.2 小萌新 #4：小班第 4 关第 3 题答对后到结算前，每 100 ms 量一次：「…在说话」提示和伙伴头顶说话气泡（「小七变成你的好朋友…」）任何时刻都不重叠、也不压题干气泡。
// 同时检查：两个都出现过（不是靠都不显示来过关）。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4307/'; const OUT = process.env.OUT || '/workspace/playtest/r1542-kbubble/'; mkdirSync(OUT, { recursive: true });
const VPS = (process.env.VPS || '1393x901,1400x920,1244x818,1280x800,1024x600,1180x820').split(',');
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
for (const vp of VPS) {
  const [W, H] = vp.split('x').map(Number); const ctx = await b.newContext({ viewport: { width: W, height: H } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; });
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r9'); await pg.click('[data-testid=home-grade-K1]'); await w(300);
  await pg.click('text=r9').catch(() => {}); await w(400); for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-4]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } await w(300); }
  await pg.click('[data-testid=level-4]'); await w(1500);
  for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
  let r = null;
  for (let qn = 1; qn <= 3; qn++) {
    await pg.waitForSelector('.kopt:not([disabled])', { timeout: 15000 }); await w(400);
    await pg.click('.kopt[data-correct="1"]'); await w(qn === 3 ? 250 : 0);
    if (qn === 3) { r = { n: 0, ov: 0, ovB: 0, ovBan: 0, sawBan: false, sawK: false, sawS: false, both: 0, worst: '' }; let shot = false;
      for (let t = 0; t < 70; t++) { if (t === 3) await pg.click('.kopt >> nth=0', { force: true }).catch(() => {});   // 锁定时再点一下：提示 / 气泡轻跳
        const m = await pg.evaluate(() => { const R = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 2 && +getComputedStyle(e).opacity > 0.05 ? r : null; }; const k = R('[data-testid=kbusy]'), bub = R('.kbubble'), say = R('[data-testid=ksay]'), ban = R('[data-testid=skill-banner]');
          const inter = (x, y) => x && y ? Math.max(0, Math.min(x.right, y.right) - Math.max(x.left, y.left)) * Math.max(0, Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top)) : 0;
          return { k: !!k, s: !!say, ban: !!ban, ovBan: inter(k, ban) + inter(say, ban), banWho: (inter(k, ban) ? 'kbusy' : '') + (inter(say, ban) ? 'ksay' : ''), rects: JSON.stringify([k, say, ban].map(x => x && [x.left, x.top, x.right, x.bottom].map(Math.round))), ov: inter(k, say), ovB: inter(k, bub) + inter(say, bub) * 0, sayTxt: say ? document.querySelector('[data-testid=ksay]').textContent : '', res: !!document.querySelector('[data-testid=kinder-sub]') }; });
        if (m.res) break; r.n++; r.sawK ||= m.k; r.sawS ||= m.s; if (m.k && m.s) r.both++; if (m.ov > r.ov) { r.ov = m.ov; r.worst = m.sayTxt; } r.ovB = Math.max(r.ovB, m.ovB); if (m.ovBan > r.ovBan) r.banDbg = `${m.banWho} 提示/气泡/横幅 ${m.rects}`; r.ovBan = Math.max(r.ovBan, m.ovBan); r.sawBan ||= m.ban;
        if (!shot && m.s && /好朋友/.test(m.sayTxt)) { shot = true; await pg.screenshot({ path: `${OUT}L4-Q3-friend-${vp}.png` }); }
        await w(100); } }
    else await pg.waitForSelector('[data-testid=kbusy]', { state: 'detached', timeout: 8000 }).catch(() => {});
  }
  ok(r && r.sawK && r.sawS && r.ov === 0 && r.ovB === 0 && r.ovBan === 0, `${vp} 第 4 关第 3 题答对后 ${r?.n} 次采样：「在说话」出现 ${r?.sawK}、说话气泡出现 ${r?.sawS}、同时出现 ${r?.both} 次；两者最大重叠 ${Math.round(r?.ov ?? -1)} px²${r?.worst ? `（气泡「${r.worst}」）` : ''}，提示压题干 ${Math.round(r?.ovB ?? -1)} px²；技能横幅出现 ${r?.sawBan}，和提示 / 气泡重叠 ${Math.round(r?.ovBan ?? -1)} px²${r?.banDbg ? `（${r.banDbg}）` : ''}`);
  await ctx.close();
}
console.log(bad ? `r1542-kbubble FAIL ${bad}` : 'r1542-kbubble ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
