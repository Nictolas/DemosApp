# DEMOS — Normalizzazione dei nuovi token FCM, pulizia e revoca

**26 ottobre 2026 — PR DRAFT stacked su #343 → #342 → #341 → #340 → #339 → #338 → #336 → #335 → #334 → #333 → #332 → #331 → #330 → #329 → #328 → #327 → #326 → #302.**

## Rischio rilevato

Il servizio di notifiche politiche, dopo #343, protegge i token canonici disattivati/trasferiti e tenta prima una ricerca FCM esatta tramite l'indice unico. Tuttavia `api/routes/fcm-tokens.js` verificava l'input con `token.trim()` **senza salvare il risultato**. Il POST poteva quindi scrivere token con spazi in `users.fcm_tokens` e `user_devices.fcm_token`, alimentando nuove righe storiche per cui il controllo pre-send è costretto al più costoso confronto `btrim`. Anche il cleanup e DELETE confrontavano stringhe raw senza gestire coerentemente vecchi valori con spazi.

## Modifica limitata alle operazioni esplicitamente richieste

- `normalizeFcmToken(token)` accetta esclusivamente stringhe e rimuove gli spazi iniziali/finali. La verifica di lunghezza minima e il rifiuto del prefisso sintetico `web_` operano **sul token normalizzato**. Un oggetto JSON non stringa viene rifiutato con HTTP 400 senza interrogare il DB.
- `POST /api/fcm-tokens` usa il valore normalizzato per entrambi i salvataggi (`public.users.fcm_tokens` legacy e `public.user_devices.fcm_token` canonico) e per il confronto con i token già presenti in legacy. Durante la registrazione viene mantenuta attiva soltanto la riga canonica con **valore esattamente uguale** al token normalizzato: un vecchio duplicato con spazi è disattivato, non rimane inavvertitamente attivo.
- `POST /api/fcm-tokens/cleanup` normalizza solo il token scelto nell'operazione di pulizia invocata dall'utente, senza bonificare indiscriminatamente l'intera base dati; conserva il comportamento di mantenere un solo token.
- `DELETE /api/fcm-tokens/:token` normalizza la richiesta, rimuove copie legacy con whitespace e disattiva anche vecchie righe canoniche in cui `btrim(fcm_token)` equivale al token rimosso. L'uso qui di `btrim` è deliberato: una revoca deve raggiungere anche i token vecchi.
- Tutte le SELECT/UPDATE/INSERT del router sono qualificate nello schema `public`, per non operare su tabelle `pg_temp` omonime in connessioni con `search_path` alterato.
- Non si stampano più prefissi dei token nei log e gli errori del database sono ridotti a un codice generico, senza inviare `error.message` al browser: tali errori potrebbero contenere valori FCM.
- Nessun cambiamento al comportamento del dispatcher Firebase, ai campi API di successo o alla policy mobile-only; nessun DDL, nuova tabella, indice o variabile d'ambiente.

## Test senza DB o Firebase reali

- `api/tests/fcmTokenNormalizedHttp.smoke.test.js` lancia un server Express su **localhost porta effimera**, con modulo database completamente simulato e autenticazione di test. Esegue veri POST, POST cleanup e DELETE con token lunghi sintetici e conferma i parametri SQL effettivi.
- Copre input con spazi, oggetti non stringa, token troppo corti dopo trim, prefisso sintetico, copia canonica padded da disattivare, pulizia, revoca sia legacy sia canonica e compatibilità del fallback per colonna legacy rimossa (`42703`).
- `fcmTokenIntegrity.test.js` e `fcmTokenLegacyFallback.test.js` verificano i contratti statici; la suite è aggiunta al workflow `Political consent save/revoke atomic privacy`.
- Si continuano a eseguire le prove PostgreSQL 17 disposable delle PR #342/#343 su device inattivi, token trasferiti e controlli pre-send. **Questa PR non legge dati utenti reali né contatta Firebase.**

## Limiti e prossimo rischio da esaminare

- Le operazioni HTTP del vecchio router eseguono ancora più query con `pool.query` indipendenti: un guasto dopo l'aggiornamento legacy ma prima dell'upsert/disattivazione canonica potrebbe lasciare una scrittura parziale. La presente PR **non dichiara di aver reso atomico** il flusso; la transazionalità dell'intera registrazione, cleanup e DELETE richiede un audit separato sui conflitti concorrenti fra registrazioni e revoche.
- Il salvataggio di un **nuovo** token con il formato corretto non prova che tutte le vecchie righe FCM siano normalizzate. Nessuna bonifica o alterazione massiva è autorizzata.
- Non è attestata la presenza reale degli indici/versioni schema su Supabase, né è misurata la latenza/costo per milioni di utenti. La PR #343 mantiene per sicurezza il fallback normalizzato nella lettura dei token storici.
- La revoca fra l'ultima SELECT e l'accettazione del messaggio da Firebase resta una finestra non atomica.
- L'issue #296 rimane bloccata dalla disponibilità verificabile di un journal GDPR indipendente **completo, fresco e durevole fino al freeze**, dalla quarantena Render/Supabase/Data API/worker, dalla prova B2 Object Lock COMPLIANCE/VersionId/retention su provider staging e dalle approvazioni DPIA/titolare/DPO, conservazione e costi.

**Nessun merge, deploy, migrazione, accesso a produzione o dati reali, credenziali, costi o servizi attivati.**
