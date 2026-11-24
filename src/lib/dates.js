// Le date dei gruppi sono stringhe "AAAA-MM-GG" (ora locale).
const pad = (n) => String(n).padStart(2, '0');

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayStr = () => toDateStr(new Date());

export function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Mezzanotte locale del giorno: serve alle Security Rules per capire se il giorno è iniziato.
export const startsAtOf = (s) => (s ? parseDateStr(s) : null);

export function formatDate(s, withYear = false) {
  if (!s) return 'Data da definire';
  return parseDateStr(s).toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function addDays(s, n) {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function formatDateTime(ts) {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleString('it-IT', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}
