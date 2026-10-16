/* Service worker: lưu sẵn khung app để mở nhanh; dữ liệu luôn lấy mới từ máy chủ. */
const CACHE = 'eco-v1';
const SHELL = ['./', 'index.html', 'css/app.css?v=1', 'js/config.js?v=1', 'js/app.js?v=1', 'js/p-member.js?v=1', 'js/p-bod.js?v=1', 'js/p-admin.js?v=1', 'js/p-mail.js?v=1', 'assets/logo.png', 'assets/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Mạng trước, rớt mạng thì dùng bản đã lưu.
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
