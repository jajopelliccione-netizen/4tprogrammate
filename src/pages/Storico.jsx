import { useData } from '../context/DataContext';
import { entryText, typeIcon } from '../lib/history';
import { formatDateTime } from '../lib/dates';

export default function Storico() {
  const { history, nameOf } = useData();
  return (
    <>
      <h2>Storico</h2>
      {history.length === 0 && <p className="muted">Ancora nessun evento.</p>}
      <ul className="timeline">
        {history.map((e) => (
          <li key={e.id} className={e.undone ? 'undone' : ''}>
            <span className="ico">{typeIcon(e.type)}</span>
            <div>
              <p>{entryText(e, nameOf)}{e.undone && ' (annullato)'}</p>
              <small>{formatDateTime(e.at)}</small>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
