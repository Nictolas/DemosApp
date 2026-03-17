# Sincronizzazione SPARQL Camera e Senato

## ✅ Implementazione Completata

Il sistema ora supporta la sincronizzazione delle votazioni da **entrambi** gli endpoint SPARQL:
- **Camera dei Deputati**: `http://dati.camera.it/sparql`
- **Senato della Repubblica**: `https://dati.senato.it/sparql`

## 📋 Modifiche Effettuate

### 1. Database
- ✅ Aggiunta colonna `camera` alla tabella `voti_politici`
- ✅ Script SQL: `add-camera-column-voti-politici.sql`
- ✅ Constraint CHECK: `camera IN ('Camera', 'Senato')`
- ✅ Indice per performance: `idx_voti_politici_camera`

### 2. Codice (`routes/voti-politici.js`)
- ✅ `ensureTableExists()`: Aggiunge automaticamente colonna `camera` se non esiste
- ✅ `fetchFromSparql(camera, limit)`: Supporta Camera e Senato
- ✅ `processAndSaveVotazioni()`: Include la colonna `camera` nei dati
- ✅ `saveVotazioniToDatabase()`: Salva la colonna `camera`
- ✅ Endpoint GET: Filtro opzionale `?camera=Camera` o `?camera=Senato`
- ✅ Endpoint POST `/sync`: Sincronizza Camera, Senato o entrambi

## 🚀 Come Usare

### 1. Eseguire la Migrazione Database

Prima di tutto, esegui lo script SQL per aggiungere la colonna `camera`:

```sql
-- Esegui nel Neon Console
-- File: add-camera-column-voti-politici.sql
```

Oppure la tabella verrà aggiornata automaticamente al primo accesso (grazie a `ensureTableExists()`).

### 2. Recuperare Votazioni (GET)

#### Tutte le votazioni (Camera e Senato)
```bash
GET /api/voti-politici
Authorization: Bearer <token>
```

#### Solo Camera
```bash
GET /api/voti-politici?camera=Camera
Authorization: Bearer <token>
```

#### Solo Senato
```bash
GET /api/voti-politici?camera=Senato
Authorization: Bearer <token>
```

### 3. Sincronizzare Dati (POST)

#### Sincronizza Camera e Senato
```bash
POST /api/voti-politici/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "limit": 100,
  "camera": "both"
}
```

#### Sincronizza solo Camera
```bash
POST /api/voti-politici/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "limit": 100,
  "camera": "Camera"
}
```

#### Sincronizza solo Senato
```bash
POST /api/voti-politici/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "limit": 100,
  "camera": "Senato"
}
```

## 📊 Struttura Dati

Ogni votazione salvata include:
- `uri`: URI completo della votazione
- `votazione_id`: ID estratto dall'URI
- `legislatura`: Numero legislatura (es. 19)
- `data_votazione`: Data della votazione
- `descrizione`: Descrizione/testo della votazione
- `esito`: Approvato/Non Approvato
- **`camera`**: **'Camera' o 'Senato'** (NUOVO)
- `metadati`: JSONB con tutti i metadati SPARQL

## ⚠️ Note Importanti

### Query SPARQL Senato
La query SPARQL per il Senato è una versione generica basata sulla struttura della Camera. Potrebbe essere necessario adattarla in base alla struttura reale dei dati del Senato:

- **Namespace**: Potrebbe essere diverso (`http://dati.senato.it/ocd/`)
- **Filtro legislatura**: Potrebbe usare un pattern diverso da "vs19"
- **Predicati**: Potrebbero avere nomi diversi

### Verifica Dati Senato
Prima di usare in produzione, verifica:
1. Che l'endpoint SPARQL del Senato funzioni correttamente
2. Che i namespace e predicati siano corretti
3. Che il filtro per la legislatura funzioni

## 🔄 Prossimi Passi

1. **Test Endpoint Senato**: Verificare che la query SPARQL funzioni correttamente
2. **Job Schedulato**: Creare un cron job per sincronizzazione giornaliera automatica
3. **Filtro "Leggi Approvate"**: Aggiungere logica per distinguere leggi da altri atti
4. **Frontend**: Aggiornare l'interfaccia per mostrare votazioni Camera e Senato

## 📝 Esempio Risposta

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "uri": "http://dati.camera.it/ocd/votazione.rdf/vs19_590_001",
      "votazione_id": "vs19_590_001",
      "legislatura": 19,
      "data_creazione": "2024-01-15",
      "descrizione": "Votazione finale",
      "esito": "Approvato",
      "camera": "Camera",
      "data": {
        "label": "Votazione finale",
        "approvato": "1",
        "seduta": "http://dati.camera.it/ocd/seduta.rdf/s19_590"
      }
    }
  ],
  "count": 1,
  "source": "database"
}
```
