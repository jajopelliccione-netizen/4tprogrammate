import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useToday } from '../hooks';
import { findSeat, sortGroups } from '../lib/groups';
import { setSwapStatus, swapValidNow } from '../lib/swaps';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

const withId = (s) => ({ id: s.id, ...s.data() });
const byCreated = (a, b) => (b.createdAt?.toMillis?.() ?? Infinity) - (a.createdAt?.toMillis?.() ?? Infinity);

// Listener in tempo reale su studenti, gruppi, storico e (per lo studente) scambi.
export function DataProvider({ children }) {
  const { user, profile, isAdmin } = useAuth();
  const today = useToday();
  const [students, setStudents] = useState([]);
  const [groupsRaw, setGroups] = useState(null);
  const [history, setHistory] = useState([]);
  const [subject, setSubject] = useState('');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  useEffect(() => {
    const err = (e) => console.error(e);
    const subs = [
      onSnapshot(collection(db, 'students'), (s) => setStudents(s.docs.map(withId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))), err),
      onSnapshot(doc(db, 'config', 'main'), (s) => setSubject(s.exists() ? s.data().subject || '' : ''), err),
      onSnapshot(collection(db, 'groups'), (s) => setGroups(s.docs.map(withId)), err),
      onSnapshot(query(collection(db, 'history'), orderBy('at', 'desc'), limit(300)), (s) => setHistory(s.docs.map(withId)), err),
    ];
    if (!isAdmin) {
      subs.push(
        onSnapshot(query(collection(db, 'swaps'), where('toUid', '==', user.uid)), (s) => setIncoming(s.docs.map(withId).sort(byCreated)), err),
        onSnapshot(query(collection(db, 'swaps'), where('fromUid', '==', user.uid)), (s) => setOutgoing(s.docs.map(withId).sort(byCreated)), err),
      );
    }
    return () => subs.forEach((u) => u());
  }, [user.uid, isAdmin]);

  const groups = useMemo(() => sortGroups(groupsRaw || []), [groupsRaw]);
  const groupsById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const studentsById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const nameOf = (sid) => studentsById[sid]?.name || '(?)';

  const mySid = profile?.role === 'student' ? profile.studentId : null;
  const mySeat = useMemo(() => (mySid ? findSeat(groups, mySid) : null), [groups, mySid]);

  // Una richiesta in attesa è "valida" solo se i due posti sono ancora quelli e il giorno non è iniziato.
  const isLive = (sw) => sw.status === 'pending' && swapValidNow(sw, groupsById, today);
  const pendingIncoming = incoming.filter(isLive);

  // Le richieste non più valide decadono da sole (le segna come "expired" chi le vede per primo).
  const expiring = useRef(new Set());
  useEffect(() => {
    if (groupsRaw === null) return;
    [...incoming, ...outgoing].forEach((sw) => {
      if (sw.status === 'pending' && !swapValidNow(sw, groupsById, today) && !expiring.current.has(sw.id)) {
        expiring.current.add(sw.id);
        setSwapStatus(sw.id, 'expired').catch(() => {});
      }
    });
  }, [incoming, outgoing, groupsById, groupsRaw, today]);

  const value = {
    today, subject, students, studentsById, nameOf, groups, groupsById, groupsLoaded: groupsRaw !== null, history,
    mySid, mySeat, incoming, outgoing, isLive, badge: pendingIncoming.length,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
