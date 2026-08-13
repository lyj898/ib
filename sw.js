// Stale-while-revalidate service worker: instant loads from cache, refresh in background.
const CACHE = "sg-cache-v13";
const SHELL = [
  "./",
  "index.html",
  "subject.html",
  "practice.html",
  "review.html",
  "exam.html",
  "assess.html",
  "path.html",
  "hub.html",
  "manifest.webmanifest",
  "assets/style.css",
  "assets/app.js",
  "assets/srs.js",
  "assets/home.js",
  "assets/notes.js",
  "assets/practice.js",
  "assets/review.js",
  "assets/exam.js",
  "assets/assess.js",
  "assets/path.js",
  "assets/hub.js",
  "assets/logo.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/apple-touch-icon.png",
  "data/search-index.json",
  "data/units.json",
  "data/chinese.json",
  "data/chemistry.json",
  "data/physics.json",
  "data/geography.json",
  "data/history.json",
];

self.addEventListener("install", (e) => {
  // bypass the HTTP cache so a new SW version always precaches fresh files
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        Promise.all(
          SHELL.map((u) =>
            fetch(new Request(u, { cache: "no-cache" })).then((res) => {
              if (res.ok) return c.put(u, res);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const cacheable =
    url.origin === location.origin ||
    url.hostname.endsWith("fonts.googleapis.com") ||
    url.hostname.endsWith("fonts.gstatic.com");
  if (!cacheable) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      // no-cache: revalidate against the server instead of the HTTP cache,
      // so background refreshes actually pick up new deploys
      const network = fetch(new Request(e.request, { cache: "no-cache" }))
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
