/* Standchef Service Worker
 *
 * - Precache: Offline-Seiten (/offline, /offline/match, /offline/new) inkl. ihrer JS/CSS-Dateien, Icons
 * - Cache-first: /_next/static/** und Schriften (unveränderliche, gehashte Dateien)
 * - Stale-while-revalidate: /api/avatars/**, /api/files/**, /api/targets/**
 * - Network-first mit Cache-Fallback: Seiten (HTML) und React-Server-Component-Anfragen
 * - Nie gecacht: POST, Server Actions (Header Next-Action), /api/sync, /api/payments/**, Login/Registrierung
 * - Beim Abmelden werden alle benutzerbezogenen Caches gelöscht.
 *
 * Bei Änderungen an dieser Datei VERSION erhöhen. Name/Version der IndexedDB müssen mit
 * src/lib/offline/idb.ts übereinstimmen.
 */

const VERSION = "2026-10-28.2";
const DATA_VERSION = "v1"; // nur erhöhen, wenn sich das Format gecachter Seiten ändert

const PRECACHE = `sc-precache-${VERSION}`;
const STATIC = `sc-static-${VERSION}`;
const PAGES = `sc-pages-${DATA_VERSION}`;
const RSC = `sc-rsc-${DATA_VERSION}`;
const MEDIA = `sc-media-${DATA_VERSION}`;
const CURRENT = [PRECACHE, STATIC, PAGES, RSC, MEDIA];
const USER_CACHES = [PAGES, RSC, MEDIA];

const OFFLINE_URL = "/offline";
const SHELL_PAGES = ["/offline", "/offline/match", "/offline/new"];
const PRECACHE_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const LIMITS = { [STATIC]: 400, [PAGES]: 60, [RSC]: 120, [MEDIA]: 250 };
const NAV_TIMEOUT = 6000;
const PAGE_FRESH_MS = 60_000; // CACHE_PAGE: jüngere gecachte Seiten nicht erneut laden

// Nie über den Service Worker cachen
const NEVER = [/^\/api\/sync(\/|$)/, /^\/api\/payments(\/|$)/, /^\/api\/offline(\/|$)/, /^\/login(\/|$)/, /^\/register(\/|$)/, /^\/sw\.js$/];
const AUTH_PAGES = [/^\/login(\/|$)/, /^\/register(\/|$)/];

// ---------------------------------------------------------------------------
// Installation / Aktivierung
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  // Streng: fehlt eine Offline-Seite oder eine ihrer Dateien, schlägt die Installation fehl und der
  // bisherige Service Worker (samt seinem Offline-Cache) bleibt aktiv. Der Browser versucht es später erneut.
  event.waitUntil(precacheShell(true));
  // Kein automatisches skipWaiting: die App fragt den Benutzer («Neue Version verfügbar»).
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("sc-") && !CURRENT.includes(k)).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (e) {
          /* nicht unterstützt */
        }
      }
      await self.clients.claim();
    })(),
  );
});

/**
 * Lädt die Offline-Seiten samt der darin referenzierten statischen Dateien.
 * `strict` (Installation): jeder Fehler bei Offline-Seiten oder ihren Dateien lässt das Promise scheitern.
 */
async function precacheShell(strict) {
  const settle = (promises) => (strict ? Promise.all(promises) : Promise.allSettled(promises));
  const pre = await caches.open(PRECACHE);
  const stat = await caches.open(STATIC);
  await Promise.allSettled(
    PRECACHE_ASSETS.map(async (url) => {
      const res = await fetch(url, { cache: "reload", credentials: "same-origin" });
      if (res.ok) await pre.put(url, res);
    }),
  );
  await settle(
    SHELL_PAGES.map(async (url) => {
      const res = await fetch(url, { cache: "reload", credentials: "same-origin", redirect: "follow" });
      if (!res.ok || res.redirected) {
        if (strict) throw new Error("Offline-Seite nicht verfügbar: " + url);
        return;
      }
      const html = await res.clone().text();
      await pre.put(url, res);
      const assets = new Set();
      const re = /["'(](\/_next\/static\/[^"'()\s\\]+)/g;
      let m;
      while ((m = re.exec(html))) assets.add(m[1]);
      await settle(
        [...assets].map(async (a) => {
          if (await stat.match(a)) return;
          const r = await fetch(a, { credentials: "same-origin" });
          if (r.ok) await stat.put(a, r);
          else if (strict) throw new Error("Datei nicht verfügbar: " + a);
        }),
      );
    }),
  );
}

// ---------------------------------------------------------------------------
// Nachrichten der App
// ---------------------------------------------------------------------------

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (data.type === "CLEAR_USER_CACHES") {
    event.waitUntil(clearUserCaches());
  } else if (data.type === "CACHE_PAGE" && typeof data.url === "string") {
    event.waitUntil(cachePage(data.url));
  } else if (data.type === "REFRESH_OFFLINE_SHELL") {
    event.waitUntil(precacheShell());
  } else if (data.type === "GET_VERSION" && event.source) {
    event.source.postMessage({ type: "VERSION", version: VERSION });
  }
});

