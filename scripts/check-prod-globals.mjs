// r16.2 技术QA B3：生产包不能定义 / 赋值任何 window.__zy* 全局（以前 __zyPaused / __zyRestoring / __zyRotate / __zyInactive 能从控制台改，
// 绕过时长限制或 PIN 锁定）。运行时开关都在 src/runtimeFlags.ts 的模块变量里；测试构建的只读快照 __zyTestFlags 只在 __TEST_HOOKS__ 下。
// 规则（从严）：生产 JS / HTML 里出现任何 __zy 开头的名字就失败——不管是 window.__zyX = …、window["__zyX"]、globalThis / self 上的，
// 还是 Object.defineProperty(window, '__zyX')；另外单独标出看起来是「赋值 / 定义」的位置，方便查。CI 部署前跑；本机：node scripts/check-prod-globals.mjs [dist]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const CODE = /\.(js|mjs|cjs|html)$/i;
export const NAME_RE = /__zy[A-Za-z0-9$][\w$]*/g;   // __zy_pin__ / __zy_rec__ 是 Cache Storage 的键（'./__zy_pin__'），不是全局；但对 window 上 __zy_x 的赋值下面的 ASSIGN_RE 照样抓
export const ASSIGN_RE = /(?:window|globalThis|self|top|parent)\s*(?:\.\s*(__zy[\w$]*)|\[\s*['"`](__zy[\w$]*)['"`]\s*\])\s*(?:=(?!=)|\+\+|--|[-+*/|&]=)|defineProperty\(\s*(?:window|globalThis|self)\s*,\s*['"`](__zy[\w$]*)/g;
export function scanGlobals(dir) { const hits = [];
  const walk = d => { for (const n of readdirSync(d)) { const p = join(d, n); const st = statSync(p); if (st.isDirectory()) walk(p); else if (CODE.test(n)) { const s = readFileSync(p, 'utf8');
    const names = [...new Set(s.match(NAME_RE) ?? [])]; const assigns = [...new Set([...s.matchAll(ASSIGN_RE)].map(m => m[1] || m[2] || m[3]))];
    if (names.length || assigns.length) hits.push({ file: p, names, assigns }); } } };
  walk(dir); return hits; }
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] || 'dist'; const hits = scanGlobals(dir);
  if (hits.length) { console.error(`生产包 ${dir}/ 里有 window.__zy* 全局：`); for (const h of hits) console.error(`  ${h.file}: ${h.names.join(', ')}${h.assigns.length ? `（赋值 / 定义：${h.assigns.join(', ')}）` : ''}`); process.exit(1); }
  console.log(`check-prod-globals: ${dir}/ 里没有 __zy* 全局`);
}
