import { NavLink, Outlet } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { badge } = useData();
  const { isAdmin } = useAuth();
  return (
    <div className="app">
      <header className="topbar"><b>Interrogazioni 4T SSA</b></header>
      <main className="main"><Outlet /></main>
      <nav className="tabbar">
        <NavLink to="/" end><span>🗺️</span>Cartina</NavLink>
        {!isAdmin && (
          <NavLink to="/scambi"><span>🔄{badge > 0 && <i className="badge">{badge}</i>}</span>Scambi</NavLink>
        )}
        <NavLink to="/storico"><span>📜</span>Storico</NavLink>
        {isAdmin && <NavLink to="/admin"><span>🛠️</span>Admin</NavLink>}
        <NavLink to="/profilo"><span>👤</span>Profilo</NavLink>
      </nav>
    </div>
  );
}
