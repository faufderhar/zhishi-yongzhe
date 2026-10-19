// r16 4：中班怪物按 LevelKind——专属 Boss 美术（宽 Boss 走近距离缩短、不出战斗区）、obj_thread / obj_paper_sheet 题图可读。4 个视口截图。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4471/'; const OUT = process.env.OUT || '/workspace/playtest/r16dev/kmon/'; mkdirSync(OUT, { recursive: true });
const VPS = (process.env.VPS || '1200x800,1280x700,1280x800,844x390m').split(',');
// [科目, 小节, 关卡类型, 首题]
const CASES = [['儿歌古诗', '古诗', 'boss', ''], ['生活常识', '大家的工作', 'boss', ''], ['儿歌古诗', '儿歌', 'boss', ''], ['认识动物', '会飞会游会跑', 'boss', ''],
  ['颜色形状', '比粗细厚薄轻重', 'boss', 'K2C-056'], ['颜色形状', '比粗细厚薄轻重', 'normal', 'K2C-048']];
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; }; const rep = [];
for (const vp of VPS) {
  const mob = vp.endsWith('m'); const [W, H] = vp.replace('m', '').split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(mob ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}) }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyTestNoTts = true; window.__zyUnlockAll = true; window.__zyNoOfflineCache = true; });
  const w = ms => pg.waitForTimeout(ms); const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300);
  await pg.click('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); await w(300);
  await pg.fill('[data-testid=add-name]', 'k2'); await pg.click('[data-testid=home-grade-K2]'); await w(300);
  const toMap = async () => { for (let i = 0; i < 25 && !(await pg.isVisible('[data-testid=level-1]')); i++) { if (await pg.isVisible('[data-testid=pin-ok]')) await pinIn('2468'); for (const sp of ['stage-pick', 'grade-pick']) if (await pg.isVisible(`[data-testid=${sp}]`)) await pg.click(`[data-testid=${sp}] .stage-btn.on`).catch(() => {}); if (await pg.isVisible('[data-testid=char-confirm]')) { await pg.click('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist]) >> nth=0'); await pg.click('[data-testid=char-confirm]'); } await w(300); } };
  await pg.click('text=k2').catch(() => {}); await w(400); await toMap();
  for (const [subj, unit, kind, fq] of CASES) {
    await pg.click(`[data-testid="chapter-${subj}"]`).catch(() => {}); await w(400);
    const idx = await pg.evaluate(([s, u, k]) => { const c = window.__zyLevels.find(c => c.subject === s); return c.levels.findIndex(l => l.kind === k && l.qs.some(q => q.unit === u)); }, [subj, unit, kind]);
    await pg.evaluate(f => { window.__zyForceQ = f || undefined; }, fq);
    await pg.click(`[data-testid=level-${idx + 1}]`);
    // 跳进来（hop-in 1.4s）：序列帧框不出战斗区
    let hop = 1e9; for (let t = 0; t < 22; t++) { const m = await pg.evaluate(() => { const st = document.querySelector('.kstage')?.getBoundingClientRect(), sh = document.querySelector('[data-testid=monster-sheet]')?.getBoundingClientRect(); return st && sh ? Math.min(sh.left - st.left, st.right - sh.right) : null; }); if (m !== null) hop = Math.min(hop, m); await w(70); }
    await w(200);
    for (let i = 0; i < 10; i++) { const t = await pg.$('[data-testid=tutorial-skip], [data-testid=tutorial-next]'); if (!t) break; await t.click().catch(() => {}); await w(300); }
    await pg.waitForSelector('.kopt:not([disabled])', { timeout: 15000 }); if (kind !== 'normal') await pg.waitForSelector('[data-testid=monster-sheet]', { timeout: 8000 }).catch(() => {}); await w(700);
    const tag = `${subj}-${unit}-${kind}${fq ? '-' + fq : ''}-${vp}`;
    const info = await pg.evaluate(() => { const R = e => e && e.getBoundingClientRect(); const st = R(document.querySelector('.kstage')), sh = R(document.querySelector('[data-testid=monster-sheet]'));
      const imgs = [...document.querySelectorAll('.kopts img, .kq img, .kbubble img')].map(i => ({ src: i.getAttribute('src'), w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), ok: i.complete && i.naturalWidth > 0 }));
      return { mon: document.querySelector('[data-testid=monster-sheet]')?.dataset.mon ?? document.querySelector('[data-testid=kmon]')?.dataset.mon, kboss: document.querySelector('[data-kboss]')?.dataset.kboss, crown: !!document.querySelector('[data-testid=boss-crown]'),
        inStage: st && sh ? sh.left >= st.left - 1 && sh.right <= st.right + 1 : null, sizeRatio: sh ? +(sh.height / (Math.max(1, ...[...document.querySelectorAll('[data-testid=kpup] *')].map(e => e.getBoundingClientRect().height)))).toFixed(2) : null, imgs }; });
    await pg.screenshot({ path: `${OUT}${tag}-start.png` });
    let fin = null;
    if (kind !== 'normal') {
      // 答到最后一题：最后一次答对后 kinderFinale 开始（「开心值」点满）
      for (let n = 0; n < 12; n++) {
        const left = await pg.evaluate(() => { const h = document.querySelector('[data-testid=hearts]')?.getAttribute('aria-label') ?? ''; const m = h.match(/(\d+)\/(\d+)/); return m ? +m[2] - +m[1] : 0; });
        if (left <= 0) break;
        await pg.waitForSelector('.kopts:not(.kwait) .kopt[data-correct="1"]:not([disabled])', { timeout: 12000 }).catch(() => {}); await w(250);
        await pg.click('.kopt[data-correct="1"]').catch(() => {}); if (left === 1) break; await w(400);
      }
      // 结尾走近主角（kinderFinale 900ms，中点约 450ms）：多次取样，看序列帧框是否一直在战斗区内
      let worst = 1e9; for (let t = 0; t < 30; t++) { if (await pg.$('[data-testid=gentle-mon].go-home')) break; const m = await pg.evaluate(() => { const st = document.querySelector('.kstage')?.getBoundingClientRect(), sh = document.querySelector('[data-testid=monster-sheet]')?.getBoundingClientRect(); return st && sh ? Math.min(sh.left - st.left, st.right - sh.right) : null; }); if (m !== null) worst = Math.min(worst, m); if (t === 5) await pg.screenshot({ path: `${OUT}${tag}-finale.png` }); await w(80); }
      fin = Math.round(worst);
    }
    rep.push({ vp, subj, unit, kind, fq, ...info, hopMinMargin: hop === 1e9 ? null : Math.round(hop), playMinMargin: fin });
    if (kind === 'boss') { ok(info.kboss === 'art' && !info.crown && /^mon_k2_/.test(info.mon ?? ''), `${tag} 专属 Boss ${info.mon} 无王冠`); ok((info.sizeRatio ?? 0) >= 0.6, `${tag} 序列帧高度 / 伙伴高度 = ${info.sizeRatio}`); ok(info.inStage !== false && (fin === null || fin >= -1) && (hop === 1e9 || hop >= -1), `${tag} 序列帧在战斗区内（跳进来最小边距 ${hop === 1e9 ? '-' : Math.round(hop)}px，答题到回家前最小边距 ${fin}px）`); }
    if (fq) { const im = info.imgs.filter(i => /obj_(thread|paper_sheet)/.test(i.src ?? '')); ok(im.length > 0 && im.every(i => i.ok && i.w >= 60 && i.h >= 60), `${tag} ${fq} 题图 ${JSON.stringify(im)}`); }
    // 回地图
    await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(300); await pg.click('text=k2').catch(() => {}); await w(400); await toMap();
  }
  await ctx.close();
}
writeFileSync(OUT + 'report.json', JSON.stringify(rep, null, 1));
console.log(bad ? `r16-kmon FAIL ${bad}` : 'r16-kmon ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
