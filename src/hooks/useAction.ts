import { useCallback, useState } from 'react';
import { describeSocialError } from '@/features/friends/friends.service';

/** Menjalankan aksi async dengan status sibuk dan pesan error seragam. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(describeSocialError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, run, clearError: () => setError(null) };
}
