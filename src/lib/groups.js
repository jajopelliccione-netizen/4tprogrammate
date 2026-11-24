// Logica pura dei gruppi (nessun accesso a Firebase): facile da testare.
export const WAIT = 'attesa';
export const DONE = 'interrogato';
export const ABSENT = 'assente';
export const SEATS = 4;

export const groupId = (n) => `g${String(n).padStart(2, '0')}`;
export const groupNumber = (id) => Number(String(id).replace(/^g/, '')) || 0;

export const emptyGroup = (number, extra = {}) => ({
  number,
  date: null,
  startsAt: null,
  seats: Array(SEATS).fill(''),
  status: Array(SEATS).fill(WAIT),
  subId: '',
  absentIds: [],
  done: false,
  ...extra,
});

export const sortGroups = (list) => [...list].sort((a, b) => a.number - b.number);

const clone = (g) => ({
  ...g,
  seats: [...g.seats],
  status: [...g.status],
  absentIds: [...(g.absentIds || [])],
});

// done = c'è almeno un posto occupato e nessuno è più "in attesa"
export function finalize(g) {
  const filled = g.seats.map((s, i) => (s ? g.status[i] : null)).filter(Boolean);
  g.done = filled.length > 0 && filled.every((s) => s !== WAIT);
  return g;
}

export function findSeat(groups, sid) {
  for (const g of groups) {
    const pos = g.seats.indexOf(sid);
    if (sid && pos >= 0) return { gid: g.id, pos };
  }
  return null;
}

// Sostituto automatico: il 1° del gruppo successivo ancora in attesa
// (escludendo chi è già stato segnato assente per questo gruppo).
export function autoSub(groups, g) {
  const idx = groups.findIndex((x) => x.id === g.id);
  const next = groups[idx + 1];
  if (!next) return '';
  const absent = g.absentIds || [];
  for (let i = 0; i < SEATS; i++) {
    const s = next.seats[i];
    if (s && next.status[i] === WAIT && !absent.includes(s)) return s;
  }
  return '';
}

// Sostituto effettivo: quello scelto a mano (se valido) oppure l'automatico.
export function subOf(groups, g) {
  if (g.subId) {
    const seat = findSeat(groups, g.subId);
    if (seat && seat.gid !== g.id) {
      const sg = groups.find((x) => x.id === seat.gid);
      if (sg.status[seat.pos] === WAIT) return g.subId;
    }
  }
  return autoSub(groups, g);
}

// Segna lo stato di un posto (interrogato / in attesa). Ritorna { gid: nuovoDoc }.
export function applyStatus(groups, gid, pos, status) {
  const g = clone(groups.find((x) => x.id === gid));
  const sid = g.seats[pos];
  g.status[pos] = status;
  if (status !== ABSENT) g.absentIds = g.absentIds.filter((x) => x !== sid);
  return { [gid]: finalize(g) };
}

// Tutti i posti ancora in attesa diventano "interrogato".
export function markAllDone(groups, gid) {
  const g = clone(groups.find((x) => x.id === gid));
  g.status = g.status.map((s, i) => (g.seats[i] && s === WAIT ? DONE : s));
  return { [gid]: finalize(g) };
}

// REGOLA DELLE ASSENZE: l'assente e il sostituto si scambiano di posto.
// Senza sostituto disponibile il posto resta "assente".
export function applyAbsence(groups, gid, pos) {
  const g = clone(groups.find((x) => x.id === gid));
  const absentSid = g.seats[pos];
  const subSid = subOf(groups, groups.find((x) => x.id === gid));
  const info = { type: 'absenza', sid: absentSid, group: gid, subSid: null, toGroup: null };
  g.absentIds = Array.from(new Set([...g.absentIds, absentSid]));

  const subSeat = subSid ? findSeat(groups, subSid) : null;
  if (!subSeat || subSeat.gid === gid) {
    g.status[pos] = ABSENT;
    return { changed: { [gid]: finalize(g) }, info };
  }
  const h = clone(groups.find((x) => x.id === subSeat.gid));
  g.seats[pos] = subSid;
  g.status[pos] = WAIT;
  h.seats[subSeat.pos] = absentSid;
  h.status[subSeat.pos] = WAIT;
  if (g.subId === subSid) g.subId = '';
  info.subSid = subSid;
  info.toGroup = h.id;
  return { changed: { [gid]: finalize(g), [h.id]: finalize(h) }, info };
}

// Sposta uno studente in un posto o fuori dai gruppi.
// target: { pool: true } | { gid, pos }. Se il posto è occupato i due si scambiano.
export function moveStudent(groups, sid, target) {
  const work = {};
  const get = (id) => (work[id] ||= clone(groups.find((x) => x.id === id)));
  const src = findSeat(groups, sid);

  if (target.pool) {
    if (!src) return {};
    const g = get(src.gid);
    g.seats[src.pos] = '';
    g.status[src.pos] = WAIT;
  } else {
    if (src && src.gid === target.gid && src.pos === target.pos) return {};
    const dst = get(target.gid);
    const occupant = dst.seats[target.pos];
    const occStatus = occupant ? dst.status[target.pos] : WAIT;
    const srcStatus = src ? get(src.gid).status[src.pos] : WAIT;
    dst.seats[target.pos] = sid;
    dst.status[target.pos] = srcStatus;
    if (src) {
      const sg = get(src.gid);
      sg.seats[src.pos] = occupant;
      sg.status[src.pos] = occStatus;
    }
  }
  Object.values(work).forEach(finalize);
  return work;
}

// Distribuzione automatica: riempie i gruppi 1..n con 4 studenti ciascuno, in ordine.
// Mantiene le date dei gruppi già esistenti.
export function distribute(studentIds, numGroups, existing) {
  const byNumber = new Map(existing.map((g) => [g.number, g]));
  const groups = {};
  for (let n = 1; n <= numGroups; n++) {
    const old = byNumber.get(n);
    const seats = studentIds.slice((n - 1) * SEATS, n * SEATS);
    while (seats.length < SEATS) seats.push('');
    groups[groupId(n)] = emptyGroup(n, {
      date: old?.date ?? null,
      startsAt: old?.startsAt ?? null,
      seats,
    });
  }
  const deleted = existing.filter((g) => g.number > numGroups).map((g) => g.id);
  const overflow = Math.max(0, studentIds.length - numGroups * SEATS);
  return { groups, deleted, overflow };
}

export function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
