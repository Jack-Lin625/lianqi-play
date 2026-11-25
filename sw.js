/* =========================================================
 * sw.js — service worker（路線圖 C4，PLAN.md 2.26）：離線也能開遊戲
 *
 * - 安裝時預先快取：index.html 裡的所有腳本與樣式（從 index.html 讀出來，不用手動維護清單）＋ ASSETS
 * - 之後同一網站的請求都先用快取（快取沒有才上網，上網拿到的也存進快取）
 * - VERSION 要和 config.js 的 CONFIG.app.version 一樣（tests/pwa.test.js 會檢查）；發布新版時兩個一起改，
 *   瀏覽器發現 sw.js 變了就會下載新版，畫面顯示「有新版本」，玩家按下去才換（不會在戰鬥中自動重新整理）
 * - 只在 https 或 localhost 註冊（pwa.js）；試玩頁（claude.ai 的框架）、直接開檔案、測試的手動推進模式都不註冊
 * ========================================================= */
const VERSION = '1.2.0';
const CACHE = 'lianqi-' + VERSION;
const ASSETS = [
  './',
  'index.html',
  'data/equipment.json',
  'manifest.webmanifest',
  'fonts/lxgw-wenkai-tc-400.woff2',
  'fonts/lxgw-wenkai-tc-700.woff2',
  'fonts/noto-serif-tc-400.woff2',
  'fonts/noto-serif-tc-700.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const html = await (await fetch('index.html', { cache: 'no-cache' })).text();
      const linked = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((u) => !/^(https?:|data:)/.test(u));
      const cache = await caches.open(CACHE);
      await cache.addAll([...new Set([...ASSETS, ...linked])].map((u) => new Request(u, { cache: 'no-cache' })));
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('lianqi-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

// 頁面按「更新」時才切換到新版
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'VERSION' && event.ports[0]) event.ports[0].postMessage(VERSION);
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // 開頁面（網址可能帶 ?參數）一律用快取的 index.html
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await cache.match('index.html');
        if (shell) return shell;
      }
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })()
  );
});
