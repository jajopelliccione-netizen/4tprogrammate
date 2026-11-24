import { collection, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

// Il sostituto chiede a una persona del suo gruppo di prendere il ruolo: deve accettare lei.
export async function createSubRequest({ gid, fromSid, toSid }) {
  const ref = doc(collection(db, 'subRequests'));
  await setDoc(ref, { gid, fromSid, toSid, status: 'pending', createdAt: serverTimestamp() });
  return ref.id;
}

export const setSubRequestStatus = (id, status) =>
  updateDoc(doc(db, 'subRequests', id), { status, resolvedAt: serverTimestamp() });

// Accettazione: stato richiesta + nuovo sostituto del gruppo, in un solo batch atomico.
export async function acceptSubRequest(r) {
  const b = writeBatch(db);
  b.update(doc(db, 'subRequests', r.id), { status: 'accepted', resolvedAt: serverTimestamp() });
  b.update(doc(db, 'groups', r.gid), { subId: r.toSid, lastSubReq: r.id });
  await b.commit();
}
