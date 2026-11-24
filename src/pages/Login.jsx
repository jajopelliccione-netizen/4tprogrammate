import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../hooks';

export default function Login() {
  const { user, profile, loading } = useAuth();
  const [students, setStudents] = useState(null);
  const [sid, setSid] = useState('');
  const [pw, setPw] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'students'))
      .then((s) => setStudents(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((e) => { setStudents([]); setErr(errMsg(e)); });
  }, []);

  if (!loading && user && profile) return <Navigate to="/" replace />;

  const active = (students || []).filter((s) => s.activated).sort((a, b) => a.name.localeCompare(b.name, 'it'));

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const mail = adminMode ? email.trim() : students.find((s) => s.id === sid)?.authEmail;
      if (!mail) throw new Error('Scegli il tuo nome.');
      await signInWithEmailAndPassword(auth, mail, pw);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <form className="panel" onSubmit={submit}>
        <h1>Interrogazioni 4T SSA</h1>
        {adminMode ? (
          <label>Email admin
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </label>
        ) : (
          <label>Il tuo nome
            <select value={sid} onChange={(e) => setSid(e.target.value)} required>
              <option value="">{students === null ? 'Caricamento…' : '— scegli —'}</option>
              {active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label>Password
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Accesso…' : 'Entra'}</button>
        {!adminMode && students && active.length === 0 && (
          <p className="hint">Nessun account attivo ancora: apri il link d'invito che ti ha mandato il rappresentante.</p>
        )}
        <button type="button" className="link" onClick={() => { setAdminMode(!adminMode); setErr(''); }}>
          {adminMode ? '← Accesso studenti' : 'Sono il rappresentante (admin)'}
        </button>
      </form>
    </div>
  );
}
