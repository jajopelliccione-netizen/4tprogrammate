import { useState } from 'react';
import Accessi from './admin/Accessi';
import Gruppi from './admin/Gruppi';
import Segna from './admin/Segna';

const TABS = [['segna', '✅ Segna'], ['gruppi', '👥 Gruppi'], ['accessi', '🔑 Accessi']];

export default function Admin() {
  const [tab, setTab] = useState(() => sessionStorage.getItem('admintab') || 'segna');
  const pick = (t) => { setTab(t); sessionStorage.setItem('admintab', t); };
  return (
    <>
      <div className="seg">
        {TABS.map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => pick(k)}>{l}</button>
        ))}
      </div>
      {tab === 'segna' && <Segna />}
      {tab === 'gruppi' && <Gruppi />}
      {tab === 'accessi' && <Accessi />}
    </>
  );
}
