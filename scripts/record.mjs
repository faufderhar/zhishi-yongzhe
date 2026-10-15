// 录屏 + 关键帧：node scripts/record.mjs（需先 vite preview）。输出 recordings/*.webm、screenshots/anim/*.png
import { chromium } from 'playwright';
import { rename, readdir, mkdir } from 'node:fs/promises';
const URL = process.env.URL || 'http://localhost:4173/zhishi-yongzhe/';
const V = { width: 1180, height: 820 };
const b = await chromium.launch();
const errs = [];
async function session(name, fn) {
  const dir = `recordings/tmp-${name}`; await mkdir(dir, { recursive: true });
  const ctx = await b.newContext({ viewport: V, hasTouch: true, recordVideo: { dir, size: V } });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(name + ': ' + e)); pg.on('console', m => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]', { timeout: 20000 });
  await fn(pg);
  await ctx.close();
  const f = (await readdir(dir)).find(x => x.endsWith('.webm'));
  await rename(`${dir}/${f}`, `recordings/${name}.webm`);
}
const shot = (pg, n) => pg.screenshot({ path: `screenshots/anim/${n}.png` });
const w = (pg, ms) => pg.waitForTimeout(ms);

await session('g7-battle', async pg => {
  await pg.click('[data-testid=profile-kid-7]'); await w(pg, 400);
  await pg.click('[data-testid=char-suansuan]'); await w(pg, 400);
  await pg.click('[data-testid=chapter-数学]').catch(() => {}); await w(pg, 200);
  await pg.click('[data-testid=level-1]'); await w(pg, 1500);
  await shot(pg, 'g7-01-idle');
  let n = 0, wrongDone = false, dodgeDone = false, atk = 0;
  while (n++ < 16 && !(await pg.$('[data-testid=to-map]'))) {
    if (await pg.$('[data-testid=revive-no]')) { await pg.click('[data-testid=revive-no]'); await w(pg, 2500); continue; }
    const right = await pg.$('.quiz .opt[data-correct="1"]');
    if (!right) {   // 填空/多选：随便答（会答错 → 怪物出手）
      if (await pg.$('.keypad')) { await pg.click('.keypad button'); await pg.click('[data-testid=ok]'); }
      else if (await pg.$('.quiz .opt')) { await pg.click('.quiz .opt'); await pg.click('[data-testid=ok]').catch(() => {}); }
      await w(pg, 1500);
    } else if (atk >= 2 && !wrongDone) {
      await pg.click('.quiz .opt[data-correct="0"]'); wrongDone = true;
      await w(pg, 520); await shot(pg, 'g7-05-monster-attack'); await w(pg, 1200);
    } else {
      await right.click(); await pg.waitForSelector('[data-testid=act-attack]');
      await w(pg, 500);
      if (wrongDone && !dodgeDone) { await pg.click('[data-testid=act-dodge]'); dodgeDone = true; await w(pg, 140); await shot(pg, 'g7-06-dodge-afterimage'); await w(pg, 1600); }
      else {
        await pg.click('[data-testid=act-attack]'); atk++;
        if (atk <= 2) { await w(pg, 300); await shot(pg, `g7-0${atk * 2}-${atk === 1 ? 'charge' : 'dash'}`); await w(pg, 230); await shot(pg, `g7-0${atk * 2 + 1}-impact`); }
        else if (atk === 3) { await w(pg, 560); await shot(pg, 'g7-07-crit-impact'); }
        await w(pg, 1500);
      }
    }
    if (n === 2) { await w(pg, 0); }
    const nx = await pg.waitForSelector('[data-testid=next]:not([disabled]), [data-testid=revive-no]', { timeout: 8000 }).catch(() => null);
    if (nx && await nx.getAttribute('data-testid') === 'next') { await nx.click(); await w(pg, 600); }
    if (await pg.$('[data-testid=anim]')) { await w(pg, 500); await shot(pg, 'g7-08-outro'); await w(pg, 1500); }
  }
  await w(pg, 800); await shot(pg, 'g7-09-result');
});

await session('kinder-battle', async pg => {
  await pg.click('[data-testid=profile-kid-k]'); await w(pg, 400);
  if (await pg.$('[data-testid^=char-]')) { await pg.click('[data-testid^=char-]'); await w(pg, 400); }
  await pg.click('[data-testid=level-1]'); await w(pg, 1500);
  await shot(pg, 'k-01-idle');
  let n = 0;
  while (n++ < 10 && !(await pg.$('[data-testid=to-map]'))) {
    if (n === 2) { await pg.click('.kopt[data-correct="0"]').catch(() => {}); await w(pg, 250); await shot(pg, 'k-03-retry-gentle'); await w(pg, 900); }
    await pg.click('.kopt[data-correct="1"]').catch(() => {});
    if (n === 1) { await w(pg, 700); await shot(pg, 'k-02-correct-stars'); await w(pg, 900); }
    else await w(pg, 1600);
    if (await pg.$('.kbattle') && !(await pg.$('[data-testid=to-map]')) && n >= 3) { await w(pg, 0); }
  }
  await w(pg, 200);
  await shot(pg, 'k-05-result');
});
// 「减少动画」模式快照
await session('g7-reduced-motion', async pg => {
  await pg.evaluate(() => localStorage.setItem('zy.reduceMotion', '1')); await pg.reload(); await pg.waitForSelector('[data-testid^=profile-]');
  await pg.click('[data-testid=profile-kid-7]'); await w(pg, 400); await pg.click('[data-testid=char-suansuan]').catch(() => {}); await w(pg, 300);
  await pg.click('[data-testid=level-1]'); await w(pg, 800);
  await pg.click('[data-testid=pause]'); await w(pg, 300); await shot(pg, 'g7-10-pause-reduce-toggle'); await pg.click('[data-testid=resume]');
  const r = await pg.$('.quiz .opt[data-correct="1"]'); if (r) { await r.click(); await pg.click('[data-testid=act-attack]'); await w(pg, 1200); }
});
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await b.close();
