/* Service worker Agrilonic — naikkan VERSION setiap kali index.html / file Plus diubah */
const VERSION = 'agrilonic-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './agrilonic-plus.css', './agrilonic-plus.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
const CDN_HOSTS = ['cdn.tailwindcss.com','cdn.jsdelivr.net','cdnjs.cloudflare.com','fonts.googleapis.com','fonts.gstatic.com'];

self.addEventListener('install', e => {
  // Satu file gagal diambil tidak boleh membatalkan seluruh pemasangan offline
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Halaman: jaringan dulu, cadangan cache saat offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // File sendiri & CDN: stale-while-revalidate
  if (url.origin === location.origin || CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
      return hit || net;
    }));
  }
  // API lain (cuaca, AI, Wikipedia, counter): langsung ke jaringan
});
// Klik notifikasi pengingat → fokus ke aplikasi yang terbuka, atau buka baru
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./?m=0&a=pengingat');
  }));
});
