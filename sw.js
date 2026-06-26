/* ════════════════════════════════════════
   DAILY BRIEF — Service Worker
   Caches app shell for offline support
════════════════════════════════════════ */

const CACHE = 'daily-brief-v5';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network-first for API calls, cache-first for app shell
  if (e.request.url.includes('supabase.co') || e.request.url.includes('jsdelivr')) {
    return; // Let these go straight to network
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
