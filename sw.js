// MonArka Service Worker
// Simple: cache assets for offline, push notifications, no update complexity.
// Updates handled by version.json polling in the app itself.

const CACHE = 'monarka-v1';
const PRECACHE = ['./manifest.json', './icon-192.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // NEVER cache: HTML, version.json, API calls
  if(url.pathname.endsWith('.html') ||
     url.pathname.endsWith('/') ||
     url.pathname.endsWith('version.json') ||
     url.hostname.includes('groq.com') ||
     url.hostname.includes('googleapis.com') ||
     url.hostname.includes('workers.dev')){
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else (icons, fonts, manifest)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'MonArka', body: 'Tap to open' };
  try { data = e.data.json(); } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/monarka/icon-192.png',
      badge: '/monarka/icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: '/monarka/' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const existing = cls.find(c => c.url.includes('monarka'));
      if(existing) return existing.focus();
      return clients.openWindow('/monarka/');
    })
  );
});

// Handle SKIP_WAITING from app
self.addEventListener('message', e => {
  if(e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
