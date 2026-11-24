import { useState } from 'react';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/Toast';
import {
  addGroup, commitChange, deleteGroup, setGroupDate, setGroupDates, setGroupSub, setSubject,
} from '../../lib/admin';
import { buildImport, parseGroupsText } from '../../lib/importGroups';
import { colorOf } from '../../components/GroupCard';
import { MAX_SEATS, SEATS, WAIT, distribute, finalize, findSeat, moveStudent, shuffled, subOf } from '../../lib/groups';
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
  const { groups, groupsById, students, studentsById, nameOf, subject } = useData();
  const toast = useToast();
  const [picked, setPicked] = useState(null);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nGroups, setNGroups] = useState(Math.max(1, Math.ceil(students.filter((s) => !s.excluded).length / SEATS)));
  const [shuffle, setShuffle] = useState(false);
  const [start, setStart] = useState('');
  const [step, setStep] = useState(7);
  const [subj, setSubj] = useState(subject || '');
  const [importText, setImportText] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast(errMsg(e), { error: true }); } finally { setBusy(false); }
  };

  const seated = new Set(groups.flatMap((g) => g.seats.filter(Boolean)));
  const pool = students.filter((s) => !seated.has(s.id));

  function move(sid, target) {
    const changed = moveStudent(groups, sid, target);
    if (!Object.keys(changed).length) return;
    run(() => commitChange({
      changed, groupsById, studentsById,
      entry: { type: 'sposta', sid, to: target.pool ? null : target.gid },
    }));
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
      await commitChange({ changed, studentPatches: { [s.id]: { excluded: true } }, groupsById, studentsById,
        entry: { type: 'escluso', sid: s.id } });
      toast(`${s.name} escluso dalle programmate.`);
    } else {
      // reinserito: va nel primo posto libero (se c'è)
      let changed = {};
      for (const g of groups) {
        const pos = g.seats.indexOf('');
        if (pos >= 0) { changed = moveStudent(groups, s.id, { gid: g.id, pos }); break; }
      }
      await commitChange({ changed, studentPatches: { [s.id]: { excluded: false } }, groupsById, studentsById,
        entry: { type: 'reinserito', sid: s.id } });
      toast(`${s.name} reinserito.`);
    }
    setPicked(null);
  });

  const auto = () => {
    const base = students.filter((s) => !s.excluded).map((s) => s.id);
    const ids = shuffle ? shuffled(base) : base;
    const res = distribute(ids, Number(nGroups), groups);
    if (!confirm(`Ridistribuire ${ids.length} studenti in ${nGroups} gruppi? I gruppi attuali (posti e stati) vengono sostituiti; le date restano. Potrai annullare.`)) return;
    run(async () => {
      await commitChange({ changed: res.groups, deleted: res.deleted, groupsById, studentsById,
        entry: { type: 'distribuzione', n: Number(nGroups) } });
      toast(res.overflow ? `Distribuiti. ${res.overflow} studenti restano fuori: aumenta i gruppi.` : 'Gruppi creati ✔');
    });
  };

  const applyDates = () => run(async () => {
    const dates = groups.map((_, i) => addDays(start, i * Number(step)));
    await setGroupDates(groups, dates);
    toast('Date impostate.');
  });

  const doImport = () => {
    const { groups: parsed, errors } = parseGroupsText(importText, students);
    if (errors.length) { toast(errors.slice(0, 3).join(' · '), { error: true }); return; }
    if (!parsed.length) { toast('Nessun gruppo trovato.', { error: true }); return; }
    if (!confirm(`Importare ${parsed.length} gruppi? Sostituiscono quelli attuali (le date restano). Potrai annullare.`)) return;
    const { changed, deleted } = buildImport(parsed, groups);
    run(async () => {
      await commitChange({ changed, deleted, groupsById, studentsById, entry: { type: 'importa', n: parsed.length } });
      toast('Gruppi importati ✔');
      setImportText('');
    });
  };

  const toggleFifth = (g) => {
    const add = g.seats.length < MAX_SEATS;
    const doc5 = { ...g, seats: [...g.seats], status: [...g.status] };
    if (add) { doc5.seats.push(''); doc5.status.push(WAIT); } else { doc5.seats.pop(); doc5.status.pop(); }
    run(() => commitChange({ changed: { [g.id]: finalize(doc5) }, groupsById, studentsById,
      entry: { type: 'posto', group: g.id, add } }));
  };

  const sel = picked ? studentsById[picked] : null;
  const subCandidates = (g) => groups.filter((x) => x.id !== g.id)
    .flatMap((x) => x.seats.filter(Boolean).map((sid) => sid));

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActive(String(e.active.id).replace('stu:', ''))}
      onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <p className="hint">Trascina i nomi (o tocca un nome e poi un posto). Se il posto è occupato, i due si scambiano.</p>

      {sel && (
        <div className="pickbar">
          <b>{sel.name}</b>
          <button disabled={busy} onClick={() => toggleExcluded(sel)}>{sel.excluded ? 'Reinserisci' : 'Escludi dalle programmate'}</button>
          <button onClick={() => setPicked(null)}>✕</button>
        </div>
      )}

      <div className="grid">
        {groups.map((g) => {
          const sub = subOf(groups, g);
          return (
            <section key={g.id} className={`gcard ${colorOf(g.number)}`}>
              <header>
                <h3>Gruppo {g.number}</h3>
                <input type="date" value={g.date || ''} onChange={(e) => run(() => setGroupDate(g.id, e.target.value))} />
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
                {(g.seats.length < MAX_SEATS || !g.seats[MAX_SEATS - 1]) && (
                  <button className="small" disabled={busy} onClick={() => toggleFifth(g)}>
                    {g.seats.length < MAX_SEATS ? '+ 5° posto' : '− togli 5° posto'}
                  </button>
                )}
                {g.seats.every((s) => !s) && g.number === Math.max(...groups.map((x) => x.number)) && (
                  <button className="danger small" onClick={() => run(() => deleteGroup(g.id))}>Elimina gruppo</button>
                )}
              </footer>
            </section>
          );
        })}
      </div>

      <h2>Fuori dai gruppi</h2>
      <Slot id="pool" className="pool" onTap={() => tapTarget({ pool: true })}>
        {pool.length === 0 && <span className="vuoto">Nessuno</span>}
        {pool.map((s) => (
          <Chip key={s.id} s={s} picked={picked === s.id} onPick={(id) => setPicked(picked === id ? null : id)} />
        ))}
      </Slot>
      {pool.some((s) => s.excluded) && <p className="hint">I nomi sbarrati sono esclusi dalle programmate.</p>}

      <h2>Strumenti</h2>
      <div className="panel flat">
        <button disabled={busy} onClick={() => run(() => addGroup(groups))}>+ Aggiungi gruppo</button>
        <label>Numero di gruppi
          <input type="number" min="1" max="30" value={nGroups} onChange={(e) => setNGroups(e.target.value)} />
        </label>
        <label className="inline"><input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> Ordine casuale</label>
        <button className="primary" disabled={busy || !students.length} onClick={auto}>🎲 Distribuisci automaticamente</button>
      </div>
      <div className="panel flat">
        <h3>Materia</h3>
        <label>Materia delle interrogazioni
          <input value={subj} onChange={(e) => setSubj(e.target.value)} placeholder="Es. Italiano" />
        </label>
        <button disabled={busy} onClick={() => run(async () => { await setSubject(subj); toast('Materia salvata.'); })}>Salva materia</button>
      </div>
      <div className="panel flat">
        <h3>Importa gruppi da testo</h3>
        <p className="hint">Una riga per gruppo, cognomi separati da virgola, sostituto dopo "|". Esempio:<br />
          <code>Gruppo 1: Tasmi, Sciumè, Perricone, Maino | Sostituto: Guzzardi</code></p>
        <textarea rows={7} value={importText} onChange={(e) => setImportText(e.target.value)} />
        <button className="primary" disabled={busy || !importText.trim()} onClick={doImport}>Importa i gruppi</button>
      </div>
      <div className="panel flat">
        <h3>Date a cadenza</h3>
        <label>Prima data<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Ogni quanti giorni<input type="number" min="1" value={step} onChange={(e) => setStep(e.target.value)} /></label>
        <button disabled={busy || !start || !groups.length} onClick={applyDates}>Imposta le date</button>
      </div>

      <DragOverlay>{active ? <div className="chip drag">{nameOf(active)}</div> : null}</DragOverlay>
    </DndContext>
  );
}
