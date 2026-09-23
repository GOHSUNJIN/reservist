const CACHE = 'ops-v190';
const APP_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.json',
  './assets/icon.svg',
  './assets/apple-touch-icon.png',
  './assets/icon-512.png',
  './js/config.js',
  './js/utils.js',
  './js/state.js',
  './js/db-client.js',
  './js/db.js',
  './js/db/auth.js',
  './js/db/attendance.js',
  './js/db/batches.js',
  './js/db/leaves.js',
  './js/db/no-report-days.js',
  './js/db/personnel.js',
  './js/db/realtime.js',
  './js/db/signups.js',
  './js/db/storage.js',
  './js/db/audit.js',
  './js/handlers/auth.js',
  './js/handlers/init.js',
  './js/handlers/batch.js',
  './js/handlers/checkin.js',
  './js/handlers/roster.js',
  './js/handlers/requests.js',
  './js/handlers/people.js',
  './js/handlers/member_search.js',
  './js/handlers/signups.js',
  './js/handlers/account.js',
  './js/handlers/admin_mgmt.js',
  './js/handlers/misc.js',
  './js/handlers/export.js',
  './js/builders/auth.js',
  './js/builders/nav.js',
  './js/builders/checkin.js',
  './js/builders/calendar.js',
  './js/builders/briefings.js',
  './js/builders/account.js',
  './js/builders/admin/index.js',
  './js/builders/admin/batch.js',
  './js/builders/admin/roster.js',
  './js/builders/admin/people.js',
  './js/component.js',
  './js/support.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith('http')) return;
  const url = new URL(e.request.url);

  // Network-first for HTML - always serve the latest index so config changes
  // (coordinates, props) take effect immediately without needing a hard refresh
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Always network-first for Supabase and external CDNs
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Network-first for local JS and CSS - always fetch fresh, fall back to cache offline
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for CSS and images
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      });
    })
  );
});
