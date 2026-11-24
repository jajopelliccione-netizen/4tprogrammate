import { NavLink, Outlet } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const I = {
  map: <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20" />,
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4m4 4H7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  tool: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};
const Icon = ({ n }) => <svg viewBox="0 0 24 24" aria-hidden="true">{I[n]}</svg>;

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
