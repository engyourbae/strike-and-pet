// Dimuat oleh service worker utama (workbox importScripts). Menampilkan notifikasi push tanpa SDK Firebase.
// Isi pesan sengaja generik (tanpa isi chat) demi privasi.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = {}; }
    const n = payload.notification || {};
    const d = payload.data || {};
    // Jika aplikasi sedang terlihat, notifikasi dalam aplikasi sudah cukup.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((c) => c.visibilityState === 'visible')) return;
    await self.registration.showNotification(n.title || d.title || 'STRIKE & PET', {
      body: n.body || d.body || '',
      icon: 'assets/icon-192.png',
      badge: 'assets/icon-192.png',
      tag: d.tag || undefined,
      data: { url: d.url || '' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '', self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if ('focus' in c) {
        if ('navigate' in c) { try { await c.navigate(target); } catch (e) { /* abaikan */ } }
        return c.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
