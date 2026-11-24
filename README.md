# Interrogazioni 4T SSA

Web app (pensata per il telefono) per gestire le interrogazioni programmate della classe.

- **Frontend**: Vite + React, sito statico → Cloudflare Pages
- **Backend**: Firebase piano gratuito *Spark* (Authentication email/password + Cloud Firestore). **Nessuna Cloud Function.**
- **Sicurezza**: tutta nelle Firestore Security Rules (`firestore.rules`), verificate da test con l'emulatore.

## Come funziona (in breve)

| Cosa | Come |
|---|---|
| Inviti | L'admin importa i nomi → per ognuno l'app crea un link `/invito/<token>` (64 caratteri casuali, usabile **una sola volta**). |
| Account | Lo studente apre il link, sceglie la password; l'app crea un utente Firebase con un'email interna casuale (non la vede mai). |
| Login | Scegli il tuo nome dall'elenco + password. |
| Reset | L'admin preme "Resetta accesso": nuovo link, e il vecchio account perde tutti i permessi (si elimina il suo documento `users/{uid}`). |
| Assenza | Un tap: il sostituto del gruppo entra al posto dell'assente, e l'assente va al posto del sostituto nel gruppo successivo. |
| Scambi | Richiesta → il compagno accetta → **transazione Firestore** che scambia i due posti. Decade se un posto cambia. |

### Perché nessuno può creare l'account al posto di un altro

1. Per creare un account servono `studentId`, `token` ed email interna: i primi due stanno solo nel link, l'email interna è casuale e salvata solo nell'invito (leggibile solo conoscendo il token).
2. Un account Firebase da solo **non può fare niente**: il permesso è il documento `users/{uid}`.
3. `users/{uid}` si può creare solo in un batch atomico che, nello stesso momento, segna l'invito come usato e lo studente come attivato. Le regole controllano che il token esista, non sia usato, appartenga a quello studente e che l'email dell'account coincida con quella dell'invito.
4. Il ruolo `admin` non si può creare dal client: si imposta a mano dalla console (vedi sotto).

---

## 1. Creare il progetto Firebase

1. Vai su <https://console.firebase.google.com> → **Aggiungi progetto** (es. `interrogazioni-4t`). Google Analytics non serve.
2. Resta sul piano **Spark** (gratuito). Non attivare Blaze.
3. In **Impostazioni progetto (⚙️) → Le tue app → `</>` Web** registra un'app web (nome a piacere, niente Hosting).
4. Copia i valori di `firebaseConfig`.

## 2. Abilitare Authentication

**Build → Authentication → Inizia → Metodo di accesso → Email/password → Abilita** (lascia disattivato "Link via email") → Salva.

## 3. Abilitare Firestore

**Build → Firestore Database → Crea database** → scegli una regione europea (es. `eur3` o `europe-west`) → **Avvia in modalità produzione** (le regole vere le incolli al passo 4).

## 4. Incollare le Security Rules

Console: **Firestore Database → Regole** → cancella tutto, incolla il contenuto di [`firestore.rules`](firestore.rules) → **Pubblica**.

(In alternativa, da terminale: `npx firebase login`, `npx firebase use --add` e `npx firebase deploy --only firestore:rules`.)

## 5. Impostare il tuo account come admin

Le regole non permettono a nessun client di darsi il ruolo admin, quindi si fa a mano **una volta sola**:

1. **Authentication → Utenti → Aggiungi utente**: inserisci la tua email vera e una password (la userai nel login admin). Copia l'**UID** dell'utente creato.
2. **Firestore Database → Avvia raccolta** → ID raccolta `users` → **ID documento = l'UID** copiato →  campo `role`, tipo *string*, valore `admin` → Salva.

Poi, nella pagina di login dell'app, tocca **"Sono il rappresentante (admin)"** ed entra con quella email e password.

## 6. Configurare e provare in locale

```bash
npm install
cp .env.example .env      # poi incolla i valori di firebaseConfig
npm run dev
```

Variabili in `.env`:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

> La API key di Firebase **non è un segreto**: finisce comunque nel sito. La sicurezza sta nelle Security Rules.

## 7. Deploy su Cloudflare Pages

