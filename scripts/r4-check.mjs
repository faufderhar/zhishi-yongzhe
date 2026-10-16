// r4 D6 轮流回合验收（实现规格 §11）。URL=... OUT=screenshots/live/ node scripts/r4-check.mjs
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4180/'; const OUT = process.env.OUT || 'screenshots/r4/';
const b = await chromium.launch(); let bad = 0; const R = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); R.push([!!c, m]); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } });
const pg = await ctx.newPage();
  // r8b 两级入口（学段 → 年级）：默认项就是档案年级，出现时直接点它
  await pg.addLocatorHandler(pg.locator('[data-testid=stage-pick]'), async () => { await pg.click('[data-testid=stage-pick] .stage-btn.on'); }, { noWaitAfter: true });
  await pg.addLocatorHandler(pg.locator('[data-testid=grade-pick]'), async () => { await pg.click('[data-testid=grade-pick] .stage-btn.on'); }, { noWaitAfter: true }); const errs = [];
pg.on('pageerror', e => errs.push(String(e))); await pg.addInitScript(() => { window.__zyTest = true; });
const w = ms => pg.waitForTimeout(ms);
const pinIn = async p => { for (const d of p) await pg.click(`[data-testid=pin-${d}]`); await pg.click('[data-testid=pin-ok]'); await w(250); };
let pinSet = false;
const home = async () => { await pg.goto(URL); await pg.waitForSelector('[data-testid^=profile-]', { timeout: 30000 }); await w(500); };
async function addChild(g, name) {
  await home(); await pg.click('[data-testid=add-child]'); await w(300);
  if (!pinSet) { await pinIn('2468'); await pinIn('2468'); await pg.fill('[data-testid=hint-answer]', 'x'); await pg.click('[data-testid=hint-ok]'); pinSet = true; } else await pinIn('2468');
  await w(300); await pg.fill('[data-testid=add-name]', name); await pg.click(`[data-testid=home-grade-${g}]`); await w(500);
  await pg.click(`text=${name}`); await w(1200); await pg.click('[data-testid^=char-]'); await pg.click('[data-testid=char-confirm]'); await w(600);
}
const openProfile = async name => { await home(); await pg.click(`text=${name}`); await w(1000); };
let answered = 0;
async function answer(right) {
  answered++;
  await pg.waitForSelector('.quiz .opt, .keypad', { timeout: 10000 });
  const o = await pg.$(`.quiz .opt[data-correct="${right ? 1 : 0}"]`);
  if (o) { await o.click(); return right; }
  if (await pg.$('.keypad')) {
    const ans = await pg.getAttribute('.qtext', 'data-ans'); const ks = right && ans ? await Promise.all([...ans].map(c => pg.$(`.keypad [data-key="${c}"]`))) : [];
    if (right && ks.length && ks.every(Boolean)) { for (const k of ks) await k.click(); await pg.click('[data-testid=ok]'); return true; }
    await pg.click('.keypad button'); await pg.click('[data-testid=ok]'); return false;
  }
  await pg.click('.quiz .opt'); await pg.click('[data-testid=ok]').catch(() => {}); return false;
}
const afterAnswer = () => pg.waitForSelector('[data-testid=next]:not([disabled]), [data-testid=result-stats], [data-testid=revive-yes]', { timeout: 15000 });
const turnText = () => pg.textContent('[data-testid=turn]');
const tutAll = async () => { const t = []; for (let i = 0; i < 8 && await pg.isVisible('[data-testid=tutorial-next]'); i++) { t.push(await pg.innerText('.tut-card')); await pg.click('[data-testid=tutorial-next]'); await w(150); } return t; };
const box = sel => pg.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const overlap = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;

