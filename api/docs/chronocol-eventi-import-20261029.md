# DEMOS — importazione mobilitazioni Chrono Collective (staging)

## Stato e fonte

Integrazione predisposta **ma disattivata per impostazione predefinita**.
Sito: https://mobilitazioni.chronocol.com/

Non è stato verificato un endpoint machine-readable stabile né una licenza che autorizzi
la ripubblicazione integrale di eventi, descrizioni e altri contenuti. **Non abilitare
l'import in produzione** finché Chrono Collective non conferma formato,
licenza/permessi, attribuzione, aggiornamento e condizioni d'accesso.

Nessuna chiamata a un endpoint non verificato è effettuata con la configurazione
standard. I test usano soltanto un feed simulato.

## Comportamento

- API e navbar esistenti: `GET /api/eventi`, `GET /api/eventi/prossimo`.
- Evento originale nel DB PostgreSQL: non viene modificato, cancellato o duplicato
  da questo componente. Si mantiene il ranking personalizzato già esistente.
- Eventi esterni: cache **solo in memoria Render** per istanza; nessuna tabella,
  migrazione, INSERT o SELECT aggiuntiva su Supabase.
- Una richiesta al feed esterno ogni **12 ore per istanza**, non una per utente.
  Timeout 8 secondi, massimo 2 MiB/3000 eventi, nessun redirect,
  sorgente HTTPS limitata a mobilitazioni.chronocol.com.
- Se l'origine non risponde, ultimo snapshot per massimo 24 ore; altrimenti
  la parte esterna del feed è vuota senza interrompere la pagina Eventi.
- Gli eventi esterni scaduti sono **esclusi dalla risposta** dopo il termine:
  non vengono salvati nel DB e non occorre una DELETE. Gli eventi senza
  ora finale sono visibili fino alla fine del giorno finale.
- Vista personale: filtraggio per comune/provincia/regione sui dati utente
  già recuperati dal feed normale, nessuna nuova lettura profilo.
- Vista globale Admin: tutti gli eventi importati non scaduti.
- La pagina mostra **Fonte: Chrono Collective** con collegamento al sito;
  questi eventi sono in sola lettura anche per Admin.
- Deduplicazione conservativa su titolo, data e comune; senza coordinate
  e identificatori canonici incrociati, non è garantita la deduplicazione
  di eventi nominati in modo differente.

## Attivazione dopo verifica

Su backend Render, configurare **solo dopo autorizzazione**:

```env
CHRONOCOL_IMPORT_ENABLED=true
CHRONOCOL_EVENTS_JSON_URL=https://mobilitazioni.chronocol.com/PERCORSO_VERIFICATO.json
```

L'URL mostrato è un **segnaposto**, NON un endpoint esistente confermato.
L'importatore accetta JSON come array oppure oggetto con `events`, `items`,
`data` o `features` (GeoJSON). Ogni record deve avere titolo e data,
con campi testuali tipo `title`/`name`, `start_at`/`date`, `city`,
`region`, `link`; la mappatura va verificata **su un export reale**,
perché non abbiamo ancora lo schema ufficiale.

Se il sito offre CSV, RSS o GraphQL anziché JSON, occorre prima adattare
l'importatore e testare su un campione reale autorizzato. **Non puntare
l'importatore alla home page HTML.**

## Test

```bash
npm ci --prefix api
node --test api/tests/chronocolEventFeedService.test.js api/tests/eventFeedService.test.js
```

La CI `chronocol-eventi.yml` controlla anche la build del client.

## Impatto e limiti

Con importazione attiva, nessuna **nuova query PostgreSQL** viene effettuata
per l'import; restano le letture già presenti nell'endpoint personalizzato
`/api/eventi`. Il JSON finale contiene più eventi, quindi aumentano di poco
CPU e traffico API per utente. La cache è per istanza (quindi con più worker
si moltiplicano i fetch). Restart di Render svuota la cache; il primo utente
dopo un restart può attendere il fetch (max 8 s).

Non tracciare la partecipazione o i click a mobilitazioni: possono rivelare
preferenze politiche. Nessun profilo personale è trasmesso a Chrono.
