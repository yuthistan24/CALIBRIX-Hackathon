const CACHE_NAME = 'mindguard-shell-v5';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/student-login.html',
  '/student-register.html',
  '/counselor-login.html',
  '/counselor-register.html',
  '/admin-login.html',
  '/assessment.html',
  '/dashboard.html',
  '/ai-chat.html',
  '/counselor-dashboard.html',
  '/counselor-chat.html',
  '/admin-dashboard.html',
  '/css/styles.css',
  '/js/api.js',
  '/js/activity-tracker.js',
  '/js/dashboard.js',
  '/js/admin-dashboard.js',
  '/js/counselor-dashboard.js',
  '/js/assessment.js',
  '/js/ai-chat.js',
  '/js/counselor-chat.js',
  '/js/auth-page.js',
  '/js/mobile-shell.js',
  '/js/landing-scene.js',
  '/assets/icon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }

        return caches.match('/index.html');
      })
  );
});
