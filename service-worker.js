/* VERTEX PWA — offline app shell + safe runtime asset cache */
'use strict';
const CACHE_VERSION = 'vertex-pwa-v2';
const APP_CACHE = `${CACHE_VERSION}-app`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.webmanifest',
  './vertex-masterpiece-bg.png',
  './vertex-masterpiece-bg-mobile.png',
  './icons/vertex-192.png',
  './icons/vertex-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    // A missing optional asset must not prevent the whole app from installing.
    await Promise.all(APP_SHELL.map(async path => {
      try { await cache.add(new Request(path, { cache: 'reload' })); }
      catch (error) { console.warn('[VERTEX SW] Cache skipped:', path, error); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('vertex-pwa-') && ![APP_CACHE, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isCacheableAsset(url) {
  return url.origin === self.location.origin ||
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!isCacheableAsset(url)) return;

  // HTML: prefer fresh content, but serve the installed app when offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) {
          const cache = await caches.open(APP_CACHE);
          cache.put('./index.html', fresh.clone());
        }
        return fresh;
      } catch (_) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || new Response('VERTEX offline: ilova keshi topilmadi. Internetga ulanib sahifani bir marta oching.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // Local app files and static CDN assets: cache-first, then refresh cache.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(request);
          if (fresh && (fresh.ok || fresh.type === 'opaque')) {
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, fresh.clone());
          }
        } catch (_) {}
      })());
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const fallback = await caches.match(request);
      if (fallback) return fallback;
      throw error;
    }
  })());
});