async function clearUserCaches() {
  await Promise.all(USER_CACHES.map((c) => caches.delete(c)));
}

/**
 * Per Client-Navigation erreichte Seite als HTML ablegen (sonst gäbe es nur RSC-Daten, und ein
 * Neuladen ohne Verbindung zeigte die allgemeine Offline-Seite).
 */
async function cachePage(href) {
  let url;
  try {
    url = new URL(href, self.location.origin);
  } catch (e) {
    return;
  }
  url.hash = "";
  const path = url.pathname;
  if (url.origin !== self.location.origin || path.startsWith("/offline") || path.startsWith("/api/") || path.startsWith("/_next/") || NEVER.some((re) => re.test(path))) return;
  const cache = await caches.open(PAGES);
  const hit = await cache.match(url.href, { ignoreVary: true });
  const hitDate = hit ? Date.parse(hit.headers.get("date") || "") : NaN;
  if (hit && Number.isFinite(hitDate) && Date.now() - hitDate < PAGE_FRESH_MS) return;
  try {
    const res = await fetch(url.href, { credentials: "same-origin", headers: { Accept: "text/html" } });
    if (cacheable(res) && !isLoginResponse(res) && (res.headers.get("content-type") || "").includes("text/html")) {
      if (await isSoftNotFound(res)) {
        await cache.delete(url.href);
        return;
      }
      await cache.put(url.href, res);
      await trim(PAGES);
    } else if (res.status === 404 || res.status === 410) {
      await cache.delete(url.href);
    }
  } catch (e) {
    /* offline oder Serverfehler: nächster Besuch versucht es erneut */
  }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.headers.has("Next-Action") || req.headers.has("range")) return;
  const path = url.pathname;

  if (NEVER.some((re) => re.test(path))) {
    // Login-Seite erreicht (z.B. nach dem Abmelden): benutzerbezogene Caches leeren
    if (AUTH_PAGES.some((re) => re.test(path)) && (req.mode === "navigate" || isRsc(req, url))) {
      const preload = req.mode === "navigate" && event.preloadResponse ? event.preloadResponse.catch(() => null) : Promise.resolve(null);
      event.respondWith(
        preload.then((p) => p || fetch(req)).then(
          (res) => {
            if (res.ok && !res.redirected) event.waitUntil(clearUserCaches());
            return res;
          },
          () => offlineFallback(req),
        ),
      );
    }
    return;
  }

  if (path.startsWith("/_next/static/") || /\.(woff2?|ttf|otf)$/i.test(path)) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (path.startsWith("/_next/image")) {
    event.respondWith(staleWhileRevalidate(event, req, MEDIA));
    return;
  }
  if (path.startsWith("/_next/")) return; // Dev-Server, HMR usw.

  if (/^\/api\/(avatars|files|targets)\//.test(path)) {
    event.respondWith(staleWhileRevalidate(event, req, MEDIA));
    return;
  }
  if (path.startsWith("/api/")) return;

  if (path.startsWith("/icons/") || path === "/manifest.webmanifest" || path === "/favicon.ico") {
    event.respondWith(staleWhileRevalidate(event, req, PRECACHE));
    return;
  }

  if (isRsc(req, url)) {
    event.respondWith(networkFirstRsc(event, req));
    return;
  }

  const accept = req.headers.get("accept") || "";
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(networkFirstPage(event, req, url));
  }
});

