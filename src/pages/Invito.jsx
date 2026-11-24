import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { errMsg } from '../hooks';

// Attivazione account da link personale: /invito/<token>
export default function Invito() {
  const { token } = useParams();
  const nav = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const inv = await getDoc(doc(db, 'invites', token));
        if (!inv.exists() || inv.data().used) return setState({ status: 'invalid' });
        const st = await getDoc(doc(db, 'students', inv.data().studentId));
        if (!st.exists()) return setState({ status: 'invalid' });
        setState({ status: 'ok', invite: inv.data(), name: st.data().name });
      } catch {
        setState({ status: 'invalid' });
      }
    })();
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (pw.length < 6) return setErr('La password deve avere almeno 6 caratteri.');
    if (pw !== pw2) return setErr('Le due password non coincidono.');
    setBusy(true);
    const { invite } = state;
    try {
      let cred;
      try {
        cred = await createUserWithEmailAndPassword(auth, invite.authEmail, pw);
      } catch (e) {
        // account creato in un tentativo precedente interrotto: riprendiamo da lì
        if (e.code !== 'auth/email-already-in-use') throw e;
        cred = await signInWithEmailAndPassword(auth, invite.authEmail, pw);
      }
      const uid = cred.user.uid;
      // Un solo batch atomico: le Security Rules verificano che le 3 scritture siano insieme.
      const b = writeBatch(db);
      b.set(doc(db, 'users', uid), { role: 'student', studentId: invite.studentId, inviteToken: token });
      b.update(doc(db, 'students', invite.studentId), { activated: true, uid, authEmail: invite.authEmail });
      b.update(doc(db, 'invites', token), { used: true, usedByUid: uid, usedAt: serverTimestamp() });
      await b.commit();
      nav('/', { replace: true });
    } catch (e) {
      const c = e.code || '';
      setErr(c.includes('invalid-credential') || c.includes('wrong-password')
        ? 'Questo account era già stato avviato con un\'altra password. Chiedi al rappresentante un nuovo link.'
        : errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'loading') return <div className="center-page"><p>Caricamento…</p></div>;
  if (state.status === 'invalid') {
    return (
      <div className="center-page">
        <div className="panel">
          <h1>Link non valido</h1>
          <p>Questo link non esiste oppure è già stato usato. Se hai già attivato l'account, vai al login.
            Se hai perso la password, chiedi al rappresentante un nuovo link.</p>
          <a className="primary btn" href="/login">Vai al login</a>
        </div>
      </div>
    );
  }
  return (
    <div className="center-page">
      <form className="panel" onSubmit={submit}>
        <h1>Ciao {state.name}!</h1>
        <p>Scegli la tua password (almeno 6 caratteri). Ti servirà ogni volta che entri.</p>
        <label>Password
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
        </label>
        <label>Ripeti la password
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Creo l\'account…' : 'Attiva il mio account'}</button>
      </form>
    </div>
  );
}
