// r8b 线上验收（不用测试钩子）：两级入口截图；初一英语第 1 关用公开题库自动答对，实测怪物 0 血到结算的时间、0 血后有无「战斗中…」停顿
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'https://faufderhar.github.io/zhishi-yongzhe/'; const OUT = process.env.OUT || 'screenshots/live/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const bank = (await (await fetch(URL + 'banks/bank_7.json')).json()).questions;
const norm = s => String(s).replace(/\s+/g, ' ').replace(/[（(]\s*[)）]/g, '').trim();
async function session(vp) {
  const ctx = await b.newContext({ viewport: vp }); const pg = await ctx.newPage(); const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(600);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'r8b'); await pg.click('[data-testid=home-grade-7]'); await w(400); await pg.click('text=r8b'); await w(800);
  return { ctx, pg, w };
}
for (const [vp, tag] of [[{ width: 1180, height: 820 }, 'landscape'], [{ width: 820, height: 1180 }, 'portrait']]) {
  const { ctx, pg, w } = await session(vp);
  ok(await pg.isVisible('[data-testid=stage-pick]'), `线上 ${tag}：第 1 级选学段`); await pg.screenshot({ path: `${OUT}r8b-stage-${tag}.png` });
  await pg.click('[data-testid=stage-J]'); await w(400); ok(await pg.isVisible('[data-testid=grade-8][aria-disabled=true]'), `线上 ${tag}：第 2 级选年级，初二锁定`);
  await pg.screenshot({ path: `${OUT}r8b-grade-${tag}.png` });
  if (tag === 'portrait') { await ctx.close(); continue; }
  const hooks = await pg.evaluate(() => ['__zyAnswer', '__zyForceQ', '__zyPlaySkill', '__zySfxStats', '__zyLevels'].filter(k => k in window)); ok(!hooks.length, `线上无测试钩子（${hooks}）`);
  await pg.click('[data-testid=grade-7]'); await w(600); await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600);
  await pg.click('[data-testid="chapter-英语"]'); await w(300); await pg.click('[data-testid=level-1]'); await w(800);
  for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); }
  let tHp0 = 0, stall = false, tRes = 0, n = 0;
  for (let k = 0; k < 30; k++) {
    await pg.waitForSelector('.quiz .opt, .keypad, [data-testid=result-stats]', { timeout: 15000 });
    if (await pg.$('[data-testid=result-stats]')) break;
    const qt = norm(await pg.textContent('.qtext')); const q = bank.find(x => norm(x.question) === qt) ?? bank.find(x => qt.includes(norm(x.question).slice(0, 25)));
    if (!q) { ok(false, `题库里找不到题「${qt.slice(0, 20)}」`); break; }
    const a = String(Array.isArray(q.answer) ? q.answer[0] : q.answer);
    if (await pg.$('.keypad')) { for (const ch of a.toLowerCase()) await pg.click(`.keypad [data-key="${ch === ' ' ? 'space' : ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]'); }
    else if (q.type === '多选') { for (const ch of a) await pg.click(`[data-testid=opt-${ch}]`); await pg.click('[data-testid=multi-ok], [data-testid=ok]').catch(() => {}); }
    else await pg.click(`[data-testid=opt-${a.toUpperCase() === 'TRUE' || a === '对' ? 'A' : a}]`).catch(async () => { await pg.click('.quiz .opt'); });
    n++;
    // 轮询：怪物血量到 0 的时刻 → 结算出现的时刻；期间有没有「战斗中…」
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      const st = await pg.evaluate(() => ({ mhp: document.querySelector('.mhp')?.textContent ?? '', anim: !!document.querySelector('[data-testid=anim]'), res: !!document.querySelector('[data-testid=result-stats]'), next: !!document.querySelector('[data-testid=next]:not([disabled])') }));
      const now = Date.now();
      if (!tHp0 && /(^|\D)0\/\d+/.test(st.mhp)) tHp0 = now;
      if (tHp0 && st.anim) stall = true;
      if (st.res) { tRes = now; break; }
      if (st.next && !tHp0) { await pg.click('[data-testid=next]'); break; }
      await w(30);
    }
    if (tRes) break;
  }
  ok(tRes > 0 && tHp0 > 0, `线上初一英语第 1 关打完（答 ${n} 题）`);
  const gap = tRes - tHp0; ok(gap > 0 && gap <= 1300, `线上：怪物血量到 0 → 结算 ${gap} ms（defeat 动作 0.8 s 封顶，含攻击收尾），无额外停顿`);
  ok(!stall, '线上：怪物 0 血后没有出现「战斗中…」');
  await pg.screenshot({ path: `${OUT}r8b-monster-defeat-result.png` }); await ctx.close();
}
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
