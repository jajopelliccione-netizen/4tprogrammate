// Calcoli per la dashboard (puri, senza Firebase).
import { DONE, WAIT, pidOf, subOf } from './groups.js';

const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// Giorni da oggi alla data (negativo = passata, null = senza data).
export function daysUntil(dateStr, today) {
  if (!dateStr) return null;
  return Math.round((parse(dateStr) - parse(today)) / 864e5);
}

export function whenLabel(days) {
  if (days === null) return 'data da definire';
  if (days === 0) return 'oggi';
  if (days === 1) return 'domani';
  if (days === -1) return 'ieri';
  if (days > 1) return `tra ${days} giorni`;
  return `${-days} giorni fa`;
}

// Le interrogazioni dello studente, una per programmata in cui è inserito.
// Ordine: prima quelle ancora da fare (per data, senza data in fondo), poi le fatte.
export function myEntries(allGroups, programmate, mySid, today) {
  const out = [];
  for (const prog of programmate) {
    const groups = allGroups.filter((g) => pidOf(g) === prog.id);
    for (const g of groups) {
      const pos = g.seats.indexOf(mySid);
      if (!mySid || pos < 0) continue;
      const status = g.status[pos];
      const days = daysUntil(g.date, today);
      const upcoming = status === WAIT && !g.done && (days === null || days >= 0);
      out.push({
        prog, group: g, pos, status, days, upcoming,
        mates: g.seats.filter((s, i) => s && i !== pos),
        sub: subOf(groups, g),
      });
    }
  }
  const key = (e) => (e.upcoming ? (e.days ?? 9999) : 10000 + (e.days ?? 0) * -1);
  return out.sort((a, b) => key(a) - key(b));
}

export const nextEntry = (entries) => entries.find((e) => e.upcoming) || null;

// Dove sono sostituto (solo gruppi ancora da fare).
export function mySubstitutions(allGroups, programmate, mySid, today) {
  const out = [];
  for (const prog of programmate) {
    const groups = allGroups.filter((g) => pidOf(g) === prog.id);
    for (const g of groups) {
      const days = daysUntil(g.date, today);
      if (!g.done && (days === null || days >= 0) && !g.seats.includes(mySid) && subOf(groups, g) === mySid) {
        out.push({ prog, group: g, days });
      }
    }
  }
  return out.sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
}

// Riepilogo di una materia: avanzamento e prossimo gruppo.
export function progSummary(groups, today) {
  const total = groups.length;
  const done = groups.filter((g) => g.done).length;
  const people = groups.reduce((n, g) => n + g.seats.filter(Boolean).length, 0);
  const interrogati = groups.reduce((n, g) => n + g.status.filter((s, i) => g.seats[i] && s === DONE).length, 0);
  const todo = groups.filter((g) => !g.done && (!g.date || g.date >= today));
  const dated = todo.filter((g) => g.date).sort((a, b) => a.date.localeCompare(b.date));
  const next = dated[0] || todo[0] || null;
  return { total, done, people, interrogati, next, nextDays: next ? daysUntil(next.date, today) : null };
}