// ===== 初一 =====
await addChild('7', 'r4初一');
await pg.click('[data-testid=level-1]'); await w(600);
await pg.screenshot({ path: OUT + 'r4-tutorial-1.png' });
const tut = await tutAll();
ok(tut.length === 4 && /我方回合答对就攻击.*对方回合答对就能闪避，答得快还能攒专注/.test(tut[2]) && /点一下能看说明/.test(tut[1]), '§10 初一引导 4 张，第 2、3 张文案正确');
await pg.waitForSelector('[data-testid=banner]', { timeout: 10000 });
ok(/我方回合/.test(await pg.textContent('[data-testid=banner]')) && /第 1 回合 \/ 12/.test(await turnText()), '我方先手；顶栏「第 1 回合 / 12」（学霸 #3）');
ok(!(await pg.$('[data-testid=stance-attack], [data-testid=start-answer], [data-testid=act-attack], .countbar')), '没有进攻/防守、〔开始答题〕、限时行动条');
await pg.screenshot({ path: OUT + 'r4-my-turn.png' });
await pg.click('[data-testid=intent]'); await w(250);
ok(/怪物要攻击了！对方回合答对就能闪开，答错会受到 12 点伤害/.test(await pg.textContent('[data-testid=intent-pop]')), '意图说明 ⚔ 文案（#7）');
await pg.screenshot({ path: OUT + 'r4-intent-pop.png' }); await pg.click('[data-testid=intent-ok]'); await w(200);
ok(!(await pg.$('[data-testid=skill]')) && await pg.isVisible('[data-testid=energy]'), 'v0.3.7：没有手动技能按钮，只有能量环');
// T1 我方答对
const mhp0 = await pg.$eval('.mhp', e => e.textContent);
await answer(true); await afterAnswer();
const f1 = await pg.textContent('[data-testid=feedback] h3');
ok(/攻击命中.*造成 \d+/.test(f1), '我方回合答对 → 造成伤害: ' + f1);
await pg.screenshot({ path: OUT + 'r4-attack-hit.png' });
await pg.click('[data-testid=next]'); await w(500);
// T2 对方回合
ok(/对方回合/.test(await pg.textContent('[data-testid=banner]')) && /第 2 回合/.test(await turnText()), '严格交替：第 2 回合为对方回合');
ok(await pg.isVisible('.intent.now') && await pg.isVisible('[data-testid=intent-now]'), '对方回合意图放大闪烁并显示文案');
await pg.screenshot({ path: OUT + 'r4-enemy-turn.png' });
const hp0 = await pg.$eval('.hp', e => e.textContent);
await answer(true); await afterAnswer();
const f2 = await pg.textContent('[data-testid=feedback] h3');
ok(/闪避|完美闪避/.test(f2) && !/受到/.test(f2), '对方 ⚔ 答对不掉血: ' + f2);
if (await pg.isVisible('[data-testid=perfect]')) await pg.screenshot({ path: OUT + 'r4-perfect-dodge.png' });
ok(await pg.isVisible('[data-testid=perfect]') && /◆/.test(await pg.textContent('[data-testid=focus]')), '快速答对 → 完美闪避，专注 +1');
await pg.click('[data-testid=next]'); await w(500);
// T3 我方答错 → 反击或闪避，解析 ≥2s
await answer(false); await pg.waitForSelector('[data-testid=next]', { timeout: 10000 });
const f3 = await pg.textContent('[data-testid=feedback]');
ok(/正确答案/.test(f3) && (/怪物反击！.*受到 \d+/.test(f3) || /运气好闪开了！/.test(f3)), '我方答错：反击或「运气好闪开了！」，且显示正确答案: ' + f3.slice(0, 50));
ok(await pg.isDisabled('[data-testid=next]'), '答错解析至少停 2 秒'); await pg.screenshot({ path: OUT + 'r4-counter.png' });
await w(2100); ok(await pg.isEnabled('[data-testid=next]'), '2 秒后可点〔继续〕');
ok(!/◆/.test(await pg.textContent('[data-testid=focus]')), '我方回合结束专注清零');
await pg.click('[data-testid=next]'); await w(400);
// 打完：我方答对、对方答对
let n = 0;
for (; n < 30; n++) {
  if (await pg.$('[data-testid=result-stats]')) break;
  await answer(true); await afterAnswer();
  if (await pg.$('[data-testid=result-stats]')) break;
  await pg.click('[data-testid=next]'); await w(350);
}
await pg.waitForSelector('[data-testid=result-stats]', { timeout: 10000 });
const rs = await pg.textContent('[data-testid=result-stats]');
ok(/答对 [\d.]+ \/ \d+ 题 · 正确率 \d+% · 共 \d+ 回合/.test(rs), '结算页显示题数与回合数（#3）: ' + rs);
await pg.screenshot({ path: OUT + 'r4-result.png' });
const beforeRev = answered;
await pg.evaluate(() => { window.__zyTestHp = 20; window.__zyTestMonHp = 9999; });
// 第二次：全错 → 复活 → 之后我方错/对方对 → 撤退
await pg.click('[data-testid=again]'); await w(1000);
let revived = false, turnAtDeath = '', warnSeen = false;
for (let k = 0; k < 40; k++) {
  if (await pg.$('[data-testid=result-stats]')) break;
  if (await pg.$('[data-testid=revive-yes]')) {
    turnAtDeath = await turnText(); await pg.screenshot({ path: OUT + 'r4-revive.png' });
    await pg.click('[data-testid=revive-yes]'); await w(300);
    for (let t = 0; t < 4 && await pg.isVisible('.revive-banner') && !(await pg.$('[data-testid=result-stats]')); t++) { await answer(true); await w(1500); if (await pg.isVisible('[data-testid=next]:not([disabled])') && await pg.isVisible('.revive-banner')) await pg.click('[data-testid=next]'); }   // r7：复活成功后直接出新题（学霸报告 #7）
    if (await pg.$('[data-testid=result-stats]')) { ok(false, '复活题未能答对（题型无法自动作答）'); break; }
    const t2 = await turnText(); const hp = await pg.$eval('.hp', e => e.textContent);
    const nOf = t => +(t.match(/第 (\d+) 回合/) || [0, -9])[1];   // r7：复活后直接进下一回合的新题，复活挑战本身不占回合
    ok(nOf(t2) === nOf(turnAtDeath) + 1 && /50/.test(hp), `复活：复活题不计回合（${turnAtDeath}→新题 ${t2}），回到 50%（${hp.trim()}）`);
    revived = true; await w(400); continue;
  }
  await pg.waitForSelector('.quiz .opt, .keypad, [data-testid=result-stats], [data-testid=revive-yes]', { timeout: 15000 });
  if (await pg.$('[data-testid=result-stats], [data-testid=revive-yes]')) continue;
  const side = await pg.textContent('[data-testid=banner]').catch(() => '');
  const myHp = +((await pg.textContent('.hp').catch(() => '')).match(/(\d+)\//) || [0, 99])[1];
  await answer(revived ? (/对方/.test(side) || myHp <= 26) : false);   // 复活后：低血时我方回合答对，避免再次阵亡（v0.3.7 起无法靠技能按钮控制）
  await pg.waitForSelector('[data-testid=next], [data-testid=result-stats], [data-testid=revive-yes], [data-testid=retreating]', { timeout: 15000 });
  if (await pg.$('[data-testid=next]')) { await pg.waitForSelector('[data-testid=next]:not([disabled])', { timeout: 5000 }); if (/第 1[01] 回合/.test(await turnText())) { await pg.screenshot({ path: OUT + 'r4-turn-warn.png' }); warnSeen = warnSeen || /warn/.test(await pg.getAttribute('[data-testid=turn]', 'class')); } await pg.click('[data-testid=next]'); await w(400); }
  if (await pg.$('[data-testid=retreating]')) { await pg.screenshot({ path: OUT + 'r4-retreat.png' }); await w(1500); }
}
ok(revived, '血量归零触发复活挑战');
ok(warnSeen, '剩余 ≤2 回合时回合数变橙色');
await pg.evaluate(() => { window.__zyTestHp = undefined; window.__zyTestMonHp = undefined; });
const cntJ = answered;
await pg.waitForSelector('[data-testid=result-stats]', { timeout: 10000 }).catch(() => {});
const ret = await pg.isVisible('[data-testid=retreat]'); const stars = await pg.$$eval('.stars .on, .star.on', e => e.length).catch(() => -1);
const rtxt = await pg.textContent('[data-testid=result-stats]').catch(() => '');
const won = await pg.$$eval('.center-screen .stars .on', e => e.length).catch(() => -1);
ok(ret && /共 12 回合/.test(rtxt) && won <= 1, `到上限（12）怪物撤退，算通关，最多 ★（${rtxt}，★×${won}）`);
await pg.screenshot({ path: OUT + 'r4-retreat-result.png' });
// 老档案补弹第 3 张
await pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); const st = t.objectStore('kv'); const g = st.get('profiles'); g.onsuccess = () => { st.put(g.result.map(p => p.name === 'r4初一' ? { ...p, tutorialDone: true, tutorialV036: false } : p), 'profiles'); }; t.oncomplete = res; }; }));
await openProfile('r4初一'); await pg.click('[data-testid=level-1]'); await w(600);
const old = await tutAll();
ok(old.length === 1 && /我方回合答对就攻击/.test(old[0]), '老档案只补弹第 3 张卡');
await pg.click('[data-testid=pause]'); await w(200);
ok(await pg.isVisible('[data-testid=quit]'), '暂停可用'); await pg.click('[data-testid=quit]'); await w(150); await pg.click('[data-testid=quit-confirm]'); await w(300);
await pg.click('[data-testid=level-1]'); await w(600);
ok(!(await pg.isVisible('[data-testid=tutorial-next]')), '补弹只出现一次');
// 1024×600 不遮挡
await pg.setViewportSize({ width: 1024, height: 600 }); await w(500);
const qb = await box('.quiz'); const bb = await box('[data-testid=banner]'); const tb = await box('[data-testid=turn]'); const ib = await box('[data-testid=intent]');
ok(!overlap(qb, bb) && !overlap(qb, tb) && !overlap(qb, ib), '1024×600：横幅、回合数、意图不遮挡题目区');
const inView = await pg.$$eval('.quiz button, .quiz .opt', els => els.every(e => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; }));
ok(inView, '1024×600：题目区按钮（含键盘〔确定〕）都在屏幕内');
await pg.screenshot({ path: OUT + 'r4-1024x600.png' });
await pg.click('[data-testid=intent]'); await w(200); await pg.screenshot({ path: OUT + 'r4-1024x600-intent.png' }); await pg.click('[data-testid=intent-ok]');
await pg.setViewportSize({ width: 1180, height: 820 });
await pg.click('[data-testid=pause]'); await w(200); await pg.click('[data-testid=quit]'); await w(150); await pg.click('[data-testid=quit-confirm]'); await w(300);

