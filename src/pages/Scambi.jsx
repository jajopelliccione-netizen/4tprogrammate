import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/Toast';
import { acceptSwap, setSwapStatus } from '../lib/swaps';
import { colorOf } from '../components/GroupCard';
import { formatDate } from '../lib/dates';
import { errMsg } from '../hooks';

const LABEL = {
  pending: 'In attesa', accepted: 'Accettata', rejected: 'Rifiutata',
  cancelled: 'Annullata', expired: 'Decaduta',
};

// Un lato dello scambio: chi è, in quale gruppo si trova.
function Side({ who, gid, group, groupLabel }) {
  const num = group?.number;
  return (
    <div className={`sw-side ${num ? colorOf(num) : ''} cg`}>
      <small>{who}</small>
      <b>{groupLabel(gid)}</b>
      {group?.date && <em>{formatDate(group.date)}</em>}
    </div>
  );
}

export default function Scambi() {
  const { isAdmin } = useAuth();
  const { incoming, outgoing, nameOf, groupsById, today, isLive, groupLabel, subjectOf, mySid } = useData();
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

  const statusOf = (sw) => (sw.status === 'pending' && !isLive(sw) ? 'expired' : sw.status);

  // Scheda di una richiesta: frase chiara + i due gruppi affiancati.
  function Card({ sw, actions, old }) {
    const iAmSender = sw.fromSid === mySid;
    const otherSid = iAmSender ? sw.toSid : sw.fromSid;
    const mine = iAmSender ? { gid: sw.fromGroup } : { gid: sw.toGroup };
    const theirs = iAmSender ? { gid: sw.toGroup } : { gid: sw.fromGroup };
    const mat = subjectOf(sw.fromGroup);
    return (
      <div className={`item swcard ${old ? 'old' : ''}`}>
        <div className="sw-top">
          {mat && <span className="pill">{mat}</span>}
          {old && <span className={`pill st-${statusOf(sw)}`}>{LABEL[statusOf(sw)]}</span>}
        </div>
        <p className="sw-sentence">
          {iAmSender
            ? <>Hai chiesto a <b>{nameOf(otherSid)}</b> di scambiare il posto.</>
            : <><b>{nameOf(otherSid)}</b> vuole scambiare il posto con te.</>}
        </p>
        <div className="sw-sides">
          <Side who="Tu" gid={mine.gid} group={groupsById[mine.gid]} groupLabel={groupLabel} />
          <span className="sw-arrow">⇄</span>
          <Side who={nameOf(otherSid)} gid={theirs.gid} group={groupsById[theirs.gid]} groupLabel={groupLabel} />
        </div>
        {!old && <small className="sw-help">{iAmSender ? 'Aspetta che risponda.' : 'Se accetti, i vostri posti si scambiano.'}</small>}
        {actions}
      </div>
    );
  }

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
        <Card key={sw.id} sw={sw} actions={(
          <div className="row">
            <button className="primary" disabled={busy === sw.id}
              onClick={() => run(sw.id, () => acceptSwap(sw.id, today), 'Scambio fatto! 🎉')}>Accetta</button>
            <button disabled={busy === sw.id}
              onClick={() => run(sw.id, () => setSwapStatus(sw.id, 'rejected'), 'Richiesta rifiutata.')}>Rifiuta</button>
          </div>
        )} />
      ))}

      <h2>Richieste inviate</h2>
      {outPending.length === 0 && <p className="muted">Nessuna richiesta in attesa.</p>}
      {outPending.map((sw) => (
        <Card key={sw.id} sw={sw} actions={(
          <button disabled={busy === sw.id}
            onClick={() => run(sw.id, () => setSwapStatus(sw.id, 'cancelled'), 'Richiesta annullata.')}>Annulla richiesta</button>
        )} />
      ))}

      {past.length > 0 && (
        <>
          <h2>Precedenti</h2>
          {past.map((sw) => <Card key={sw.id} sw={sw} old />)}
        </>
      )}
    </>
  );
}
