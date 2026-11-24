import { groupNumber } from './groups';

// Testo italiano di una voce di storico. Le voci contengono solo id, i nomi si leggono qui.
export function entryText(e, nameOf) {
  const g = (id) => `Gruppo ${groupNumber(id)}`;
  switch (e.type) {
    case 'swap':
      return `Scambio: ${nameOf(e.fromSid)} (${g(e.fromGroup)}) ⇄ ${nameOf(e.toSid)} (${g(e.toGroup)})`;
    case 'absenza':
      return e.subSid
        ? `${nameOf(e.sid)} assente (${g(e.group)}). Al suo posto ${nameOf(e.subSid)}; ${nameOf(e.sid)} passa nel ${g(e.toGroup)}.`
        : `${nameOf(e.sid)} assente (${g(e.group)}). Nessun sostituto disponibile.`;
    case 'interrogato':
      return `${nameOf(e.sid)} interrogato (${g(e.group)})`;
    case 'attesa':
      return `${nameOf(e.sid)} rimesso in attesa (${g(e.group)})`;
    case 'gruppo_fatto':
      return `${g(e.group)} segnato come fatto`;
    case 'sposta':
      return e.to
        ? `${nameOf(e.sid)} spostato in ${g(e.to)}`
        : `${nameOf(e.sid)} tolto dai gruppi`;
    case 'escluso':
      return `${nameOf(e.sid)} escluso dalle programmate`;
    case 'reinserito':
      return `${nameOf(e.sid)} reinserito nelle programmate`;
    case 'distribuzione':
      return `Gruppi ridistribuiti automaticamente (${e.n} gruppi)`;
    case 'importa':
      return `Gruppi importati (${e.n} gruppi)`;
    case 'posto':
      return e.add ? `${g(e.group)}: aggiunto un posto` : `${g(e.group)}: tolto un posto`;
    default:
      return e.type;
  }
}

export const typeIcon = (t) =>
  ({ swap: '🔄', absenza: '🚫', interrogato: '✅', attesa: '↩️', gruppo_fatto: '✅', sposta: '↔️', escluso: '⛔', reinserito: '➕', distribuzione: '🎲', importa: '📥', posto: '💺' }[t] || '•');