function isRsc(req, url) {
  return req.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

function cacheable(res) {
  return res && res.ok && res.type === "basic" && !res.redirected && res.status === 200;
}

/**
 * notFound() hinter einer Loading-Grenze liefert Status 200 mit der 404-Ansicht («soft 404»).
 * Solche Antworten erkennt man nur am Inhalt; sie dürfen nicht gecacht werden.
 */
async function isSoftNotFound(res) {
  try {
    return (await res.clone().text()).includes("NEXT_HTTP_ERROR_FALLBACK;404");
  } catch (e) {
    return true; // Inhalt nicht lesbar: lieber nicht cachen
  }
}

async function trim(cacheName) {
  const limit = LIMITS[cacheName];
  if (!limit) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((k) => cache.delete(k)));
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const pre = await caches.match(req, { ignoreVary: true });
  if (pre) return pre;
  const res = await fetch(req);
  if (cacheable(res)) {
    await cache.put(req, res.clone());
    trim(cacheName);
  }
  return res;
}

async function staleWhileRevalidate(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreVary: true });
  const network = fetch(req)
    .then(async (res) => {
      if (cacheable(res)) {
        await cache.put(req, res.clone());
        trim(cacheName);
      }
      return res;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(network);
    return hit;
  }
  const res = await network;
  return res || new Response("", { status: 504, statusText: "Offline" });
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function isLoginResponse(res) {
  try {
    return AUTH_PAGES.some((re) => re.test(new URL(res.url).pathname));
  } catch (e) {
    return false;
  }
}

/** Seiten: Netz zuerst (mit Timeout bei schlechtem Empfang), sonst Cache, sonst Offline-Seite. */
async function networkFirstPage(event, req, url) {
  const cache = await caches.open(PAGES);
  const network = (async () => {
    const preload = event.preloadResponse ? await event.preloadResponse.catch(() => null) : null;
    const res = preload || (await fetch(req));
    if (cacheable(res) && !isLoginResponse(res) && (res.headers.get("content-type") || "").includes("text/html")) {
      if (url.pathname.startsWith("/offline")) {
        // Offline-Seiten nur einmal (ohne Query) im Precache halten
        const pre = await caches.open(PRECACHE);
        await pre.put(url.pathname, res.clone());
      } else {
        const copy = res.clone();
        // Im Hintergrund prüfen, damit die Antwort nicht auf den ganzen Inhalt warten muss
        event.waitUntil(
          isSoftNotFound(copy)
            .then((notFound) => (notFound ? cache.delete(url.href) : cache.put(url.href, copy).then(() => trim(PAGES))))
            .catch(() => null),
        );
      }
    } else if (res && (res.status === 404 || res.status === 410)) {
      // Seite gibt es nicht mehr: veraltete Kopie entfernen
      event.waitUntil(cache.delete(url.href).catch(() => null));
    }
    return res;
  })();
  event.waitUntil(network.catch(() => null));

  try {
    const cached = url.pathname.startsWith("/offline")
      ? await caches.match(url.pathname, { ignoreSearch: true, ignoreVary: true })
      : await cache.match(url.href, { ignoreVary: true });
    // Mit Cache: höchstens NAV_TIMEOUT auf das Netz warten; ohne Cache: auf das Netz warten
    return cached ? await withTimeout(network, NAV_TIMEOUT).catch(() => cached) : await network;
  } catch (e) {
    return offlineFallback(req, url);
  }
}

async function offlineFallback(req, url) {
  url = url || new URL(req.url);
  const cached = await caches.match(url.href, { ignoreVary: true });
  if (cached) return cached;
  // Offline-Seiten: Query-Parameter ignorieren (z.B. /offline/match?key=…)
  if (url.pathname.startsWith("/offline")) {
    const shell = await caches.match(url.pathname, { ignoreSearch: true, ignoreVary: true });
    if (shell) return shell;
  }
  // Durchgang ohne gespeicherte Seite: direkt zur Offline-Erfassung (liest den Stand aus IndexedDB)
  const matchPage = /^\/scores\/matches\/([^/]+)\/?$/.exec(url.pathname);
  if (matchPage && matchPage[1] !== "new" && req.mode === "navigate" && (await caches.match("/offline/match", { ignoreSearch: true, ignoreVary: true }))) {
    return Response.redirect(new URL("/offline/match?key=" + encodeURIComponent("s:" + matchPage[1]), self.location.origin).href, 302);
  }
  const offline = await caches.match(OFFLINE_URL, { ignoreVary: true });
  if (offline) return offline;
  return new Response(
    '<!doctype html><html lang="de-CH"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Standchef</title>' +
      '<body style="font-family:system-ui,sans-serif;background:#f4f2ee;color:#151515;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center">' +
      '<div><h1 style="font-size:22px">Keine Verbindung</h1><p>Diese Seite ist offline noch nicht verfügbar.</p><p><a href="/" style="color:#d6232d">Erneut versuchen</a></p></div></body></html>',
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/** React-Server-Component-Anfragen (Client-Navigation): Netz zuerst, sonst Cache. */
async function networkFirstRsc(event, req) {
  const prefetch = req.headers.has("Next-Router-Prefetch");
  const cache = await caches.open(RSC);
  try {
    const res = await fetch(req);
    if (!prefetch && cacheable(res) && !isLoginResponse(res)) {
      const copy = res.clone();
      event.waitUntil(
        isSoftNotFound(copy)
          .then((notFound) => (notFound ? cache.delete(req) : cache.put(req, copy).then(() => trim(RSC))))
          .catch(() => null),
      );
    }
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    if (hit) return hit;
    // Ohne Treffer: Fehler zurückgeben, Next.js navigiert dann klassisch (und bekommt HTML aus dem Cache)
    return Response.error();
  }
}

// ---------------------------------------------------------------------------
// Background Sync (Ergänzung; die App synchronisiert auch selbst)
// ---------------------------------------------------------------------------

self.addEventListener("sync", (event) => {
  if (event.tag !== "standchef-sync") return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.length) {
        windows.forEach((c) => c.postMessage({ type: "SYNC_NOW" }));
        return;
      }
      await swFlush();
    })(),
  );
});