// ===== 高一 =====
await addChild('10', 'r4高一');
await pg.click('[data-testid=level-1]'); await w(600);
const htut = await tutAll(); ok(htut.length === 5 && /押『确定』答错了就闪不开/.test(htut[4]), '§10 高一第 5 张卡');
await pg.waitForSelector('[data-testid=cards]', { timeout: 10000 });
ok(true, '高一我方回合出题卡'); await pg.screenshot({ path: OUT + 'r4-hs-cards.png' });
await pg.click('[data-testid=card-heavy]'); await w(200);
ok(await pg.isVisible('[data-testid=wager]'), '我方回合：题卡后押注'); await pg.screenshot({ path: OUT + 'r4-hs-wager.png' });
await pg.click('[data-testid=wager-sure]'); await w(300);
await answer(false); await pg.waitForSelector('[data-testid=next]', { timeout: 10000 });
const hf = await pg.textContent('[data-testid=feedback]');
ok(/怪物反击！/.test(hf) && !/运气好闪开了/.test(hf), '押「确定」答错不闪避: ' + hf.slice(0, 40));
await pg.screenshot({ path: OUT + 'r4-hs-sure-wrong.png' });
await w(2100); await pg.click('[data-testid=next]'); await w(500);
ok(!(await pg.isVisible('[data-testid=cards]')) && await pg.isVisible('[data-testid=wager]'), '对方回合：不出题卡，只押注');
await pg.screenshot({ path: OUT + 'r4-hs-enemy-wager.png' });
await pg.click('[data-testid=pause]'); await w(200); await pg.click('[data-testid=quit]'); await w(150); await pg.click('[data-testid=quit-confirm]'); await w(300);
// 设置关闭押注
await home(); await pg.click('[data-testid=parent]'); await w(300); await pinIn('2468'); await pg.click('text=稍后', { timeout: 3000 }).catch(() => {}); await w(300);
await pg.click('[data-testid=ptab-time]').catch(() => {}); await w(200);
let wg = await pg.$('[data-testid=hs-wager]'); for (const t of ['profiles', 'bank', 'backup', 'pin']) { if (wg) break; await pg.click(`[data-testid=ptab-${t}]`); await w(200); wg = await pg.$('[data-testid=hs-wager]'); }
if (wg) await wg.uncheck(); await w(300);
// 学习报告仍工作
await pg.click('[data-testid=ptab-report]'); await w(300); await pg.locator('.chip', { hasText: 'r4初一' }).click(); await w(800);
const rep = await pg.textContent('[data-testid=report]'); const cnt = +(/累计答题 (\d+) 题/.exec(rep)?.[1] ?? 0);
ok(cnt >= cntJ - 4 && cnt <= cntJ, `学习报告计数正常（报告 ${cnt} / 脚本 ${cntJ}，复活题不入统计）`); await pg.screenshot({ path: OUT + 'r4-report.png' });
await pg.click('[data-testid=ptab-time]'); await w(300); await pg.screenshot({ path: OUT + 'r4-time.png' });
await openProfile('r4高一'); await pg.click('[data-testid=level-1]'); await w(800);
await pg.click('[data-testid=card-std]'); await w(300);
ok(!!wg && !(await pg.isVisible('[data-testid=wager]')) && await pg.isVisible('.qtext'), '设置里关闭押注后不再出现押注');
await pg.click('[data-testid=pause]'); await w(200); await pg.click('[data-testid=quit]'); await w(150); await pg.click('[data-testid=quit-confirm]'); await w(300);

