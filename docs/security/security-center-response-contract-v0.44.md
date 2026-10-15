# CP-044 – Security Center Response/Output Contract Hardening v0.44

## Obiettivo
Applicare un contratto di output fail-closed comune a tutte le 9 API GET del Security Center, mantenendo l'agente in modalità shadow/read-only e impedendo che regressioni interne espongano output non serializzabili, eccessivi o operativi.

## Contratto
- Envelope di successo fisso: `{ success: true, data }`.
- Tipo top-level dichiarato per endpoint: oggetto oppure array.
- Profondità massima: 10 livelli.
- Massimo 200 elementi per array.
- Massimo 128 chiavi per oggetto.
- Stringhe massimo 4096 caratteri; nomi chiave massimo 80 caratteri.
- Solo valori JSON sicuri: niente `undefined`, funzioni, simboli, BigInt, numeri non finiti, cicli o istanze arbitrarie.
- Chiavi prototype-sensitive respinte.
- Limite byte sull'envelope serializzato: Health 64 KiB; Overview/Incidents/Notifications/Boundary/AI Policy/AI Orchestrator 128 KiB; Approvals/AI Analyses 256 KiB.
- I flag di sicurezza `authorized`, `executable`, `actionRunnerAvailable`, `executionEnabled`, `realDeliveryEnabled` sono fail-closed: qualunque valore `true` nell'output Security Center viene respinto.
- Ogni violazione viene convertita nell'errore pubblico generico già esistente `SECURITY_CENTER_READ_FAILED`; nessun dettaglio interno viene restituito.

## Copertura
Il policy gate viene applicato centralmente in `securityCenterApi.js` a: Overview, Incidents, Health, Notifications, Boundary Audit, Approvals, AI Policy, AI Orchestrator e AI Analyses.

## Regressioni riallineate
Quattro file di test legacy sono stati riallineati ai contratti già introdotti da CP-040/CP-043: consistency minimizzata, Boundary Health annidata nel relativo read model e `limit` normalizzato a intero. Nessuna capacità applicativa è stata aggiunta da questi riallineamenti.

## Gate locale
- Syntax check dei file CP-044: verde.
- Test mirati CP-040–CP-044: 36/36 verdi.
- Suite `test:security-agent`: 328/328 verde.
- Build Vite client: verde.
- Nessun deploy, migration, Action Runner, automazione reale o write di produzione.

## Strategia GitHub Actions
Nel branch sono presenti solo due workflow: `eci_sync.yml`, schedulato ogni 6 ore, e `update-monitoring.yml`, manuale. Non esiste un workflow GitHub dedicato a test/lint/build del Security Agent.

Per preservare i minuti Actions, i checkpoint devono essere validati prima localmente con suite security completa, syntax check, build client e `git diff --check`; i push vanno raggruppati e GitHub CI va usata solo come validazione finale di batch già verdi. Il workflow ECI schedulato resta invariato perché modificarne la frequenza o disabilitarlo cambierebbe un processo operativo reale e richiede una decisione separata.

Nota: non esiste attualmente uno script lint nel package del progetto; CP-044 usa syntax check + test + build senza introdurre un nuovo toolchain di lint.
