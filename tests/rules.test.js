// Test delle Firestore Security Rules con l'emulatore.
// Esegui con:  npm run test:rules
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, writeBatch,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';

let env;

const ADMIN = 'admin1';
const UA = 'uidA'; // studente Anna (g01 pos0)
const UB = 'uidB'; // studente Bruno (g02 pos0)
const UC = 'uidC'; // studente Carla (g01 pos1)
const UX = 'uidX'; // account Auth senza permessi
const TOKEN = 'tok'.padEnd(64, 'a');
const EMAIL = 'sabc123@studenti.4tssa.app';

const future = () => Timestamp.fromDate(new Date(Date.now() + 5 * 864e5));
const past = () => Timestamp.fromDate(new Date(Date.now() - 864e5));

const group = (n, seats, extra = {}) => ({
  number: n, date: '2099-01-01', startsAt: future(),
  seats, status: seats.map((s) => (s ? 'attesa' : 'attesa')),
  subId: '', absentIds: [], done: false, ...extra,
});

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { role: 'admin' });
    for (const [uid, sid] of [[UA, 'A'], [UB, 'B'], [UC, 'C']]) {
      await setDoc(doc(db, 'users', uid), { role: 'student', studentId: sid, inviteToken: 'x' });
      await setDoc(doc(db, 'students', sid), {
        name: sid, activated: true, uid, authEmail: `${sid}@x.it`, excluded: false, order: 0,
      });
    }
    await setDoc(doc(db, 'students', 'N'), {
      name: 'Nuovo', activated: false, uid: null, authEmail: null, excluded: false, order: 5,
    });
    await setDoc(doc(db, 'invites', TOKEN), {
      studentId: 'N', authEmail: EMAIL, used: false,
    });
    await setDoc(doc(db, 'groups', 'g01'), group(1, ['A', 'C', '', '']));
    await setDoc(doc(db, 'groups', 'g02'), group(2, ['B', '', '', '']));
    await setDoc(doc(db, 'groups', 'g03'), group(3, ['D', 'E', '', ''], { startsAt: past(), date: '2000-01-01' }));
  });
}

const as = (uid, email) => env.authenticatedContext(uid, email ? { email } : {}).firestore();
const swapData = (over = {}) => ({
  fromUid: UA, toUid: UB, fromSid: 'A', toSid: 'B',
  fromGroup: 'g01', fromPos: 0, toGroup: 'g02', toPos: 0,
  status: 'pending', createdAt: serverTimestamp(), ...over,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-4tssa',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(seed);

// ------------------------------------------------------------------ lettura --
test('chiunque legge l\'elenco studenti, ma non invites (list) né gruppi', async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(collection(anon, 'students')));
  await assertFails(getDocs(collection(anon, 'invites')));
  await assertFails(getDocs(collection(anon, 'groups')));
  await assertSucceeds(getDoc(doc(anon, 'invites', TOKEN))); // get col token
});

test('un account senza permessi non legge gruppi, storico, scambi', async () => {
  const x = as(UX);
  await assertFails(getDocs(collection(x, 'groups')));
  await assertFails(getDocs(collection(x, 'history')));
  await assertFails(getDoc(doc(x, 'users', UA)));
});

test('lo studente legge i gruppi ma non scrive', async () => {
  const a = as(UA);
  await assertSucceeds(getDocs(collection(a, 'groups')));
  await assertFails(updateDoc(doc(a, 'groups', 'g01'), { seats: ['C', 'A', '', ''] }));
  await assertFails(setDoc(doc(a, 'groups', 'g09'), group(9, ['', '', '', ''])));
});

test('lo studente non può leggere gli users degli altri né fare l\'admin', async () => {
  const a = as(UA);
  await assertSucceeds(getDoc(doc(a, 'users', UA)));
  await assertFails(getDoc(doc(a, 'users', UB)));
  await assertFails(updateDoc(doc(a, 'users', UA), { role: 'admin' }));
  await assertFails(setDoc(doc(a, 'students', 'Z'), { name: 'Z', activated: false }));
});

// -------------------------------------------------------------- attivazione --
function activationBatch(db, uid, over = {}) {
  const b = writeBatch(db);
  b.set(doc(db, 'users', uid), { role: 'student', studentId: 'N', inviteToken: TOKEN, ...(over.user || {}) });
  b.update(doc(db, 'students', 'N'), { activated: true, uid, authEmail: EMAIL, ...(over.student || {}) });
  b.update(doc(db, 'invites', TOKEN), { used: true, usedByUid: uid, usedAt: serverTimestamp() });
  return b.commit();
}

test('attivazione corretta con token valido', async () => {
  await assertSucceeds(activationBatch(as(UX, EMAIL), UX));
});

