import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/Toast';
import {
  copyText, importStudents, inviteLink, removeStudent, resetAccess, whatsappMessage,
} from '../../lib/admin';
import { errMsg } from '../../hooks';

export default function Accessi() {
  const { students, groups } = useData();
  const toast = useToast();
  const [invites, setInvites] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'invites'),
    (s) => setInvites(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => toast(errMsg(e), { error: true })), [toast]);

  // invito ancora utilizzabile per ogni studente
  const openInvite = useMemo(() => {
    const m = {};
    invites.filter((i) => !i.used).forEach((i) => { m[i.studentId] = i; });
    return m;
  }, [invites]);

  const activated = students.filter((s) => s.activated).length;
  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast(ok); } catch (e) { toast(errMsg(e), { error: true }); } finally { setBusy(false); }
  };
  const copy = async (t, ok) => toast((await copyText(t)) ? ok : 'Copia non riuscita', { error: false });

  const pending = students.filter((s) => !s.activated && openInvite[s.id]);

  return (
    <>
      <h2>Importa la lista</h2>
      <textarea rows={5} placeholder={'Un nome per riga\nMario Rossi\nGiulia Bianchi'} value={text}
        onChange={(e) => setText(e.target.value)} />
      <button className="primary" disabled={busy || !text.trim()}
        onClick={() => run(async () => {
          const n = await importStudents(text, students);
          setText('');
          toast(n ? `${n} studenti aggiunti, link creati.` : 'Nessun nome nuovo.');
        })}>Importa nomi e crea i link</button>

      <h2>Studenti <small>({activated}/{students.length} attivi)</small></h2>
      {pending.length > 0 && (
        <button onClick={() => copy(pending.map((s) => `${s.name} → ${inviteLink(openInvite[s.id].id)}`).join('\n'),
          `Copiati ${pending.length} link`)}>📋 Copia tutti i link ({pending.length})</button>
      )}
      <ul className="rows">
        {students.map((s) => {
          const inv = openInvite[s.id];
          const link = inv && inviteLink(inv.id);
          return (
            <li key={s.id} className="srow">
              <div className="sname">
                <b>{s.name}</b>
                <span className={`pill ${s.activated ? 'st-accepted' : 'st-pending'}`}>{s.activated ? 'Attivo' : 'In attesa'}</span>
              </div>
              {link && (
                <>
                  <input className="linkbox" readOnly value={link} onFocus={(e) => e.target.select()} />
                  <div className="row">
                    <button onClick={() => copy(link, 'Link copiato')}>Copia</button>
                    <button onClick={() => copy(whatsappMessage(s.name, link), 'Messaggio WhatsApp copiato')}>Copia messaggio WhatsApp</button>
                  </div>
                </>
              )}
              <div className="row">
                <button disabled={busy} onClick={() => {
                  const msg = s.activated
                    ? `Resettare l'accesso di ${s.name}? Il vecchio account smette di funzionare e viene creato un nuovo link.`
                    : `Rigenerare il link di ${s.name}? Quello vecchio non funzionerà più.`;
                  if (confirm(msg)) run(() => resetAccess(s, invites), 'Nuovo link creato.');
                }}>{s.activated ? 'Resetta accesso' : 'Rigenera link'}</button>
                <button className="danger" disabled={busy} onClick={() => {
                  if (confirm(`Eliminare ${s.name} dalla classe?`)) run(() => removeStudent(s, groups, invites), 'Studente eliminato.');
                }}>Elimina</button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
