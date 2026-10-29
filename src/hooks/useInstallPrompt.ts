import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Tombol "Pasang aplikasi" (Android/desktop). iOS tidak punya prompt: tampilkan petunjuk manual. */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return {
    installed,
    canPrompt: deferred !== null,
    showIosHint: isIos && !installed,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    },
  };
}
