// Tanpa Cloud Functions (paket Spark) tidak ada server yang bisa mengirim push FCM. Sebagai gantinya aplikasi
// menampilkan notifikasi sistem dari data realtime yang sudah dipantau (lihat NotificationsProvider). Berfungsi
// selama aplikasi/tab masih berjalan (termasuk di latar belakang), TIDAK saat browser/aplikasi benar-benar ditutup.

const KEY = 'sp-local-notify';

export type PushStatus = 'unsupported' | 'denied' | 'enabled' | 'disabled';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function localNotificationsEnabled(): boolean {
  return notificationsSupported() && Notification.permission === 'granted' && localStorage.getItem(KEY) === '1';
}

export function pushStatus(): PushStatus {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return localNotificationsEnabled() ? 'enabled' : 'disabled';
}

/** Dipanggil HANYA setelah pengguna menekan tombol (izin tidak diminta saat aplikasi dibuka). */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Izin notifikasi tidak diberikan. Aktifkan di pengaturan situs browser bila ingin menerima notifikasi.');
  localStorage.setItem(KEY, '1');
}

export function disablePush(): void {
  localStorage.removeItem(KEY);
}

/** Menampilkan notifikasi sistem lewat service worker (isi generik, tanpa isi chat). */
export async function showLocalNotification(n: { title: string; body: string; tag: string; url: string }): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(n.title, { body: n.body, tag: n.tag, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { url: n.url } });
  } catch {
    /* notifikasi tidak kritis */
  }
}
