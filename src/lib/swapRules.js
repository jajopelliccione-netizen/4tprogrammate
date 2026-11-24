// Regole di validità degli scambi (pure, senza Firebase): le stesse delle Security Rules.
import { WAIT } from './groups.js';

// Il giorno è "futuro" se la data è dopo oggi. Senza data: ancora scambiabile.
export const isFutureDay = (g, today) => !g.date || g.date > today;

export function seatSwappable(g, pos, today) {
  return Boolean(g && g.seats[pos] && g.status[pos] === WAIT && !g.done && isFutureDay(g, today));
}

// La richiesta è ancora applicabile ai gruppi come sono adesso?
export function swapValidNow(sw, groupsById, today) {
  const ga = groupsById[sw.fromGroup];
  const gb = groupsById[sw.toGroup];
  if (!ga || !gb) return false;
  return (
    ga.seats[sw.fromPos] === sw.fromSid &&
    gb.seats[sw.toPos] === sw.toSid &&
    seatSwappable(ga, sw.fromPos, today) &&
    seatSwappable(gb, sw.toPos, today)
  );
}
