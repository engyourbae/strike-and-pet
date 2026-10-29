import { useState } from 'react';
import { useAction } from '@/hooks/useAction';
import type { ReportReason } from '@/types/social';
import { reportUser } from './friends.service';

export const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'pelecehan', label: 'Pelecehan' },
  { value: 'akun_palsu', label: 'Akun palsu' },
  { value: 'lainnya', label: 'Lainnya' },
];

export function ReportMenu({ myUid, targetUid }: { myUid: string; targetUid: string }) {
  const { busy, error, run } = useAction();
  const [sent, setSent] = useState(false);
  if (sent) return <p className="field-hint">Laporan terkirim. Terima kasih.</p>;
  return (
    <details className="report">
      <summary>Laporkan</summary>
      <div className="row">
        {REASONS.map((r) => (
          <button key={r.value} className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void run(() => reportUser(myUid, targetUid, r.value)).then((ok) => ok && setSent(true))}>
            {r.label}
          </button>
        ))}
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </details>
  );
}
