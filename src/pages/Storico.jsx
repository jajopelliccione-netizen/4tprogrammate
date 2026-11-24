import { useState } from 'react';
import { useData } from '../context/DataContext';
import { entryText, typeIcon } from '../lib/history';
import { formatDateTime } from '../lib/dates';

export default function Storico() {
  const { history, nameOf, groupLabel, subjectOf, programmate } = useData();
  const [filter, setFilter] = useState('tutte');

  // materia della voce: dal pid salvato (voci admin) oppure dal gruppo (scambi)
  const subjOf = (e) => (e.pid !== undefined && e.pid !== ''
    ? programmate.find((p) => p.id === e.pid)?.subject
    : subjectOf(e.group || e.fromGroup || e.to)) || '';
  const list = history.filter((e) => filter === 'tutte' || subjOf(e) === filter);

  return (
    <>
      <h2>Storico</h2>
      {programmate.length > 1 && (
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="tutte">Tutte le materie</option>
          {programmate.map((p) => <option key={p.id} value={p.subject}>{p.subject}</option>)}
        </select>
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
          </li>
        ))}
      </ul>
    </>
  );
}
