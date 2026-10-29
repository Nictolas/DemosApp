# DEMOS — Mobilitazioni Chrono Collective nella pagina Eventi

## Fonte verificata il 29 ottobre 2026

- Sito: https://mobilitazioni.chronocol.com/
- API REST effettivamente raggiungibile: https://mobilitazioni.chronocol.com/api/w-mobs (risposta Strapi JSON).
- Il sito Statistiche e dati aperti dichiara per il CSV: «Liberi da usare citando Chrono». Non è stata verificata una licenza standard nominata, quindi importiamo solo informazioni fattuali con attribuzione, senza testi completi, recapiti e altre informazioni personali.
- La prima verifica ha restituito 400 record totali e, dopo i filtri, 73 verificati non annullati, 63 in corso o futuri.
- Test live senza scritture e build: https://github.com/Nictolas/DemosApp/actions/runs/40904151526

## Minimizzazione e sicurezza

La richiesta seleziona esclusivamente i campi TIPO, CITTA, DATA_ORARIO,
DATA_FINE, FINE_EFFETTIVA, INDIRIZZO, RITROVO_LUOGO, VERIFICATA,
ANNULLATA, LATITUDE, LONGITUDE, SCIOPERO e PIATTAFORMA.

NON vengono richiesti i campi CONTATTI, DESCRIZIONE, ACCESSIBILITA e MEZZI.
L'importatore richiede VERIFICATA=true e ANNULLATA=false e ricontrolla
entrambi lato DEMOS. I nomi delle schede sono derivati dai soli dati fattuali;
la descrizione integrale rimane sul sito originale.

- Paginazione: 100 record, al massimo 30 pagine e 3000 eventi.
- Timeout 8 secondi per pagina, massimo 2 MiB ciascuna, redirect bloccati.
- Source e URL sono fissi per evitare SSRF.
- Cache in memoria per istanza Render: aggiornamento ogni 12 ore; retry
  dopo 30 minuti in caso di errore; snapshot fino a 24 ore.
- Niente nuove tabelle, migrazioni o scritture PostgreSQL/Supabase.

## Integrazione nella pagina Eventi esistente

- Tab Personali: feed nativo e mobilitazioni nella città dell'utente,
  rispettando le priorità correnti.
- Tab Mobilitazioni: tutti gli eventi esterni non scaduti; non interroga
  la tabella degli eventi nel database.
- Tab Globale Admin: resta disponibile e comprende anche eventi importati.
- Ogni scheda esterna è di sola lettura, ha la fonte dichiarata e link
  diretto alla scheda originale.
- Gli eventi esterni conclusi sono rimossi dalla risposta in base all'ora
  finale nel fuso Europe/Rome; nessuna cancellazione dei dati DEMOS.
- Deduplica conservativa per nome, data e comune.
- Il middleware autenticazione può mantenere proprie letture DB, separate
  dal catalogo eventi esterno.

## Attivazione dopo il merge

Impostazione backend Render: CHRONOCOL_IMPORT_ENABLED=true

L'API sorgente è già fissata nel codice e non richiede alcuna password.
Dopo il rilascio verificare Eventi > Mobilitazioni su dispositivi diversi,
date, link, assenza di dati non verificati e consumi effettivi.
Per disattivare: CHRONOCOL_IMPORT_ENABLED=false.

## Test

- Test di import/paginazione e feed nativo: api/tests/chronocolEventFeedService.test.js e api/tests/eventFeedService.test.js
- Workflow: .github/workflows/chronocol-eventi.yml
