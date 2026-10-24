# DOC-073 — Security e privacy review finale, piano di rilascio della PR #258

**Data:** 24 ottobre 2026. **Stato:** revisione tecnica completata per il perimetro OP-37, nessun merge né deployment di produzione. PR [#258](https://github.com/Nictolas/DemosApp/pull/258), ancora DRAFT.

## Ambito verificato

La PR sostituisce le letture N+1 degli aggregati Sondaggi **TEXT** con tre SELECT nominali per GET (catalogo domande, whitelist delle colonne, aggregazione), mantenendo il formato JSON e le quattro route nazionale, regione, provincia e comune. Non contiene migrazioni BYTEA/2-bit e non richiede una nuova release Android per applicare la sola ottimizzazione backend.

I controlli sull'elenco delle domande e sugli identificatori SQL sono limitati a `SAFE_COLUMN` e alle colonne presenti nella tabella `opinioni_risposte`; i parametri geografici sono vincolati e non interpolati in SQL. Le statistiche con meno di **10 voti espliciti** rimangono omesse; l'aggregazione include solo account `PERSON` con consenso politico effettivo secondo la regola `COALESCE(user_consents.political_opinions_consent, users.political_opinions_consent, false)`.

## Rischi corretti in questa revisione

1. **Consensi che cambiano durante un fallback N+1.** Se il bulk SQL non è supportato, il fallback esegue più letture per-opinione. Prima potevano osservare versioni diverse dei consensi; il codice ora usa `withReadOnlySnapshot` con una sola connessione `pg.Pool.connect()`, una transazione `REPEATABLE READ READ ONLY`, COMMIT o ROLLBACK e rilascio. Se il rollback fallisce, la connessione viene scartata. L'eventuale richiesta iniziata **prima** della revoca può concludersi con il suo snapshot originale: una **nuova** richiesta legge la revoca e sopprime le celle sotto soglia. Il percorso aggregato multi-batch già usava lo snapshot, ora condivide la funzione.
2. **Lancio involontario della query sperimentale sul backend pubblico.** La variabile `SONDAGGI_EXPERIMENTAL_DIRECT_FILTER=true` da sola **non basta più**. Occorre contestualmente l'ambiente CI isolato (`GITHUB_ACTIONS=true`, `SONDAGGI_TEXT_CI=isolated`) oppure l'esatto servizio OP-37 di staging (`RENDER=true`, `OP37_STAGING_HTTP_ONLY=yes`, `OP37_STAGING_SETUP_ONLY=no`). Il backend di produzione deve continuare con il SQL standard. Nessun cambio della query predefinita.
3. **Apertura inutile di transazioni per cataloghi troppo grandi.** La soglia del fallback legacy (128 opinioni) è ora applicata **prima** di aprire la nuova transazione, evitando lavoro non necessario quando il blocco è inevitabile.

## Evidenze

- [GitHub Actions #40135299612](https://github.com/Nictolas/DemosApp/actions/runs/40135299612) **SUCCESS** su commit `2b20c6a7`, comprendente le due correzioni e i test di unità, privacy, database isolato PostgreSQL 17, benchmark concorrente, confronto SQL e route HTTP.
- Il test di regressione PostgreSQL 17 con **300 colonne** verifica inoltre, per tutti e quattro gli ambiti, la revoca di un consenso mentre il fallback è **già a metà delle sue letture**. Il risultato in corso conserva lo snapshot iniziale; il risultato della richiesta successiva sopprime tutte le celle da 10→9. Tutto sul database GitHub Actions sintetico, senza Supabase o Render.
- Nuovi test unitari: commit/rollback di una sola transazione del fallback per ambito, divieto di riutilizzare una connessione il cui rollback fallisce, impossibilità di attivare FILTER in produzione con il solo flag.
- Le prove DOC-071 (48 GET su Render↔Supabase Demos-Staging) e DOC-072 (192 GET concorrenti sulla fixture PostgreSQL CI) rimangono distinte. Le credenziali DB staging sono già state revocate, il servizio Render staging è tornato `setup-only`.

## Limiti ancora aperti / prerequisiti del merge

- **Nessuna verifica delle latenze o dei consumi su traffico reale in produzione.** Non si può dichiarare la capacità di un milione di utenti o il rispetto garantito dei piani gratuiti sulla base di queste prove.
- **Privacy end-to-end dell'app** e dati reali: la revisione ha verificato il perimetro backend Sondaggi e dati sintetici, non ha svolto una certificazione GDPR completa né un test Android su utenti.
- Il fallback può ancora essere oneroso se l'SQL aggregato risulta incompatibile; resta limitato a 128 opinioni e non parte su errori temporanei di connessione, timeout o permessi. Un raro errore `42703` dentro una transazione PostgreSQL può causare l'interruzione sicura della richiesta (500): preferire la non pubblicazione alla restituzione di dati incompleti.
- SQL opt-in resta **disattivata**, benché più rapida nei test di alto volume CI. Non impostare il flag nella produzione.
- Valutare un piano di rollback applicativo e avvisi su `/api/sondaggi` prima dell'integrazione. Il PR include script sintetici staging/CI ma **non** credenziali. Non applicare al database di produzione i file `api/staging/*.sql`.

## Piano di rilascio backend suggerito, NON eseguito

1. Rieseguire suite di sicurezza/privacy dei backend che dipendono dalle route Sondaggi e assicurarsi che la PR sia aggiornabile contro il ramo di destinazione senza conflitti.
2. Controllare i flag e le variabili del backend produttivo: nessuna CA/credenziale OP-37 di test, nessun `SONDAGGI_EXPERIMENTAL_DIRECT_FILTER` utilizzabile; mantenere il pool PostgreSQL esistente senza aumento arbitrario.
3. Solo dopo approvazione del rilascio e di eventuali ulteriori controlli: integrare la PR in una finestra sorvegliata, con backup/rollback disponibile, verificando 4 GET e soppressione sotto soglia usando un dataset di prova e senza esporre voti individuali.
4. Monitorare numero di query per GET, errori 5xx e timeout, latenza p50/p95, attesa connessioni e CPU database. Su regressioni rilevanti effettuare rollback del deploy applicativo (nessuna migrazione schema da invertire).
5. Conservare la query alternativa disabilitata finché non si ottengono misure remote concorrenti sufficienti, con costi misurati e controlli privacy. Non forzare nuovi segreti staging.

**Decisione DOC-073:** modifiche correttive e prove CI completate; **PR #258 da mantenere DRAFT** fino all'esame di rilascio, senza merge, deploy DEMOS pubblico o aggiornamento Android.
