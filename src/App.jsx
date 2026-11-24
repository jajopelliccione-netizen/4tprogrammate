import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Invito from './pages/Invito';
import Cartina from './pages/Cartina';
import Scambi from './pages/Scambi';
import Storico from './pages/Storico';
import Profilo from './pages/Profilo';
import Admin from './pages/Admin';
import { configured } from './lib/firebase';

function Splash({ children }) {
  return <div className="center-page"><div className="panel">{children || <p>Caricamento…</p>}</div></div>;
}

function Protected() {
  const { user, profile, loading, logout } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) {
    return (
      <Splash>
        <h2>Accesso non più valido</h2>
        <p>Questo account non è (più) collegato a uno studente. Chiedi al rappresentante un nuovo link d'invito.</p>
        <button onClick={logout}>Esci</button>
      </Splash>
    );
  }
  return <DataProvider><Layout /></DataProvider>;
}

function AdminOnly({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

export default function App() {
  if (!configured) {
    return (
      <Splash>
        <h2>Configurazione mancante</h2>
        <p>Copia <code>.env.example</code> in <code>.env</code> e inserisci i valori del tuo progetto Firebase (vedi README).</p>
      </Splash>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/invito/:token" element={<Invito />} />
      <Route element={<Protected />}>
        <Route index element={<Cartina />} />
        <Route path="scambi" element={<Scambi />} />
        <Route path="storico" element={<Storico />} />
        <Route path="profilo" element={<Profilo />} />
        <Route path="admin" element={<AdminOnly><Admin /></AdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
