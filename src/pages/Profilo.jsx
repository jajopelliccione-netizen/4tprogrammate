import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/Toast';
import { errMsg } from '../hooks';

export default function Profilo() {
  const { user, isAdmin, logout } = useAuth();
  const { nameOf, mySid } = useData();
  const toast = useToast();
  const [oldPw, setOldPw] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function change(e) {
    e.preventDefault();
    setErr('');
    if (pw.length < 6) return setErr('La nuova password deve avere almeno 6 caratteri.');
    if (pw !== pw2) return setErr('Le due password non coincidono.');
    setBusy(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, oldPw));
      await updatePassword(user, pw);
      setOldPw(''); setPw(''); setPw2('');
      toast('Password cambiata ✔');
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>{isAdmin ? 'Rappresentante' : nameOf(mySid)}</h2>
      <form className="panel flat" onSubmit={change}>
        <h3>Cambia password</h3>
        <label>Password attuale
          <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" required />
        </label>
        <label>Nuova password
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
        </label>
        <label>Ripeti la nuova password
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy}>Salva password</button>
      </form>
      <button className="danger" onClick={logout}>Esci</button>
    </>
  );
}
