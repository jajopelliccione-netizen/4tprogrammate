// Richieste per passare il ruolo di sostituto (pure, senza Firebase). Stesse regole di firestore.rules.
import { WAIT, pidOf, sortGroups, subOf } from './groups.js';
import { isFutureDay } from './swapRules.js';

// La richiesta ha ancora senso? (chi la manda è ancora il sostituto, il destinatario sta ancora nel
// gruppo del sostituto ed è in attesa, il gruppo non è fatto né iniziato)
export function subRequestLive(sr, allGroups, today) {
  const g = allGroups.find((x) => x.id === sr.gid);
  if (!g || g.done || !isFutureDay(g, today)) return false;
  const groups = sortGroups(allGroups.filter((x) => pidOf(x) === pidOf(g)));
  const next = groups[groups.findIndex((x) => x.id === g.id) + 1];
  if (!next || subOf(groups, g) !== sr.fromSid) return false;
  const pos = next.seats.indexOf(sr.toSid);
  return pos >= 0 && next.status[pos] === WAIT;
}
