import { useState } from 'react';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/Toast';
import {
  addGroup, commitChange, deleteGroup, deleteProgrammata, renameProgrammata, setGroupDate, setGroupDates, setGroupSub,
} from '../../lib/admin';
import { buildImport, parseGroupsText } from '../../lib/importGroups';
import { colorOf } from '../../components/GroupCard';
import { MAX_SEATS, SEATS, WAIT, distribute, finalize, moveStudent, shuffled, subOf } from '../../lib/groups';
import { addDays } from '../../lib/dates';
import { errMsg } from '../../hooks';

function Chip({ s, picked, onPick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `stu:${s.id}` });
  return (
    <button ref={setNodeRef} {...listeners} {...attributes} type="button"
      className={`chip ${picked ? 'picked' : ''} ${s.excluded ? 'excl' : ''} ${isDragging ? 'drag' : ''}`}
      onClick={() => onPick(s.id)}>
      {s.name}
    </button>
  );
}

function Slot({ id, onTap, children, className = '' }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} onClick={onTap} className={`slot ${isOver ? 'over' : ''} ${className}`}>{children}</div>
  );
}

export default function Gruppi() {
  const {
    groups, groupsById, students, studentsById, nameOf, currentPid, currentProg, programmate, setPid,
  } = useData();
  const toast = useToast();
  const [picked, setPicked] = useState(null);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nGroups, setNGroups] = useState(Math.max(1, Math.floor(students.filter((s) => !s.excluded).length / SEATS)));
  const [shuffle, setShuffle] = useState(false);
  const [start, setStart] = useState('');
  const [step, setStep] = useState(7);
  const [subj, setSubj] = useState('');
  const [importText, setImportText] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast(errMsg(e), { error: true }); } finally { setBusy(false); }
  };
  const commit = (args) => commitChange({ groupsById, studentsById, pid: currentPid, ...args });

  if (!currentProg) {
    return <p className="muted">Crea prima una programmata (materia) con il pulsante <b>+ Nuova</b> qui sopra.</p>;
  }

  // chi è in un posto di QUESTA programmata
  const seated = new Set(groups.flatMap((g) => g.seats.filter(Boolean)));
  const pool = students.filter((s) => !seated.has(s.id));

  function move(sid, target) {
    const changed = moveStudent(groups, sid, target);
    if (!Object.keys(changed).length) return;
    run(() => commit({ changed, entry: { type: 'sposta', sid, to: target.pool ? null : target.gid } }));
  }

  function onDragEnd({ active: a, over }) {
    setActive(null);
    if (!over) return;
    const sid = String(a.id).replace('stu:', '');
    const [kind, gid, pos] = String(over.id).split(':');
    move(sid, kind === 'pool' ? { pool: true } : { gid, pos: Number(pos) });
  }

  // tap-per-spostare (utile su telefono): tocca il nome, poi il posto
  const tapTarget = (target) => {
    if (!picked) return;
    move(picked, target);
    setPicked(null);
  };

  const toggleExcluded = (s) => run(async () => {
    if (!s.excluded) {
      const changed = moveStudent(groups, s.id, { pool: true });
      await commit({ changed, studentPatches: { [s.id]: { excluded: true } }, entry: { type: 'escluso', sid: s.id } });
      toast(`${s.name} escluso dalle programmate.`);
    } else {
      let changed = {};
      for (const g of groups) {
        const pos = g.seats.indexOf('');
        if (pos >= 0) { changed = moveStudent(groups, s.id, { gid: g.id, pos }); break; }
      }
      await commit({ changed, studentPatches: { [s.id]: { excluded: false } }, entry: { type: 'reinserito', sid: s.id } });
      toast(`${s.name} reinserito.`);
    }
    setPicked(null);
  });

  // + posto: porta un gruppo da 4 a 5 persone (e viceversa se l'ultimo posto è libero)
  const changeSeats = (g, add) => {
    const d = { ...g, seats: [...g.seats], status: [...g.status] };
    if (add) { d.seats.push(''); d.status.push(WAIT); } else { d.seats.pop(); d.status.pop(); }
    run(() => commit({ changed: { [g.id]: finalize(d) }, entry: { type: 'posto', group: g.id, add } }));
  };

  const auto = () => {
    const base = students.filter((s) => !s.excluded).map((s) => s.id);
    const ids = shuffle ? shuffled(base) : base;
    const res = distribute(ids, Number(nGroups), groups, currentPid);
    if (!confirm(`Ridistribuire ${ids.length} studenti in ${nGroups} gruppi di "${currentProg.subject}"? I gruppi attuali di questa materia (posti e stati) vengono sostituiti; le date restano. Potrai annullare.`)) return;
    run(async () => {
      await commit({ changed: res.groups, deleted: res.deleted, entry: { type: 'distribuzione', n: Number(nGroups) } });
      toast(res.overflow ? `Distribuiti. ${res.overflow} studenti restano fuori: aumenta i gruppi.` : 'Gruppi creati ✔');
    });
  };

  const doImport = () => {
    const { groups: parsed, errors } = parseGroupsText(importText, students);
    if (errors.length) { toast(errors.slice(0, 3).join(' · '), { error: true }); return; }
    if (!parsed.length) { toast('Nessun gruppo trovato.', { error: true }); return; }
    if (!confirm(`Importare ${parsed.length} gruppi in "${currentProg.subject}"? Sostituiscono quelli attuali di questa materia (le date restano). Potrai annullare.`)) return;
    const { changed, deleted } = buildImport(parsed, groups, currentPid);
    run(async () => {
      await commit({ changed, deleted, entry: { type: 'importa', n: parsed.length } });
      toast('Gruppi importati ✔');
      setImportText('');
    });
  };

  const applyDates = () => run(async () => {
    await setGroupDates(groups, groups.map((_, i) => addDays(start, i * Number(step))));
    toast('Date impostate.');
  });

  const removeProg = () => {
    if (!confirm(`Eliminare la programmata "${currentProg.subject}" con tutti i suoi gruppi? Non si può annullare.`)) return;
    run(async () => {
      await deleteProgrammata(currentPid, groups);
      setPid('');
      toast('Programmata eliminata.');
    });
  };

  const sel = picked ? studentsById[picked] : null;
  const lastNumber = groups.length ? Math.max(...groups.map((x) => x.number)) : 0;
  // il sostituto può essere solo una persona del gruppo SUCCESSIVO
  const subCandidates = (g) => {
    const next = groups[groups.findIndex((x) => x.id === g.id) + 1];
    return next ? next.seats.filter(Boolean) : [];
  };

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActive(String(e.active.id).replace('stu:', ''))}
      onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>

      <div className="boardhead">
        <h2 style={{ margin: 0 }}>{currentProg.subject}</h2>
        <button className="small" disabled={busy} onClick={() => run(async () => { await addGroup(groups, currentPid); })}>+ Gruppo</button>
      </div>
      <p className="hint">Trascina i nomi (o tocca un nome e poi un posto). Se il posto è occupato, i due si scambiano.</p>

      {sel && (
        <div className="pickbar">
          <b>{sel.name}</b>
          <button disabled={busy} onClick={() => toggleExcluded(sel)}>{sel.excluded ? 'Reinserisci' : 'Escludi'}</button>
          <button onClick={() => setPicked(null)}>✕</button>
        </div>
      )}

      {groups.length === 0 && <p className="muted">Nessun gruppo: usa "Distribuisci automaticamente" o "Importa gruppi da testo" qui sotto.</p>}
      <div className="grid">
        {groups.map((g) => {
          const sub = subOf(groups, g);
          return (
            <section key={g.id} className={`gcard ${colorOf(g.number)}`}>
              <header>
                <h3>Gruppo {g.number}</h3>
                <span className="dategrp">
                  <input type="date" value={g.date || ''} onChange={(e) => run(() => setGroupDate(g.id, e.target.value))} />
                  {g.date && (
                    <button type="button" className="small cleardate" disabled={busy} aria-label="Togli la data" title="Togli la data"
                      onClick={() => run(() => setGroupDate(g.id, ''))}>✕</button>
                  )}
                </span>
              </header>
              <ul>
                {g.seats.map((sid, i) => (
                  <li key={i} className="seat">
                    <Slot id={`seat:${g.id}:${i}`} onTap={() => tapTarget({ gid: g.id, pos: i })}>
                      {sid ? <Chip s={studentsById[sid] || { id: sid, name: '(?)' }} picked={picked === sid}
                        onPick={(id) => setPicked(picked === id ? null : id)} /> : <span className="vuoto">libero</span>}
                    </Slot>
                  </li>
                ))}
              </ul>
              <footer>
                <label className="sublabel">Sostituto
                  <select value={g.subId || ''} onChange={(e) => run(() => setGroupSub(g.id, e.target.value))}>
                    <option value="">Auto ({sub ? nameOf(sub) : '—'})</option>
                    {subCandidates(g).map((sid) => <option key={sid} value={sid}>{nameOf(sid)}</option>)}
                  </select>
                </label>
                {g.seats.length < MAX_SEATS && (
                  <button className="small addseat" title="Aggiungi una persona al gruppo" disabled={busy} onClick={() => changeSeats(g, true)}>+ Persona</button>
                )}
                {g.seats.length >= MAX_SEATS && !g.seats[g.seats.length - 1] && (
                  <button className="small addseat" disabled={busy} onClick={() => changeSeats(g, false)}>− Posto</button>
                )}
                {g.seats.every((s) => !s) && g.number === lastNumber && (
                  <button className="danger small" disabled={busy} onClick={() => run(() => deleteGroup(g.id))}>Elimina gruppo</button>
                )}
              </footer>
            </section>
          );
        })}
      </div>

      <h2>Fuori da questa programmata</h2>
      <Slot id="pool" className="pool" onTap={() => tapTarget({ pool: true })}>
        {pool.length === 0 && <span className="vuoto">Nessuno</span>}
        {pool.map((s) => (
          <Chip key={s.id} s={s} picked={picked === s.id} onPick={(id) => setPicked(picked === id ? null : id)} />
        ))}
      </Slot>
      {pool.some((s) => s.excluded) && <p className="hint">I nomi sbarrati sono esclusi dalle programmate.</p>}

      <details className="sec">
        <summary>🎲 Distribuisci automaticamente</summary>
        <label>Numero di gruppi
          <input type="number" min="1" max="30" value={nGroups} onChange={(e) => setNGroups(e.target.value)} />
        </label>
        <p className="hint">Gruppi da 4. Se avanzano persone, l'ultimo posto in più va agli ultimi gruppi
          (es. 17 studenti in 4 gruppi → 4, 4, 4, 5).</p>
        <label className="inline"><input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> Ordine casuale</label>
        <button className="primary" disabled={busy || !students.length} onClick={auto}>Distribuisci</button>
      </details>

      <details className="sec">
        <summary>📥 Importa gruppi da testo</summary>
        <p className="hint">Una riga per gruppo, cognomi separati da virgola, sostituto dopo "|":<br />
          <code>Gruppo 1: Tasmi, Sciumè, Perricone, Maino | Sostituto: Guzzardi</code><br />
          Si possono scrivere fino a 5 nomi per gruppo.</p>
        <textarea rows={7} value={importText} onChange={(e) => setImportText(e.target.value)} />
        <button className="primary" disabled={busy || !importText.trim()} onClick={doImport}>Importa i gruppi</button>
      </details>

      <details className="sec">
        <summary>📅 Date a cadenza</summary>
        <label>Prima data<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Ogni quanti giorni<input type="number" min="1" value={step} onChange={(e) => setStep(e.target.value)} /></label>
        <button disabled={busy || !start || !groups.length} onClick={applyDates}>Imposta le date</button>
        <button className="danger" disabled={busy || !groups.some((g) => g.date)} onClick={() => {
          if (confirm(`Togliere la data a tutti i gruppi di "${currentProg.subject}"?`)) {
            run(async () => { await setGroupDates(groups, groups.map(() => null)); toast('Date tolte.'); });
          }
        }}>Togli tutte le date</button>
      </details>

      <details className="sec">
        <summary>⚙️ Programmata: nome ed eliminazione</summary>
        {!currentProg.virtual && (
          <>
            <label>Materia
              <input value={subj || currentProg.subject} onChange={(e) => setSubj(e.target.value)} />
            </label>
            <button disabled={busy || !subj.trim()} onClick={() => run(async () => { await renameProgrammata(currentPid, subj); setSubj(''); toast('Nome salvato.'); })}>Salva nome</button>
          </>
        )}
        <button className="danger" disabled={busy} onClick={removeProg}>Elimina questa programmata</button>
        {programmate.length > 1 && <p className="hint">Per passare a un'altra materia usa le schede in alto.</p>}
      </details>

      <DragOverlay>{active ? <div className="chip drag">{nameOf(active)}</div> : null}</DragOverlay>
    </DndContext>
  );
}