test('attivazione con email diversa da quella dell\'invito: rifiutata', async () => {
  await assertFails(activationBatch(as(UX, 'altra@mail.it'), UX));
});

test('attivazione con token inesistente o di un altro studente: rifiutata', async () => {
  await assertFails(activationBatch(as(UX, EMAIL), UX, { user: { inviteToken: 'boh' } }));
  await assertFails(activationBatch(as(UX, EMAIL), UX, { user: { studentId: 'A' }, student: {} }));
});

test('attivazione che prova a darsi role admin: rifiutata', async () => {
  await assertFails(activationBatch(as(UX, EMAIL), UX, { user: { role: 'admin' } }));
  await assertFails(setDoc(doc(as(UX, EMAIL), 'users', UX), { role: 'admin' }));
});

test('il token si usa una sola volta', async () => {
  await assertSucceeds(activationBatch(as(UX, EMAIL), UX));
  await assertFails(activationBatch(as('uidY', EMAIL), 'uidY'));
});

test('non si può attivare scrivendo solo il documento studente (senza users e invito)', async () => {
  await assertFails(updateDoc(doc(as(UX, EMAIL), 'students', 'N'), { activated: true, uid: UX, authEmail: EMAIL }));
});

test('non si può attivare lo studente e metterci l\'uid di un altro', async () => {
  await assertFails(activationBatch(as(UX, EMAIL), UX, { student: { uid: UA } }));
});

test('studente già attivo: nessuno può riattivarlo con un invito vecchio', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'invites', 'vecchio'), { studentId: 'A', authEmail: 'v@x.it', used: false });
  });
  const db = as(UX, 'v@x.it');
  const b = writeBatch(db);
  b.set(doc(db, 'users', UX), { role: 'student', studentId: 'A', inviteToken: 'vecchio' });
  b.update(doc(db, 'students', 'A'), { activated: true, uid: UX, authEmail: 'v@x.it' });
  b.update(doc(db, 'invites', 'vecchio'), { used: true, usedByUid: UX, usedAt: serverTimestamp() });
  await assertFails(b.commit());
});

test('reset admin: elimina users e azzera lo studente; il vecchio account perde ogni permesso', async () => {
  const admin = as(ADMIN);
  const b = writeBatch(admin);
  b.delete(doc(admin, 'users', UA));
  b.update(doc(admin, 'students', 'A'), { activated: false, uid: null, authEmail: null });
  b.set(doc(admin, 'invites', 'nuovo'), { studentId: 'A', authEmail: 'n@x.it', used: false });
  await assertSucceeds(b.commit());
  await assertFails(getDocs(collection(as(UA), 'groups')));
});

// ---------------------------------------------------------------- admin ----
test('l\'admin scrive gruppi, studenti, storico', async () => {
  const admin = as(ADMIN);
  await assertSucceeds(updateDoc(doc(admin, 'groups', 'g01'), { seats: ['C', 'A', '', ''] }));
  await assertSucceeds(setDoc(doc(admin, 'students', 'Q'), { name: 'Q', activated: false }));
  await assertSucceeds(setDoc(doc(admin, 'history', 'h1'), { type: 'absenza', at: serverTimestamp() }));
});

// ------------------------------------------------------------------ scambi --
test('A crea una richiesta valida; non può farla a nome di un altro', async () => {
  const a = as(UA);
  await assertSucceeds(setDoc(doc(a, 'swaps', 's1'), swapData()));
  await assertFails(setDoc(doc(a, 'swaps', 's2'), swapData({ fromUid: UC, fromSid: 'C', fromGroup: 'g01', fromPos: 1 })));
});

test('richiesta non valida: posto sbagliato, gruppo passato, interrogato, fatto', async () => {
  const a = as(UA);
  await assertFails(setDoc(doc(a, 'swaps', 's1'), swapData({ toPos: 2 }))); // posto vuoto
  await assertFails(setDoc(doc(a, 'swaps', 's2'), swapData({ toSid: 'D', toUid: 'u', toGroup: 'g03', toPos: 0 }))); // data passata
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'groups', 'g02'), { status: ['interrogato', 'attesa', 'attesa', 'attesa'] });
  });
  await assertFails(setDoc(doc(a, 'swaps', 's3'), swapData())); // B già interrogato
});

test('richiesta con gruppo "oggi" (startsAt passato): rifiutata', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'groups', 'g02'), { startsAt: past(), date: '2000-01-01' });
  });
  await assertFails(setDoc(doc(as(UA), 'swaps', 's1'), swapData()));
});

test('solo i due interessati leggono lo scambio', async () => {
  await assertSucceeds(setDoc(doc(as(UA), 'swaps', 's1'), swapData()));
  await assertSucceeds(getDoc(doc(as(UB), 'swaps', 's1')));
  await assertSucceeds(getDoc(doc(as(UA), 'swaps', 's1')));
  await assertFails(getDoc(doc(as(UC), 'swaps', 's1')));
});

