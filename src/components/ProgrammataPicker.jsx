import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/Toast';
import { createProgrammata } from '../lib/admin';
import { errMsg } from '../hooks';
import Icon from './Icon';

// Schede per scegliere la programmata (materia). Per l'admin c'è anche "+ Nuova".
export default function ProgrammataPicker({ admin = false }) {
  const { programmate, currentPid, setPid } = useData();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await createProgrammata(name, programmate.filter((p) => !p.virtual));
      setPid(id);
      setName('');
      setAdding(false);
      toast(`Programmata "${name.trim()}" creata.`);
    } catch (er) {
      toast(errMsg(er), { error: true });
    } finally {
      setBusy(false);
    }
  }

  if (!admin && programmate.length <= 1) return null;
  return (
    <div className="progbar no-print">
      <div className="progtabs">
        {programmate.map((p) => (
          <button key={p.id || 'x'} className={p.id === currentPid ? 'on' : ''} onClick={() => setPid(p.id)}>{p.subject}</button>
        ))}
        {admin && <button className="plus" onClick={() => setAdding(!adding)}><Icon n="plus" size={16} /> Nuova</button>}
      </div>
      {admin && adding && (
        <form className="row" onSubmit={create}>
          <input autoFocus placeholder="Materia (es. Italiano)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="primary" disabled={busy || !name.trim()}>Crea programmata</button>
        </form>
      )}
    </div>
  );
}
