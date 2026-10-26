// r17.1：测试构建里 __zyBossLog（本场统计 + 逐回合日志）和 __zyBossLab 下的「导出 JSON / CSV」按钮（Boss测试解锁_r17 §4.2-3/4/5）。
// 高一同学（kid-10）进第一个 Boss，全部答对打完：summary.result=击杀、correctToKill=答对数、两阶段分开计；CSV 每回合一行、和 rounds 一致；
// 不设 __zyBossLab 时没有导出按钮。用法：URL=http://127.0.0.1:4475/ OUT=… node scripts/r171-bosslog.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const URL = process.env.URL || 'http://127.0.0.1:4475/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/bosslog/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function run(lab) {
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, acceptDownloads: true }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(lab => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; window.__zyTestSpentSec = -1e7; if (lab) window.__zyBossLab = true; }, lab);
  await pg.addLocatorHandler(pg.locator('[data-testid=pin-reset-notice-full]'), async () => { await pg.click('[data-testid=pin-reset-full-ok]'); }, { noWaitAfter: true });
  const w = ms => pg.waitForTimeout(ms);
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
  await pg.click('[data-testid=profile-kid-10]'); await w(600);
  for (let i = 0; i < 20 && !(await pg.isVisible('[data-testid=levels]')); i++) {
    if (await pg.isVisible('[data-testid=pin-nudge-skip]')) await pg.click('[data-testid=pin-nudge-skip]');
    if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm])'); await pg.click('[data-testid=char-confirm]'); }
    for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {});
    await w(400);
  }
  await pg.locator('.level.boss').first().click(); await w(900);
  const tut = async () => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); } for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-skip]'); i++) { await pg.click('[data-testid=tutorial-skip]'); await w(300); } };
  const tipsOff = async () => { for (const t of await pg.$$('.first-tip')) await t.click().catch(() => {}); };
  let qn = 0, exp = null;
  for (let s = 0; s < 600; s++) {
    if (await pg.isVisible('[data-testid=result-title]')) break;
    await tut(); await tipsOff();
    if (lab && !exp && qn >= 3 && await pg.isVisible('[data-testid=bosslog-export]')) exp = 'seen';
    if (await pg.isVisible('[data-testid=chal-normal]')) { await pg.click('[data-testid=chal-normal]'); await w(200); continue; }
    if (await pg.isVisible('[data-testid=card-std]')) { await pg.click('[data-testid=card-std]'); await w(200); continue; }
    if (await pg.isVisible('[data-testid=wager-sure]')) { await pg.click('[data-testid=wager-sure]'); await w(200); continue; }
    if (await pg.isVisible('[data-testid=revive-no]')) { await pg.click('[data-testid=revive-no]'); await w(400); continue; }
    const o = await pg.$('.quiz .opt[data-correct="1"]');
    if (o) { qn++; for (const x of await pg.$$('.quiz .opt[data-correct="1"]')) await x.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); await w(300); continue; }
    if (await pg.$('.keypad')) { qn++; const a = String(await pg.evaluate(() => window.__zyAnswer?.())); for (const ch of a) await pg.click(`.keypad [data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]').catch(() => {}); await w(300); continue; }
    if (await pg.$('.quiz input')) { qn++; await pg.fill('.quiz input', String(await pg.evaluate(() => window.__zyAnswer?.()))); await pg.click('[data-testid=ok]').catch(() => {}); await w(300); continue; }
    if (await pg.isVisible('[data-testid=next]')) { await pg.click('[data-testid=next]').catch(() => {}); await w(300); continue; }
    await w(250);
  }
  const log = await pg.evaluate(() => window.__zyBossLog);
  return { ctx, pg, log, qn, exp };
}
{ const { ctx, pg, log, qn, exp } = await run(true);
  writeFileSync(OUT + 'bosslog.json', JSON.stringify(log, null, 1)); await pg.screenshot({ path: OUT + 'result.png' });
  const s = log?.summary ?? {}; const R = log?.rounds ?? [];
  ok(s.result === '击杀' && s.kind === 'boss', `结果 ${s.result} / ${s.kind}，${s.monster}，${s.turns} 回合，答 ${qn} 题`);
  ok(s.correctToKill === s.correct && s.correct > 0 && s.wrong === 0, `答对 ${s.correct} 题击杀（错 ${s.wrong}，漏选 ${s.partial}）`);
  ok(s.correctByPhase?.length === 2 && s.correctByPhase[0] + s.correctByPhase[1] === s.correct, `分阶段：${JSON.stringify(s.correctByPhase)}`);
  ok(R.length === qn && R.at(-1)?.monHpAfter === 0 && R.every((r, i) => !i || r.monHpBefore === R[i - 1].monHpAfter), `rounds ${R.length} 行，血量首尾相接到 0`);
  ok(s.totalDealt === R.filter(r => r.side === 'P').reduce((a, r) => a + r.dealt, 0) && s.totalDealt >= R[0]?.monHpBefore, `总伤害 ${s.totalDealt}（≥ 开打血量 ${R[0]?.monHpBefore}），均 ${s.avgPerQ}；技能 ${s.skills}，封顶 ${s.caps}`);
  ok(exp === 'seen' || await pg.isVisible('[data-testid=bosslog-export]'), '__zyBossLab：战斗里有导出按钮');
  // 结算页没有战斗组件了 → 下载用最后一份日志：再进一次 Boss，答 2 题，点导出
  await pg.click('[data-testid=to-map]').catch(() => {}); await pg.waitForTimeout(800); await pg.locator('.level.boss').first().click(); await pg.waitForTimeout(1200);
  for (let i = 0; i < 40; i++) { const L = await pg.evaluate(() => window.__zyBossLog?.rounds?.length ?? 0); const fresh = await pg.evaluate(() => window.__zyBossLog?.summary?.result === '进行中');
    if (fresh && L >= 2) break;
    for (const t of await pg.$$('.first-tip')) await t.click().catch(() => {});
    for (const id of ['tutorial-next', 'tutorial-skip', 'chal-normal', 'card-std', 'wager-sure', 'next']) if (await pg.isVisible(`[data-testid=${id}]`)) { await pg.click(`[data-testid=${id}]`).catch(() => {}); }
    const o = await pg.$$('.quiz .opt[data-correct="1"]'); if (o.length) { for (const x of o) await x.click(); await pg.click('[data-testid=ok]', { timeout: 300 }).catch(() => {}); }
    else if (await pg.$('.keypad')) { const a = String(await pg.evaluate(() => window.__zyAnswer?.())); for (const ch of a) await pg.click(`.keypad [data-key="${ch}"]`).catch(() => {}); await pg.click('[data-testid=ok]').catch(() => {}); }
    await pg.waitForTimeout(400); }
  const L2 = await pg.evaluate(() => window.__zyBossLog);
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-testid=bosslog-export] >> text=导出 CSV')]);
  const fn = dl.suggestedFilename(); const p = OUT + fn; await dl.saveAs(p); const csv = readFileSync(p, 'utf8').replace(/^\ufeff/, '').trimEnd().split('\n');
  ok(/^bosslab_10_.+_\d{8}-\d{6}\.csv$/.test(fn), `CSV 文件名 ${fn}`);
  const L3 = await pg.evaluate(() => window.__zyBossLog);
  ok(csv.length === L3.rounds.length + 1 && csv[0].split(',').length === 23 && csv.slice(1).every((l, i) => l.split(',')[17] === String(L3.rounds[i].dealt)), `CSV ${csv.length - 1} 行 = rounds ${L3.rounds.length}（≥${L2.rounds.length}），「实际造成」逐行一致`);
  const [dj] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-testid=bosslog-export] >> text=导出 JSON')]);
  const pj = OUT + dj.suggestedFilename(); await dj.saveAs(pj); const J = JSON.parse(readFileSync(pj, 'utf8'));
  ok(J.summary && Array.isArray(J.rounds) && J.rounds.length >= L2.rounds.length && /\.json$/.test(pj), `JSON 导出 ${dj.suggestedFilename()}：summary + rounds ${J.rounds.length}`);
  await pg.screenshot({ path: OUT + 'export.png' });
  await ctx.close(); }
{ const { ctx, pg, log } = await run(false);
  ok(!!log?.summary && !(await pg.$('[data-testid=bosslog-export]')), '不设 __zyBossLab：日志照写，页面没有导出按钮'); await ctx.close(); }
await b.close(); console.log(bad ? `r171-bosslog FAIL ${bad}` : 'r171-bosslog ALL PASS'); process.exit(bad ? 1 : 0);
