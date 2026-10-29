# DEMOS — Letture preferenza Capo di Stato e revoca (25/10/2026)

**Stato:** modifica proposta nella PR stacked successiva alla #276, esclusivamente **DRAFT**, senza merge o deploy.

## Problema riscontrato nel codice

La PR #275 protegge `/api/capo-stato/consenso`, ma il diverso endpoint `GET /api/capo-stato` restituiva `mieiVoti` anche dopo la revoca del consenso e conteggiava preferenze residue nella classifica. Mancava una direttiva HTTP esplicita `no-store` e la query React Query `['capoStatoData']` non distingueva gli account. Alcuni log della schermata potevano includere risposte o scelte personali.

## Soluzione in bozza

- `GET /api/capo-stato`: `Cache-Control: private, no-store, max-age=0` prima dell'handler, compresi gli errori.
- La classifica aggregata e le preferenze personali leggono il consenso Art. 9 **nella stessa query SQL** che legge le righe `voti_capo_stato`. Il filtro considera l'override di `user_consents`; senza consenso, il risultato personale è vuoto e il cooldown non viene esposto.
- Identificatore utente solo da allowlist `userid`, `userId`, `user_id` per retrocompatibilità dello schema. In caso di schema non supportato, errore senza esposizione di dati.
- Esclusione CDN dell'intero prefisso `/api/capo-stato` anziché del solo `/consenso`.
- Cache `capoStatoData` per account, inoltro dell'`AbortSignal` al `fetch`, cancellazione della cache dopo revoca. Rimozione dei log frontend che stampavano la scelta e la risposta del voto.
- Test unitari sintetici e integrazione con PostgreSQL 17 locale: sole tabelle temporanee, rollback completo, nessun accesso a dati di utenti veri.

## Limiti e validazione

La verifica nella stessa SELECT è coerente rispetto allo snapshot del comando SQL, ma non serializza una lettura già avviata con una revoca concorrente. Gli aggregati molto piccoli possono richiedere soglie o ulteriori misure antinferenza. Restano le verifiche su Android, CDN effettiva e review delle PR concatenate.

**DPIA:** il DPO si è identificato come tale e ha dichiarato l'approvazione nella conversazione del 25 ottobre 2026. Questa registrazione è una **dichiarazione dell'interlocutore**, non una verifica indipendente della sua identità o una firma di una specifica versione della DPIA. Prima di rappresentare la DPIA come formalmente approvata nel documento ufficiale occorre associare la dichiarazione alla versione esatta e completare le eventuali evidenze richieste; i rischi residui delle modifiche ancora in bozza vanno inclusi nella review.

Nessun merge/deploy, nessuna operazione distruttiva, nessun accesso a dati personali reali.
