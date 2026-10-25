# DEMOS — Delta writes per opinioni compatibili con la revoca del consenso

**Data:** 26 ottobre 2026. **Stato:** PR DRAFT basata sulla #291. Nessun merge, deploy, DDL o lettura di dati politici reali.

## Motivazione

Con il formato corrente `opinioni_risposte` (una colonna TEXT `f/c/i/NULL` per opinione), il client può reinviare molte risposte già salvate. L'implementazione nel ramo privacy #291 eseguiva l'`UPDATE` su tutte le colonne accettate anche quando il valore non era cambiato. Questo produce lavoro di scrittura PostgreSQL e WAL non necessario e aumenta l'impatto della tabella, degli indici e delle operazioni di manutenzione.

La PR #216 (`performance/opinion-delta-writes-20261021`) conteneva il primo prototipo, ma partiva da una versione precedente della route, antecedente alle verifiche transazionali della revoca. Il suo generatore di SQL per i campi modificati mancava inoltre del prefisso `$` nei parametri posizionali. **Non va integrata come sostituzione diretta** della route protetta in #264–#291.

## Correzione proposta

- Riutilizzata la logica di diff per riga, **dentro la transazione che detiene sia il lock dell'utente sia quello della riga di risposte**. Il consenso Art. 9 è sempre riletto dopo `SELECT users ... FOR UPDATE`, indipendentemente dal numero di campi cambiati.
- Su un batch di 94 valori identici: **zero UPDATE**, ma consenso e due lock ancora verificati, e `savedCount=94` per compatibilità col contratto API.
- Se uno solo dei 94 valori cambia, una singola istruzione `UPDATE opinioni_risposte SET "id"=$1 WHERE user_id=$2`; se ne cambiano N, UPDATE soltanto le N colonne mutate con parametri PostgreSQL validi. Nessuna modifica allo schema o al formato TEXT.
- `NULL`→`f/c/i` produce l'aggiornamento richiesto ma non una notifica ai sostenitori; `f/c/i`→valore differente notifica solo quando il proprietario è politico/candidato. Batch interamente identico non produce notifiche.
- L'inserimento della prima riga non cambia. `savedCount` continua a rappresentare le risposte valide **accettate**, non il numero di colonne fisicamente riscritte. In caso di fallimento dell'UPDATE, la transazione fallisce, con rollback, anziché restituire un successo ingannevole.

## Test e criteri d'accettazione

1. 11 nuovi test HTTP contro la vera route Express con un database simulato, comprensivi di 94 risposte identiche, 1/94 cambiata, nuove risposte, NULL→valore, notifiche solo per modifiche reali, input parzialmente invalido, consenso revocato e utente cancellato, 401, rollback.
2. Prova PostgreSQL 17 reale e **soltanto sintetica** nella CI su database locale `political_consent_race_ci`, con tabelle TEMP create su un pool da una connessione: prima e dopo il no-op si controlla anche `xmin` (invariato), mentre una singola modifica produce un `xmin` diverso. Ultimo tentativo con consenso revocato restituisce 403 senza scritture.
3. La CI esegue anche le regressioni privacy della catena, le vecchie prove di concorrenza e la build frontend, con PostgreSQL 17 effimero. Il test rifiuta configurazioni Render/Supabase o credenziali differenti dalle fixture CI.

## Prestazioni e limiti

La riduzione **teorica delle UPDATE** è verificabile in base al numero di campi realmente mutati; non equivale direttamente a una percentuale dimostrata di risparmio nelle quote Supabase/Render. L'incremento di query di lettura è **zero rispetto alla route #291**, perché il SELECT del valore precedente e i lock erano già presenti. Non sono ancora misurati i benefici su WAL, CPU, vacuum, rete o costo reale né la distribuzione dei batch no-op nell'uso dell'app.

Questa PR **non** introduce il formato 2-bit/BYTEA (#247) né sposta le domande `opinioni_domande` nel codice, né realizza una cache locale persistente. La PR #258 sui Sondaggi TEXT, già unita a main, rimane indipendente. La successiva ottimizzazione del catalogo potrà puntare a una cache condivisa/versionata senza sacrificare la gestione editoriale delle domande.

**Gate:** review integrata della catena #264–#292, CI/Snyk, test Android e CDN, definizione della cancellazione dei residui politici dopo revoca, revisione DPIA e benchmark di consumo prima di una qualunque attivazione in produzione.
