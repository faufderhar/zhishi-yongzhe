// r17.1 Boss测试解锁_r17 §4.4 验收：Boss 测试面板（BossLab）。
// 测试版（URL）：右下角 🧪、版本号旁「• 测试版」、noindex；面板列出高二数学所有 Boss，直接进第 1 章 Boss，自动答对打完 → 本场统计「答对 N 题击杀」，
//   CSV 每回合一行、和 __zyBossLog.rounds 一致；同一种子跑两次结果完全相同；〔模拟〕〔批量〕有结果；打完不写存档（IndexedDB 不变）。
// 正式版（PROD）：页面没有 🧪 / 测试版标记 / noindex；?zytest=1、#bosslab、window.__zyBossLab=true 都没有反应。
// 用法：URL=http://127.0.0.1:4475/ PROD=http://127.0.0.1:4476/ OUT=… node scripts/r171-bosslab.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const URL = process.env.URL || 'http://127.0.0.1:4475/', PROD = process.env.PROD || '', OUT = process.env.OUT || '/workspace/playtest/r16dev/bosslab/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const idbSnap = pg => pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const d = r.result, out = {}; const names = [...d.objectStoreNames].filter(n => n !== 'bank'); if (!names.length) { res(out); return; }
  const tx = d.transaction(names, 'readonly'); let left = names.length; for (const n of names) { const st = tx.objectStore(n); const q = n === 'kv' ? st.getAllKeys() : st.count(); q.onsuccess = () => { out[n] = n === 'kv' ? q.result.map(String).sort() : q.result; if (!--left) res(out); }; } }; r.onerror = () => res({ err: 1 }); }));
const kvVals = pg => pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const st = r.result.transaction('kv', 'readonly').objectStore('kv'); const q = st.getAll(), k = st.getAllKeys(); q.onsuccess = () => k.onsuccess = () => res(JSON.stringify(k.result.map((x, i) => [String(x), /^(progress|profiles|wrong|usage|stats)/.test(String(x)) ? q.result[i] : 0]))); }; }));

