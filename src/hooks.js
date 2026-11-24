import { useEffect, useState } from 'react';
import { todayStr } from './lib/dates';

// "Oggi" che si aggiorna da solo a mezzanotte e quando si riapre l'app.
export function useToday() {
  const [today, setToday] = useState(todayStr());
  useEffect(() => {
    const refresh = () => setToday(todayStr());
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const t = setTimeout(refresh, next - now);
    const iv = setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearTimeout(t); clearInterval(iv); document.removeEventListener('visibilitychange', refresh); };
  }, [today]);
  return today;
}

export function errMsg(e) {
  const c = e?.code || '';
  if (c.includes('permission-denied')) return 'Operazione non consentita.';
  if (c.includes('wrong-password') || c.includes('invalid-credential') || c.includes('invalid-login')) return 'Password errata.';
  if (c.includes('too-many-requests')) return 'Troppi tentativi, riprova tra qualche minuto.';
  if (c.includes('network')) return 'Problema di connessione.';
  if (c.includes('weak-password')) return 'Password troppo debole (minimo 6 caratteri).';
  return e?.message || 'Errore imprevisto.';
}
