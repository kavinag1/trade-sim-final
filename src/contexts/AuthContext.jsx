import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { STARTING_BALANCE, ADMIN_EMAILS } from '../config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  async function clearStaleAuthCache() {
    if (typeof window === 'undefined') return;

    // Remove Firebase auth entries from both storage scopes.
    const clearStorage = (store) => {
      const keysToDelete = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key && key.startsWith('firebase:')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => store.removeItem(key));
    };

    try {
      clearStorage(window.localStorage);
      clearStorage(window.sessionStorage);
    } catch (err) {
      console.warn('Could not clear browser storage:', err);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Force a token read so revoked/invalid refresh state fails fast.
          await firebaseUser.getIdToken();
          setUser(firebaseUser);
          const adminStatus = ADMIN_EMAILS.includes(firebaseUser.email);
          setIsAdmin(adminStatus);
          await loadOrCreateUserProfile(firebaseUser);
        } catch (err) {
          console.error('Invalid auth session detected. Re-authentication required.', err);
          await clearStaleAuthCache();
          await signOut(auth);
          setUser(null);
          setUserProfile(null);
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function loadOrCreateUserProfile(firebaseUser) {
    const ref = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setUserProfile(snap.data());
    } else {
      const defaultProfile = {
        userId: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || '',
        teamName: firebaseUser.displayName || 'Team ' + firebaseUser.uid.slice(0, 6),
        cashBalance: STARTING_BALANCE,
        netWorth: STARTING_BALANCE,
        portfolioValue: 0,
        portfolio: [],
        watchlist: [],
        totalTrades: 0,
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, defaultProfile);
      setUserProfile(defaultProfile);
    }
  }

  async function signInWithGoogle() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Sign in error:', err);
      throw err;
    }
  }

  async function logout() {
    await signOut(auth);
  }

  async function refreshProfile() {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) setUserProfile(snap.data());
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin, signInWithGoogle, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
