import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/Toast';
import GroupCard from '../../components/GroupCard';
import { commitChange, undoEntry } from '../../lib/admin';
import { ABSENT, DONE, WAIT, applyAbsence, applyStatus, markAllDone, subOf } from '../../lib/groups';
import { entryText } from '../../lib/history';
import { formatDate } from '../../lib/dates';
import { errMsg } from '../../hooks';

export default function Segna() {
  const { groups, groupsById, studentsById, today, history, nameOf, currentPid, groupLabel } = useData();
  const toast = useToast();
  const [gid, setGid] = useState('');
  const [busy, setBusy] = useState(false);

  // Gruppo di oggi, altrimenti il primo non ancora fatto.
  const auto = useMemo(() => (groups.find((g) => g.date === today) || groups.find((g) => !g.done) || groups[0])?.id || '', [groups, today]);
  useEffect(() => { if (!gid || !groupsById[gid]) setGid(auto); }, [auto, gid, groupsById]);
  const g = groupsById[gid];

  const lastUndoable = history.find((e) => e.by === 'admin' && !e.undone && e.prev && (e.pid ?? '') === currentPid
    && Object.keys(e.prev).length + (e.created?.length || 0) > 0);

  async function act(fn) {
    setBusy(true);
    try { await fn(); } catch (e) { toast(errMsg(e), { error: true }); } finally { setBusy(false); }
  }
  const undo = (e) => act(async () => { await undoEntry(e); toast('Azione annullata.'); });
  async function commit(changed, entry, msg) {
    await commitChange({ changed, entry, groupsById, studentsById, pid: currentPid });
    toast(msg, { action: { label: 'Annulla', onClick: () => undoLatest() } });
  }
  // dopo il commit lo storico si aggiorna da solo: al tap si annulla la voce più recente (ref = valore aggiornato)
  const histRef = useRef(history);
  histRef.current = history;
  const undoLatest = () => {
    const e = histRef.current.find((h) => h.by === 'admin' && !h.undone && h.prev);  // la più recente (appena fatta)
    if (e) undoEntry(e).then(() => toast('Azione annullata.')).catch((er) => toast(errMsg(er), { error: true }));
  };

  const setSt = (pos, status) => act(async () => {
    const sid = g.seats[pos];
    if (status === ABSENT) {
      const { changed, info } = applyAbsence(groups, gid, pos);
      const msg = info.subSid
        ? `${nameOf(sid)} assente: entra ${nameOf(info.subSid)}, ${nameOf(sid)} passa nel gruppo successivo.`
        : `${nameOf(sid)} assente (nessun sostituto).`;
      await commit(changed, info, msg);
    } else {
      await commit(applyStatus(groups, gid, pos, status),
        { type: status === DONE ? 'interrogato' : 'attesa', sid, group: gid },
        status === DONE ? `${nameOf(sid)} interrogato ✔` : `${nameOf(sid)} rimesso in attesa.`);
    }
  });

  if (!g) return <p className="muted">Crea prima i gruppi (scheda Gruppi).</p>;
  const sub = subOf(groups, g);

  return (
    <>
      <div className="row">
        <select value={gid} onChange={(e) => setGid(e.target.value)}>
          {groups.map((x) => (
            <option key={x.id} value={x.id}>
              Gruppo {x.number} – {formatDate(x.date)}{x.date === today ? ' (oggi)' : ''}{x.done ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </div>

      <GroupCard group={g} groups={groups} studentsById={studentsById} today={today} mySid={null} />

      <ul className="rows">
        {g.seats.map((sid, i) => sid && (
          <li key={i} className="srow">
            <div className="sname"><b>{nameOf(sid)}</b><span className="pill">{g.status[i]}</span></div>
            <div className="row">
              <button className="primary" disabled={busy || g.status[i] === DONE} onClick={() => setSt(i, DONE)}>Interrogato</button>
              <button disabled={busy || g.status[i] === ABSENT} onClick={() => setSt(i, ABSENT)}>Assente</button>
              <button disabled={busy || g.status[i] === WAIT} onClick={() => setSt(i, WAIT)}>In attesa</button>
            </div>
          </li>
        ))}
      </ul>
      <p className="hint">Se segni un assente, il sostituto ({sub ? nameOf(sub) : 'nessuno'}) prende il suo posto e l'assente va al posto del sostituto.</p>
      <button disabled={busy || g.done} onClick={() => act(async () => {
        await commit(markAllDone(groups, gid), { type: 'gruppo_fatto', group: gid }, `Gruppo ${g.number} segnato come fatto.`);
      })}>Segna tutto il gruppo come interrogato</button>

      <div className="undo">
        <button className="danger" disabled={busy || !lastUndoable} onClick={() => undo(lastUndoable)}>↩️ Annulla ultima azione</button>
        {lastUndoable && <small>{entryText(lastUndoable, nameOf, groupLabel)}</small>}
      </div>
    </>
  );
}
