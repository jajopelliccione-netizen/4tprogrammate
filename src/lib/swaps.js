import {
  collection, doc, runTransaction, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { isFutureDay, seatSwappable, swapValidNow } from './swapRules';

export { isFutureDay, seatSwappable, swapValidNow };

export async function createSwap({ meSid, otherSid, from, to }) {
  // from/to: { gid, pos }. Le richieste sono legate agli studenti, anche a chi non ha ancora attivato l'app.
  const ref = doc(collection(db, 'swaps'));
  await setDoc(ref, {
    fromSid: meSid,
    toSid: otherSid,
    fromGroup: from.gid,
    fromPos: from.pos,
    toGroup: to.gid,
    toPos: to.pos,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export const setSwapStatus = (id, status) =>
  updateDoc(doc(db, 'swaps', id), { status, resolvedAt: serverTimestamp() });

// Accettazione: una transazione sola (stato richiesta + 1 o 2 gruppi + storico).
// Ritorna 'ok' | 'expired' | 'gone'.
export async function acceptSwap(id, today) {
  return runTransaction(db, async (tx) => {
    const sRef = doc(db, 'swaps', id);
    const s = await tx.get(sRef);
    if (!s.exists() || s.data().status !== 'pending') return 'gone';
    const sw = s.data();

    const refA = doc(db, 'groups', sw.fromGroup);
    const refB = doc(db, 'groups', sw.toGroup);
    const a = await tx.get(refA);
    const b = sw.toGroup === sw.fromGroup ? a : await tx.get(refB);
    const ga = a.exists() ? a.data() : null;
    const gb = b.exists() ? b.data() : null;
    const map = { [sw.fromGroup]: ga, [sw.toGroup]: gb };

    if (!ga || !gb || !swapValidNow(sw, map, today)) {
      tx.update(sRef, { status: 'expired', resolvedAt: serverTimestamp() });
      return 'expired';
    }

    const seatsA = [...ga.seats];
    const seatsB = sw.toGroup === sw.fromGroup ? seatsA : [...gb.seats];
    seatsA[sw.fromPos] = sw.toSid;
    seatsB[sw.toPos] = sw.fromSid;

    tx.update(sRef, { status: 'accepted', resolvedAt: serverTimestamp() });
    tx.update(refA, { seats: seatsA, lastSwapId: id });
    if (sw.toGroup !== sw.fromGroup) tx.update(refB, { seats: seatsB, lastSwapId: id });
    tx.set(doc(db, 'history', id), {
      type: 'swap',
      swapId: id,
      at: serverTimestamp(),
      fromSid: sw.fromSid,
      toSid: sw.toSid,
      fromGroup: sw.fromGroup,
      fromPos: sw.fromPos,
      toGroup: sw.toGroup,
      toPos: sw.toPos,
    });
    return 'ok';
  });
}
