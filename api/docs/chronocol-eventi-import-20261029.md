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
L'importatore richiede VERIFICATA=true e non impone ANNULLATA=false
lato Strapi, poiché alcuni eventi validi hanno ANNULLATA=null.
In DEMOS vengono comunque eliminati i record con ANNULLATA=true.
Il 29/10/2026 è stato verificato il corteo di Pisa del 30/10:
VERIFICATA=true, ANNULLATA=null. Il vecchio filtro lo escludeva.
Non sono ammesse manifestazioni non verificate o esplicitamente annullate. I nomi delle schede sono derivati dai soli dati fattuali;
la descrizione integrale rimane sul sito originale.

- Paginazione: 100 record, al massimo 30 pagine e 3000 eventi.
- Timeout 8 secondi per pagina, massimo 2 MiB ciascuna, redirect bloccati.
- Source e URL sono fissi per evitare SSRF.
- Cache in memoria per istanza Render: aggiornamento ogni 12 ore; retry
  dopo 30 minuti in caso di errore; snapshot fino a 24 ore.
- Niente nuove tabelle, migrazioni o scritture PostgreSQL/Supabase.

## Integrazione nella pagina Eventi esistente

- Tab Personali: eventi dei soggetti seguiti e mobilitazioni dell'intera
  provincia di residenza, rispettando le priorità.
- Tab Regionali: eventi DEMOS approvati e mobilitazioni della regione.
- Tab Globali: tutti gli eventi pubblici approvati e mobilitazioni nazionali.
- Ogni evento esterno è di sola lettura. L'accredito a Chrono è riportato
  una volta a fondo elenco, anziché ripetuto su ciascuna scheda.
- Gli eventi esterni conclusi sono rimossi dalla risposta in base all'ora
  finale nel fuso Europe/Rome; nessuna cancellazione dei dati DEMOS.
- Deduplica conservativa per nome, data e comune.
- Il middleware autenticazione può mantenere proprie letture DB, separate
  dal catalogo eventi esterno.

## Attivazione dopo il merge

Impostazione backend Render: CHRONOCOL_IMPORT_ENABLED=true

L'API sorgente è già fissata nel codice e non richiede alcuna password.
Dopo il rilascio verificare Eventi > Personali, Regionali e Globali su dispositivi diversi,
date, link, assenza di dati non verificati e consumi effettivi.
Per disattivare: CHRONOCOL_IMPORT_ENABLED=false.

## Test

- Test di import/paginazione e feed nativo: api/tests/chronocolEventFeedService.test.js e api/tests/eventFeedService.test.js
- Workflow: .github/workflows/chronocol-eventi.yml
