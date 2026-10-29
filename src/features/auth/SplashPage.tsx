import { Logo } from '@/components/Logo';
import { Skeleton } from '@/components/Skeleton';

export function SplashPage() {
  return (
    <div className="center-page" role="status" aria-label="Memuat aplikasi">
      <div className="center-card">
        <Logo size={72} />
        <h1 style={{ marginTop: 16 }}>STRIKE &amp; PET</h1>
        <div className="stack" style={{ marginTop: 24 }}>
          <Skeleton height={14} width="70%" style={{ margin: '0 auto' }} />
          <Skeleton height={14} width="45%" style={{ margin: '0 auto' }} />
        </div>
      </div>
    </div>
  );
}