function acceptBatch(db, over = {}) {
  const b = writeBatch(db);
  b.update(doc(db, 'swaps', 's1'), { status: 'accepted', resolvedAt: serverTimestamp() });
  b.update(doc(db, 'groups', 'g01'), { seats: over.g1 || ['B', 'C', '', ''], lastSwapId: 's1' });
  b.update(doc(db, 'groups', 'g02'), { seats: over.g2 || ['A', '', '', ''], lastSwapId: 's1' });
  if (!over.noHistory) {
    b.set(doc(db, 'history', 's1'), {
      type: 'swap', swapId: 's1', at: serverTimestamp(), fromSid: 'A', toSid: 'B',
      fromGroup: 'g01', fromPos: 0, toGroup: 'g02', toPos: 0,
    });
  }
  return b;
}

async function seedSwap() {
  await assertSucceeds(setDoc(doc(as(UA), 'swaps', 's1'), swapData()));
}

test('B accetta: scambio perfetto di A e B (con storico)', async () => {
  await seedSwap();
  await assertSucceeds(acceptBatch(as(UB)).commit());
});

test('chi ha chiesto non può accettare da solo', async () => {
  await seedSwap();
  await assertFails(acceptBatch(as(UA)).commit());
});

test('un terzo non può accettare', async () => {
  await seedSwap();
  await assertFails(acceptBatch(as(UC)).commit());
});

test('accettazione che cambia anche un altro posto: rifiutata', async () => {
  await seedSwap();
  await assertFails(acceptBatch(as(UB), { g1: ['B', 'A', '', ''] }).commit());
  await assertFails(acceptBatch(as(UB), { g2: ['A', 'C', '', ''] }).commit());
});

test('accettazione incompleta (solo un gruppo) o senza scambio: rifiutata', async () => {
  await seedSwap();
  const db = as(UB);
  const b = writeBatch(db);
  b.update(doc(db, 'swaps', 's1'), { status: 'accepted', resolvedAt: serverTimestamp() });
  b.update(doc(db, 'groups', 'g01'), { seats: ['B', 'C', '', ''], lastSwapId: 's1' });
  await assertFails(b.commit());
  // solo il gruppo, senza passare lo scambio ad accepted
  await assertFails(updateDoc(doc(db, 'groups', 'g01'), { seats: ['B', 'C', '', ''], lastSwapId: 's1' }));
});

test('B non può usare lo scambio per toccare altri campi del gruppo', async () => {
  await seedSwap();
  const db = as(UB);
  const b = writeBatch(db);
  b.update(doc(db, 'swaps', 's1'), { status: 'accepted', resolvedAt: serverTimestamp() });
  b.update(doc(db, 'groups', 'g01'), { seats: ['B', 'C', '', ''], lastSwapId: 's1', date: '2030-01-01' });
  b.update(doc(db, 'groups', 'g02'), { seats: ['A', '', '', ''], lastSwapId: 's1' });
  await assertFails(b.commit());
});

test('scambio già accettato: non si può riusare per un secondo cambio', async () => {
  await seedSwap();
  await assertSucceeds(acceptBatch(as(UB)).commit());
  const db = as(UB);
  await assertFails(updateDoc(doc(db, 'groups', 'g01'), { seats: ['A', 'C', '', ''], lastSwapId: 's1' }));
});

test('se un posto cambia prima dell\'accettazione la richiesta decade', async () => {
  await seedSwap();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'groups', 'g02'), { seats: ['', 'B', '', ''], status: ['attesa', 'attesa', 'attesa', 'attesa'] });
  });
  await assertFails(acceptBatch(as(UB), { g2: ['A', 'B', '', ''] }).commit());
  // ma si può segnare come decaduta
  await assertSucceeds(updateDoc(doc(as(UB), 'swaps', 's1'), { status: 'expired', resolvedAt: serverTimestamp() }));
});

test('non si può segnare "decaduta" una richiesta ancora valida', async () => {
  await seedSwap();
  await assertFails(updateDoc(doc(as(UB), 'swaps', 's1'), { status: 'expired', resolvedAt: serverTimestamp() }));
});

