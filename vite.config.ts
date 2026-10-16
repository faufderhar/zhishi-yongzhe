import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: './',
  plugins: [react(), VitePWA({
    registerType: 'prompt', includeAssets: ['apple-touch-icon.png', 'icon.svg'],
    manifest: { name: '知识勇者', short_name: '知识勇者', display: 'standalone', orientation: 'landscape', background_color: '#1d2340', theme_color: '#2b3a78', start_url: './', scope: './', id: './', lang: 'zh-CN',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ] },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,json,png,webp,woff2}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      // 序列帧约 4.3MB：不进预缓存，战斗时懒加载并运行时缓存（家长页可一键预下载供离线）
      globIgnores: ['anim/**', 'fx/**', 'sfx/skills/**'],   // 技能特效 fx/skills/ 与音效 sfx/skills/ 也只运行时缓存
      runtimeCaching: [{ urlPattern: /\/(anim|fx)\/.+\.(webp|json)$/, handler: 'CacheFirst', options: { cacheName: 'zy-anim', expiration: { maxEntries: 320 } } },
        { urlPattern: /\/sfx\/skills\/.+\.mp3$/, handler: 'CacheFirst', options: { cacheName: 'zy-sfx-skills', expiration: { maxEntries: 110 }, cacheableResponse: { statuses: [200] } } }] },
  })],
  test: { environment: 'node' },
  preview: { host: true, port: 4173, strictPort: true, allowedHosts: true },
  server: { host: true, allowedHosts: true },
} as any);
