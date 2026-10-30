# DEMOS — riconciliazione DPIA e registro dopo il rilascio web
**Data verifica tecnica:** 30 ottobre 2026 · **Stato:** REVISIONE APERTA — NON APPROVATA

Questa è una **matrice di scostamenti e prove mancanti**, non una nuova DPIA, una nomina DPO, una certificazione GDPR o una decisione del titolare. Il documento storico [DPIA_DemosApp.md](../../DPIA_DemosApp.md) (versione 1.1, revisione 16/03/2026) **non va presentato come approvato o aggiornato al rilascio**. La verifica è limitata al repository e agli esiti tecnici documentati; non include l'ispezione completa delle configurazioni dei fornitori né un collaudo fisico Android.

## Matrice da chiudere con evidenze

| Ambito | Evidenza o incongruenza osservata | Prova richiesta prima di dichiarare «verificato» | Stato |
| --- | --- | --- | --- |
| Titolarità e DPO | §1.2 e frontespizio DPIA storica riportano identità e nomina non riconfermate; §7 (parere) e §9 (approvazioni) non sono compilati. | Identità/titolarità confermate dal responsabile, incarico DPO e relativi estremi documentali, parere e firme verificabili; non inferire da ruoli tecnici nell'app. | APERTO |
| Inventario account | §2.2 e allegato A descrivono nome/cognome e password obbligatori, data di nascita e «genere U/D/A»; le decisioni recenti del prodotto prevedono minimizzazione, anno di nascita e sesso M/F. | Riconciliare schema Supabase **in sola lettura**, registrazione OAuth/passkey/CIE, ruoli P/O/E, eventuali campi legacy e informativa; distinguere dato presente da dato effettivamente raccolto. | APERTO |
| Opinioni e consenso | Il rilascio [#468](https://github.com/Nictolas/DemosApp/pull/468) e le correzioni [#475](https://github.com/Nictolas/DemosApp/pull/475), [#476](https://github.com/Nictolas/DemosApp/pull/476) hanno test automatici; non equivalgono a test multidevice reali. | Matrice A→logout→B, 401 tardivo, revoca e nuova concessione, rete assente, cache cifrata, cancellazione account; verificare risposte e log senza esportare dati personali. | APERTO — QA ANDROID FISICO NON ESEGUITO |
| Diritti e cancellazione | §4.4 DPIA marca DELETE `/api/user/account` come implementato; la [PR #376](https://github.com/Nictolas/DemosApp/pull/376) è Draft e riguarda anche il percorso legacy. | Verificare compatibilità API e stato delle richieste in staging con PostgreSQL sintetico, idempotenza, audit, rollback e gestione delle copie; non usare account reali per test distruttivi. | APERTO |
| Conservazione | §2.6 DPIA riporta 5 anni voti, 7 anni audit, 12 mesi log e 10 anni consensi, senza prova attuale delle impostazioni e delle basi per ciascuna categoria. | Inventario per categoria/finalità, fonte giuridica documentata, periodo approvato, scadenza effettiva, job di cancellazione e prova non distruttiva di esecuzione. | APERTO — PERIODI NON ATTESTATI |
| Axiom e log storici | Le [PR #472](https://github.com/Nictolas/DemosApp/pull/472), [#473](https://github.com/Nictolas/DemosApp/pull/473) e [#474](https://github.com/Nictolas/DemosApp/pull/474) minimizzano log futuri; non bonificano i log precedenti. | Inventario dataset e retention configurata, permessi, scadenza effettiva e valutazione dei log preesistenti; non cancellare archivi senza piano e autorizzazione. | APERTO |
| Backblaze B2 e backup | La [PR #374](https://github.com/Nictolas/DemosApp/pull/374) resta Draft: test PostgreSQL sintetici e ricevute non dimostrano restore di produzione o eliminazione completa dai backup. | Mappare bucket, Object Lock, retention/versioni, lifecycle, manifest e restore **non distruttivo**, con responsabilità e prove firmate. | APERTO — B2 NON CERTIFICATO |
| Registro trattamenti e informativa | Le pagine `client/src/pages/RegistroTrattamenti.tsx` e `PrivacyPolicy.tsx` sono state rettificate nel rilascio #468, ma non è provata la corrispondenza completa con DPIA e fornitori. | Confronto riga-per-riga di finalità, categorie, ruoli, destinatari, trasferimenti, retention, diritti, contatti e date effettive; approvazione titolare/DPO. | APERTO |
| Rischi e trasferimenti | Le sezioni 3–6 DPIA attribuiscono punteggi e controlli «implementati» storici, inclusi cifratura, CIE, trasferimenti e misure di mitigazione. | Inventario tecnico e contrattuale aggiornato, regioni/provider e subprocessori, controlli verificati, riesame dei rischi residui e delle eventuali misure ulteriori. | APERTO |

## Gate di chiusura (tutti necessari)

1. **Tecnico:** prove versionate per Android fisico, web e API, compresi cambio account/revoca, cancellazione e ripristino non distruttivo.
2. **Dati e fornitori:** evidenze read-only di schema, policy Axiom/B2, tempi reali e capacità di ripristino; nessuna deduzione dal solo codice.
3. **Documentale:** riconciliazione con informativa e registro, identificazione formale di titolare e DPO, motivazione delle basi giuridiche e dei periodi.
4. **Decisionale:** parere DPO, accettazione del rischio residuo, data, versione e approvazioni effettive. Fino ad allora **DPIA NON APPROVATA**.

**Tracciamento:** [registro operativo «DEMOS – Ottimizzazione Opinioni – Piano operativo e verifiche»](https://docs.google.com/spreadsheets/d/18-kXLPc7rHHJQBgmOj0qnDzCGNa2WY5pfruLf374Vqs/edit), scheda «Registro lavori». Nessun dato personale o backup di produzione è stato modificato per redigere questa matrice.
