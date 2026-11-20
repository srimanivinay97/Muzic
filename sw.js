// ============================================================
// Service worker
// Runs in the background for the app. It does two jobs:
// 1. Always fetches the newest app files from GitHub when online,
//    so a reload shows your latest push without re-adding the app.
// 2. Keeps a copy of those files, so the app still opens offline.
// ============================================================

const CACHE = 'glass-music-v3';
const CORE = ['./', './index.html', './style.css', './app.js', './manifest.json', './apple-touch-icon.png', './icon-192.png'];
const CDN_HOST = 'cdnjs.cloudflare.com';

// Install: save the core files, then take over right away instead of waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        CORE.map((url) =>
          fetch(url, { cache: 'no-store' })
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null) // One missing file must not stop the install
        )
      )
    )
  );
  self.skipWaiting();
});

// Activate: delete caches from older versions, and control open pages immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // App files: network first, cached copy only when offline
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, url));
    return;
  }

  // The tag-reading library never changes, so the cached copy is used first
  if (url.hostname === CDN_HOST) {
    event.respondWith(cacheFirst(req));
  }
  // Everything else (such as blob: song links) is left to the browser
});

async function networkFirst(req, url) {
  const cache = await caches.open(CACHE);
  try {
    // The URL string is used instead of the request, because page navigations
    // can't be copied with new options. "no-store" skips the browser's HTTP cache.
    const res = await fetch(url.href, { cache: 'no-store', credentials: 'same-origin' });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const page = await cache.match('./index.html');
      if (page) return page;
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  // A plain <script> tag from another site gives an "opaque" response, which is still safe to keep
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
