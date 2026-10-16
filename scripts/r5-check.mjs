// r5 角色技能（v0.3.7）验收 + 护眼自动检查 + 技能图集。URL=... OUT=screenshots/live/ node scripts/r5-check.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4180/'; const OUT = process.env.OUT || 'screenshots/r5/'; const FR = '/tmp/r5frames/';
mkdirSync(OUT, { recursive: true }); mkdirSync(FR, { recursive: true });
const ALL = process.env.ALL !== '0';
const b = await chromium.launch(); let bad = 0; const R = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); R.push([!!c, m]); if (!c) bad++; };
async function session(opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 1024, height: 600 }, ...opts });
  const pg = await ctx.newPage();
  // r8b 两级入口（学段 → 年级）：默认项就是档案年级，出现时直接点它
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true }); const errs = [], reqs = [];
  pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [console]', m.text().slice(0, 200)); }); pg.on('request', r => reqs.push(r.url()));
  await pg.addInitScript(() => { window.__zyTest = true; window.__zyNoOfflineCache = true;   /* r7 起有后台离线缓存：本脚本只验「战斗内按需懒加载」 */ window.__fxFps = []; });
  const w = ms => pg.waitForTimeout(ms);
  const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
  let pinSet = false;
  const home = async () => { await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]', { timeout: 30000 }); await w(500); };
  async function addChild(g, name, charIdx = 0) {
    await home(); await pg.click('[data-testid=add-child]'); await w(300);
    if (!pinSet) { await pinIn('2468'); await pinIn('2468'); await pg.click('.pinpad input[type=radio] >> nth=0', { timeout: 5000 }).catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); await pg.waitForSelector('[data-testid=rec-code]', { timeout: 5000 }).then(() => pg.click('[data-testid=rec-done]')).catch(() => {}); pinSet = true; } else await pinIn('2468');
    await w(300); await pg.fill('[data-testid=add-name]', name); await pg.click(`[data-testid=home-grade-${g}]`); await w(500);
    await pg.click(`text=${name}`); await w(1200); await pg.waitForSelector('[data-testid=char-confirm]'); const cs = await pg.$$('[data-testid^=char-]:not([data-testid=char-confirm])'); await cs[charIdx].click(); await pg.click('[data-testid=char-confirm]'); await w(600);
  }
  const tutAll = async () => { for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { await pg.click('[data-testid=tutorial-next]'); await w(150); } if (await pg.isVisible('[data-testid=tutorial-skip]')) { await pg.click('[data-testid=tutorial-skip]'); await w(500); } };
  async function answer(right) {
    await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 10000 });
    const o = await pg.$(`.quiz .opt[data-correct="${right ? 1 : 0}"]`);
    if (o) { await o.click(); return; }
    const ans = await pg.getAttribute('.qtext', 'data-ans'); const ks = right && ans ? await Promise.all([...ans].map(c => pg.$(`.keypad [data-key="${c}"]`))) : [];
    if (right && ks.length && ks.every(Boolean)) { for (const k of ks) await k.click(); await pg.click('[data-testid=ok]'); return; }
    await pg.click('.keypad button'); await pg.click('[data-testid=ok]');
  }
  const log = () => pg.evaluate(() => window.__fxLog ?? []);
  return { ctx, pg, errs, reqs, w, addChild, tutAll, answer, log };
}
/* ---- 护眼：对 __fxLog 逐条检查 ---- */
function eyeCare(L, tag) {
  const okProps = new Set(['transform', 'opacity', 'offset', 'easing', 'composite']);
  let badProp = 0, tooLong = 0, flicker = 0, big = 0, shake = 0, blend = 0;
  for (const e of L) {
    const isLow = /^(k|p12)_/.test(e.id);
    if (e.t1 - e.t0 > 1600) tooLong++;
    if (isLow && (e.shake || e.blend !== 'normal')) { shake += e.shake ? 1 : 0; blend += e.blend !== 'normal' ? 1 : 0; }
    for (const a of e.anims) {
      for (const f of a.frames) for (const k of Object.keys(f)) if (!okProps.has(k)) badProp++;
      const op = a.frames.map(f => f.opacity).filter(x => x != null).map(Number);
      let rev = 0, dir = 0; for (let i = 1; i < op.length; i++) { const d = Math.sign(op[i] - op[i - 1]); if (d && dir && d !== dir) rev++; if (d) dir = d; }
      if (rev / 2 / Math.max(0.001, a.duration / 1000) > 3) flicker++;   // 往返次数 / 秒
      if (a.area > 0.5 && a.el !== 'fx-sprite') big++;
    }
  }
  ok(L.length > 0 && !badProp, `${tag} 护眼：特效只动画 transform/opacity（${L.length} 次释放，违规属性 ${badProp}）`);
  ok(!tooLong, `${tag} 护眼：每次释放 ≤1.5 s（超时 ${tooLong}）；最长 ${Math.max(...L.map(e => Math.round(e.t1 - e.t0)))} ms`);
  ok(!flicker, `${tag} 护眼：无 >3 Hz 闪烁（透明度往返频率超限 ${flicker}）`);
  ok(!big, `${tag} 护眼：无覆盖 >50% 舞台的发光层（全屏闪白 0）`);
  ok(!shake && !blend, `${tag} 护眼：小班/小学1–2 不震屏、强制 normal 混合（违规 ${shake + blend}）`);
}
/* ---- 帧采样：录 stage 截图，后续 python 算亮度 ---- */
async function capture(pg, id, tag, dur) {
  const st = await pg.$('.stage'); const t0 = Date.now(); const p = pg.evaluate(id => window.__zyPlaySkill?.(id), id); let i = 0;
  while (Date.now() - t0 < dur + 150) { await st.screenshot({ path: `${FR}${tag}_${id}_${String(i).padStart(2, '0')}_${Date.now() - t0}.jpg`, type: 'jpeg', quality: 70 }); i++; }
  await p; return i;
}

