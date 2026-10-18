// r15.4.2 游戏策划：高一押注开关浏览器测试。全新高一档案（真实界面新建），只用触摸点屏作答。
//  ①开关只在我方回合（选题卡 / 多步题出题前）出现，对方回合没有；②每回合默认关；③第一次出现时有一句提示，之后不再出现（同一关后面、刷新后新一关都不出）；
//  ④押注估算 = 不押 × min(1.25, 1.8/题卡倍率)（×1.8 封顶）；押注答对：能量比不押多 +1，伤害 ≈ 押注估算；⑤押注答错：「押注答错：怪物反击，闪不开！」、受到伤害、不出现闪开。
// 测试构建（__zyTest 只用来读哪个选项对 / 题目答案，__zyUnlockAll 解锁）。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from "node:fs";
const URL = process.env.URL || 'http://localhost:4326/'; const OUT = process.env.OUT || '/workspace/playtest/r1542-wager/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
await pg.addInitScript(() => { window.__zyTest = true; window.__zyUnlockAll = true; window.__zyTestNoTts = true; window.__zyTestMonHp = 5000; window.__zyTestHp = 900; });   // 怪物血量加厚：估算不被剩余血量截住、几回合内不会打死
const w = ms => pg.waitForTimeout(ms); const vis = sel => pg.isVisible(sel);
const tap = async sel => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const bb = await l.boundingBox().catch(() => null); if (!bb) return false; await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
const pinIn = async p => { for (const d of p) await tap(`[data-testid=pin-${d}]`); await tap('[data-testid=pin-ok]'); await w(300); };
async function toMap() { for (let i = 0; i < 30 && !(await vis('[data-testid=level-1]')); i++) {
  if (await vis('[data-testid=pin-ok]')) await pinIn('2468'); else if (await vis('[data-testid=pin-reset-full-ok]')) await tap('[data-testid=pin-reset-full-ok]');
  else if (await vis('[data-testid=stage-pick]')) await tap('[data-testid=stage-pick] .stage-btn.on'); else if (await vis('[data-testid=grade-pick]')) await tap('[data-testid=grade-pick] .stage-btn.on');
  else if (await vis('[data-testid=char-confirm]')) { await tap('[data-testid^=char-]:not([data-testid=char-confirm]):not([data-testid=charlist])'); await w(200); await tap('[data-testid=char-confirm]'); }
  else if (await vis('text=r9')) await tap('text=r9'); await w(500); } }
