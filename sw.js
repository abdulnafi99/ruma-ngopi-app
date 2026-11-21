/* Service worker — cache app shell supaya boleh dibuka luar talian.
   Naikkan VERSION setiap kali anda kemas kini index.html. */
const VERSION = "rumangopi-v4.0.0";
const SHELL = ["./", "./index.html", "./admin.html", "./menu.js", "./shop.js", "./firebase-config.js", "./firebase-sync.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/logo-circle.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Halaman: network dahulu, fallback cache. Aset lain: cache dahulu.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (req.url.startsWith(self.location.origin) || req.url.includes("fonts.g") || req.url.includes("gstatic.com/firebasejs/"))) {
      const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy));
    }
    return r;
  }).catch(() => hit)));
});

/* ---------- Push notification ---------- */
self.addEventListener("push", e => {
  let d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(_){ d = { body: e.data && e.data.text() }; }
  const title = d.title || "RumaNgopi";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    vibrate: [80, 40, 80],
    data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const page = new URL(url).pathname;
    const same = list.find(c => new URL(c.url).pathname === page) || list.find(c => c.url.startsWith(self.registration.scope));
    if(same){ return same.navigate ? same.navigate(url).then(c => (c || same).focus()).catch(() => same.focus()) : same.focus(); }
    return self.clients.openWindow(url);
  }));
});
