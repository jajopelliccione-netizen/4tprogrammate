import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useData } from '../context/DataContext';
import { useToast } from '../context/Toast';
import Modal from './Modal';
import { WAIT, pidOf } from '../lib/groups';
import { errMsg } from '../hooks';

// Il sostituto del gruppo N sta nel gruppo N+1: può passare il ruolo solo a un'altra persona del SUO gruppo.
export default function SubTransfer({ entry, onClose }) {
  const { allGroups, mySid, nameOf } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const groups = allGroups.filter((g) => pidOf(g) === pidOf(entry.group));
  const own = groups[groups.findIndex((g) => g.id === entry.group.id) + 1];   // il suo gruppo effettivo
  const options = own ? own.seats.map((sid, i) => ({ sid, i })).filter((o) => o.sid && o.sid !== mySid && own.status[o.i] === WAIT) : [];

  async function pass(sid) {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'groups', entry.group.id), { subId: sid });
      toast(`Ora il sostituto è ${nameOf(sid)}.`);
      onClose();
    } catch (e) {
      toast(errMsg(e), { error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Passa il ruolo di sostituto" onClose={onClose} actions={<button onClick={onClose}>Chiudi</button>}>
      <p className="hint">Sei il sostituto del <b>Gruppo {entry.group.number}</b> ({entry.prog.subject}). Puoi passare il ruolo solo a una persona del tuo gruppo{own ? ` (Gruppo ${own.number})` : ''}.</p>
      {options.length === 0 && <p>Non c'è nessun altro nel tuo gruppo a cui passarlo.</p>}
      <ul className="pickerlist">
        {options.map(({ sid }) => (
          <li key={sid}><button disabled={busy} onClick={() => pass(sid)}><b>{nameOf(sid)}</b></button></li>
        ))}
      </ul>
    </Modal>
  );
}