{ // ---------- 测试版 ----------
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, acceptDownloads: true }); const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
  await pg.addInitScript(() => { window.__zyTestNoTts = true; });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await pg.waitForTimeout(800);
  ok(await pg.isVisible('[data-testid=bosslab-btn]'), '测试版：右下角有 🧪');
  ok((await pg.textContent('[data-testid=test-build-tag]').catch(() => ''))?.includes('测试版'), '测试版：版本号旁有「• 测试版」');
  ok(await pg.locator('meta[name=robots][content*=noindex]').count() === 1, '测试版：页面带 noindex');
  const before = await idbSnap(pg), kv0 = await kvVals(pg);
  await pg.click('[data-testid=bosslab-btn]'); await pg.waitForSelector('[data-testid=bosslab-panel]');
  ok(await pg.inputValue('[data-testid=bosslab-grade]') === '11' && await pg.inputValue('[data-testid=bosslab-subj]') === '数学', '面板默认 高二 / 数学');
  const rows = await pg.$$eval('[data-testid^=bosslab-row-]', rs => rs.map(r => ({ id: r.dataset.level, cells: [...r.querySelectorAll('td')].map(t => t.textContent) })));
  ok(rows.length >= 5 && rows.every(r => r.cells[0] === '数学' && r.cells[3] && /^\d+（\d+ \+ \d+）$/.test(r.cells[6])), `高二数学 Boss ${rows.length} 个，每行有名字 / 血量（两阶段）：${rows.slice(0, 3).map(r => r.cells[3] + ' ' + r.cells[6]).join('；')}`);
  writeFileSync(OUT + 'list.json', JSON.stringify(rows, null, 1));
  // 直接进第 1 章 Boss，自动答对（p=1，标准卡，种子 3）
  await pg.fill('[data-testid=bosslab-seed]', '3'); await pg.fill('[data-testid=bosslab-p]', '1'); await pg.selectOption('[data-testid=bosslab-card]', 'std');
  const fightOnce = async () => { await pg.click('[data-testid=bosslab-row-0] [data-testid=bosslab-enter]'); await pg.waitForSelector('[data-testid=bosslab-fight]');
    await pg.waitForSelector('[data-testid=bosslab-result]', { timeout: 180000 }); return pg.evaluate(() => window.__zyBossLog); };
  const L1 = await fightOnce(); const s1 = await pg.textContent('[data-testid=bosslab-summary]');
  await pg.screenshot({ path: OUT + 'result.png' });
  ok(L1?.summary?.result === '击杀' && L1.summary.wrong === 0 && L1.summary.partial === 0 && /答对 \d+ 题击杀/.test(s1), `自动答对（p=1，全对、无错题）打完：${s1}`);
  ok(L1.summary.correctToKill === L1.summary.correct && L1.summary.correctByPhase.length === 2 && L1.summary.correctByPhase.reduce((a, x) => a + x, 0) === L1.summary.correctToKill, `答对 ${L1.summary.correctToKill} 题击杀，分阶段 ${L1.summary.correctByPhase.join('+')}`);
  ok(L1.rounds.length === L1.summary.turns && L1.rounds.at(-1).monHpAfter === 0 && L1.rounds.every((r, i) => !i || r.monHpBefore === L1.rounds[i - 1].monHpAfter), `日志 ${L1.rounds.length} 行，怪物血量首尾相接到 0`);
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-testid=bosslab-export-csv]')]);
  const csvPath = OUT + dl.suggestedFilename(); await dl.saveAs(csvPath); const csv = readFileSync(csvPath, 'utf8').replace(/^\ufeff/, '').trim().split('\n');
  const dealtCol = csv[0].split(',').indexOf('实际造成');
  ok(/^bosslab_11_.+_\d{8}-\d{6}\.csv$/.test(dl.suggestedFilename()) && csv.length - 1 === L1.rounds.length && dealtCol >= 0 && csv.slice(1).every((l, i) => Number(l.split(',')[dealtCol]) === L1.rounds[i].dealt), `CSV ${dl.suggestedFilename()}：${csv.length - 1} 行 = 回合数，「实际造成」逐行一致`);
  const [dj] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-testid=bosslab-export-json]')]); await dj.saveAs(OUT + dj.suggestedFilename());
  ok(/\.json$/.test(dj.suggestedFilename()) && JSON.parse(readFileSync(OUT + dj.suggestedFilename(), 'utf8')).rounds.length === L1.rounds.length, `JSON ${dj.suggestedFilename()}`);
  // 同一种子再跑一次：结果完全相同（除了用时）
  const L2 = await fightOnce(); const strip = L => JSON.stringify({ ...L, summary: { ...L.summary, seconds: 0 } });
  ok(strip(L1) === strip(L2), `同一种子（3）跑两次结果完全相同（${L1.rounds.map(r => r.qid).slice(0, 4).join(',')}…）`);
  if (strip(L1) !== strip(L2)) writeFileSync(OUT + 'diff.json', JSON.stringify({ L1, L2 }, null, 1));
  // p=0.6、种子 5：自动答题有错题，照样有统计
  await pg.fill('[data-testid=bosslab-seed]', '5'); await pg.fill('[data-testid=bosslab-p]', '0.6');
  const L3 = await fightOnce(); ok(L3?.summary && L3.summary.wrong + L3.summary.partial > 0 && ['击杀', '失败', '超时', '撤退'].includes(L3.summary.result), `p=0.6：${await pg.textContent('[data-testid=bosslab-summary]')}`);
  // 模拟 / 批量
  await pg.fill('[data-testid=bosslab-p]', '1'); await pg.selectOption('[data-testid=bosslab-char]', 'asuan'); await pg.selectOption('[data-testid=bosslab-card]', 'heavy');
  await pg.click('[data-testid=bosslab-row-0] [data-testid=bosslab-sim]'); const sim = await pg.textContent('[data-testid=bosslab-summary]');
  ok(/模拟/.test(await pg.textContent('[data-testid=bosslab-result]')) && /答对 \d+ 题击杀/.test(sim), `〔模拟〕：${sim}`);
  await pg.fill('[data-testid=bosslab-n]', '10'); await pg.click('[data-testid=bosslab-row-0] [data-testid=bosslab-batch]');
  const mean = Number(await pg.textContent('[data-testid=bosslab-batch-mean]')); ok(mean > 3 && mean < 15, `〔批量 10〕阿算 + 重击：均值 ${mean}（${await pg.textContent('[data-testid=bosslab-batch-result] div')}）`);
  const [db] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-testid=bosslab-batch-csv]')]); await db.saveAs(OUT + db.suggestedFilename());
  ok(/中位数,/.test(readFileSync(OUT + db.suggestedFilename(), 'utf8')), `批量汇总 CSV ${db.suggestedFilename()}`);
  // 切年级：初一也能列
  await pg.selectOption('[data-testid=bosslab-grade]', '7'); await pg.waitForTimeout(300); ok(await pg.locator('[data-testid^=bosslab-row-]').count() > 0, `切到初一：${await pg.locator('[data-testid^=bosslab-row-]').count()} 个 Boss`);
  await pg.click('[data-testid=bosslab-close]'); ok(!(await pg.isVisible('[data-testid=bosslab-panel]')) && await pg.isVisible('[data-testid=bosslab-btn]'), '关闭面板回到 🧪');
  const after = await idbSnap(pg), kv1 = await kvVals(pg);
  ok(JSON.stringify(before) === JSON.stringify(after) && kv0 === kv1, `打了 3 场：IndexedDB 档案 / 进度 / 错题 / 答题记录都没变（${JSON.stringify(after).slice(0, 120)}）`);
  ok(!errs.length, '没有页面错误' + (errs.length ? '：' + errs.join(' | ') : ''));
  // #bosslab 自动打开
  await pg.goto(URL + '#bosslab'); await pg.reload(); ok(await pg.waitForSelector('[data-testid=bosslab-panel]', { timeout: 15000 }).then(() => true, () => false), '测试版：#bosslab 自动打开面板');
  await ctx.close();
}
if (PROD) { // ---------- 正式版 ----------
  for (const [suffix, lab] of [['', false], ['?zytest=1', false], ['#bosslab', false], ['', true]]) {
    const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } }); const pg = await ctx.newPage();
    if (lab) await pg.addInitScript(() => { window.__zyBossLab = true; window.__zyTest = true; });
    await pg.goto(PROD + suffix); if (lab) await pg.reload(); await pg.waitForSelector('[data-testid^=profile-]', { timeout: 20000 }); await pg.waitForTimeout(1500);
    const txt = await pg.textContent('body');
    ok(!(await pg.$('[data-testid^=bosslab]')) && !txt.includes('🧪') && !txt.includes('测试版') && await pg.locator('meta[name=robots]').count() === 0,
      `正式版 ${suffix || '(无参数)'}${lab ? ' + window.__zyBossLab=true 刷新' : ''}：没有 🧪 / 面板 / 测试版标记 / noindex`);
    await ctx.close();
  }
}
await b.close(); console.log(bad ? `r171-bosslab FAIL ${bad}` : 'r171-bosslab ALL PASS'); process.exit(bad ? 1 : 0);
