const CACHE_NAME = "schoolflow-static-v1";
const CACHEABLE = /\.(js|css|png|svg|ico|jpg|jpeg|webp|woff2?)$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never intercept mutations — only GET is ever safe to serve from cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept cross-origin requests (Supabase, etc.) — this alone
  // keeps every API/data call untouched regardless of its exact path.
  if (url.origin !== self.location.origin) return;

  // Only static assets — never HTML navigations, so a page can never be
  // served with data that's gone stale.
  const isManifest = url.pathname === "/manifest.webmanifest";
  if (!CACHEABLE.test(url.pathname) && !isManifest) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? Response.error())),
  );
});
