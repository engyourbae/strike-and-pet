import { useTheme } from '@/hooks/useTheme';
import type { ThemePreference } from '@/utils/theme';

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'light', label: 'Terang', hint: 'Tampilan default.' },
  { value: 'dark', label: 'Gelap', hint: 'Nyaman untuk cahaya redup.' },
  { value: 'system', label: 'Ikuti sistem', hint: 'Mengikuti pengaturan perangkat.' },
];

export function ThemeSettingsPage() {
  const { preference, setPreference } = useTheme();
  return (
    <>
      <h1>Tema</h1>
      <div className="seg" role="radiogroup" aria-label="Pilihan tema">
        {OPTIONS.map((o) => (
          <button key={o.value} role="radio" aria-checked={preference === o.value} onClick={() => setPreference(o.value)}>
            <strong>{o.label}</strong>
            <div className="field-hint">{o.hint}</div>
          </button>
        ))}
      </div>
    </>
  );
}
