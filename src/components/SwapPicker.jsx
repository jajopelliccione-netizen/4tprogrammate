import { useData } from '../context/DataContext';
import Modal from './Modal';
import { formatDate } from '../lib/dates';
import { findSeat, pidOf, sortGroups } from '../lib/groups';
import { seatSwappable } from '../lib/swaps';

// Elenco guidato per chiedere uno scambio: scegli con chi.
export default function SwapPicker({ pid, onPick, onClose }) {
  const { allGroups, programmate, mySid, today, studentsById, outgoing, incoming } = useData();
  const groups = sortGroups(allGroups.filter((g) => pidOf(g) === pid));
  const prog = programmate.find((p) => p.id === pid);
  const mine = findSeat(groups, mySid);
  const myGroup = mine ? groups.find((g) => g.id === mine.gid) : null;
  const canSwap = mine && seatSwappable(myGroup, mine.pos, today);

  const asked = (sid) => [...outgoing, ...incoming].some((s) => s.status === 'pending' &&
    ((s.toSid === sid && s.fromSid === mySid) || (s.fromSid === sid && s.toSid === mySid)));

  const options = [];
  if (canSwap) {
    for (const g of groups) {
      g.seats.forEach((sid, pos) => {
        if (sid && sid !== mySid && seatSwappable(g, pos, today)) options.push({ g, pos, sid });
      });
    }
  }

  return (
    <Modal title={`Chiedi uno scambio${prog ? ` · ${prog.subject}` : ''}`} onClose={onClose}
      actions={<button onClick={onClose}>Chiudi</button>}>
      {!mine && <p>Non sei in nessun gruppo di questa programmata.</p>}
      {mine && !canSwap && (
        <p>Il tuo gruppo non è più scambiabile (la data è oggi o già passata, oppure sei già stato interrogato).</p>
      )}
      {canSwap && (
        <>
          <p className="hint">Tu: <b>Gruppo {myGroup.number}</b> ({formatDate(myGroup.date)}). Scegli con chi scambiare il posto:</p>
          {options.length === 0 && <p>Nessun compagno con cui scambiare per ora.</p>}
          <ul className="pickerlist">
            {options.map(({ g, pos, sid }) => (
              <li key={`${g.id}-${pos}`}>
                <button disabled={asked(sid)} onClick={() => onPick({ group: g, pos, sid })}>
                  <b>{studentsById[sid].name}</b>
                  <small>Gruppo {g.number} · {formatDate(g.date)}{asked(sid) ? ' · richiesta già in attesa' : ''}{!studentsById[sid].activated ? ' · non ha ancora attivato l\'app' : ''}</small>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
