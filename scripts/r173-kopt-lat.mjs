// r17.3 小萌新 r17.1 低：幼儿园英文选项不从单词中间断（Goodby/e!）。用构建出的 CSS 摆三张 .kopt（各视口），量每个单词只占一行、字不出卡
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4481/';
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const TX = ['Thank you!', 'Goodbye!', 'Good morning!', 'Good night!', 'Hello!', 'Sorry!', '苹果', '红色的大苹果'];
for (const [W, H] of [[667, 375], [800, 600], [1024, 600], [1280, 800], [1920, 1080]]) {
  const pg = await b.newPage({ viewport: { width: W, height: H } }); await pg.goto(URL); await pg.waitForTimeout(800);
  const r = await pg.evaluate(TX => { document.body.innerHTML = '<div class="kopts" style="display:flex;gap:20px;flex-wrap:wrap">' + TX.map(t => { const lat = /[A-Za-z]{3,}/.test(t) && !/[\u4e00-\u9fff]/.test(t); const wl = Math.max(4, ...t.split(/\s+/).map(x => x.length)); return `<button class="kopt"><span class="kopt-text ${[...t].length <= 3 ? 'short' : ''} ${lat ? 'lat' : ''}" style="--len:${[...t].length};--wl:${wl}">${t}</span></button>`; }).join('') + '</div>';
    return [...document.querySelectorAll('.kopt-text')].map(s => { const tn = s.firstChild, txt = tn.textContent; const words = []; let i = 0; for (const w of txt.split(' ')) { const rg = document.createRange(); rg.setStart(tn, i); rg.setEnd(tn, i + w.length); const tops = new Set([...rg.getClientRects()].map(x => Math.round(x.top))); words.push([w, tops.size]); i += w.length + 1; }
      const k = s.parentElement.getBoundingClientRect(), t = s.getBoundingClientRect(); return { txt, lat: s.classList.contains('lat'), fs: getComputedStyle(s).fontSize, words, inside: t.left >= k.left - 1 && t.right <= k.right + 1 && t.top >= k.top - 1 && t.bottom <= k.bottom + 1, kw: Math.round(k.width) }; }); }, TX);
  for (const x of r) { const split = x.words.filter(([w, n]) => /[A-Za-z]/.test(w) && n > 1).map(([w]) => w); ok(split.length === 0 && x.inside, `${W}×${H} 「${x.txt}」 ${x.fs} 卡宽${x.kw}${split.length ? ' 断词:' + split : ''}${x.inside ? '' : ' 出卡'}`); }
  await pg.close();
}
console.log(bad ? `r173-kopt-lat FAIL ${bad}` : 'r173-kopt-lat ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
