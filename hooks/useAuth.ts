import { useState, useEffect, useCallback } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        try {
          // Sync user profile to Firestore
          const userRef = doc(db, 'users', currentUser.uid);
          await setDoc(
            userRef,
            {
              userId: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Usuário Google',
              photoURL: currentUser.photoURL || '',
              lastLoginAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (err) {
          console.debug('Firestore user sync info:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('O login do Google foi fechado antes de concluir.');
      } else if (err?.code === 'auth/popup-blocked') {
        setError('A janela pop-up foi bloqueada pelo navegador. Permita pop-ups para este site.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        // Ignored
      } else {
        setError(err?.message || 'Falha na autenticação com o Google.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fbSignOut(auth);
      setUser(null);
    } catch (err: any) {
      console.error('Logout error:', err);
      setError('Erro ao encerrar a sessão.');
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    user,
    loading,
    error,
    signInWithGoogle,
    signOut,
    clearError,
  };
}
