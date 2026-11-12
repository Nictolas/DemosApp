# PROD-041 — Tre identità PE selezionate: fascicolo di revisione (08/11/2026)

**Stato: PENDING_REVIEW. Questo documento NON autorizza alcun aggiornamento o link `VERIFIED`.**

## Perimetro

Verifica effettuata usando solo `SELECT` sul progetto DEMOS produzione, limitando l'estrazione alle tre schede pubbliche di eurodeputati selezionati secondo la query reviewer-only `api/database/20261108_ep_selected_identity_review_readonly.sql`. Nessun follower, preferenza individuale, votazione personale o storico è stato esportato. I tre UUID interni rimangono consultabili *solo* con query reviewer-only nel database, non copiati in questo file pubblico.

| Scheda DEMOS pubblica | Candidato MepId (NON ancora VERIFIED) | Fonte istituzionale PE | DOB DEMOS | DOB fonte ufficiale | Esito preliminare |
| --- | --- | --- | --- | --- | --- |
| Susanna Ceccardi | `197786` | https://www.europarl.europa.eu/meps/en/197786/SUSANNA_CECCARDI/home | `1997-03-19` | `1987-03-19` | **DOB_MISMATCH_REVIEW**: data discordante di dieci anni |
| Salvatore De Meo | `204333` | https://www.europarl.europa.eu/meps/en/204333/SALVATORE_DE%2BMEO/home | `NULL` | `1971-10-27` | **DOB_MISSING_REVIEW**: data assente in DEMOS |
| Elisabetta Gualmini | `197618` | https://www.europarl.europa.eu/meps/en/197618/ELISABETTA_GUALMINI/home | `NULL` | Non visibile nella scheda istituzionale consultata | **DOB_MISSING_OFFICIAL_UNAVAILABLE** |

**Attenzione:** il numero nel percorso istituzionale identifica un *candidato* MepId altamente plausibile, non è ancora una crosswalk approvata con l'UUID DEMOS. Le pagine del PE indicano che i tre soggetti sono eurodeputati italiani correnti alla consultazione dell'08/11/2026; una prova di identità in DEMOS richiede ancora l'approvazione indipendente del revisore. Per Gualmini non inventare la data di nascita. Per De Meo e Gualmini la mancanza della data non deve causare compilazione automatica.

## Checklist obbligatoria per un revisore autorizzato (nessuna automazione)

1. Usare la query SQL reviewer-only per identificare l'UUID canonico selezionato con mandato E/ACTIVE e `political_office_id='eu.parliament.it'`, senza fidarsi delle stringhe legacy.
2. Confrontare personalmente nome, carica corrente, profilo istituzionale e ID numerico con la voce DEMOS; escludere omonimie, doppioni e migrazioni di identità non autorizzate.
3. Per Ceccardi, accertare e documentare l'errore DOB `1997` vs `1987` e richiedere una decisione DPO/legale prima di aggiornare un profilo reale. Non correggere per semplice somiglianza del nome.
4. Per De Meo e Gualmini, verificare che la data mancante non nasconda un duplicato e registrare le evidenze sufficienti per il crosswalk. La DOB non è prerequisito tecnico da riempire con supposizioni.
5. Registrare identità del revisore e data, URL ufficiale corrispondente allo stesso ID, e approvare `VERIFIED` solo dopo l'autorizzazione richiesta e l'installazione validata della migration PE sullo staging unico. Nessun approvatore automatico.
6. Eseguire test autenticato in staging: un solo `demos:<UUID>` per eurodeputato, voto corrente/oggetto/data/esito/fonte corretti, revoca `VERIFIED` che blocca nuove scritture, 0 follower che blocca rete+import, assenza di storico, gruppi e partiti in UI.

## Vincoli di rilascio

- Lo staging unico **non** ha ancora applicato `api/database/20261108_ep_verified_identity_bridge.sql`: il CHECK esistente ammette solo Camera e Senato. Audit read-only 08/11: 0 link PE `VERIFIED`, 0 `institutional_current_nominal_votes` PE; RLS attiva.
- Il refresh PE è predisposto nei Draft #633/#635 ma `PARLIAMENT_EP_CURRENT_REFRESH_ENABLED` resta **OFF**, senza nuovi cron o servizi a pagamento.
- Test PostgreSQL 16 e Chrome sintetici non sostituiscono E2E autenticato su staging o QA Android/AAB.
- Nessuna modifica a DB produzione, DPO, dati anagrafici, selezioni, AAB, deploy o bonifica autorizzata in questo fascicolo.
