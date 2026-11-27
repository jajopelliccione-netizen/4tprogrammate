// Importa i gruppi da testo (puro, senza Firebase).
// Formato, una riga per gruppo:
//   Gruppo 1: Tasmi, Sciumè, Perricone, Maino | Sostituto: Guzzardi
// La data è facoltativa, tra parentesi quadre (AAAA-MM-GG):
//   Gruppo 1 [2026-12-04]: Papagno, Tarallo, Pernici
// I nomi si riconoscono anche con la sola parola del cognome (o del nome).
import { MAX_SEATS, SEATS, WAIT, emptyGroup, finalize, groupId } from './groups.js';
import { startsAtOf } from './dates.js';

// Data tra parentesi quadre, in vari formati: 2026-12-04, 2027-1-8, 4/12/2026, 4-12-2026 → "AAAA-MM-GG"
export function parseDateLoose(txt) {
  const t = txt.trim();
  let y, m, d, r;
  if ((r = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) [y, m, d] = [r[1], r[2], r[3]];
  else if ((r = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [d, m, y] = [r[1], r[2], r[3]];
  else return null;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (dt.getFullYear() !== Number(y) || dt.getMonth() !== Number(m) - 1 || dt.getDate() !== Number(d)) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, '').trim();
const tokens = (s) => norm(s).split(/\s+/).filter(Boolean);

function findStudent(query, students) {
  const q = tokens(query);
  const hits = students.filter((s) => {
    const t = tokens(s.name);
    return q.every((w) => t.includes(w));
  });
  if (hits.length === 1) return { student: hits[0] };
  if (hits.length === 0) return { error: `"${query}": nessuno studente con questo nome` };
  return { error: `"${query}": più studenti corrispondono (${hits.map((h) => h.name).join(', ')})` };
}

export function parseGroupsText(text, students) {
  const errors = [];
  const out = [];
  const used = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^gruppo\s*(\d+)\s*(?:\[([^\]]*)\])?\s*[:\-]\s*(.*)$/i);
    if (!m) { errors.push(`Riga non riconosciuta: "${line}"`); continue; }
    const number = Number(m[1]);
    let date = null;
    if (m[2] !== undefined && m[2].trim()) {
      date = parseDateLoose(m[2]);
      if (!date) { errors.push(`Gruppo ${m[1]}: data non valida "${m[2]}" (scrivila come 2026-12-04 oppure 4/12/2026)`); continue; }
    }
    const [namesPart, subPart] = m[3].split('|');
    const names = namesPart.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    if (names.length > MAX_SEATS) { errors.push(`Gruppo ${number}: massimo ${MAX_SEATS} persone`); continue; }
    const seats = [];
    for (const n of names) {
      const r = findStudent(n, students);
      if (r.error) { errors.push(`Gruppo ${number}, ${r.error}`); continue; }
      if (used.has(r.student.id)) {
        errors.push(`${r.student.name} è già nel gruppo ${used.get(r.student.id)}`);
        continue;
      }
      used.set(r.student.id, number);
      seats.push(r.student.id);
    }
    while (seats.length < SEATS) seats.push('');
    let subId = '';
    const subName = subPart?.replace(/^\s*sostituto\s*[:=]?\s*/i, '').trim();
    if (subName) {
      const r = findStudent(subName, students);
      if (r.error) errors.push(`Gruppo ${number}, sostituto ${r.error}`);
      else subId = r.student.id;
    }
    out.push({ number, seats, subId, date });
  }
  const nums = out.map((g) => g.number);
  if (new Set(nums).size !== nums.length) errors.push('Ci sono due righe con lo stesso numero di gruppo');
  return { groups: out, errors };
}

// Costruisce i documenti Firestore, mantenendo le date dei gruppi già esistenti.
export function buildImport(parsed, existing, pid = '', opts = {}) {
  const byNumber = new Map(existing.map((g) => [g.number, g]));
  const changed = {};
  for (const g of parsed) {
    const old = byNumber.get(g.number);
    changed[groupId(g.number, pid)] = finalize(emptyGroup(g.number, {
      pid,
      seats: g.seats,
      status: g.seats.map(() => WAIT),
      subId: opts.noSub ? '' : g.subId,
      noSub: Boolean(opts.noSub),
      date: g.date || old?.date || null,
      startsAt: g.date ? startsAtOf(g.date) : old?.startsAt ?? null,
    }));
  }
  const keep = new Set(parsed.map((g) => g.number));
  const deleted = existing.filter((g) => !keep.has(g.number)).map((g) => g.id);
  return { changed, deleted };
}