await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]'); await w(400);
await tap('[data-testid=add-child]'); await w(300); await pinIn('2468'); await pinIn('2468'); await tap('.pinpad input[type=radio]').catch(() => {}); await pg.fill('[data-testid=hint-answer]', 'x'); await tap('[data-testid=hint-ok]'); await w(500);
for (const sel of ['[data-testid=rec-done]', 'text=我已经抄好了']) if (await vis(sel)) { await tap(sel); await w(300); }
if (await vis('.modal >> text=稍后')) await tap('.modal >> text=稍后');
await pg.fill('[data-testid=add-name]', 'r9'); await tap('[data-testid=home-grade-10]'); await w(400); await toMap();
const st = { cardTurns: 0, cardToggle: 0, cardDefaultOff: 0, mTurns: 0, mToggle: 0, hints: [], ratios: [], betRight: [], noBetRight: [], betWrong: [], qToggle: 0 };
const energy = async () => Number(((await pg.textContent('[data-testid=energy]').catch(() => '')) || '').match(/(\d+)\/\d/)?.[1] ?? NaN);
const fbText = async () => { for (let i = 0; i < 30; i++) { if (await vis('[data-testid=feedback]')) return (await pg.textContent('[data-testid=feedback] h3')).trim(); await w(200); } return ''; };
async function answer(right) {
  if (await vis('.keypad')) { const a = right ? await pg.$eval('.qtext', e => e.getAttribute('data-ans') || '1').catch(() => '1') : '98765'; for (const ch of a) await tap(`.keypad [data-key="${ch}"]`); await tap('[data-testid=ok]'); return; }
  const multi = await vis('.opts.multi, [data-testid=multi-ok]');
  if (multi) { const sel = right ? '.quiz .opt[data-correct="1"]' : '.quiz .opt[data-correct="0"]'; for (const h of await pg.$$(sel)) { const bb = await h.boundingBox(); if (bb) await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await w(120); } await tap('[data-testid=multi-ok], [data-testid=ok]'); return; }
  const want = right ? '1' : '0'; await tap((await pg.$(`.quiz .opt[data-correct="${want}"]`)) ? `.quiz .opt[data-correct="${want}"]` : '.quiz .opt');
}
async function play(lv, tag, plan, maxP = 8) {
  await tap(`[data-testid=level-${lv}]`); await w(1200); let pTurn = 0, sawSetup = false, side = '';
  for (let step = 0; step < 260; step++) {
    if (pTurn >= maxP && (await vis('[data-testid=cards]') || await vis('[data-testid=bet-phase]'))) { await tap('[data-testid=pause]'); await w(400); await tap('[data-testid=quit]'); await w(300); await tap('[data-testid=quit-confirm]').catch(() => {}); await w(800); break; }
    if (await vis('[data-testid=result-title], [data-testid=result-stats]')) break;
    if (await vis('[data-testid=tutorial-skip]')) { await tap('[data-testid=tutorial-skip]'); await w(400); continue; }
    if (await vis('[data-testid=tutorial-next]')) { await tap('[data-testid=tutorial-next]'); await w(300); continue; }
    if (await vis('[data-testid=revive-no]')) { await tap('[data-testid=revive-no]'); await w(300); continue; }
    side = await pg.getAttribute('[data-testid=banner]', 'data-side').catch(() => side) || side;
    const setup = await vis('[data-testid=cards]') || await vis('[data-testid=bet-phase]');
    if (setup) {
      pTurn++; st.cardTurns++; sawSetup = true; const tg = await vis('[data-testid=bet-toggle]'); if (tg) st.cardToggle++;
      if (tg && (await pg.getAttribute('[data-testid=bet-toggle]', 'data-on')) === '0') st.cardDefaultOff++;
      const hint = await vis('[data-testid=bet-hint]'); st.hints.push(`${tag}#${pTurn}:${hint ? 1 : 0}`); if (hint) await pg.screenshot({ path: `${OUT}${tag}-hint-${pTurn}.png` });
      const p = plan(pTurn); let key = 'std';
      if (await vis('[data-testid=cards]')) { for (const k of ['light', 'std', 'heavy']) { const d = await pg.textContent(`[data-testid=card-dmg-${k}]`).catch(() => ''); const m = d.match(/≈ (\d+)（押注 ≈ (\d+)）/); const mult = Number((await pg.textContent(`[data-testid=card-mult-${k}]`).catch(() => '')).match(/伤害 ×([\d.]+)/)?.[1]);
          const diff = Number((await pg.textContent(`[data-testid=card-${k}]`).catch(() => '')).match(/难度 (\d)/)?.[1] ?? 0);
          if (m && mult) st.ratios.push({ t: st.cardTurns, diff, k, base: +m[1], bet: +m[2], mult, want: Math.min(1.25, 1.8 / Math.min(mult, 1.8)) }); }
        key = p.card || 'std'; }
      const est = await pg.textContent(`[data-testid=card-dmg-${key}]`).catch(() => ''); const em = est.match(/≈ (\d+)（押注 ≈ (\d+)）/);
      if (p.bet && tg) { await tap('[data-testid=bet-toggle]'); await w(150); }
      const e0 = await energy(); await pg.screenshot({ path: `${OUT}${tag}-setup-${pTurn}.png` });
      if (await vis('[data-testid=cards]')) await tap(`[data-testid=card-${key}]`); else await tap('[data-testid=bet-go]'); await w(350);
      if (await vis('[data-testid=chal-normal]')) { await tap('[data-testid=chal-normal]'); await w(300); }
      for (let i = 0; i < 20 && !(await vis('.quiz .opt, .keypad')); i++) await w(200);
      if (await vis('[data-testid=bet-toggle]')) st.qToggle++;
      await answer(p.right); const t = await fbText(); const e1 = await energy();
      const dealt = Number(t.match(/造成 ([\d+]+)/)?.[1]?.split('+').reduce((a, x) => a + +x, 0) ?? 0); const taken = Number(t.match(/受到 (\d+)/)?.[1] ?? 0);
      const rec = { tag, turn: pTurn, card: key, est: em ? +em[1] : null, betEst: em ? +em[2] : null, dealt, taken, de: e1 - e0, e0, gain: Number(t.match(/能量 \+(\d+)/)?.[1] ?? 0), skill: /✨/.test(t), text: t.slice(0, 60) };
      (p.bet ? (p.right ? st.betRight : st.betWrong) : p.right ? st.noBetRight : []).push(rec); if (p.bet) await pg.screenshot({ path: `${OUT}${tag}-fb-${pTurn}.png` });
      if (await vis('[data-testid=next]')) await tap('[data-testid=next]'); await w(300); continue;
    }
    if (await vis('.quiz .opt, .keypad')) { if (side === 'M') { st.mTurns++; if (await vis('[data-testid=bet-toggle]')) st.mToggle++; } await answer(true); await fbText(); if (await vis('[data-testid=next]')) await tap('[data-testid=next]'); await w(300); continue; }
    if (await vis('[data-testid=next]')) { await tap('[data-testid=next]'); await w(300); continue; }
    await w(300);
  }
  await pg.screenshot({ path: `${OUT}${tag}-end.png` }); if (await vis('[data-testid=to-map]')) await tap('[data-testid=to-map]'); await w(800); return sawSetup;
}
// 第 1 关：第 1 回合不押（看提示 / 默认关），第 2 回合押注答对，第 3 回合不押答对（对照能量），第 4 回合押注答错，之后不押答对
await play(1, 'L1', n => n === 2 ? { bet: true, right: true } : n === 4 ? { bet: true, right: false } : n === 6 ? { bet: true, right: true, card: 'heavy' } : n === 7 ? { bet: true, right: true } : { bet: false, right: true }, 9);
await toMap(); await play(2, 'L2', n => n === 1 ? { bet: true, right: false } : n === 3 ? { bet: true, right: true } : { bet: false, right: true }, 4);
await pg.reload(); await pg.waitForSelector('[data-testid^=profile-], [data-testid=pin-ok], [data-testid=levels]'); await w(600); await toMap(); await play(1, 'L1-reload', () => ({ bet: false, right: true }), 3);
console.log(JSON.stringify({ ...st, ratios: st.ratios.slice(0, 12) }, null, 0)); writeFileSync(OUT + "ratios.json", JSON.stringify(st.ratios));
ok(st.cardTurns >= 6 && st.cardToggle === st.cardTurns, `我方回合（选题卡 / 多步题出题前）都有押注开关（${st.cardToggle}/${st.cardTurns}）`);
ok(st.mTurns > 0 && st.mToggle === 0, `对方回合没有押注开关（${st.mTurns} 次对方回合，出现 ${st.mToggle} 次）`);
ok(st.qToggle === 0, `出题后开关收起（${st.qToggle}）`);
ok(st.cardDefaultOff === st.cardTurns, `每回合默认关（${st.cardDefaultOff}/${st.cardTurns}）`);
const hs = st.hints.filter(h => h.endsWith(':1')); ok(hs.length === 1 && hs[0] === 'L1#1:1', `押注提示只在第一次出现时显示 1 次（${hs.join(',') || '没出现'}；共 ${st.hints.length} 个我方回合，含刷新后新一关）`);
// 押注估算：内层（连击 × 专注 × 卡 × 押注）封顶 INNER_CAP——没封顶时 = 不押 × 1.25；封顶时 = 这一回合的封顶值（同一回合各卡外层相同，封顶值 = 本回合最大押注估算）
// 同一回合、同难度的卡外层相同：拿没封顶的卡（正好 ×1.25）按倍率换算出这张卡不封顶该有多少，封顶的必须比它小（被截住）且不比不押少
const isEx = r => Math.abs(r.bet - r.base * 1.25) <= 1.01 + r.base * 0.02;
const capOk = r => r.bet >= r.base && r.bet < r.base * 1.25 + 1.01 && st.ratios.filter(e => e.t === r.t && e.diff === r.diff && e !== r && isEx(e)).every(e => e.bet * r.mult / e.mult >= r.bet - 1.5);
const rcls = st.ratios.map(r => ({ ...r, exact: isEx(r), capped: !isEx(r) && capOk(r) }));
const rbad = rcls.filter(r => !r.exact && !r.capped); const nEx = rcls.filter(r => r.exact).length;
ok(st.ratios.length >= 6 && nEx >= 3 && !rbad.length, `押注估算 = 不押 × 1.25（内层封顶时到本回合封顶值为止）：${st.ratios.length} 张卡，正好 ×1.25 的 ${nEx} 张，封顶的 ${rcls.filter(r => !r.exact).length} 张${rbad.length ? '；不符 ' + JSON.stringify(rbad.slice(0, 3)) : ''}`);
// 能量：答对 +1（连击到 3 再 +1）、押注再 +1，最多 5（看反馈里的「能量 +N」，技能花掉的不算）
const gOk = (r, b) => r.gain >= Math.min(b, 5 - r.e0) && r.gain <= Math.min(b + 1, 5 - r.e0);
const nbad = st.noBetRight.filter(r => !gOk(r, 1)), bbad = st.betRight.filter(r => !gOk(r, 2)); const bfull = st.betRight.filter(r => r.e0 <= 3);
ok(st.betRight.length >= 3 && bfull.length >= 2 && !nbad.length && !bbad.length, `押注答对能量多 +1（不押：${st.noBetRight.map(r => `${r.e0}→+${r.gain}`).join(' ')}；押注：${st.betRight.map(r => `${r.e0}→+${r.gain}`).join(' ')}）`);
// 估算是「无技能」伤害；同回合放了技能的按技能说明换算：技能倍率乘在内层、同样受 INNER_CAP 封顶：×1.4 在 [估算, 估算×1.4]；多段（2 次每次 70%）在 [估算×2×70%, 估算×2]（估算已封顶时每段仍是封顶值）
const skK = t => { const m = t.match(/(\d) 次，每次 (\d+)%/); if (m) return +m[1] * +m[2] / 100; const x = t.match(/✨[^造]*×([\d.]+)/); return x ? +x[1] : 1; };
const dchk = st.betRight.map(r => ({ ...r, k: skK(r.text), want: Math.round(r.betEst * skK(r.text)) }));
ok(dchk.length >= 3 && dchk.filter(r => r.k === 1).length >= 1 && dchk.every(r => { if (!r.betEst) return false; if (r.k === 1) return Math.abs(r.dealt - r.betEst) <= Math.max(2, r.betEst * 0.15); const n = +(r.text.match(/(\d) 次，每次/)?.[1] ?? 1); const lo = Math.min(r.want, r.betEst * n), hi = Math.max(r.want, r.betEst * n); return r.dealt >= lo * 0.95 - 2 && r.dealt <= hi * 1.05 + 2; }), `押注答对伤害 ≈ 押注估算（${dchk.map(r => `${r.dealt}≈${r.betEst}${r.k !== 1 ? '×' + r.k + '=' + r.want + '（' + r.text.match(/✨[^：]*/)?.[0] + '）' : ''}`).join('，')}）`);
ok(st.betWrong.length >= 2 && st.betWrong.every(r => /押注答错：怪物反击，闪不开/.test(r.text) && r.taken > 0 && !/闪开/.test(r.text.replace('闪不开', ''))), `押注答错：怪物反击、闪不开（${st.betWrong.map(r => r.text).join(' | ')}）`);
console.log(bad ? `r1542-wager FAIL ${bad}` : 'r1542-wager ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
