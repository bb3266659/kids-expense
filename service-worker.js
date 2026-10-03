'use strict';

const RELEASE = '1.0.0';

/* แยกชื่อแคชตามขอบเขตแอป ไม่ล้างแคชของโปรเจกต์อื่น */
const PREFIX = `breathe-fresh:${self.registration.scope}:`;
const CACHE_NAME = `${PREFIX}${RELEASE}`;

const ASSETS = [
  './index.html',
  './ui.css',
  './main.js',
  './manifest.webmanifest',
  './icon.svg'
];

const assetURLs = new Set(
  ASSETS.map(path => new URL(path, self.registration.scope).href)
);

const indexURL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    /* หากมีไฟล์ใดโหลดไม่สำเร็จ จะไม่ถือว่าติดตั้งชุดนี้สำเร็จ */
    await cache.addAll(
      ASSETS.map(path => new Request(
        new URL(path, self.registration.scope),
        { cache: 'reload' }
      ))
    );

    /* ไม่ skipWaiting อัตโนมัติ เพื่อไม่เปลี่ยนรุ่นระหว่างผู้ใช้ฝึก */
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();

    await Promise.all(
      names
        .filter(name => name.startsWith(PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope)
  ) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const saved = await cache.match(indexURL);
      return saved || fetch(request);
    })());
    return;
  }

  /* ดูแลเฉพาะไฟล์แอปที่ระบุ ไม่แคชทุก request */
  if (!assetURLs.has(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(request);

    /* ไม่คืน HTML แทนไฟล์ JavaScript */
    return saved || fetch(request);
  })());
});