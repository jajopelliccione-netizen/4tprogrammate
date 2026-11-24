import { useState } from 'react';
import Accessi from './admin/Accessi';
import Gruppi from './admin/Gruppi';
import Segna from './admin/Segna';
import ProgrammataPicker from '../components/ProgrammataPicker';
import Icon from '../components/Icon';

const TABS = [['segna', 'check', 'Segna'], ['gruppi', 'users', 'Gruppi'], ['accessi', 'key', 'Accessi']];

export default function Admin() {
  const [tab, setTab] = useState(() => sessionStorage.getItem('admintab') || 'segna');
  const pick = (t) => { setTab(t); sessionStorage.setItem('admintab', t); };
  return (
    <>
      <div className="seg">
        {TABS.map(([k, ic, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => pick(k)}><Icon n={ic} size={17} /> {l}</button>
        ))}
      </div>
      {tab !== 'accessi' && <ProgrammataPicker admin />}
      {tab === 'segna' && <Segna />}
      {tab === 'gruppi' && <Gruppi />}
      {tab === 'accessi' && <Accessi />}
    </>
  );
}
