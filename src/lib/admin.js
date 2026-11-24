// Azioni dell'amministratore (scrivono su Firestore con batch atomici).
import {
  collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { newInternalEmail, newToken } from './tokens';
import { startsAtOf } from './dates';
import { emptyGroup, groupId, moveStudent, sortGroups } from './groups';

const stripId = ({ id, ...rest }) => rest;

// Applica modifiche ai gruppi e registra nello storico lo stato PRECEDENTE,
// così "Annulla ultima azione" può ripristinarlo.
//   changed: { gid: nuovoDoc }, deleted: [gid], studentPatches: { sid: {excluded} }
export async function commitChange({ changed = {}, deleted = [], studentPatches = {}, entry, groupsById, studentsById = {}, pid = '' }) {
  const batch = writeBatch(db);
  const prev = {};
  const created = [];
  const prevStudents = {};

  for (const [gid, data] of Object.entries(changed)) {
    if (groupsById[gid]) prev[gid] = stripId(groupsById[gid]);
    else created.push(gid);
    batch.set(doc(db, 'groups', gid), stripId(data));
  }
  for (const gid of deleted) {
    if (groupsById[gid]) prev[gid] = stripId(groupsById[gid]);
    batch.delete(doc(db, 'groups', gid));
  }
  for (const [sid, patch] of Object.entries(studentPatches)) {
    prevStudents[sid] = Object.fromEntries(Object.keys(patch).map((k) => [k, studentsById[sid]?.[k] ?? false]));
    batch.update(doc(db, 'students', sid), patch);
  }
  if (entry) {
    batch.set(doc(collection(db, 'history')), {
      ...entry, pid, at: serverTimestamp(), by: 'admin', prev, created, prevStudents, undone: false,
    });
  }
  await batch.commit();
}

// Annulla una voce dello storico (ripristina i gruppi com'erano prima).
export async function undoEntry(entry) {
  const batch = writeBatch(db);
  for (const [gid, data] of Object.entries(entry.prev || {})) batch.set(doc(db, 'groups', gid), data);
  for (const gid of entry.created || []) batch.delete(doc(db, 'groups', gid));
  for (const [sid, patch] of Object.entries(entry.prevStudents || {})) batch.update(doc(db, 'students', sid), patch);
  batch.update(doc(db, 'history', entry.id), { undone: true });
  await batch.commit();
}

export const setGroupDate = (gid, dateStr) =>
  updateDoc(doc(db, 'groups', gid), { date: dateStr || null, startsAt: startsAtOf(dateStr) });

export const setGroupSub = (gid, subId) => updateDoc(doc(db, 'groups', gid), { subId: subId || '' });

export async function setGroupDates(groups, dates) {
  const batch = writeBatch(db);
  groups.forEach((g, i) => {
    // dates[i] === null → toglie la data; undefined → lascia com'è
    if (dates[i] !== undefined) batch.update(doc(db, 'groups', g.id), { date: dates[i] || null, startsAt: startsAtOf(dates[i]) });
  });
  await batch.commit();
}

export const addGroup = (groups, pid = '') => {
  const n = groups.length ? Math.max(...groups.map((g) => g.number)) + 1 : 1;
  const batch = writeBatch(db);
  batch.set(doc(db, 'groups', groupId(n, pid)), emptyGroup(n, { pid }));
  return batch.commit();
};

// ------------------------------------------------------------ programmate ---
// Una programmata = una materia, con i suoi gruppi.
export async function createProgrammata(subject, programmate) {
  const ref = doc(collection(db, 'programmate'));
  const order = programmate.reduce((m, p) => Math.max(m, p.order ?? 0), 0) + 1;
  await setDoc(ref, { subject: subject.trim(), order, createdAt: serverTimestamp() });
  return ref.id;
}
export const renameProgrammata = (id, subject) => updateDoc(doc(db, 'programmate', id), { subject: subject.trim() });
export async function deleteProgrammata(id, groups) {
  const batch = writeBatch(db);
  groups.forEach((g) => batch.delete(doc(db, 'groups', g.id)));
  if (id) batch.delete(doc(db, 'programmate', id));
  await batch.commit();
}

export const deleteGroup = (gid) => deleteDoc(doc(db, 'groups', gid));

// ------------------------------------------------------------------ inviti ---
export const inviteLink = (token) => `${window.location.origin}/invito/${token}`;

function inviteDoc(studentId) {
  return { studentId, authEmail: newInternalEmail(), used: false, createdAt: serverTimestamp() };
}

// Importa i nomi (uno per riga). Salta i duplicati. Ritorna quanti ne ha creati.
export async function importStudents(rawText, existing) {
  const have = new Set(existing.map((s) => s.name.trim().toLowerCase()));
  const names = [];
  for (const line of rawText.split(/\r?\n/)) {
    const name = line.replace(/^\s*\d+[.)\-\s]+(?=\D)/, '').trim().replace(/\s+/g, ' ');
    if (name && !have.has(name.toLowerCase())) {
      have.add(name.toLowerCase());
      names.push(name);
    }
  }
  const base = existing.reduce((m, s) => Math.max(m, s.order ?? 0), 0);
  for (let i = 0; i < names.length; i += 200) {
    const batch = writeBatch(db);
    names.slice(i, i + 200).forEach((name, k) => {
      const ref = doc(collection(db, 'students'));
      batch.set(ref, {
        name, activated: false, uid: null, authEmail: null, excluded: false,
        order: base + i + k + 1, createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'invites', newToken()), inviteDoc(ref.id));
    });
    await batch.commit();
  }
  return names.length;
}

// Reset accesso: nuovo invito + vecchio account senza più permessi
// (si elimina users/{vecchioUid}). Funziona anche per chi non ha ancora attivato (rigenera il link).
export async function resetAccess(student, invites) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'students', student.id), { activated: false, uid: null, authEmail: null });
  if (student.uid) batch.delete(doc(db, 'users', student.uid));
  invites.filter((i) => i.studentId === student.id).forEach((i) => batch.delete(doc(db, 'invites', i.id)));
  batch.set(doc(db, 'invites', newToken()), inviteDoc(student.id));
  await batch.commit();
}

export async function removeStudent(student, groups, invites) {
  const changed = moveStudent(sortGroups(groups), student.id, { pool: true });
  const batch = writeBatch(db);
  for (const [gid, data] of Object.entries(changed)) batch.set(doc(db, 'groups', gid), stripId(data));
  if (student.uid) batch.delete(doc(db, 'users', student.uid));
  invites.filter((i) => i.studentId === student.id).forEach((i) => batch.delete(doc(db, 'invites', i.id)));
  batch.delete(doc(db, 'students', student.id));
  await batch.commit();
}

export function whatsappMessage(name, link) {
  return (
    `Ciao ${name}! Questo è il tuo link personale per entrare nell'app delle interrogazioni programmate della 4T SSA:\n` +
    `${link}\n` +
    `Apri il link, scegli una password (almeno 6 caratteri) e sei dentro. Il link funziona una sola volta, non girarlo a nessuno.`
  );
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// ----------------------------------------------------------------- storico ---
export const deleteHistoryEntry = (id) => deleteDoc(doc(db, 'history', id));

export async function deleteHistoryEntries(ids) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => batch.delete(doc(db, 'history', id)));
    await batch.commit();
  }
}
