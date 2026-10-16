// 线上版本核验（r9 起所有线上验收的第一步）：带 cache-busting 取 index.html → 读出引用的 bundle → 确认 200 且内含期望的构建提交号
// 用法：EXPECT=<git 短哈希> [URL=...] [WAIT=秒] node scripts/verify-live.mjs   —— 成功时打印 bundle 名并以 0 退出，否则非 0
const URL = (process.env.URL || 'https://faufderhar.github.io/zhishi-yongzhe/').replace(/\/?$/, '/');
const EXPECT = process.env.EXPECT; const ROUND = process.env.EXPECT_ROUND;   // r12：EXPECT_ROUND=r12 → 同时核对 bundle 里的版本轮次和 version.json const WAIT = +(process.env.WAIT || 0);
if (!EXPECT) { console.error('需要 EXPECT=<commit>'); process.exit(2); }
const t0 = Date.now(); let last = '';
for (;;) {
  try {
    const cb = Date.now() + '' + Math.random().toString(36).slice(2);
    const html = await (await fetch(URL + '?cb=' + cb, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } })).text();
    const m = html.match(/assets\/(index-[\w-]+\.js)/);
    if (!m) last = 'index.html 里没有找到 bundle';
    else {
      const r = await fetch(URL + 'assets/' + m[1] + '?cb=' + cb, { cache: 'no-store' });
      const js = r.ok ? await r.text() : '';
      if (r.status !== 200) last = `${m[1]} 返回 ${r.status}`;
      else if (!js.includes(`"${EXPECT}"`) && !js.includes(`'${EXPECT}'`) && !js.includes(EXPECT)) last = `${m[1]} 不含构建号 ${EXPECT}`;
      else if (ROUND && !new RegExp("[`\"']" + ROUND + " · 题库").test(js)) last = `${m[1]} 的版本标签不是 ${ROUND}`;
      else if (ROUND && (await (await fetch(URL + 'version.json?cb=' + cb, { cache: 'no-store' })).json().catch(() => ({}))).release !== ROUND) last = `version.json 的 release 不是 ${ROUND}`;
      else { console.log(`LIVE OK bundle=${m[1]} build=${EXPECT}${ROUND ? ' round=' + ROUND : ''} (${Math.round((Date.now() - t0) / 1000)}s)`); process.exit(0); }
    }
  } catch (e) { last = String(e); }
  if ((Date.now() - t0) / 1000 >= WAIT) { console.error('LIVE FAIL ' + last); process.exit(1); }
  await new Promise(r => setTimeout(r, 15000));
}
