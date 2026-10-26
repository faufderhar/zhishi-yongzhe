import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
// 题库版本 = public/banks 内容哈希：换题库（如 v14 改了题干/题型但 id 不变）时 URL 变化，绕过 HTTP 缓存；SW 预缓存按文件 revision 自动更新
// r12（技术QA R10-4）：题库发布号不手写——构建时从各 bank_*.json 的 version 字段推出；各文件不一致就构建失败。
// 同时把 release.json（发布号 + 可玩题数）按题库文件重新生成，保证和题库一致。
const BANK_RELEASE = (() => {
  const files = readdirSync('public/banks').filter(f => /^bank_.*\.json$/.test(f)).sort();
  const vs = new Map<string, string[]>(); let playable = 0;
  for (const f of files) { const d = JSON.parse(readFileSync('public/banks/' + f, 'utf8')); const v = String(d.version ?? '?'); vs.set(v, [...(vs.get(v) ?? []), f]);
    playable += (d.questions ?? []).filter((q: { status?: string }) => q.status === '已通过' || q.status === 'AI初审通过').length; }
  if (vs.size !== 1) throw new Error('题库文件的 version 不一致：' + [...vs].map(([v, fs]) => `${v}: ${fs.join(',')}`).join('；'));
  const release = [...vs.keys()][0]; const json = JSON.stringify({ release, playable });
  let cur = ''; try { cur = readFileSync('public/banks/release.json', 'utf8'); } catch { /* */ }
  if (cur !== json) writeFileSync('public/banks/release.json', json);
  return release;
})();
const BANK_VER = (() => { const h = createHash('sha1'); for (const f of readdirSync('public/banks').sort()) h.update(f).update(readFileSync('public/banks/' + f)); return h.digest('hex').slice(0, 10); })();
const BUILD = (() => { let h = 'nogit'; try { h = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* */ } return h; })();
// r9：构建时间取提交时间（不是「现在」）——同一个提交本地和 CI 构建出的 bundle 一样，线上 bundle 名可预测、可核验
const BUILD_TIME = (() => { try { return new Date(execSync('git log -1 --format=%cI').toString().trim()).toISOString(); } catch { return new Date().toISOString(); } })();
// 版本轮次的唯一来源：仓库根目录 RELEASE 文件（发版时只改这里）
const RELEASE = readFileSync(new URL('./RELEASE', import.meta.url), 'utf8').trim();
export default defineConfig({
  base: './',
  define: { __BANK_VER__: JSON.stringify(BANK_VER), __BANK_RELEASE__: JSON.stringify(BANK_RELEASE), __BUILD__: JSON.stringify(BUILD), __RELEASE__: JSON.stringify(RELEASE), __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    // r8：测试钩子只在测试构建（ZY_TEST=1）、dev 服务器、vitest 里保留；正式构建为 false，整段代码被删除
    __TEST_HOOKS__: JSON.stringify(process.env.ZY_TEST === '1' || !!process.env.VITEST || !process.argv.includes('build')) },
  plugins: [react(), ({ name: 'zy-test-noindex', transformIndexHtml(html: string) {   // r17.1 Boss测试解锁_r17 §4.1：测试构建 / 开发服务器的页面不让搜索引擎收录（正式构建不加）
    return process.env.ZY_TEST === '1' || !process.argv.includes('build') ? html.replace('</head>', '  <meta name="robots" content="noindex,nofollow">\n</head>') : html; } } as Plugin), ({ name: 'zy-version', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD, release: RELEASE, time: BUILD_TIME }) }); } } as Plugin), VitePWA({
    registerType: 'prompt', injectRegister: false, includeAssets: ['apple-touch-icon.png', 'icon.svg'],
    manifest: { name: '知识勇者', short_name: '知识勇者', display: 'standalone', orientation: 'landscape', background_color: '#1d2340', theme_color: '#2b3a78', start_url: './', scope: './', id: './', lang: 'zh-CN',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ] },
    workbox: { skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true, importScripts: ['sw-extra.js'], navigateFallback: null,   // r10：页面导航改为网络优先（sw-extra.js），离线才用缓存
       ignoreURLParametersMatching: [/^utm_/],   /* r17.2.1：去掉 /^v$/——题库 banks/bank_*.json?v=新哈希 不再被当成预缓存里的旧题库（学霸 r17.2：旧档更新后初三仍 5 科）；断网时 bankStore 退回不带参数的预缓存地址 */ globPatterns: ['**/*.{js,css,html,svg,json,png,webp,woff2}', 'sfx/sfx_k_term_celebrate.mp3'],   /* r17：期末庆祝乐句（主版 ≈50 KB，alt 不要）预缓存——第一次玩期末关就在离线时也有音乐 */ maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,   // r16.1：v47/v48 加了初二生物 / 地理，bank_8.json 4.3MB 超过原来的 4MB → 构建失败、离线缓存不到初二题库（tests/r161precache.test.ts 守着）
     
      // 序列帧约 4.3MB：不进预缓存，战斗时懒加载并运行时缓存（家长页可一键预下载供离线）
      globIgnores: ['version.json', 'anim/**', 'fx/**', 'sfx/skills/**', 'art/monsters/subjects/**', 'images/k/**', 'art/monsters/k3_boss/**', 'art/k_qban/mon_k3_*'],   // r17：大班（还没开放）的 Boss 序列帧 / Q版不进预缓存，开放后按需缓存   // 技能特效 fx/skills/ 与音效 sfx/skills/ 也只运行时缓存
      runtimeCaching: [{ urlPattern: /\/(anim|fx)\/.+\.(webp|json)$/, handler: 'CacheFirst', options: { cacheName: 'zy-anim', expiration: { maxEntries: 700 } } },
        { urlPattern: /\/sfx\/sfx_k_term_celebrate\.mp3$/, handler: 'CacheFirst', options: { cacheName: 'zy-sfx-term', expiration: { maxEntries: 2 }, cacheableResponse: { statuses: [200] } } },   // r17 D：期末庆祝乐句——主版已预缓存；这条运行时规则留作后备（只认主版，alt 不接）
        { urlPattern: /\/sfx\/skills\/.+\.mp3$/, handler: 'CacheFirst', options: { cacheName: 'zy-sfx-skills', expiration: { maxEntries: 110 }, cacheableResponse: { statuses: [200] } } },
        /* r15.4 朗读录音退路：按需加载，CacheFirst，只缓存完整 200 响应（不缓存 206 分段，Chrome 从缓存回放分段会失败；播放用 new Audio 整段读） */
        { urlPattern: /\/voice\/.+\.(mp3|m4a)$/, handler: 'CacheFirst', options: { cacheName: 'zy-voice', expiration: { maxEntries: 3000 }, cacheableResponse: { statuses: [200] }, rangeRequests: true } },
        { urlPattern: /\/art\/(monsters\/k3_boss|k_qban)\/.+\.(webp|json)$/, handler: 'CacheFirst', options: { cacheName: 'zy-monsters', expiration: { maxEntries: 400 }, cacheableResponse: { statuses: [200] } } },
        { urlPattern: /\/art\/monsters\/subjects\/.+\.(webp|json)$/, handler: 'CacheFirst', options: { cacheName: 'zy-monsters', expiration: { maxEntries: 400 }, cacheableResponse: { statuses: [200] } } },
        { urlPattern: /\/images\/k\/.+\.webp$/, handler: 'CacheFirst', options: { cacheName: 'zy-kimg', expiration: { maxEntries: 100 }, cacheableResponse: { statuses: [200] } } }] },
  })],
  test: { environment: 'node' },
  preview: { host: true, port: 4173, strictPort: true, allowedHosts: true },
  server: { host: true, allowedHosts: true },
} as any);
