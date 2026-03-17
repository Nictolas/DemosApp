# Architettura Sincronizzazione Referendum Abrogativi

## Riepilogo

Il sistema di sincronizzazione dei referendum abrogativi è stato migliorato per garantire **dati sempre freschi** direttamente dalle API pubbliche del Ministero della Giustizia, evitando la necessità di caricare manualmente i dati.

## Architettura

### 1. Sincronizzazione Automatica

Il sistema utilizza un **job automatico** che si connette alle API pubbliche del Ministero della Giustizia:

- **URL API**: `https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public`
- **Sincronizzazione completa**: ogni **1 ora** (configurabile via `MINISTERO_SYNC_INTERVAL_MS`)
- **Sincronizzazione referendum in corso**: ogni **30 minuti** (configurabile via `MINISTERO_SYNC_IN_CORSO_INTERVAL_MS`)

### 2. Sincronizzazione Differenziata

Il sistema implementa una **sincronizzazione intelligente**:

- **Sincronizzazione completa**: aggiorna tutti i referendum/iniziative (in corso e concluse) ogni ora
- **Sincronizzazione rapida**: aggiorna solo i referendum "in corso" ogni 30 minuti per avere dati più freschi durante le votazioni attive

Questo approccio ottimizza:
- ✅ **Performance**: la sync rapida è più veloce (aggiorna solo i referendum attivi)
- ✅ **Dati freschi**: i referendum in votazione vengono aggiornati più frequentemente
- ✅ **Efficienza**: riduce il carico sul database e sulle API

### 3. Gestione Errori e Retry

Il sistema include un **meccanismo di retry automatico**:

- **Tentativi massimi**: 3 (configurabile via `MINISTERO_SYNC_MAX_RETRIES`)
- **Delay tra tentativi**: 1 minuto (configurabile via `MINISTERO_SYNC_RETRY_DELAY_MS`)
- **Logging dettagliato**: tutti gli errori vengono registrati per il debugging

### 4. Struttura Dati

I dati vengono salvati nella tabella `iniziative_ministero` con i seguenti campi principali:

- `id`: ID univoco generato
- `id_ministero`: ID dall'API del Ministero (chiave univoca)
- `titolo`: Titolo del referendum/iniziativa
- `descrizione`: Descrizione completa
- `tipo`: Tipo (es. "Referendum abrogativo")
- `stato`: Stato corrente (es. "in_corso", "conclusa")
- `firme_raccolte`: Numero di firme raccolte
- `quorum_raggiunto`: Boolean che indica se il quorum è stato raggiunto
- `data_inizio`: Data di inizio raccolta firme
- `data_fine`: Data di fine raccolta firme
- `sito_web`: URL del sito ufficiale
- `data_ultimo_aggiornamento`: Timestamp dell'ultimo aggiornamento
- `dati_raw`: JSONB con tutti i dati originali dall'API

## Endpoint API

### GET `/api/referendum-abrogativi`

Recupera i referendum abrogativi dal database (dati sincronizzati).

**Query parameters:**
- `vota=true`: Mostra solo i referendum con quorum raggiunto e non in corso (per la pagina di voto)

**Risposta:**
```json
{
  "success": true,
  "referendum": [...],
  "classifica": [...],
  "mieiVoti": [...]
}
```

### POST `/api/ministero/sync`

Forza una sincronizzazione manuale immediata.

**Risposta:**
```json
{
  "success": true,
  "message": "Sincronizzazione completata",
  "results": {
    "created": 0,
    "updated": 5,
    "errors": 0,
    "skipped": 0
  }
}
```

### GET `/api/ministero/sync/status`

Verifica lo stato della sincronizzazione automatica.

**Risposta:**
```json
{
  "success": true,
  "job": {
    "isRunning": false,
    "lastSyncTime": "2025-01-XX...",
    "lastSyncStatus": "success",
    "intervalMinutes": 60,
    "intervalInCorsoMinutes": 30,
    "prossimaSync": "2025-01-XX..."
  },
  "database": {
    "totaleIniziative": 50,
    "referendum": 10,
    "referendumInCorso": 3,
    "ultimoAggiornamento": "2025-01-XX..."
  }
}
```

## Configurazione

### Variabili d'Ambiente

Puoi configurare il comportamento della sincronizzazione tramite variabili d'ambiente:

```env
# Intervallo sincronizzazione completa (default: 1 ora = 3600000 ms)
MINISTERO_SYNC_INTERVAL_MS=3600000

# Intervallo sincronizzazione referendum in corso (default: 30 minuti = 1800000 ms)
MINISTERO_SYNC_IN_CORSO_INTERVAL_MS=1800000

# Numero massimo di tentativi in caso di errore (default: 3)
MINISTERO_SYNC_MAX_RETRIES=3

# Delay tra tentativi in millisecondi (default: 60000 = 1 minuto)
MINISTERO_SYNC_RETRY_DELAY_MS=60000

# Abilita/disabilita la sincronizzazione automatica (default: true)
ENABLE_MINISTERO_SYNC=true
```

### Esempi di Configurazione

**Sincronizzazione molto frequente (per test o sviluppo):**
```env
MINISTERO_SYNC_INTERVAL_MS=300000        # 5 minuti
MINISTERO_SYNC_IN_CORSO_INTERVAL_MS=60000 # 1 minuto
```

**Sincronizzazione standard (produzione):**
```env
MINISTERO_SYNC_INTERVAL_MS=3600000        # 1 ora (default)
MINISTERO_SYNC_IN_CORSO_INTERVAL_MS=1800000 # 30 minuti (default)
```

**Sincronizzazione meno frequente (per ridurre carico):**
```env
MINISTERO_SYNC_INTERVAL_MS=21600000       # 6 ore
MINISTERO_SYNC_IN_CORSO_INTERVAL_MS=3600000 # 1 ora
```

## Vantaggi dell'Architettura

1. ✅ **Dati sempre aggiornati**: sincronizzazione automatica ogni ora (o più frequentemente)
2. ✅ **Nessun intervento manuale**: i dati si aggiornano automaticamente
3. ✅ **Performance ottimizzate**: sincronizzazione differenziata per referendum attivi
4. ✅ **Affidabilità**: retry automatico in caso di errori temporanei
5. ✅ **Monitoraggio**: endpoint per verificare lo stato della sincronizzazione
6. ✅ **Flessibilità**: configurabile tramite variabili d'ambiente

## File Modificati

- `api/jobs/ministeroSyncJob.js`: Job di sincronizzazione migliorato
- `api/routes/ministero.js`: Endpoint per stato sincronizzazione
- `api/services/ministeroSync.js`: Servizio di sincronizzazione (già esistente)

## Prossimi Passi

1. ✅ Sincronizzazione automatica implementata
2. ✅ Retry automatico implementato
3. ✅ Sincronizzazione differenziata implementata
4. ✅ Endpoint di stato implementato
5. 🔄 Testare la sincronizzazione in produzione
6. 🔄 Monitorare i log per verificare il corretto funzionamento

## Note

- La sincronizzazione parte automaticamente all'avvio del server
- I dati vengono salvati nella tabella `iniziative_ministero`
- L'endpoint `/api/referendum-abrogativi` legge sempre dal database (dati sincronizzati)
- Per forzare una sincronizzazione immediata, usa `POST /api/ministero/sync`
- Per verificare lo stato, usa `GET /api/ministero/sync/status`

