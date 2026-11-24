import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/Toast';
import { acceptSwap, setSwapStatus } from '../lib/swaps';
import { acceptSubRequest, setSubRequestStatus } from '../lib/substitute';
import { colorOf } from '../components/GroupCard';
import SubBlock, { SubBlockText } from '../components/SubBlock';
import { formatDate } from '../lib/dates';
import { errMsg } from '../hooks';
import Icon from '../components/Icon';

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
  const { incoming, outgoing, nameOf, groupsById, today, isLive, groupLabel, subjectOf, mySid, subBlock, subIn, subOut, subLive } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [blockInfo, setBlockInfo] = useState(null);
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
          <span className="sw-arrow"><Icon n="swap" size={22} /></span>
          <Side who={nameOf(otherSid)} gid={theirs.gid} group={groupsById[theirs.gid]} groupLabel={groupLabel} />
        </div>
        {!old && <small className="sw-help">{iAmSender ? 'Aspetta che risponda.' : 'Se accetti, i vostri posti si scambiano.'}</small>}
        {actions}
      </div>
    );
  }

  const subInPending = subIn.filter(subLive);
  const subOutPending = subOut.filter(subLive);
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
          <>
          {subBlock(mySid, sw.toGroup) && (
            <div className="warnbox">
              <SubBlockText block={subBlock(mySid, sw.toGroup)} />
              <button className="small" onClick={() => setBlockInfo(subBlock(mySid, sw.toGroup))}>Passa il ruolo</button>
            </div>
          )}
          <div className="row">
            <button className="primary" disabled={busy === sw.id || Boolean(subBlock(mySid, sw.toGroup))}
              onClick={() => run(sw.id, () => acceptSwap(sw.id, today), 'Scambio fatto! 🎉')}>Accetta</button>
            <button disabled={busy === sw.id}
              onClick={() => run(sw.id, () => setSwapStatus(sw.id, 'rejected'), 'Richiesta rifiutata.')}>Rifiuta</button>
          </div>
          </>
        )} />
      ))}

      {(subInPending.length > 0 || subOutPending.length > 0) && <h2>Ruolo di sostituto</h2>}
      {subInPending.map((r) => (
        <div className="item swcard" key={r.id}>
          <div className="sw-top"><span className="pill">{subjectOf(r.gid)}</span></div>
          <p className="sw-sentence"><b>{nameOf(r.fromSid)}</b> ti chiede di fare il <b>sostituto del {groupLabel(r.gid)}</b>.</p>
          <small className="sw-help">Il sostituto è la persona che prende il posto di un assente di quel gruppo.</small>
          <div className="row">
            <button className="primary" disabled={busy === r.id}
              onClick={() => run(r.id, () => acceptSubRequest(r), 'Ora sei il sostituto.')}>Accetta</button>
            <button disabled={busy === r.id}
              onClick={() => run(r.id, () => setSubRequestStatus(r.id, 'rejected'), 'Richiesta rifiutata.')}>Rifiuta</button>
          </div>
        </div>
      ))}
      {subOutPending.map((r) => (
        <div className="item swcard" key={r.id}>
          <div className="sw-top"><span className="pill">{subjectOf(r.gid)}</span></div>
          <p className="sw-sentence">Hai chiesto a <b>{nameOf(r.toSid)}</b> di fare il sostituto del {groupLabel(r.gid)}.</p>
          <small className="sw-help">Aspetta che risponda.</small>
          <button disabled={busy === r.id}
            onClick={() => run(r.id, () => setSubRequestStatus(r.id, 'cancelled'), 'Richiesta annullata.')}>Annulla richiesta</button>
        </div>
      ))}

      {blockInfo && <SubBlock block={blockInfo} onClose={() => setBlockInfo(null)} />}

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
