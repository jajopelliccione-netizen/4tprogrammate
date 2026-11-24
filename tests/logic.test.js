// Test della logica pura (assenze, spostamenti, distribuzione).  npm run test:logic
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ABSENT, DONE, WAIT, applyAbsence, applyStatus, distribute, emptyGroup, finalize, findSeat,
  groupId, moveStudent, subOf,
} from '../src/lib/groups.js';
import { seatSwappable, swapValidNow } from '../src/lib/swapRules.js';

const mk = (n, seats, extra = {}) => ({ id: groupId(n), ...emptyGroup(n, { seats, ...extra }) });
const base = () => [mk(1, ['a', 'b', 'c', 'd']), mk(2, ['e', 'f', 'g', 'h']), mk(3, ['i', 'j', '', ''])];

test('sostituto automatico = 1° del gruppo successivo; ultimo gruppo: nessuno', () => {
  const gs = base();
  assert.equal(subOf(gs, gs[0]), 'e');
  assert.equal(subOf(gs, gs[1]), 'i');
  assert.equal(subOf(gs, gs[2]), '');
});

test('sostituto manuale valido ha la precedenza', () => {
  const gs = base();
  gs[0].subId = 'g';
  assert.equal(subOf(gs, gs[0]), 'g');
});

test('assenza: l\'assente e il sostituto si scambiano di posto', () => {
  const gs = base();
  const { changed, info } = applyAbsence(gs, 'g01', 1); // b assente
  assert.deepEqual(changed.g01.seats, ['a', 'e', 'c', 'd']);
  assert.deepEqual(changed.g02.seats, ['b', 'f', 'g', 'h']);
  assert.equal(info.sid, 'b');
  assert.equal(info.subSid, 'e');
  assert.equal(info.toGroup, 'g02');
  assert.deepEqual(changed.g01.absentIds, ['b']);
  assert.ok(changed.g01.status.every((s) => s === WAIT));
});

test('dopo un\'assenza il sostituto del gruppo non è l\'assente appena spostato', () => {
  const gs = base();
  const { changed } = applyAbsence(gs, 'g01', 1);
  const after = gs.map((g) => (changed[g.id] ? { id: g.id, ...changed[g.id] } : g));
  assert.equal(subOf(after, after[0]), 'f'); // 'b' è in g02 pos 0 ma è tra gli assenti di g01
});

test('assenza nell\'ultimo gruppo: nessun sostituto, il posto resta "assente"', () => {
  const gs = base();
  const { changed, info } = applyAbsence(gs, 'g03', 0);
  assert.equal(changed.g03.status[0], ABSENT);
  assert.equal(changed.g03.seats[0], 'i');
  assert.equal(info.subSid, null);
});

test('stato interrogato → gruppo "fatto" quando nessuno è più in attesa', () => {
  let gs = base();
  for (let i = 0; i < 4; i++) {
    const ch = applyStatus(gs, 'g01', i, DONE);
    gs = gs.map((g) => (ch[g.id] ? { id: g.id, ...ch[g.id] } : g));
  }
  assert.equal(gs[0].done, true);
  const back = applyStatus(gs, 'g01', 0, WAIT);
  assert.equal(back.g01.done, false);
});

test('spostamento: su posto libero, su posto occupato (scambio) e fuori dai gruppi', () => {
  const gs = base();
  let ch = moveStudent(gs, 'a', { gid: 'g03', pos: 2 });
  assert.equal(ch.g01.seats[0], '');
  assert.equal(ch.g03.seats[2], 'a');
  ch = moveStudent(gs, 'a', { gid: 'g02', pos: 0 });
  assert.equal(ch.g01.seats[0], 'e');
  assert.equal(ch.g02.seats[0], 'a');
  ch = moveStudent(gs, 'a', { pool: true });
  assert.equal(ch.g01.seats[0], '');
  assert.equal(findSeat(gs, 'zzz'), null);
  // dal "fuori" a un posto occupato: l'occupante esce
  ch = moveStudent(gs, 'z', { gid: 'g01', pos: 0 });
  assert.equal(ch.g01.seats[0], 'z');
  assert.deepEqual(Object.keys(ch), ['g01']);
});