// ===== 1. 初一：能量环、自动释放、懒加载 =====
const S = await session();
{
  const { pg, w, addChild, tutAll, answer, reqs, errs } = S;
  await pg.evaluate(() => { window.__zyTestMonHp = 9999; }).catch(() => {}); await pg.addInitScript(() => { window.__zyTestMonHp = 9999; });   // 怪物够厚，才能连续答对 5 次验证保底
  await addChild('7', 'r5初一'); await pg.click('[data-testid=level-1]'); await w(600); await tutAll();
  await pg.waitForSelector('[data-testid=energy]');
  ok(!(await pg.$('[data-testid=skill]')) && !(await pg.$('.skill-btn')), '§6-1 界面没有手动技能按钮');
  await pg.click('[data-testid=energy]'); await w(250);
  const rp = await pg.textContent('[data-testid=ring-pop]'); const li = await pg.$$('.skill-list li');
  ok(/答对.*20%.*能量攒满 5 点必定触发.*连续 4 次/.test(rp) && li.length >= 3, `§6-1 能量环可点开说明（列出本角色 ${li.length} 个技能）`);
  await pg.screenshot({ path: OUT + 'r5-energy-ring.png' }); await pg.click('[data-testid=ring-ok]'); await w(200);
  const before = reqs.filter(u => /\/fx\/skills\//.test(u));
  const ids = [...new Set(before.map(u => (u.match(/fx\/skills\/(?:icons\/icon_)?([a-z0-9_]+)\.(json|webp)/) || [])[1]).filter(Boolean))];
  ok(ids.length && ids.every(x => /^j1_suansuan_\d$/.test(x)) && ids.length === li.length, `懒加载：进战斗只取本角色本学段素材 ${ids.join(',')}`);
  ok(!reqs.some(u => /sfx\/skills\/.*\.mp3/.test(u)), '技能音效未预载（释放前 0 个 mp3 请求）');
  let seen = 0, n = 0, castAt = -1;
  for (n = 1; n <= 10 && !seen; n++) {
    await answer(true);
    const ban = await pg.waitForSelector('[data-testid=skill-banner]', { timeout: 1800 }).catch(() => null);
    if (ban) { seen = 1; castAt = n; await w(380); await pg.screenshot({ path: OUT + 'r5-skill-cast-j.png' });
      const sid = await ban.getAttribute('data-skill'); const icoOk = await pg.$eval('[data-testid=skill-banner] .skill-ico', e => e.tagName !== 'IMG' || e.naturalWidth > 0).catch(() => false);
      ok(/^j1_suansuan_\d$/.test(sid) && icoOk, `横幅显示技能图标 + 名称（${sid}）`);
      const sp = await pg.$('.fx-sprite'); ok(!!sp, '美术序列帧在播放（.fx-sprite）'); }
    await pg.waitForSelector('[data-testid=next]:not([disabled]), [data-testid=result-stats]', { timeout: 15000 });
    if (await pg.isVisible('[data-testid=result-stats]')) break;
    if (seen) { const fb = await pg.textContent('[data-testid=feedback] h3'); ok(/✨/.test(fb), '反馈里写出技能效果：' + fb.slice(0, 60)); await pg.screenshot({ path: OUT + 'r5-skill-feedback.png' }); }
    await pg.click('[data-testid=next]'); await w(400);
  }
  ok(seen && castAt <= 5, `§6-5 连续答对最多第 5 次必触发（实际第 ${castAt} 次）`);
  ok(/\d\/5/.test(await pg.textContent('[data-testid=energy]')), '能量环显示 n/5');
  await w(500);
  const mp3 = reqs.filter(u => /sfx\/skills\/.*\.mp3/.test(u));
  ok(mp3.length >= 1 && mp3.every(u => /sfx_skill_j1_suansuan_\d\.mp3/.test(u)), `技能音效按需懒加载：${mp3.map(u => u.split('/').pop()).join(',')}`);
  // ----- 图集 -----
  const GAL = ['k_suansuan_1', 'k_shishi_1', 'p12_momo_2', 'p12_beibei_3', 'p36_abei_1', 'p36_shishi_2', 'j1_suansuan_1', 'j1_momo_2', 'j1_beibei_3', 'h1_asuan_1', 'h1_lexi_2', 'h1_xiaobai_3', 'h1_bola_1', 'j1_abei_3', 'p36_beibei_2', 'h1_xiaomo_2'];
  const meta = await pg.evaluate(async ids => Object.fromEntries(await Promise.all(ids.map(async id => { const r = await fetch(`fx/skills/${id}.json`); const j = await r.json(); return [id, { dur: j.frame_count / j.fps * 1000, peak: j.peak_frame / j.fps * 1000 }]; }))), GAL);
  for (const id of GAL) {
    const p = pg.evaluate(id => window.__zyPlaySkill?.(id), id); await w(Math.round(meta[id].peak) + 60);
    await (await pg.$('.stage')).screenshot({ path: `${OUT}r5-gal-${id}.png` }); await p; await w(150);
  }
  writeFileSync('/tmp/r5-gallery.json', JSON.stringify(GAL));
  await pg.evaluate(() => { window.__zyNoArt = true; });
  for (const id of ['j1_suansuan_2', 'h1_bola_2', 'p36_momo_3', 'k_abei_1']) { const p = pg.evaluate(id => window.__zyPlaySkill?.(id), id); await w(450); await (await pg.$('.stage')).screenshot({ path: `${OUT}r5-proc-${id}.png` }); await p; await w(150); }
  await pg.evaluate(() => { window.__zyNoArt = false; window.__fxLog = []; });
  // ----- 全部 85 个：美术 + 程序化，逐个录帧 + 日志检查 -----
  const all = await pg.evaluate(async () => Object.keys((await (await fetch('fx/skills/manifest.json')).json()).skills));
  ok(all.length === 85, '美术 manifest 85 个');
  if (ALL) {
    for (const id of all) await capture(pg, id, 'art', 1300);
    const La = await S.log(); eyeCare(La, '美术序列帧×85');
    { const n = La.filter(e => e.mode === 'sheet').length; ok(n >= 80, `非本角色技能未预载、首播 250 ms 超时即回退程序化：85 个中 ${n} 个走美术序列帧，其余回退（预期行为）`); }
    await pg.evaluate(() => { window.__zyNoArt = true; window.__fxLog = []; });
    for (const id of all) await capture(pg, id, 'proc', 1300);
    const Lp = await S.log(); eyeCare(Lp, '程序化回退×85');
    ok(Lp.every(e => e.mode === 'proc') && Lp.length === 85, '素材缺失时 85 个都能回退程序化特效');
    const caps = { k: 30, p12: 40, p36: 40, j1: 60, h1: 60 };
    ok(Lp.every(e => e.particles <= caps[e.id.split('_')[0]]), `粒子不超学段上限（最大 ${Math.max(...Lp.map(e => e.particles))}）`);
    await pg.evaluate(() => { window.__zyNoArt = false; });
  }
  const fps = await pg.evaluate(() => window.__fxFps);
  console.log('FPS samples', fps.length, 'min', Math.min(...fps), 'median', fps.sort((a, b) => a - b)[fps.length >> 1]);
  writeFileSync('/tmp/r5-fps.json', JSON.stringify(fps));
  ok(!errs.length, '初一无页面错误 ' + errs.join(' | '));
}
await S.ctx.close();
// ===== 2. 减少动画 =====
{
  const T = await session({ reducedMotion: 'reduce' }); const { pg, w, addChild, tutAll } = T;
  await addChild('10', 'r5高一RM'); await pg.click('[data-testid=level-1]'); await w(600); await tutAll(); await pg.waitForSelector('[data-testid=energy]');
  for (const id of ['h1_asuan_1', 'j1_momo_2', 'k_suansuan_1']) { const p = pg.evaluate(id => window.__zyPlaySkill?.(id), id); await w(400); if (id === 'h1_asuan_1') await pg.screenshot({ path: OUT + 'r5-reduced-motion.png' }); await p; }
  const L = await T.log(); console.log(JSON.stringify(L.map(e => [e.id, e.mode, e.particles, e.anims.map(a => a.el + ':' + a.frames.map(f => f.transform).join('|'))])));
  const moved = L.flatMap(e => e.anims).filter(a => new Set(a.frames.map(f => f.transform ?? '')).size > 1);   // 横幅也不许位移
  ok(L.length === 3 && L.every(e => e.mode === 'reduced' && e.particles === 0) && !moved.length && !(await pg.$('.fx-sprite')), 'reducedMotion：只有横幅 + 图标淡入淡出，无位移、无粒子、无序列帧');
  ok(!T.errs.length, '减少动画无页面错误 ' + T.errs.join(' | '));
  await T.ctx.close();
}
// ===== 3. 小班 / 小学 2 年级（演出类，35%、保底 3）=====
for (const [g, nm, pre] of [['K1', 'r5小班', 'k'], ['2', 'r5二年级', 'p12']]) {
  const T = await session(); const { pg, w, addChild, tutAll, answer } = T;
  await addChild(g, nm); await pg.click('[data-testid=level-1]'); await w(600);
  if (await pg.isVisible('[data-testid=tut-apple]')) { await w(4500); await pg.click('[data-testid=tut-apple]').catch(() => {}); await w(500); }
  await tutAll();
  let cast = -1, nextMs = 0;
  for (let n = 1; n <= 6 && cast < 0; n++) {
    if (g === 'K1') {
      await pg.waitForSelector('[data-testid=kopts]', { timeout: 10000 }).catch(() => {});
      if (n === 3) await pg.evaluate(() => { Math.random = () => 0; });   // 小班普通关只有 3 题，保底（第 4 次）到不了：第 3 题固定随机数，确保能验收演出
      const q0 = await pg.$eval('[data-testid=kopts]', e => e.innerHTML).catch(() => '');
      const c = await pg.$('[data-testid^=opt-][data-correct="1"]'); if (!c) break; const t0 = Date.now(); await c.click();
      const ban = await pg.waitForSelector('[data-testid=skill-banner]', { timeout: 900 }).catch(() => null);
      if (ban) { cast = n; await w(300); await pg.screenshot({ path: OUT + `r5-skill-cast-${pre}.png` });
        await pg.waitForFunction(q => { const e = document.querySelector('[data-testid=kopts]'); return !e || e.innerHTML !== q; }, q0, { timeout: 4000 }).catch(() => {}); nextMs = Date.now() - t0; }
      else { await w(1500); console.log('  kinder no cast', n, await T.log().then(l => l.length)); }
    } else {
      await answer(true);
      const ban = await pg.waitForSelector('[data-testid=skill-banner]', { timeout: 1500 }).catch(() => null);
      if (ban) { cast = n; await w(300); await pg.screenshot({ path: OUT + `r5-skill-cast-${pre}.png` }); }
      await pg.waitForSelector('[data-testid=next]:not([disabled]), [data-testid=result-stats]', { timeout: 15000 }).catch(() => {});
      if (await pg.isVisible('[data-testid=next]')) { await pg.click('[data-testid=next]'); await w(400); }
    }
  }
  await w(1500); const L = await T.log();
  ok(cast > 0 && cast <= 4, `${nm}：演出类技能触发（第 ${cast} 次答对；保底第 4 次）`);
  ok(L.length > 0 && L.every(e => e.id.startsWith(pre + '_') && e.blend === 'normal' && !e.shake), `${nm}：强制 normal 混合、不震屏（${L.map(e => e.id + '/' + e.blend).join(',')}）`);
  if (g === 'K1') ok(L.every(e => e.t1 - e.t0 <= 1100), `小班：技能演出 ≤1.0 s（实测 ${L.map(e => Math.round(e.t1 - e.t0)).join(',')} ms），在 1.2 s 换题节奏内`);
  if (g === 'K1') ok(!(await pg.$('[data-testid=energy]')), '小班无能量环（纯演出）');
  ok(!T.errs.length, nm + ' 无页面错误 ' + T.errs.join(' | '));
  await T.ctx.close();
}
writeFileSync(OUT + 'r5-check-result.json', JSON.stringify(R, null, 1));
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
