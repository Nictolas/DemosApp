# DEMOS — concorrenza revoca e preferenze referendum legacy (25 ottobre 2026)

**Stato:** PR di bozza concatenata alla #272. Nessun merge/deploy; DPIA da validare con il DPO.

## Rischio
L'endpoint ancora raggiungibile `POST /api/referendum/abrogativi/vota` sostituiva le preferenze con una DELETE seguita da più INSERT eseguite su connessioni separate, senza transazione. Il controllo consenso avveniva solo nel middleware: una revoca concorrente poteva cancellare i dati e terminare prima di una INSERT tardiva. Un errore a metà lista poteva inoltre lasciare le preferenze cancellate o parziali. Questa è la vecchia funzione di priorità referendum, distinta dalla nuova previsione referendum reali.

## Correzione proposta
Transazione unica con blocco della riga `users` prima di ogni scrittura, seconda lettura del consenso tramite `getPoliticalConsentState` **dopo** il lock, 403/rollback se revocato, 404 se utente assente, DELETE e INSERT sul medesimo client, COMMIT e rilascio della connessione. L'array di preferenze non valido restituisce 400.

## Verifica
Il workflow privacy esegue test statici e quattro scenari HTTP su PostgreSQL 17 locale con soli dati sintetici: scrittura prima della revoca (cancellata), revoca prima della scrittura (403), consenso attivo (200), errore durante la sostituzione (rollback completo). I due test concorrenti verificano l'arrivo della seconda transazione sul lock prima di sbloccare la prima.

## Limiti
Nessuna modifica alla produzione né accesso a dati reali. Il vecchio endpoint resta raggiungibile e altri percorsi di scrittura politica richiedono audit separato. Restano verifiche Android/logout, CDN reale, revisione PR concatenate e validazione DPIA con DPO.