await pg.evaluate(() => new Promise(res => { const r = indexedDB.open('zhishi-yongzhe'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); const st = t.objectStore('kv'); const g = st.get('profiles'); g.onsuccess = () => st.put(g.result.filter(p => !['r4高一', 'r4初一'].includes(p.name)), 'profiles'); t.oncomplete = res; }; }));
// ===== 小学 3 年级（3–4：无 ⚡💥、无专注）/ 2 年级（自动）=====
await addChild('3', 'r4三年级');
await pg.click('[data-testid=level-1]'); await w(600);
const t3 = await tutAll(); ok(t3.length === 4 && !/攒专注/.test(t3[2]), '小学 3–6 引导卡 3 去掉「攒专注」');
await pg.waitForSelector('[data-testid=banner]'); ok(!(await pg.$('[data-testid=focus]')), '小学 3–6 无专注');
await pg.screenshot({ path: OUT + 'r4-g3.png' });
await pg.click('[data-testid=pause]'); await w(200); await pg.click('[data-testid=quit]'); await w(150); await pg.click('[data-testid=quit-confirm]'); await w(300);
await addChild('2', 'r4二年级');
await pg.click('[data-testid=level-1]'); await w(600); const t2 = await tutAll();
ok(t2.some(x => /答对后会自动帮你出招/.test(x)), '1–2 年级引导仍为「自动出招」');
await answer(true); await w(1500);
ok(!(await pg.$('[data-testid=banner]')) && !(await pg.$('[data-testid=turn]')), '1–2 年级无横幅、无回合数（保持 r2）');
await pg.screenshot({ path: OUT + 'r4-g2-auto.png' });
ok(!errs.length, '无页面错误 ' + errs.join(' | '));
await b.close(); console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
