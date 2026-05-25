// MonArka Service Worker v4
// Strategy: NEVER cache index.html — always fetch fresh from network
// Cache only static assets (icons, manifest)

const CACHE = 'monarka-v4';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['./manifest.json', './icon-192.png', './apple-touch-icon.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // NEVER cache — always fetch fresh:
  // index.html, any .html, version.json, all API calls
  const neverCache =
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('version.json') ||
    url.hostname.includes('groq.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('fonts.googleapis') ||
    url.hostname.includes('fonts.gstatic');

  if (neverCache) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(e.request)) // offline fallback only
    );
    return;
  }

  // Cache-first for icons, manifest etc
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
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
      if (existing) return existing.focus();
      return clients.openWindow('/monarka/');
    })
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
