// Link Milano — Service Worker
// Caches the app shell for fast loading

const CACHE = 'linkmi-v3';
const SHELL = [
  '/',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Push Notifications ───────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  const title = data.title || 'Link Milano';
  const body  = data.body  || 'Nuovo lead ricevuto';
  const count = data.badge || 0;
  const url   = data.url   || '/?admin';

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      data:  { url },
      vibrate: [200, 100, 200]
    }).then(() => {
      if ('setAppBadge' in self.navigator) return self.navigator.setAppBadge(count);
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/?admin';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          // Navigate the existing window to the deep-link URL, then focus.
          // The SPA handles ?lead= after leadsReady resolves — no race condition.
          if ('navigate' in client) await client.navigate(url);
          await client.focus();
          return;
        }
      }
      // No window open — launch fresh with deep link URL
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', e => {
  // Network-first for HTML (always get latest), cache-first for assets
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    // Network first — ensures fresh admin data
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // Cache first for icons etc.
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
