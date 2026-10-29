import { GoogleAuthProvider, deleteUser, reauthenticateWithPopup, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { getFirebase } from '@/lib/firebase/client';

export async function signInWithGoogle(): Promise<void> {
  const { auth } = getFirebase();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    // Beberapa browser mobile/iOS memblokir popup: pakai redirect sebagai cadangan.
    if (e instanceof FirebaseError && e.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}

export function signOutUser(): Promise<void> {
  return signOut(getFirebase().auth);
}

/** Login ulang (diminta Firebase sebelum menghapus akun) lalu hapus akun Auth. Harus dipanggil dari tindakan pengguna. */
export async function reauthenticate(): Promise<void> {
  const user = getFirebase().auth.currentUser;
  if (!user) throw new Error('Login diperlukan.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await reauthenticateWithPopup(user, provider);
}

export async function deleteAuthUser(): Promise<void> {
  const user = getFirebase().auth.currentUser;
  if (!user) return;
  try {
    await deleteUser(user);
  } catch (e) {
    if (!(e instanceof FirebaseError && e.code === 'auth/user-not-found')) throw e;
  }
}

export function describeAuthError(e: unknown): string {
  if (e instanceof FirebaseError) {
    switch (e.code) {
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Login dibatalkan. Coba lagi bila ingin melanjutkan.';
      case 'auth/network-request-failed':
        return 'Tidak ada koneksi internet. Sambungkan lalu coba lagi.';
      case 'auth/unauthorized-domain':
        return 'Domain ini belum diizinkan di Firebase Authentication (Authorized domains).';
      case 'auth/user-disabled':
        return 'Akun ini dinonaktifkan. Hubungi pemilik aplikasi.';
      case 'auth/operation-not-allowed':
        return 'Login Google belum diaktifkan di Firebase Console.';
      default:
        return `Login gagal (${e.code}).`;
    }
  }
  return 'Login gagal. Coba lagi.';
}
