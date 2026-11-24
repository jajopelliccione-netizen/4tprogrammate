import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/Toast';
import { acceptSwap, setSwapStatus } from '../lib/swaps';
import { formatDate } from '../lib/dates';
import { errMsg } from '../hooks';

const LABEL = {
  pending: 'In attesa', accepted: 'Accettata', rejected: 'Rifiutata',
  cancelled: 'Annullata', expired: 'Decaduta',
};

export default function Scambi() {
  const { isAdmin } = useAuth();
  const { incoming, outgoing, nameOf, groupsById, today, isLive, groupLabel, subjectOf } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  if (isAdmin) return <Navigate to="/" replace />;

  const run = async (id, fn, okMsg) => {
    setBusy(id);
    try {
      const r = await fn();
      if (r === 'expired') toast('Richiesta decaduta: nel frattempo uno dei due posti è cambiato.', { error: true });
      else if (r === 'gone') toast('Richiesta non più disponibile.', { error: true });
      else toast(okMsg);
    } catch (e) {
      toast(errMsg(e), { error: true });
    } finally {
      setBusy('');
    }
  };

  const desc = (sw) => {
    const a = groupsById[sw.fromGroup];
    const b = groupsById[sw.toGroup];
    const mat = subjectOf(sw.fromGroup);
    return `${mat ? `[${mat}] ` : ''}${nameOf(sw.fromSid)} (${groupLabel(sw.fromGroup)}, ${formatDate(a?.date)}) ⇄ ${nameOf(sw.toSid)} (${groupLabel(sw.toGroup)}, ${formatDate(b?.date)})`;
  };
  const statusOf = (sw) => (sw.status === 'pending' && !isLive(sw) ? 'expired' : sw.status);

  const inPending = incoming.filter((s) => s.status === 'pending' && isLive(s));
  const outPending = outgoing.filter((s) => s.status === 'pending' && isLive(s));
  const past = [...incoming, ...outgoing]
    .filter((s) => !(s.status === 'pending' && isLive(s)))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    .slice(0, 20);

  return (
    <>
      <h2>Richieste ricevute</h2>
      {inPending.length === 0 && <p className="muted">Nessuna richiesta da gestire.</p>}
      {inPending.map((sw) => (
        <div className="item" key={sw.id}>
          <p>{desc(sw)}</p>
          <div className="row">
            <button className="primary" disabled={busy === sw.id}
              onClick={() => run(sw.id, () => acceptSwap(sw.id, today), 'Scambio fatto! 🎉')}>Accetta</button>
            <button disabled={busy === sw.id}
              onClick={() => run(sw.id, () => setSwapStatus(sw.id, 'rejected'), 'Richiesta rifiutata.')}>Rifiuta</button>
          </div>
        </div>
      ))}

      <h2>Richieste inviate</h2>
      {outPending.length === 0 && <p className="muted">Nessuna richiesta in attesa.</p>}
      {outPending.map((sw) => (
        <div className="item" key={sw.id}>
          <p>{desc(sw)}</p>
          <button disabled={busy === sw.id}
            onClick={() => run(sw.id, () => setSwapStatus(sw.id, 'cancelled'), 'Richiesta annullata.')}>Annulla richiesta</button>
        </div>
      ))}

      {past.length > 0 && (
        <>
          <h2>Precedenti</h2>
          {past.map((sw) => (
            <div className="item old" key={sw.id}>
              <p>{desc(sw)}</p>
              <span className={`pill st-${statusOf(sw)}`}>{LABEL[statusOf(sw)]}</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}
