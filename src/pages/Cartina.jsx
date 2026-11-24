import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/Toast';
import GroupCard from '../components/GroupCard';
import Modal from '../components/Modal';
import Dashboard from '../components/Dashboard';
import SwapPicker from '../components/SwapPicker';
import SubBlock from '../components/SubBlock';
import Icon from '../components/Icon';
import { formatDate } from '../lib/dates';
import { ABSENT, DONE, WAIT } from '../lib/groups';
import { createSwap, seatSwappable } from '../lib/swaps';
import { useMarking } from '../useMarking';
import { errMsg } from '../hooks';

export default function Cartina() {
  const { isAdmin } = useAuth();
  const {
    setPid, subBlock, groups, groupsLoaded, studentsById, today, mySid, mySeat, groupsById, outgoing, incoming, nameOf,
  } = useData();
  const toast = useToast();
  const { setStatus, groupDone, absencePreview } = useMarking();
  const gridRef = useRef(null);
  const [openPid, setOpenPid] = useState(null);   // programmata aperta (null = tutte chiuse)
  const [target, setTarget] = useState(null);     // studente: { group, pos, sid } da confermare
  const [picker, setPicker] = useState(null);     // studente: pid per cui scegliere con chi scambiare
  const [blockInfo, setBlockInfo] = useState(null);   // spiegazione: sei sostituto, non puoi cambiare gruppo
  const [mark, setMark] = useState(null);         // admin: { gid, pos } posto da segnare
  const [busy, setBusy] = useState(false);

  const toggle = (id) => {
    setOpenPid((cur) => (cur === id ? null : id));
    setPid(id);
  };
  const askSwap = (pid) => { setPid(pid); setPicker(pid); };

  const myGroup = mySeat ? groupsById[mySeat.gid] : null;
  const mySwappable = mySeat && seatSwappable(myGroup, mySeat.pos, today);

  // Studente: si può toccare un posto altrui solo se entrambi i posti sono scambiabili.
  // Admin: si può toccare qualsiasi posto occupato per segnarlo.
  const canTap = (g, i) => {
    const sid = g.seats[i];
    if (!sid) return false;
    if (isAdmin) return true;
    if (!mySeat || !mySwappable || sid === mySid) return false;
    return seatSwappable(g, i, today);
  };
  const onSeat = (group, pos) => {
    if (isAdmin) return setMark({ gid: group.id, pos });
    const blk = mySeat ? subBlock(mySid, mySeat.gid) : null;
    return blk ? setBlockInfo(blk) : setTarget({ group, pos, sid: group.seats[pos] });
  };

  const alreadyAsked = target && [...outgoing, ...incoming].some((s) => s.status === 'pending' &&
    ((s.toSid === target.sid && s.fromSid === mySid) || (s.fromSid === target.sid && s.toSid === mySid)));

  async function send() {
    setBusy(true);
    try {
      await createSwap({
        meSid: mySid,
        otherSid: target.sid,
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

  async function doMark(status) {
    setBusy(true);
    const ok = await setStatus(mark.gid, mark.pos, status);
    setBusy(false);
    if (ok) setMark(null);
  }

  async function doGroupDone(gid) {
    setBusy(true);
    await groupDone(gid);
    setBusy(false);
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

  const markGroup = mark ? groupsById[mark.gid] : null;
  const markSid = markGroup?.seats[mark.pos];
  const markStatus = markGroup?.status[mark.pos];

  const gruppi = (
    <div className="aperta">
      {mySid && mySeat && (
        <button className="primary bigact" onClick={() => askSwap(openPid)}><Icon n="swap" /> Chiedi uno scambio</button>
      )}
      {isAdmin && <p className="hint">Tocca un nome per segnarlo <b>interrogato</b> o <b>assente</b>.</p>}
      {groups.length === 0 ? (
        <p className="muted">Questa programmata non ha ancora gruppi.</p>
      ) : (
        <div className="grid" ref={gridRef}>
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} groups={groups} studentsById={studentsById} today={today}
              mySid={mySid} canTap={canTap} onSeat={onSeat}
              footerExtra={isAdmin && !g.done && (
                <button className="small primary no-print" disabled={busy} onClick={() => doGroupDone(g.id)}><Icon n="check" size={16} /> Gruppo interrogato</button>
              )} />
          ))}
        </div>
      )}
      <div className="row no-print">
        <button onClick={download}><Icon n="download" /> Scarica immagine</button>
        <button onClick={() => window.print()}><Icon n="print" /> Stampa / PDF</button>
      </div>
    </div>
  );

  return (
    <>
      <Dashboard openPid={openPid} onToggle={toggle} renderOpen={() => gruppi} onSwap={askSwap} />

      {picker !== null && (
        <SwapPicker pid={picker} onClose={() => setPicker(null)}
          onPick={(t) => { setPicker(null); setTarget(t); }} />
      )}

      {blockInfo && <SubBlock block={blockInfo} onClose={() => setBlockInfo(null)} />}

      {target && myGroup && (
        <Modal title="Chiedere uno scambio?" onClose={() => setTarget(null)}
          actions={<>
            <button onClick={() => setTarget(null)}>Annulla</button>
            <button className="primary" disabled={busy || alreadyAsked} onClick={send}>Invia richiesta</button>
          </>}>
          <p>Tu: <b>Gruppo {myGroup.number}</b> ({formatDate(myGroup.date)})<br />
            {studentsById[target.sid]?.name}: <b>Gruppo {target.group.number}</b> ({formatDate(target.group.date)})</p>
          <p>Se accetta, vi scambiate i posti.{!studentsById[target.sid]?.activated && ' Non ha ancora attivato l\'app: vedrà la richiesta appena entra.'}</p>
          {alreadyAsked && <p className="error">C'è già una richiesta in attesa con questo compagno.</p>}
        </Modal>
      )}

      {mark && markGroup && (
        <Modal title={nameOf(markSid)} onClose={() => setMark(null)}
          actions={<button onClick={() => setMark(null)}>Chiudi</button>}>
          <p className="hint">Gruppo {markGroup.number} · {formatDate(markGroup.date)} · ora: <b>{markStatus}</b></p>
          <div className="markbtns">
            <button className="primary" disabled={busy || markStatus === DONE} onClick={() => doMark(DONE)}><Icon n="check" /> Interrogato</button>
            <button disabled={busy || markStatus === ABSENT} onClick={() => doMark(ABSENT)}><Icon n="ban" /> Assente</button>
            {markStatus !== ABSENT && <p className="markinfo">{absencePreview(mark.gid, mark.pos)}</p>}
            <button disabled={busy || markStatus === WAIT} onClick={() => doMark(WAIT)}><Icon n="undo" /> In attesa</button>
          </div>
        </Modal>
      )}
    </>
  );
}