test('rifiuta (destinatario) e annulla (mittente); non viceversa', async () => {
  await seedSwap();
  await assertFails(updateDoc(doc(as(UA), 'swaps', 's1'), { status: 'rejected', resolvedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as(UB), 'swaps', 's1'), { status: 'cancelled', resolvedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(as(UB), 'swaps', 's1'), { status: 'rejected', resolvedAt: serverTimestamp() }));
});

test('il mittente annulla la propria richiesta', async () => {
  await seedSwap();
  await assertSucceeds(updateDoc(doc(as(UA), 'swaps', 's1'), { status: 'cancelled', resolvedAt: serverTimestamp() }));
});

test('uno studente non può scrivere storico a mano', async () => {
  await assertFails(setDoc(doc(as(UA), 'history', 'fake'), { type: 'absenza', at: serverTimestamp() }));
  await assertFails(setDoc(doc(as(UA), 'history', 'fake2'), {
    type: 'swap', swapId: 'fake2', at: serverTimestamp(), fromSid: 'A', toSid: 'B',
    fromGroup: 'g01', fromPos: 0, toGroup: 'g02', toPos: 0,
  }));
});

test('scambio dentro lo stesso gruppo', async () => {
  await assertSucceeds(setDoc(doc(as(UA), 'swaps', 's1'),
    swapData({ toUid: UC, toSid: 'C', toGroup: 'g01', toPos: 1 })));
  const db = as(UC);
  const b = writeBatch(db);
  b.update(doc(db, 'swaps', 's1'), { status: 'accepted', resolvedAt: serverTimestamp() });
  b.update(doc(db, 'groups', 'g01'), { seats: ['C', 'A', '', ''], lastSwapId: 's1' });
  b.set(doc(db, 'history', 's1'), {
    type: 'swap', swapId: 's1', at: serverTimestamp(), fromSid: 'A', toSid: 'C',
    fromGroup: 'g01', fromPos: 0, toGroup: 'g01', toPos: 1,
  });
  await assertSucceeds(b.commit());
});

// ---------------------------------------------------------- gruppo da 5 ----
test('gruppo da 5 persone: scambio sul 5° posto riuscito, e 5° posto non manomettibile', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adb = ctx.firestore();
    await setDoc(doc(adb, 'groups', 'g05'), {
      number: 5, date: '2099-01-01', startsAt: future(), seats: ['D', 'E', 'F', 'G', 'C'],
      status: ['attesa', 'attesa', 'attesa', 'attesa', 'attesa'], subId: '', absentIds: [], done: false,
    });
    await updateDoc(doc(adb, 'groups', 'g01'), { seats: ['A', 'H', '', ''] });
  });
  // A (g01 pos0) chiede lo scambio con C (g05 pos4)
  await assertSucceeds(setDoc(doc(as(UA), 'swaps', 's5'),
    swapData({ toUid: UC, toSid: 'C', toGroup: 'g05', toPos: 4 })));
  const dbc = as(UC);
  const b = writeBatch(dbc);
  b.update(doc(dbc, 'swaps', 's5'), { status: 'accepted', resolvedAt: serverTimestamp() });
  b.update(doc(dbc, 'groups', 'g01'), { seats: ['C', 'H', '', ''], lastSwapId: 's5' });
  b.update(doc(dbc, 'groups', 'g05'), { seats: ['D', 'E', 'F', 'G', 'X'], lastSwapId: 's5' }); // sbagliato
  await assertFails(b.commit());
  const b2 = writeBatch(dbc);
  b2.update(doc(dbc, 'swaps', 's5'), { status: 'accepted', resolvedAt: serverTimestamp() });
  b2.update(doc(dbc, 'groups', 'g01'), { seats: ['C', 'H', '', ''], lastSwapId: 's5' });
  b2.update(doc(dbc, 'groups', 'g05'), { seats: ['D', 'E', 'F', 'G', 'A'], lastSwapId: 's5' });
  b2.set(doc(dbc, 'history', 's5'), {
    type: 'swap', swapId: 's5', at: serverTimestamp(), fromSid: 'A', toSid: 'C',
    fromGroup: 'g01', fromPos: 0, toGroup: 'g05', toPos: 4,
  });
  await assertSucceeds(b2.commit());
});

test('programmate (materie): le legge chi ha un account, le gestisce solo l\'admin', async () => {
  await assertSucceeds(setDoc(doc(as(ADMIN), 'programmate', 'p1'), { subject: 'Italiano', order: 1 }));
  await assertSucceeds(getDoc(doc(as(UA), 'programmate', 'p1')));
  await assertFails(setDoc(doc(as(UA), 'programmate', 'p2'), { subject: 'Altro', order: 2 }));
  await assertFails(getDoc(doc(as(UX), 'programmate', 'p1')));
});

test('non si scambia tra programmate (materie) diverse', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adb = ctx.firestore();
    await updateDoc(doc(adb, 'groups', 'g01'), { pid: 'p1' });
    await updateDoc(doc(adb, 'groups', 'g02'), { pid: 'p2' });
  });
  await assertFails(setDoc(doc(as(UA), 'swaps', 'sx'), swapData()));
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'groups', 'g02'), { pid: 'p1' });
  });
  await assertSucceeds(setDoc(doc(as(UA), 'swaps', 'sy'), swapData()));
});
