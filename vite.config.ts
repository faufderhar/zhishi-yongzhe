import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
// 题库版本 = public/banks 内容哈希：换题库（如 v14 改了题干/题型但 id 不变）时 URL 变化，绕过 HTTP 缓存；SW 预缓存按文件 revision 自动更新
const BANK_VER = (() => { const h = createHash('sha1'); for (const f of readdirSync('public/banks').sort()) h.update(f).update(readFileSync('public/banks/' + f)); return h.digest('hex').slice(0, 10); })();
// 题库发布号（导入题库时由 tools 写入 public/banks/release.json）与构建号（git 短哈希 + 日期），家长页显示（技术QA R6-5）
const BANK_RELEASE = (() => { try { return JSON.parse(readFileSync('public/banks/release.json', 'utf8')).release as string; } catch { return '?'; } })();
const BUILD = (() => { let h = 'nogit'; try { h = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* */ } return h; })();
// r9：构建时间取提交时间（不是「现在」）——同一个提交本地和 CI 构建出的 bundle 一样，线上 bundle 名可预测、可核验
const BUILD_TIME = (() => { try { return new Date(execSync('git log -1 --format=%cI').toString().trim()).toISOString(); } catch { return new Date().toISOString(); } })();
export default defineConfig({
  base: './',
  define: { __BANK_VER__: JSON.stringify(BANK_VER), __BANK_RELEASE__: JSON.stringify(BANK_RELEASE), __BUILD__: JSON.stringify(BUILD), __RELEASE__: JSON.stringify('r9'), __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    // r8：测试钩子只在测试构建（ZY_TEST=1）、dev 服务器、vitest 里保留；正式构建为 false，整段代码被删除
    __TEST_HOOKS__: JSON.stringify(process.env.ZY_TEST === '1' || !!process.env.VITEST || !process.argv.includes('build')) },
  plugins: [react(), VitePWA({
    registerType: 'prompt', injectRegister: false, includeAssets: ['apple-touch-icon.png', 'icon.svg'],
    manifest: { name: '知识勇者', short_name: '知识勇者', display: 'standalone', orientation: 'landscape', background_color: '#1d2340', theme_color: '#2b3a78', start_url: './', scope: './', id: './', lang: 'zh-CN',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ] },
    workbox: { skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true, importScripts: ['sw-extra.js'], navigateFallback: 'index.html', ignoreURLParametersMatching: [/^v$/, /^utm_/], globPatterns: ['**/*.{js,css,html,svg,json,png,webp,woff2}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      // 序列帧约 4.3MB：不进预缓存，战斗时懒加载并运行时缓存（家长页可一键预下载供离线）
      globIgnores: ['anim/**', 'fx/**', 'sfx/skills/**', 'art/monsters/subjects/**', 'images/k/**'],   // 技能特效 fx/skills/ 与音效 sfx/skills/ 也只运行时缓存
      runtimeCaching: [{ urlPattern: /\/(anim|fx)\/.+\.(webp|json)$/, handler: 'CacheFirst', options: { cacheName: 'zy-anim', expiration: { maxEntries: 700 } } },
        { urlPattern: /\/sfx\/skills\/.+\.mp3$/, handler: 'CacheFirst', options: { cacheName: 'zy-sfx-skills', expiration: { maxEntries: 110 }, cacheableResponse: { statuses: [200] } } },
        { urlPattern: /\/art\/monsters\/subjects\/.+\.(webp|json)$/, handler: 'CacheFirst', options: { cacheName: 'zy-monsters', expiration: { maxEntries: 400 }, cacheableResponse: { statuses: [200] } } },
        { urlPattern: /\/images\/k\/.+\.webp$/, handler: 'CacheFirst', options: { cacheName: 'zy-kimg', expiration: { maxEntries: 100 }, cacheableResponse: { statuses: [200] } } }] },
  })],
  test: { environment: 'node' },
  preview: { host: true, port: 4173, strictPort: true, allowedHosts: true },
  server: { host: true, allowedHosts: true },
} as any);
