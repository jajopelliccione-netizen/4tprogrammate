import { NavLink, Outlet } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

import Icon from './Icon';

export default function Layout() {
  const { badge, rulesError } = useData();
  const { isAdmin } = useAuth();
  return (
    <div className="app">
      <header className="topbar"><span className="logo">4T</span>Interrogazioni</header>
      <main className="main">
        {rulesError && (
          <div className="alertbox">
            <b>Regole di Firestore non aggiornate.</b> Apri la console Firebase → Firestore → Regole, incolla le regole
            più recenti (file <code>firestore.rules</code>) e premi Pubblica. Poi ricarica la pagina.
          </div>
        )}
        <Outlet />
      </main>
      <nav className="tabbar">
        <NavLink to="/" end><span className="ic"><Icon n="map" /></span>Cartina</NavLink>
        {!isAdmin && (
          <NavLink to="/scambi"><span className="ic"><Icon n="swap" />{badge > 0 && <i className="badge">{badge}</i>}</span>Scambi</NavLink>
        )}
        <NavLink to="/storico"><span className="ic"><Icon n="clock" /></span>Storico</NavLink>
        {isAdmin && <NavLink to="/admin"><span className="ic"><Icon n="tool" /></span>Admin</NavLink>}
        <NavLink to="/profilo"><span className="ic"><Icon n="user" /></span>Profilo</NavLink>
      </nav>
    </div>
  );
}
