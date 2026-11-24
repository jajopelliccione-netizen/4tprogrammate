import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/Toast';
import Modal from './Modal';
import { WAIT, pidOf } from '../lib/groups';
import { createSubRequest } from '../lib/substitute';
import { errMsg } from '../hooks';

// Il sostituto del gruppo N sta nel gruppo N+1. Può chiedere di passare il ruolo SOLO a una persona del
// suo gruppo, e quella persona deve accettare.
export default function SubTransfer({ entry, onClose }) {
  const { allGroups, mySid, nameOf, studentsById } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const groups = allGroups.filter((g) => pidOf(g) === pidOf(entry.group));
  const own = groups[groups.findIndex((g) => g.id === entry.group.id) + 1];   // il suo gruppo
  const options = own ? own.seats.map((sid, i) => ({ sid, i })).filter((o) => o.sid && o.sid !== mySid && own.status[o.i] === WAIT) : [];

  async function ask(sid) {
    setBusy(true);
    try {
      await createSubRequest({ gid: entry.group.id, fromSid: mySid, toSid: sid });
      toast(`Richiesta inviata a ${nameOf(sid)}: deve accettare.`);
      onClose();
    } catch (e) {
      toast(errMsg(e), { error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Passa il ruolo di sostituto" onClose={onClose} actions={<button onClick={onClose}>Chiudi</button>}>
      <p className="hint">Sei il sostituto del <b>Gruppo {entry.group.number}</b> ({entry.prog.subject}). Puoi chiederlo solo a una persona del tuo gruppo{own ? ` (Gruppo ${own.number})` : ''}, e deve <b>accettare</b> lei.</p>
      {options.length === 0 && <p>Non c'è nessun altro nel tuo gruppo a cui chiederlo.</p>}
      <ul className="pickerlist">
        {options.map(({ sid }) => (
          <li key={sid}>
            <button disabled={busy} onClick={() => ask(sid)}>
              <b>{nameOf(sid)}</b>
              {!studentsById[sid]?.activated && <small>Non ha ancora attivato l'app: vedrà la richiesta appena entra.</small>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
