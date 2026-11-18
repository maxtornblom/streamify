/* Streamify service worker.
 *
 * Scope is "/" (served from the site root). It only caches the app shell and
 * cosmetic third-party assets. API routes (/search, /home, /audio, ...) are
 * deliberately NOT handled: they are never matched below, so the browser
 * talks to the network directly (important for <audio> Range requests).
 */
const VERSION = "streamify-v2";
const SHELL = VERSION + "-shell";
const RT = VERSION + "-rt";

const SHELL_URLS = [
  "/", "/style.css", "/app.js", "/logo.svg", "/manifest.webmanifest",
  "/offline.js", "/offline.css", "/settings.js", "/settings.css",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png",
];
const SHELL_PATHS = new Set(SHELL_URLS);

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const isCoverHost = (h) => h.endsWith(".dzcdn.net") || h === "i.ytimg.com" || h.endsWith(".ytimg.com");

const NAV_TIMEOUT_MS = 3000;
const COVER_MAX_ENTRIES = 150;

// Only cache clean 200s. In opt-in LAN mode the backend answers 401/302 for
// requests without the auth cookie; caching those would poison the shell.
const cacheable = (r) => r && r.ok && !r.redirected && r.status === 200;

self.addEventListener("install", (event) => {
  // Fail soft: fetch each URL on its own so a missing icon, a 401 or a 302
  // never rejects the install. No skipWaiting here: the page may be playing
  // audio and a surprise controller swap is not worth it (see SKIP_WAITING).
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.allSettled(SHELL_URLS.map(async (url) => {
      const r = await fetch(url, { credentials: "same-origin", cache: "reload" });
      if (cacheable(r)) await cache.put(url, r);
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Drop caches from older versions (and only ours: other apps on the same
    // origin might own differently-prefixed caches).
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n.startsWith("streamify-") && n !== SHELL && n !== RT)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") self.skipWaiting();
  else if (type === "GET_VERSION" && event.source) {
    event.source.postMessage({ type: "VERSION", version: VERSION });
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Range requests (audio seeking) and non-GETs are never ours: answering a
  // partial 206 from a SW is a classic bug.
  if (req.method !== "GET" || req.headers.has("range")) return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") {
      event.respondWith(navigation(req));
    } else if (SHELL_PATHS.has(url.pathname)) {
      event.respondWith(networkFirst(req, url.pathname));
    }
    return; // every other same-origin request (the API) falls through
  }

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
  } else if (isCoverHost(url.hostname)) {
    event.respondWith(coverCacheFirst(req));
  }
});

// Network-first with a short timeout so a flaky connection still opens the
// app instantly from cache. Queries like /?t=... or /?view=... all map to the
// single cached "/" shell (the app routes client-side).
async function navigation(req) {
  const cached = () => caches.match("/", { ignoreSearch: true });
  const net = fetch(req).then(async (r) => {
    if (cacheable(r)) {
      const copy = r.clone();
      caches.open(SHELL).then((c) => c.put("/", copy)).catch(() => {});
    }
    return r;
  });
  net.catch(() => {}); // avoid unhandled rejection if the timer wins
  try {
    const timeout = new Promise((res) => setTimeout(() => res(null), NAV_TIMEOUT_MS));
    const r = await Promise.race([net, timeout]);
    if (r && cacheable(r)) return r;
    // Timed out, or a non-ok/redirected response: prefer the cached shell,
    // otherwise show whatever the network gave us.
    const c = await cached();
    if (c) return c;
    return r || await net;
  } catch (_) {
    const c = await cached();
    if (c) return c;
    return Response.error();
  }
}

// Network-first so edits to app.js/style.css show up on a normal reload; the
// cache is only the offline fallback.
async function networkFirst(req, key) {
  const cache = await caches.open(SHELL);
  try {
    const r = await fetch(req);
    if (cacheable(r)) cache.put(key, r.clone());
    if (r.ok) return r;
    return (await cache.match(key)) || r;
  } catch (e) {
    const c = await cache.match(key);
    if (c) return c;
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RT);
  const hit = await cache.match(req);
  const refresh = fetch(req).then((r) => {
    if (r && (r.ok || r.type === "opaque") && r.status !== 206) cache.put(req, r.clone());
    return r;
  });
  if (hit) { refresh.catch(() => {}); return hit; }
  return refresh;
}

async function coverCacheFirst(req) {
  const cache = await caches.open(RT);
  const hit = await cache.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if ((r.ok || r.type === "opaque") && r.status !== 206) {
    await cache.put(req, r.clone());
    trim(cache);
  }
  return r;
}

// Cache.keys() returns insertion order, so deleting from the front is FIFO.
// The RT cache also holds fonts; they are few and small, so one shared cap is fine.
async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - COVER_MAX_ENTRIES; i++) await cache.delete(keys[i]);
}
