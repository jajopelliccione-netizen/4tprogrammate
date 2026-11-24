import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/Toast';
import { deleteHistoryEntries, deleteHistoryEntry } from '../lib/admin';
import { errMsg } from '../hooks';
import { entryText, typeIcon } from '../lib/history';
import { formatDateTime } from '../lib/dates';

export default function Storico() {
  const { history, nameOf, groupLabel, subjectOf, programmate } = useData();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState('tutte');
  const [busy, setBusy] = useState(false);

  // materia della voce: dal pid salvato (voci admin) oppure dal gruppo (scambi)
  const subjOf = (e) => (e.pid !== undefined && e.pid !== ''
    ? programmate.find((p) => p.id === e.pid)?.subject
    : subjectOf(e.group || e.fromGroup || e.to)) || '';
  const list = history.filter((e) => filter === 'tutte' || subjOf(e) === filter);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast(ok); } catch (e) { toast(errMsg(e), { error: true }); } finally { setBusy(false); }
  };
  const removeOne = (e) => {
    if (confirm('Eliminare questa voce dallo storico?')) run(() => deleteHistoryEntry(e.id), 'Voce eliminata.');
  };
  const removeAll = () => {
    const what = filter === 'tutte' ? 'TUTTO lo storico' : `lo storico di "${filter}"`;
    if (confirm(`Eliminare ${what} (${list.length} voci)? Non si può annullare.`)) {
      run(() => deleteHistoryEntries(list.map((e) => e.id)), 'Storico eliminato.');
    }
  };

  return (
    <>
      <h2>Storico</h2>
      {programmate.length > 1 && (
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="tutte">Tutte le materie</option>
          {programmate.map((p) => <option key={p.id} value={p.subject}>{p.subject}</option>)}
        </select>
      )}
      {isAdmin && list.length > 0 && (
        <button className="danger small" disabled={busy} onClick={removeAll}>
          🗑️ Elimina {filter === 'tutte' ? 'tutto lo storico' : `lo storico di ${filter}`}
        </button>
      )}
      {list.length === 0 && <p className="muted">Ancora nessun evento.</p>}
      <ul className="timeline">
        {list.map((e) => (
          <li key={e.id} className={e.undone ? 'undone' : ''}>
            <span className="ico">{typeIcon(e.type)}</span>
            <div>
              <p>{entryText(e, nameOf, groupLabel)}{e.undone && ' (annullato)'}</p>
              <small>{subjOf(e) && `${subjOf(e)} · `}{formatDateTime(e.at)}</small>
            </div>
            {isAdmin && (
              <button className="small danger del" disabled={busy} aria-label="Elimina voce" onClick={() => removeOne(e)}>✕</button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