test('spostamento nello stesso gruppo', () => {
  const gs = base();
  const ch = moveStudent(gs, 'a', { gid: 'g01', pos: 3 });
  assert.deepEqual(ch.g01.seats, ['d', 'b', 'c', 'a']);
});

test('distribuzione: 22 studenti → 6 gruppi, 2 posti liberi nell\'ultimo; le date restano', () => {
  const ids = Array.from({ length: 22 }, (_, i) => `s${i}`);
  const existing = [mk(1, ['', '', '', ''], { date: '2026-12-01' })];
  const { groups, deleted, overflow } = distribute(ids, 6, existing);
  assert.equal(Object.keys(groups).length, 6);
  assert.equal(groups.g01.date, '2026-12-01');
  assert.deepEqual(groups.g06.seats, ['s20', 's21', '', '']);
  assert.equal(overflow, 0);
  assert.deepEqual(deleted, []);
  // 22 studenti in 5 gruppi: gli ultimi due gruppi hanno 5 posti
  const five = distribute(ids, 5, existing);
  assert.equal(five.overflow, 0);
  assert.deepEqual(five.groups.g04.seats.length, 5);
  assert.deepEqual(five.groups.g03.seats.length, 4);
  assert.equal(distribute(Array.from({ length: 30 }, (_, i) => `s${i}`), 5, []).overflow, 5);
  // 17 studenti in 4 gruppi: 4, 4, 4, 5
  const sev = distribute(Array.from({ length: 17 }, (_, i) => `s${i}`), 4, [], 'pX');
  assert.deepEqual(Object.values(sev.groups).map((g) => g.seats.length), [4, 4, 4, 5]);
  assert.ok('pX_g04' in sev.groups);
});

test('finalize: gruppo vuoto non è "fatto"', () => {
  assert.equal(finalize(emptyGroup(1)).done, false);
});

test('scambio: validità lato client come le regole', () => {
  const g1 = { ...emptyGroup(1, { seats: ['a', 'b', '', ''], date: '2030-01-10' }) };
  const g2 = { ...emptyGroup(2, { seats: ['c', '', '', ''], date: '2030-01-11' }) };
  const byId = { g01: g1, g02: g2 };
  const sw = { fromGroup: 'g01', fromPos: 0, fromSid: 'a', toGroup: 'g02', toPos: 0, toSid: 'c' };
  assert.ok(swapValidNow(sw, byId, '2030-01-01'));
  assert.ok(!swapValidNow(sw, byId, '2030-01-10'), 'oggi non si scambia');
  assert.ok(!swapValidNow(sw, byId, '2030-02-01'), 'passato');
  g2.status[0] = DONE;
  assert.ok(!swapValidNow(sw, byId, '2030-01-01'), 'già interrogato');
  g2.status[0] = WAIT;
  g2.seats[0] = 'x';
  assert.ok(!swapValidNow(sw, byId, '2030-01-01'), 'posto cambiato → decade');
  assert.ok(!seatSwappable(g1, 2, '2030-01-01'), 'posto vuoto');
});

// ---- import gruppi da testo ----
import { buildImport, parseGroupsText } from '../src/lib/importGroups.js';

const classe = ['Altobelli Andrea', 'Candelotti Rebecca', 'Crisanti Davide', 'Guzzardi Eva', 'Maino Giorgia',
  'Ostili Sara', 'Pernici Alessandro', 'Perricone Adriano', 'Pudota Paula', 'Sciumè Elia Maria',
  'Torres', 'Wang Coco', 'Tasmi Mawla Raisa'].map((name, i) => ({ id: `s${i}`, name }));

test('import da testo: cognome o nome, accenti, sostituto, gruppo da 5', () => {
  const txt = `Gruppo 1: Tasmi, Sciume, Perricone, Maino | Sostituto: Guzzardi
Gruppo 2: Ostili, Pernici, Candelotti, Guzzardi
Gruppo 5: Torres, Paula, Crisanti, Coco, Altobelli`;
  const { groups, errors } = parseGroupsText(txt, classe);
  assert.deepEqual(errors, []);
  assert.equal(groups[0].subId, 's3');
  assert.equal(groups[2].seats.length, 5);
  const { changed, deleted } = buildImport(groups, [{ id: 'g06', number: 6, seats: ['', '', '', ''] }]);
  assert.equal(changed.g05.seats[4], 's0');
  assert.equal(changed.g05.status.length, 5);
  assert.deepEqual(deleted, ['g06']);
});