1. Metti il codice su GitHub.
2. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → scegli il repository.
3. Impostazioni di build:
   - **Framework preset**: `Vite` (oppure None)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables** (sia *Production* che *Preview*): aggiungi le sei variabili `VITE_FIREBASE_*` con gli stessi valori di `.env`. (Facoltativo: `NODE_VERSION` = `20`.)
5. **Save and Deploy**. Alla fine avrai un indirizzo tipo `https://nome-progetto.pages.dev`.

Il file `public/_redirects` (`/* /index.html 200`) viene copiato in `dist/` e fa funzionare i link diretti come `/invito/<token>` (routing della SPA).

Ogni volta che cambi le variabili d'ambiente devi rifare il deploy (le variabili `VITE_` vengono incorporate in fase di build).

## 8. Autorizzare il dominio in Firebase

**Authentication → Impostazioni → Domini autorizzati → Aggiungi dominio** → inserisci `nome-progetto.pages.dev` (e l'eventuale dominio personalizzato, senza `https://`).

## 9. Uso (admin)

Scheda **Admin** (in basso):

1. **🔑 Accessi** → incolla l'elenco dei nomi (uno per riga) → *Importa*. Per ogni studente compaiono **Copia** e **Copia messaggio WhatsApp**; c'è anche **Copia tutti i link**. Vedi chi è "Attivo". **Resetta accesso** (password dimenticata) genera un nuovo link e invalida il vecchio account.
2. **👥 Gruppi** → *Distribuisci automaticamente* (22 studenti → 6 gruppi, posti liberi nell'ultimo), poi *Date a cadenza* o una data per gruppo. Sposta gli studenti col **drag & drop** (su telefono: tieni premuto e trascina, oppure tocca il nome e poi il posto). Tocca un nome → **Escludi dalle programmate / Reinserisci**. Il sostituto è automatico (1° del gruppo successivo) ma si può cambiare a mano.
3. **✅ Segna** → *Interrogato* / *Assente* / *In attesa* con un tap. L'assenza fa lo scambio sostituto⇄assente da sola. **↩️ Annulla ultima azione** ripristina i gruppi com'erano.

Gli studenti vedono la **Cartina**, chiedono scambi toccando il nome di un compagno e li gestiscono nella scheda **Scambi** (badge rosso sulle richieste ricevute). **Storico** mostra scambi, assenze e interrogazioni; dalla Cartina si scarica un'immagine o si stampa/salva in PDF.

## Struttura dati

```
students/{id}   name, activated, uid, authEmail, excluded, order
invites/{token} studentId, authEmail, used, usedByUid, usedAt
users/{uid}     role ('admin'|'student'), studentId, inviteToken
groups/{g01…}   number, date, startsAt, seats[4], status[4], subId, absentIds[], done, lastSwapId
swaps/{id}      fromUid, toUid, fromSid, toSid, fromGroup, fromPos, toGroup, toPos, status
history/{id}    type, at, … (le voci admin contengono anche `prev` per l'annulla)
```

## Test

```bash
npm run test:logic   # logica di assenze, spostamenti, distribuzione
npm run test:rules   # Security Rules con l'emulatore Firestore (serve Java)
npm test             # entrambi
```

I test delle regole coprono: attivazione (token valido/errato/già usato, email diversa, ruolo admin negato), reset, scrittura gruppi negata agli studenti, creazione/accettazione/rifiuto/annullamento scambi, scambio con data passata o posto già interrogato, richiesta che decade, accettazione manomessa (altri posti cambiati, un solo gruppo).

## Note e limiti

- **Reset accesso**: senza Cloud Functions non si può cancellare l'utente da Firebase Auth; il vecchio account resta in elenco ma, senza `users/{uid}`, non ha alcun permesso. Se vuoi puoi eliminarlo a mano da *Authentication → Utenti*.
- L'elenco dei **nomi** è pubblico (serve al login prima di accedere). Cartina, storico e scambi sono visibili solo a chi ha un account valido.
- Il giorno dell'interrogazione si considera iniziato a **mezzanotte (ora del dispositivo dell'admin che imposta la data)**: da quel momento non si può più scambiare.
- Le richieste di scambio che non sono più valide (un posto è cambiato, il gruppo è passato…) vengono marcate "decadute" automaticamente dall'app di chi le vede per prima.
- Tentativi di password errata sono limitati da Firebase Authentication stessa.
