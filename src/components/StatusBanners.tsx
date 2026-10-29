import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function OnlineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div className="banner banner--warn" role="status">
      <p>Kamu sedang offline. Perubahan baru tersimpan saat koneksi kembali.</p>
    </div>
  );
}

export function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    // Cek versi baru tiap jam selama aplikasi terbuka.
    onRegisteredSW(_url, reg) {
      if (reg) window.setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  function apply() {
    // Memuat ulang menghentikan berbagi lokasi; minta persetujuan dulu. Antrean unggah tersimpan di IndexedDB.
    if (document.querySelector('.share-bar') && !window.confirm('Memperbarui akan menghentikan berbagi lokasi. Lanjutkan?')) return;
    void updateServiceWorker(true);
  }
  return (
    <div className="banner" role="status">
      <p>Versi baru tersedia.</p>
      <button className="btn btn--primary" onClick={apply}>Perbarui</button>
    </div>
  );
}
