import { useState } from 'react';
import Modal from './Modal';
import SubTransfer from './SubTransfer';

// Spiega perché non si può cambiare gruppo: sei il sostituto del gruppo prima.
export function SubBlockText({ block, who = 'Sei' }) {
  return (
    <p>
      {who} il <b>sostituto del Gruppo {block.prev.number}</b>{block.prog.subject ? ` (${block.prog.subject})` : ''}.
      Chi è sostituto non può cambiare gruppo: prima deve <b>passare il ruolo di sostituto</b> a un compagno del suo gruppo.
      Solo dopo può cambiare gruppo.
    </p>
  );
}

export default function SubBlock({ block, onClose }) {
  const [pass, setPass] = useState(false);
  if (pass) return <SubTransfer entry={{ group: block.prev, prog: block.prog }} onClose={onClose} />;
  return (
    <Modal title="Prima passa il ruolo di sostituto" onClose={onClose}
      actions={<><button onClick={onClose}>Chiudi</button><button className="primary" onClick={() => setPass(true)}>Passa il ruolo</button></>}>
      <SubBlockText block={block} />
    </Modal>
  );
}
