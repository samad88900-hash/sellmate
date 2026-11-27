/* SellMate service worker — offline cache for the app shell. */
const CACHE = "sellmate-v57";
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./lang.js",
  "./help-kb.js",
  "./help-chat.js",
  "./supabase-config.js",
  "./privacy.html",
  "./terms.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.href === SUPABASE_JS) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const appShell = url.pathname === "/" || url.pathname.endsWith("/index.html");
    const privacy = url.pathname.endsWith("/privacy") || url.pathname.endsWith("/privacy.html");
    const terms = url.pathname.endsWith("/terms") || url.pathname.endsWith("/terms.html");
    const offlineFile = privacy ? "./privacy.html" : terms ? "./terms.html" : appShell ? "./index.html" : null;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && appShell) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          const direct = await caches.match(request);
          if (direct) return direct;
          if (offlineFile) {
            const fallback = await caches.match(offlineFile);
            if (fallback) return fallback;
          }
          return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
