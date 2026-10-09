// 오프라인 캐시: 앱 화면 파일은 "인터넷 먼저, 안 되면 저장본", 라이브러리·글꼴은 "저장본 먼저".
// 데이터(Firestore)와 로그인 요청은 건드리지 않습니다 — Firestore가 자체적으로 오프라인 저장을 합니다.
const CACHE = "golf-scorebook-v31";
const SHELL = ["./", "./index.html", "./firebase-config.js", "./manifest.webmanifest",
  "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png"];
const CDN_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  // cache:"reload" = 새 버전 설치 때 보관된 옛 사본이 아니라 서버의 최신 파일을 받음
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    // cache:"no-cache" = 브라우저에 보관된 사본(GitHub Pages는 10분 보관)을 쓰기 전에 항상 서버에 새 버전이 있는지 확인
    const res = await Promise.race([fetch(req.url, { cache: "no-cache", credentials: "same-origin" }), timeout(4000)]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") return cache.match("./index.html");
    throw e;
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.includes("/__/")) return;
    e.respondWith(networkFirst(req));
  } else if (CDN_HOSTS.includes(url.hostname) &&
             (url.hostname !== "www.gstatic.com" || url.pathname.startsWith("/firebasejs/"))) {
    e.respondWith(cacheFirst(req));
  }
});

// 라운드 진행 중 알림을 누르면: 열려 있는 앱 창이 있으면 그 창으로, 없으면 앱을 새로 연다
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