test('import: errori per nome sconosciuto, doppioni e troppi posti', () => {
  const r = parseGroupsText('Gruppo 1: Rossi, Maino\nGruppo 2: Maino, Gallo', classe);
  assert.ok(r.errors.some((e) => e.includes('Rossi')));
  assert.ok(r.errors.some((e) => e.includes('già nel gruppo 1')));
  assert.ok(parseGroupsText('Gruppo 1: a,b,c,d,e,f', classe).errors.length > 0);
});

// ---- dashboard ----
import { daysUntil, mySubstitutions, myEntries, nextEntry, progSummary, whenLabel } from '../src/lib/dashboard.js';

test('dashboard: giorni mancanti e testo', () => {
  assert.equal(daysUntil('2027-01-10', '2027-01-07'), 3);
  assert.equal(daysUntil('2027-01-07', '2027-01-07'), 0);
  assert.equal(daysUntil(null, '2027-01-07'), null);
  assert.deepEqual(['2027-01-07', '2027-01-08', '2027-01-12', null].map((d) => whenLabel(daysUntil(d, '2027-01-07'))),
    ['oggi', 'domani', 'tra 5 giorni', 'data da definire']);
});

test('dashboard: prossima interrogazione tra più materie, con chi, e sostituto', () => {
  const progs = [{ id: 'it', subject: 'Italiano' }, { id: 'st', subject: 'Storia' }];
  const g = (pid, n, seats, date, extra = {}) => ({ id: `${pid}_g0${n}`, ...emptyGroup(n, { pid, seats, date, ...extra }) });
  const all = [
    g('it', 1, ['me', 'a', 'b', 'c'], '2027-02-20'),
    g('it', 2, ['d', 'e', 'f', 'h'], '2027-02-27'),
    g('st', 1, ['x', 'y', 'z', 'k'], '2027-02-10'),
    g('st', 2, ['me', 'q', 'r', ''], '2027-02-15'),
  ];
  const entries = myEntries(all, progs, 'me', '2027-02-08');
  assert.equal(entries.length, 2);
  const nxt = nextEntry(entries);
  assert.equal(nxt.prog.subject, 'Storia');   // 15 feb viene prima di 20 feb
  assert.equal(nxt.days, 7);
  assert.deepEqual(nxt.mates, ['q', 'r']);
  // sostituto: il 1° del gruppo successivo è 'x' per nessuno qui; 'd' è sostituto di it_g01
  assert.equal(mySubstitutions(all, progs, 'd', '2027-02-08').length, 1);
  // 'me' è il 1° di Storia gruppo 2 → è sostituto del gruppo 1 di Storia (ma non di un gruppo in cui è già dentro)
  const meSub = mySubstitutions(all, progs, 'me', '2027-02-08');
  assert.equal(meSub.length, 1);
  assert.equal(meSub[0].prog.subject, 'Storia');
  // fatta / passata → non è "prossima"
  all[3].done = true;
  assert.equal(nextEntry(myEntries(all, progs, 'me', '2027-02-08')).prog.subject, 'Italiano');
});

test('dashboard: riepilogo materia', () => {
  const gs = [
    { ...emptyGroup(1, { seats: ['a', 'b', 'c', 'd'], date: '2027-03-01' }), done: true },
    emptyGroup(2, { seats: ['e', 'f', '', ''], date: '2027-03-09' }),
    emptyGroup(3, { seats: ['g', '', '', ''], date: '2027-03-05' }),
  ];
  const s = progSummary(gs, '2027-03-02');
  assert.equal(s.done, 1);
  assert.equal(s.total, 3);
  assert.equal(s.next.number, 3);
  assert.equal(s.nextDays, 3);
});
