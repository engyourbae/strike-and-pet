import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Illustration, type IllustrationKind } from '@/components/Illustration';

export const ONBOARDED_KEY = 'sp-onboarded';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

const SLIDES: { kind: IllustrationKind; title: string; text: string }[] = [
  { kind: 'pet', title: 'Rawat Pet bersama', text: 'Beri makan, ajak main, dan jaga streak harian bareng orang terdekat.' },
  { kind: 'friends', title: 'Duo dan Squad', text: 'Cari teman lewat @username lalu undang tanpa kode. Semua butuh persetujuan.' },
  { kind: 'places', title: 'Lokasi atas izinmu', text: 'Berbagi lokasi hanya saat kamu memulainya, dan bisa dihentikan kapan saja.' },
];

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const slide = SLIDES[Math.min(step, SLIDES.length - 1)] as (typeof SLIDES)[number];
  const last = step >= SLIDES.length - 1;

  function finish() {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      /* diabaikan: onboarding akan tampil lagi */
    }
    navigate('/masuk', { replace: true });
  }

  return (
    <div className="center-page">
      <div className="center-card" key={step}>
        <Illustration kind={slide.kind} />
        <h1 style={{ marginTop: 16 }}>{slide.title}</h1>
        <p>{slide.text}</p>
        <div className="dots" aria-hidden="true">
          {SLIDES.map((s, i) => <i key={s.kind} data-on={i === step} />)}
        </div>
        <div className="stack">
          <button className="btn btn--primary btn--block" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? 'Mulai' : 'Lanjut'}
          </button>
          {!last && <button className="btn btn--ghost btn--block" onClick={finish}>Lewati</button>}
        </div>
      </div>
    </div>
  );
}