const DB_NAME = "standchef-offline";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "key" }).createIndex("createdAt", "createdAt");
      if (!db.objectStoreNames.contains("snapshot")) db.createObjectStore("snapshot", { keyPath: "tenantId" });
      if (!db.objectStoreNames.contains("matches")) db.createObjectStore("matches", { keyPath: "key" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqP(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

/** Ausstehende Operationen senden, wenn keine App-Fenster offen sind. Zuordnungen übernimmt die App später. */
async function swFlush() {
  const db = await openDb();
  try {
    let tx = db.transaction(["outbox", "meta"], "readonly");
    const sessionRec = await reqP(tx.objectStore("meta").get("session"));
    const all = await reqP(tx.objectStore("outbox").getAll());
    await txDone(tx);
    const session = sessionRec && sessionRec.value;
    if (!session) return;
    const now = Date.now();
    const ops = all
      .filter((o) => o.userId === session.userId && !o.failed && (!o.nextAttemptAt || o.nextAttemptAt <= now))
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 40);
    if (!ops.length) return;

    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ ops: ops.map((o) => ({ id: o.id, type: o.type, tenantId: o.tenantId, userId: o.userId, payload: o.payload })) }),
    });
    if (res.status === 401) return;
    if (!res.ok) throw new Error("sync failed " + res.status); // Browser versucht es später erneut
    const data = await res.json();
    const byId = new Map((data.results || []).map((r) => [r.id, r]));

    tx = db.transaction(["outbox", "meta"], "readwrite");
    const outbox = tx.objectStore("outbox");
    const meta = tx.objectStore("meta");
    const acksRec = (await reqP(meta.get("swAcks"))) || { key: "swAcks", value: [] };
    for (const op of ops) {
      const r = byId.get(op.id);
      if (!r) continue;
      const current = await reqP(outbox.get(op.key));
      if (r.ok) {
        r.serverTime = data.serverTime;
        // Die App bereinigt beim nächsten Start die lokalen Markierungen und Zuordnungen
        acksRec.value.push({ op, result: r });
        if (current && current.id === op.id) await reqP(outbox.delete(op.key));
      } else if (current && current.id === op.id) {
        current.attempts = (current.attempts || 0) + 1;
        current.lastError = r.error || "Fehler";
        if (r.retry === false) current.failed = true;
        else current.nextAttemptAt = Date.now() + Math.min(2000 * Math.pow(2, current.attempts), 300000);
        await reqP(outbox.put(current));
      }
    }
    await reqP(meta.put(acksRec));
    await txDone(tx);
  } finally {
    db.close();
  }
}
