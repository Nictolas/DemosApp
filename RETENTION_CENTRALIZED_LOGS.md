# DEMOS — retention dei log centralizzati: documento storico superato

**Stato al 30 ottobre 2026: NON APPROVATO, NON CERTIFICATO.**

La versione precedente di questa pagina attribuiva impropriamente al GDPR un
«minimo legale» di sei mesi per tutti i log INFO, dichiarava conformi periodi
di 180/365/730 giorni e descriveva cancellazioni automatiche come gia' operative.
Quelle affermazioni **non erano dimostrate** e non devono essere usate per
configurare Axiom, Backblaze B2, Render, Supabase o processi di cancellazione.

## Cosa sappiamo e cosa resta da verificare

- Le durate **INFO 180 giorni, WARN 365, ERROR 730, DEBUG 30, TRACE 7**
  erano valori riportati in configurazioni/documenti storici, **non una policy
  giuridica approvata** e non la prova che un job li applichi oggi.
- L'obbligo specifico di almeno sei mesi per i log di accesso degli
  **amministratori di sistema**, quando applicabile, non e' un obbligo
  generalizzato per ogni log INFO, HTTP, voto o opinione.
- Il controllo tecnico del 23–24 ottobre ha verificato differenze fra
  configurazioni storiche e retention effettive non conoscibili dai soli
  metadati dei provider. Le impostazioni reali di ogni dataset Axiom e
  del lifecycle di ogni prefisso B2 richiedono una verifica separata.
- La presenza di un archivio B2 e di codice di cleanup non prova che
  i record siano anonimizzati, cancellati alla scadenza o privi di
  informazioni personali. I log precedenti alle correzioni del
  30 ottobre potrebbero contenere identificativi e richiedono un
  esame riservato della loro conservazione, senza copiarne i payload.
- Il riferimento storico a «Database Neon» non descrive
  l'infrastruttura attuale di DEMOS, che utilizza Supabase PostgreSQL.

## Fonti operative da usare al posto della vecchia tabella

1. [Verifica provider e governance del 23–24 ottobre](docs/operations/LOG_RETENTION_PROVIDER_REVIEW_2026-10-23.md).
2. [Regole di minimizzazione e periodi ancora da approvare](GDPR_RETENTION_LOGS.md).
3. [Piano operativo logging](docs/operations/LOGGING_COST_GDPR_ACTIONS_2026-10-21.md).
4. [Progetto archivio Axiom–B2](docs/operations/axiom-b2-log-archive.md).

## Gate prima di qualunque modifica di retention

Definire per ciascuna categoria finalita', base giuridica, contenuto ammesso,
responsabile, luogo di conservazione, durata proposta, copie e ripristini.
Verificare le impostazioni **effettive** dei provider, le dipendenze tecniche
e l'eventuale applicabilita' del provvedimento sugli amministratori di sistema.
Richiedere le decisioni del titolare e la valutazione del DPO prima di
approvare le policy. Solo dopo, pianificare test non distruttivi e rollback.

**Questo documento non autorizza alcuna cancellazione, modifica di lifecycle
o incremento della raccolta di log.** Le correzioni al codice di logging
non equivalgono a bonifica dei log storici o a conformita' GDPR attestata.
