// 用法：URL=http://127.0.0.1:4475/ [GRADE=K1] node scripts/r171-newkid.mjs
// r17.1 新同学流程回归（小萌新 r16 问题 5，对照 r15.4.4 backup-r15.4.4 测试包同一脚本结果一致）：小班档案建好（设家长密码、选伙伴、进地图）→ 关页（模拟关浏览器）→ 新页面点档案，记下经过的每个画面
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:4475/'; const GRADE = process.env.GRADE || 'K1';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyTestSpentSec = -1e7; });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
let pg = await ctx.newPage(); pg.setDefaultTimeout(6000); const w = ms => pg.waitForTimeout(ms);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
const where = () => pg.evaluate(() => { const ids = ['pin-ok', 'stage-pick', 'grade-pick', 'charlist', 'level-1', 'pin-nudge-skip', 'tutorial-skip', 'tutorial-next']; return ids.filter(i => document.querySelector(`[data-testid=${i}]`)).join(',') || document.body.innerText.slice(0, 60).replace(/\s+/g, ' '); });
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.fill('[data-testid=hint-answer2]', 'x').catch(() => {}); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await pg.waitForSelector('[data-testid=pin-verify]', { timeout: 3000 }).then(() => pinIn('2468')).catch(() => {}); await w(300);
await pg.fill('[data-testid=add-name]', '新同学'); await pg.click(`[data-testid=home-grade-${GRADE}]`); await w(400);
const drive = async (tag) => { const seen = []; for (let i = 0; i < 30; i++) { const s = await where(); if (seen[seen.length - 1] !== s) seen.push(s);
  if (s.includes('level-1') && !s.includes('tutorial')) break;
  if (s.includes('pin-nudge-skip')) await pg.click('[data-testid=pin-nudge-skip]');
  else if (s.includes('pin-ok')) await pinIn('2468');
  else if (s.includes('stage-pick')) await pg.locator('[data-testid=stage-pick] .stage-btn.on').first().click();
  else if (s.includes('grade-pick')) await pg.locator('[data-testid=grade-pick] .stage-btn.on').first().click();
  else if (s.includes('charlist')) { await pg.locator('[data-testid=charlist] [data-testid^=char-]').first().click(); await w(300); await pg.click('[data-testid=char-ok], button:has-text("就选"), button:has-text("确定")', { timeout: 1500 }).catch(() => {}); }
  else if (s.includes('tutorial')) await pg.click('[data-testid=tutorial-skip], [data-testid=tutorial-next]').catch(() => {});
  await w(500); }
  console.log(tag, JSON.stringify(seen)); return seen; };
await pg.click('text=新同学'); await w(500); const s1 = await drive('第一次');
ok(JSON.stringify(s1) === JSON.stringify(['stage-pick', 'grade-pick', 'charlist', 'level-1']), '刚添加完第一次进：免密 → 学段 → 年级 → 选伙伴 → 地图');
await pg.close(); pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(500);
await pg.click('text=新同学'); await w(500); const s2 = await drive('重开后');
ok(JSON.stringify(s2) === JSON.stringify(['pin-ok', 'stage-pick', 'grade-pick', 'level-1']), '关掉再开：家长密码（多档案时换档案要密码，r13/r15 设计）→ 学段 → 年级（默认上次）→ 地图，不再选伙伴');
await b.close(); console.log(bad ? `r171-newkid ${bad} FAIL` : 'r171-newkid ALL PASS'); process.exit(bad ? 1 : 0);
