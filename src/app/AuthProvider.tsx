import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase/client';
import { parseProfile } from '@/features/profile/profile.service';
import type { UserProfile } from '@/types/user';

export type AuthState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'signedOut' }
  | { status: 'needsUsername'; user: User }
  | { status: 'ready'; user: User; profile: UserProfile }
  | { status: 'error'; message: string };

const AuthContext = createContext<AuthState>({ status: 'loading' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    isFirebaseConfigured() ? { status: 'loading' } : { status: 'unconfigured' },
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const { auth, db } = getFirebase();
    let unsubProfile = () => {};

    const unsubAuth = onAuthStateChanged(
      auth,
      (user) => {
        unsubProfile();
        unsubProfile = () => {};
        if (!user) {
          setState({ status: 'signedOut' });
          return;
        }
        setState({ status: 'loading' });
        unsubProfile = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            const profile = snap.exists() ? parseProfile(snap.data()) : null;
            setState(profile ? { status: 'ready', user, profile } : { status: 'needsUsername', user });
          },
          (err) => setState({ status: 'error', message: err.message }),
        );
      },
      (err) => setState({ status: 'error', message: err.message }),
    );

    return () => {
      unsubProfile();
      unsubAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
