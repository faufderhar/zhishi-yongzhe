// r16.1 (j)：生产包里不能有任何测试钩子名（CI 部署前跑；本机：node scripts/check-prod-hooks.mjs [dist]）。只用仓库里的文件，不依赖开发机路径。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
export const HOOKS = ['__zyForceQ', '__zyTest', '__zyUnlockAll', '__zyRecLog', '__zyMissLog', '__zyGraceMs', '__zyAudioLog', '__zyPrio', '__zyTestMonHp', '__zyBossLog', '__zyAdj', '__zyRepeats', '__zyLastSkill', '__zyTestFlags', '__TEST_HOOKS__', '__zyBossLab', 'BossLab', 'bosslab_', 'bosslog-export'];   // r16.2：__zyTestFlags（runtimeFlags 的只读快照，测试构建）；r17.1：BossLab / 导出（Boss测试解锁_r17 §4.3）
export const HOOK_RE = new RegExp(HOOKS.map(h => h.replace(/\$/g, '\\$')).join('|'), 'g');   // __zyTest 也覆盖 __zyTestBetPop / __zyTestNoTts / __zyTestPinSaveFail 等
const TEXT = /\.(js|mjs|css|html|json|webmanifest|txt|map|svg)$/i;
export function scan(dir) { const hits = [];
  const walk = d => { for (const n of readdirSync(d)) { const p = join(d, n); const st = statSync(p); if (st.isDirectory()) walk(p); else if (TEXT.test(n)) { const s = readFileSync(p, 'utf8'); const m = s.match(HOOK_RE); if (m) hits.push([p, [...new Set(m)]]); } } };
  walk(dir); return hits; }
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] || 'dist'; const hits = scan(dir);
  if (hits.length) { console.error(`测试钩子出现在生产包 ${dir}/：`); for (const [p, m] of hits) console.error(`  ${p}: ${m.join(', ')}`); process.exit(1); }
  console.log(`check-prod-hooks: ${dir}/ 里没有测试钩子（${HOOKS.length} 个名字）`);
}
