// MonArka Service Worker
// Strategy: network-first for HTML (always get latest), cache-first for assets

// Version is injected automatically at deploy time via GitHub Actions
// Falls back to timestamp if not injected
const VERSION = 'monarka-1779692101';
const ASSETS = ['./manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // Delete ALL old caches when new version activates
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== VERSION).map(k => {
          console.log('[MonArka SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // take control immediately
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // ── index.html → NETWORK FIRST, fallback to cache ──────────────────────
  // This ensures you always get the latest version on next open
  if (url.pathname.endsWith('/') ||
      url.pathname.endsWith('/index.html') ||
      url.pathname.includes('monarka') && url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Update cache with fresh version
          const clone = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request)) // offline fallback
    );
    return;
  }

  // ── API calls → network only, never cache ─────────────────────────────
  if (url.hostname.includes('groq.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('workers.dev') ||
      url.hostname.includes('fonts.gstatic')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // ── Everything else → cache first, fallback to network ────────────────
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});

// ── PUSH NOTIFICATION HANDLER ─────────────────────────────────────────────
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

// ── AUTO-UPDATE CHECK ─────────────────────────────────────────────────────
// Tell all open tabs to reload when a new version activates
self.addEventListener('activate', e => {
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: VERSION }));
    })
  );
});

self.addEventListener('message', e => {
  if(e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
