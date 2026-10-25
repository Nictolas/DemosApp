# DEMOS — Salvataggio delle selezioni politiche concorrente con revoca (25 ottobre 2026)

**Stato:** correzione in PR di bozza concatenata alla #288. Nessun merge, deploy o modifica al database di produzione.

## Problema

Le tre API che registrano la scelta di un rappresentante/candidato passano da setPoliticalSelection ma, dopo i controlli pre-transazione di matching e territorio, il servizio scriveva direttamente nelle tabelle canoniche e nelle colonne legacy senza ripetere la verifica del consenso politico. Se la revoca terminava durante i controlli precedenti, una richiesta già avviata poteva salvare una nuova preferenza dopo il commit della revoca.

I punti di ingresso interessati sono:
- PUT /api/users/:userId/seleziona-rappresentante
- PUT /api/users/:userId/political-selection
- PUT /api/candidati/seleziona-candidato

## Mitigazione proposta

Nel servizio centrale setPoliticalSelection, all'interno della transazione PostgreSQL aperta dal chiamante:
1. La riga dell'utente viene acquisita con SELECT id FROM users WHERE id = $1 FOR UPDATE. È la stessa riga che il processo di revoca aggiorna transazionalmente.
2. Se si sta **aggiungendo o sostituendo** una selezione, getPoliticalConsentState usa lo **stesso client transazionale** dopo il lock; senza consenso attivo la scrittura termina con errore strutturato POLITICAL_SELECTION_CONSENT_REQUIRED.
3. Le tre API mappano tale errore a HTTP 403 e consent_required=true, senza includere dettagli SQL, ID o nomi politici nei log. Un account inesistente restituisce 404.
4. Le **rimozioni volontarie** della preferenza, riconosciute da selectedUserId nullo/vuoto, restano permesse anche senza consenso. Acquisiscono comunque il lock, evitando interleaving con la revoca.
5. Cache-Control: private, no-store, max-age=0 è impostato prima dell'autenticazione anche sui profili utenti; era già configurato per le rotte candidati.

Non cambia il modello delle selezioni né i requisiti di eleggibilità territoriale e matching. La seconda verifica non dipende dal middleware HTTP e si applica anche a eventuali futuri chiamanti del servizio, **purché** utilizzino una transazione sul medesimo client.

## Test di regressione

- Test unitari del servizio: ordine FOR UPDATE → consenso → scritture, consenso negato, giurisdizione estera, cancellazione senza consenso, account inesistente, failure DB fail-closed, errori di persistenza.
- Fixture aggiornate per i test legacy italiani, selezione canonica e matching.
- Verifica concorrente con **PostgreSQL 17 reale e solo utenti sintetici**, database locale usa username e password di test e rifiuta DATABASE_URL/SUPABASE_URL/RENDER: SAVE prima di REVOKE, REVOKE prima di SAVE, revoca già completata, rimozione dopo revoca e salvataggio con consenso valido.

## Rischi ancora aperti

La presente correzione impedisce nuove scritture dopo la revoca, ma **non elimina selezioni già presenti** in political_selections, user_representatives o colonne storiche users. In particolare un salvataggio completato prima della revoca resta conservato finché la policy di erasure di questo store non sarà implementata: una successiva concessione del consenso potrebbe renderlo nuovamente visibile. **Non considerare chiuso il requisito di cancellazione GDPR.**

Le scritture del servizio presuppongono un client PostgreSQL già in transazione: la disciplina va documentata per futuri call site. La compatibilità con installazioni legacy senza tabella political_selections richiede inoltre una prova reale della gestione SQLSTATE 42P01 durante una transazione.

Restano la revisione integrata delle PR #264–#289, prove manuali Android/CDN/staging, scelta documentata su base giuridica/conservazione, e aggiornamento versione/parere DPO/firme della DPIA. Gli esiti dei test sintetici non sono un'autorizzazione di rilascio.

**Nessuna modifica dati personali reali, produzione, merge o deploy.**
