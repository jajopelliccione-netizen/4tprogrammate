import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useToday } from '../hooks';
import { findSeat, groupNumber, pidOf, sortGroups } from '../lib/groups';
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
  const [programmateRaw, setProgrammate] = useState(null);
  const [rulesError, setRulesError] = useState(false);
  const [pidSel, setPidSel] = useState(() => { try { return sessionStorage.getItem('pid'); } catch { return null; } });
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  useEffect(() => {
    const err = (e) => console.error(e);
    const subs = [
      onSnapshot(collection(db, 'students'), (s) => setStudents(s.docs.map(withId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))), err),
      onSnapshot(collection(db, 'programmate'), (s) => { setProgrammate(s.docs.map(withId)); setRulesError(false); }, (e) => {
        // di solito: regole di Firestore non ancora aggiornate. Non blocchiamo l'app.
        console.error(e);
        setProgrammate([]);
        setRulesError(true);
      }),
      onSnapshot(collection(db, 'groups'), (s) => setGroups(s.docs.map(withId)), (e) => { console.error(e); setGroups([]); }),
      onSnapshot(query(collection(db, 'history'), orderBy('at', 'desc'), limit(300)), (s) => setHistory(s.docs.map(withId)), err),
    ];
    if (!isAdmin && profile?.studentId) {
      subs.push(
        onSnapshot(query(collection(db, 'swaps'), where('toSid', '==', profile.studentId)), (s) => setIncoming(s.docs.map(withId).sort(byCreated)), err),
        onSnapshot(query(collection(db, 'swaps'), where('fromSid', '==', profile.studentId)), (s) => setOutgoing(s.docs.map(withId).sort(byCreated)), err),
      );
    }
    return () => subs.forEach((u) => u());
  }, [user.uid, isAdmin, profile?.studentId]);

  const allGroups = useMemo(() => sortGroups(groupsRaw || []), [groupsRaw]);
  const groupsById = useMemo(() => Object.fromEntries(allGroups.map((g) => [g.id, g])), [allGroups]);
  const studentsById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const nameOf = (sid) => studentsById[sid]?.name || '(?)';

  const mySid = profile?.role === 'student' ? profile.studentId : null;

  // Programmate (una per materia). I gruppi "vecchi" senza pid finiscono in una voce "Senza materia".
  const programmate = useMemo(() => {
    const list = [...(programmateRaw || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (allGroups.some((g) => !g.pid)) list.push({ id: '', subject: 'Senza materia', virtual: true });
    return list;
  }, [programmateRaw, allGroups]);

  // Programmata selezionata: l'ultima scelta, altrimenti la prima in cui sono inserito, altrimenti la prima.
  const currentPid = useMemo(() => {
    if (programmate.some((p) => p.id === pidSel)) return pidSel;
    const mine = mySid && programmate.find((p) => allGroups.some((g) => pidOf(g) === p.id && g.seats.includes(mySid)));
    return (mine || programmate[0])?.id ?? '';
  }, [programmate, pidSel, allGroups, mySid]);
  const setPid = (id) => {
    setPidSel(id);
    try { sessionStorage.setItem('pid', id); } catch { /* niente */ }
  };
  const currentProg = programmate.find((p) => p.id === currentPid) || null;
  const groups = useMemo(() => allGroups.filter((g) => pidOf(g) === currentPid), [allGroups, currentPid]);
  const mySeat = useMemo(() => (mySid ? findSeat(groups, mySid) : null), [groups, mySid]);

  const groupLabel = (id) => `Gruppo ${groupsById[id]?.number ?? groupNumber(id)}`;
  const subjectOf = (id) => {
    const g = groupsById[id];
    return g ? programmate.find((p) => p.id === pidOf(g))?.subject || '' : '';
  };

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
    today, subject: currentProg?.subject || '', programmate, currentPid, currentProg, setPid, allGroups, groupLabel, subjectOf,
    students, studentsById, nameOf, groups, groupsById, groupsLoaded: groupsRaw !== null && programmateRaw !== null, history,
    rulesError, mySid, mySeat, incoming, outgoing, isLive, badge: pendingIncoming.length,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
