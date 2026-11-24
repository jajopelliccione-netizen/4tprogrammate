import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// user: undefined = carico, null = non loggato.  profile: undefined = carico, null = nessun permesso.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);

  useEffect(() => (!auth ? undefined : onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (!u) setProfile(null);
  })), []);

  useEffect(() => {
    if (!user) return undefined;
    setProfile(undefined);
    return onSnapshot(
      doc(db, 'users', user.uid),
      (s) => setProfile(s.exists() ? s.data() : null),
      () => setProfile(null),
    );
  }, [user?.uid]);

  const value = useMemo(() => ({
    user,
    profile,
    loading: user === undefined || (user && profile === undefined),
    isAdmin: profile?.role === 'admin',
    logout: () => signOut(auth),
  }), [user, profile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
