import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/Toast';
import GroupCard from '../components/GroupCard';
import Modal from '../components/Modal';
import Dashboard from '../components/Dashboard';
import { formatDate } from '../lib/dates';
import { createSwap, seatSwappable } from '../lib/swaps';
import { errMsg } from '../hooks';

export default function Cartina() {
  const { user, isAdmin } = useAuth();
  const { subject, programmate, setPid, groups, groupsLoaded, studentsById, today, mySid, mySeat, groupsById, outgoing, incoming } = useData();
  const toast = useToast();
  const gridRef = useRef(null);
  const materiaRef = useRef(null);
  const pick = (id) => {
    setPid(id);
    setTimeout(() => materiaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const [target, setTarget] = useState(null); // { group, pos }
  const [busy, setBusy] = useState(false);

  const myGroup = mySeat ? groupsById[mySeat.gid] : null;
  const mySwappable = mySeat && seatSwappable(myGroup, mySeat.pos, today);

  // Si può toccare un posto altrui solo se entrambi i posti sono scambiabili.
  const canTap = (g, i) => {
    if (isAdmin || !mySeat || !mySwappable) return false;
    const sid = g.seats[i];
    if (!sid || sid === mySid) return false;
    return seatSwappable(g, i, today) && Boolean(studentsById[sid]?.uid);
  };

  const alreadyAsked = target && [...outgoing, ...incoming].some((s) => s.status === 'pending' &&
    ((s.toSid === target.sid && s.fromSid === mySid) || (s.fromSid === target.sid && s.toSid === mySid)));

  async function send() {
    setBusy(true);
    try {
      await createSwap({
        me: { uid: user.uid, sid: mySid },
        other: { uid: studentsById[target.sid].uid, sid: target.sid },
        from: mySeat,
        to: { gid: target.group.id, pos: target.pos },
      });
      toast('Richiesta inviata! Ti avviso quando risponde.');
      setTarget(null);
    } catch (e) {
      toast(errMsg(e), { error: true });
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    try {
      const url = await toPng(gridRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cartina-interrogazioni-4T-SSA.png';
      a.click();
    } catch {
      toast('Non riesco a creare l\'immagine. Prova "Stampa / PDF".', { error: true });
    }
  }

  if (!groupsLoaded) return <p className="muted">Caricamento…</p>;

  return (
    <>
      <Dashboard onPickProg={pick} />

      <div ref={materiaRef} className="materia-anchor" />
      <h2 className="titolo">Cartina{subject && <> · <b>{subject}</b></>} <small>· 4T SSA</small></h2>
      {mySid && mySeat && mySwappable && <p className="hint">Per chiedere uno scambio tocca il nome di un compagno (⇄).</p>}

      {groups.length === 0 ? (
        <p className="muted">{programmate.length ? 'Questa programmata non ha ancora gruppi.' : 'Le programmate non sono ancora state create.'}</p>
      ) : (
        <div className="grid" ref={gridRef}>
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} groups={groups} studentsById={studentsById} today={today}
              mySid={mySid} canTap={canTap}
              onSeat={(group, pos) => setTarget({ group, pos, sid: group.seats[pos] })} />
          ))}
        </div>
      )}

      <div className="row no-print">
        <button onClick={download}>⬇️ Scarica immagine</button>
        <button onClick={() => window.print()}>🖨️ Stampa / PDF</button>
      </div>

      {target && (
        <Modal title="Chiedere uno scambio?" onClose={() => setTarget(null)}
          actions={<>
            <button onClick={() => setTarget(null)}>Annulla</button>
            <button className="primary" disabled={busy || alreadyAsked} onClick={send}>Invia richiesta</button>
          </>}>
          <p>Tu: <b>Gruppo {myGroup.number}</b> ({formatDate(myGroup.date)})<br />
            {studentsById[target.sid]?.name}: <b>Gruppo {target.group.number}</b> ({formatDate(target.group.date)})</p>
          <p>Se accetta, vi scambiate i posti.</p>
          {alreadyAsked && <p className="error">C'è già una richiesta in attesa con questo compagno.</p>}
        </Modal>
      )}
    </>
  );
}
