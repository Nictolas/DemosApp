# Voti Parlamento - Documentazione Completa

## 📋 Panoramica

Sistema completo per visualizzare le ultime votazioni del Parlamento (Camera e Senato) recuperate dagli endpoint SPARQL ufficiali.

## 🔌 Endpoint API

### GET `/api/voti-politici/ultime?limit=3`

Restituisce le ultime N votazioni in ordine cronologico (più recente prima).

**Parametri Query:**
- `limit` (opzionale): Numero di votazioni da restituire (default: 3, max: 100)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response di Successo:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "uri": "http://dati.camera.it/ocd/votazione.rdf/vs19_590_001",
      "votazione_id": "vs19_590_001",
      "legislatura": 19,
      "data_votazione": "2024-01-15",
      "descrizione": "Votazione finale",
      "descrizione_completa": "Descrizione completa...",
      "esito": "Approvato",
      "sigla_atto": null,
      "numero_atto": null,
      "tipo_atto": null,
      "camera": "Camera",
      "spiegazione": "Spiegazione AI...",
      "url_votazione": null,
      "numero_seduta": null,
      "metadati": {
        "label": "Votazione finale",
        "approvato": "1",
        "seduta": "http://dati.camera.it/ocd/seduta.rdf/s19_590"
      },
      "seduta": "http://dati.camera.it/ocd/seduta.rdf/s19_590",
      "data_sincronizzazione": "2024-01-15T10:30:00Z",
      "data_aggiornamento": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 3
}
```

**Response Vuota:**
```json
{
  "success": true,
  "data": [],
  "count": 0,
  "message": "Nessuna votazione trovata nel database. Esegui la sincronizzazione da SPARQL."
}
```

**Response Errore:**
```json
{
  "success": false,
  "error": "Errore nel recupero dei dati",
  "message": "Dettagli errore..."
}
```

## 🗄️ Database

### Tabelle Utilizzate

1. **`voti_politici`** - Votazioni da SPARQL (Camera e Senato)
   - Colonne: `id`, `uri`, `votazione_id`, `legislatura`, `data_votazione`, `descrizione`, `esito`, `camera`, `metadati`, etc.

2. **`votazioni_parlamento`** - Votazioni da Openpolis (con spiegazioni AI)
   - Colonne: `id`, `titolo_votazione`, `descrizione_votazione`, `spiegazione`, `camera`, `data_votazione`, etc.

### Query SQL

L'endpoint esegue una query che:
- Combina dati da `voti_politici` e `votazioni_parlamento`
- Ordina per data (più recente prima)
- Priorità: `data_votazione` > `data_sincronizzazione` > `data_aggiornamento`
- Filtra votazioni con descrizione valida

## 🚀 Sincronizzazione Dati

### Sincronizzazione Manuale

```bash
POST /api/voti-politici/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "limit": 100,
  "camera": "both"  // "Camera", "Senato", o "both"
}
```

### Sincronizzazione Automatica

Per una sincronizzazione giornaliera automatica, crea un job schedulato (cron) che chiama l'endpoint `/sync`.

## 📱 Frontend

### File Dart

Il file `voti-parlamento-page.dart` contiene:
- Widget completo per visualizzare le ultime 3 votazioni
- Gestione stati (loading, error, success)
- Design responsive con card per ogni votazione
- Badge "PIÙ RECENTE" per la prima votazione
- Pulsante refresh

### Integrazione

1. Copia `voti-parlamento-page.dart` in `lib/pages/`
2. Aggiungi route: `'/voti-parlamento': (context) => VotiParlamentoPage()`
3. Aggiungi pulsante in `/gestisci`:
   ```dart
   ElevatedButton.icon(
     onPressed: () => Navigator.pushNamed(context, '/voti-parlamento'),
     icon: Icon(Icons.how_to_vote),
     label: Text('Voti Parlamento'),
   )
   ```

## 🧪 Test

### Test Endpoint

Esegui lo script di test:
```bash
node test-endpoint-ultime-votazioni.js
```

Oppure testa manualmente:
```bash
curl -X GET "https://api.demos.community/api/voti-politici/ultime?limit=3" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## 📊 Struttura Dati

### Campi Principali

- **`id`**: ID univoco nel database
- **`uri`**: URI completo della votazione (SPARQL)
- **`votazione_id`**: ID estratto dall'URI
- **`legislatura`**: Numero legislatura (es. 19)
- **`data_votazione`**: Data della votazione (YYYY-MM-DD)
- **`descrizione`**: Titolo/descrizione breve
- **`descrizione_completa`**: Descrizione estesa (se disponibile)
- **`esito`**: "Approvato" o "Non Approvato"
- **`camera`**: "Camera" o "Senato"
- **`spiegazione`**: Spiegazione AI generata (se disponibile)
- **`metadati`**: JSONB con tutti i metadati SPARQL

## ⚙️ Configurazione

### Variabili d'Ambiente

Nessuna variabile aggiuntiva richiesta. Usa le stesse del progetto:
- `DATABASE_URL` - Connessione Neon
- `NODE_ENV` - Ambiente (production/development)

### Rate Limiting

L'endpoint usa `userLimiter` (vedi `app.js`):
- Limite per utente autenticato
- Protezione contro abusi

## 🔄 Flusso Dati

1. **Sincronizzazione SPARQL** → Dati salvati in `voti_politici`
2. **Scraping Openpolis** → Dati salvati in `votazioni_parlamento`
3. **Query Endpoint** → Combina entrambe le tabelle
4. **Frontend** → Mostra le ultime 3 votazioni

## 📝 Note

- Le votazioni sono ordinate per data (più recente prima)
- Se non ci sono votazioni, l'endpoint restituisce array vuoto
- La prima votazione nella lista è sempre la più recente
- Il limite massimo è 100 votazioni per richiesta
- L'endpoint richiede autenticazione (token Bearer)

## 🐛 Troubleshooting

### Nessuna votazione restituita

1. Verifica che la tabella `voti_politici` contenga dati
2. Esegui sincronizzazione: `POST /api/voti-politici/sync`
3. Verifica che le votazioni abbiano `descrizione` non NULL

### Errori 500

1. Verifica connessione database
2. Controlla log del server
3. Verifica che le tabelle esistano

### Dati non aggiornati

1. Esegui sincronizzazione manuale
2. Verifica che i job automatici siano attivi
3. Controlla `data_sincronizzazione` nelle votazioni
