# 🚀 Guida Migrazione Dati da Neon a Axiom

## 📋 Panoramica

Questa guida spiega come migrare i dati storici dalle tabelle `centralized_logs` e `audit_logs` da Neon (PostgreSQL) ad Axiom.

## ✅ Prerequisiti

1. **Dataset Axiom creati:**
   - `centralized_logs` - per i log applicativi
   - `real-time` - per audit logs, performance metrics e security events

2. **Token Axiom configurato** con permessi di ingest

3. **Variabili ambiente configurate su Render:**
   ```
   AXIOM_ENABLED=true
   AXIOM_API_TOKEN=xaat-...
   AXIOM_ORG_ID=demos-institute-jrim
   AXIOM_DATASET=centralized_logs
   AXIOM_REALTIME_DATASET=real-time
   AXIOM_REGION=eu
   ```

## 🧪 Test Locale (Opzionale)

Prima di migrare su Render, puoi testare la connessione localmente:

```bash
# Test connessione Axiom
node scripts/test-axiom-connection.js

# Dry-run (vedi quanti record ci sono senza migrare)
node scripts/migrate-neon-to-axiom.js dry-run
```

## 🎯 Metodo Consigliato: Endpoint API su Render

### 1. Verifica Statistiche

Prima di migrare, verifica quanti record ci sono:

```bash
curl -X GET https://tuo-backend.onrender.com/api/admin/axiom-migration/status \
  -H "Authorization: Bearer <REDACTED_TOKEN>"
```

**Risposta esempio:**
```json
{
  "success": true,
  "stats": {
    "centralized_logs": {
      "total": 150000,
      "table": "centralized_logs",
      "destination": "centralized_logs"
    },
    "audit_logs": {
      "total": 50000,
      "table": "audit_logs_compressed",
      "destination": "real-time"
    }
  },
  "axiomConfig": {
    "enabled": true,
    "hasToken": true,
    "hasOrgId": true,
    "dataset": "centralized_logs",
    "realtimeDataset": "real-time"
  }
}
```

### 2. Avvia Migrazione

```bash
curl -X POST https://tuo-backend.onrender.com/api/admin/axiom-migration/migrate \
  -H "Authorization: Bearer <REDACTED_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tables": ["centralized_logs", "audit_logs"],
    "dryRun": false
  }'
```

**Opzioni:**
- `tables`: Array di tabelle da migrare (`["centralized_logs"]`, `["audit_logs"]`, o entrambe)
- `dryRun`: `true` per solo conteggio, `false` per migrazione reale

**Risposta:**
```json
{
  "success": true,
  "message": "Migrazione avviata in background",
  "tables": ["centralized_logs", "audit_logs"],
  "dryRun": false
}
```

### 3. Monitora Progresso

La migrazione viene eseguita in background. Monitora i log su Render:

1. Vai su Render Dashboard
2. Seleziona il tuo servizio backend
3. Clicca su "Logs"
4. Cerca messaggi come:
   - `✅ Batch X: 1000 record inviati`
   - `✅ Migrazione centralized_logs completata`

## 🔄 Metodo Alternativo: Script Diretto

Se preferisci eseguire lo script direttamente su Render:

1. Vai su Render Dashboard → Il tuo servizio → "Shell"
2. Esegui:

```bash
# Dry-run
node scripts/migrate-neon-to-axiom.js dry-run

# Migrazione completa
node scripts/migrate-neon-to-axiom.js migrate

# Migrazione solo centralized_logs
node scripts/migrate-neon-to-axiom.js migrate --tables=centralized_logs

# Migrazione solo audit_logs
node scripts/migrate-neon-to-axiom.js migrate --tables=audit_logs
```

## 📊 Cosa Succede Durante la Migrazione

1. **Lettura batch**: Legge 1000 record alla volta da Neon
2. **Conversione**: Converte nel formato Axiom con:
   - `_time`: Timestamp ISO
   - `log_type`: Tipo di log (application, audit, performance, security)
   - Campi originali preservati
3. **Anonimizzazione**: Se `AXIOM_ANONYMIZE=true`, applica:
   - IP address: ultimo ottetto a `.0`
   - User ID: hash SHA256 (se `AXIOM_ANONYMIZE_USER_ID=true`)
4. **Invio ad Axiom**: Invia batch per batch con pausa di 1 secondo tra batch
5. **Progresso**: Mostra progresso in tempo reale

## 🗂️ Mapping Dataset

| Tabella Neon | Dataset Axiom | Tag `log_type` |
|-------------|--------------|----------------|
| `centralized_logs` | `centralized_logs` | `application` |
| `audit_logs` | `real-time` | `audit` |
| `performance_metrics` | `real-time` | `performance` |
| `security_events` | `real-time` | `security` |

## ⚠️ Note Importanti

1. **Non blocca l'applicazione**: La migrazione viene eseguita in background
2. **Dati duplicati**: I dati rimangono su Neon dopo la migrazione (non vengono eliminati)
3. **Rate limiting**: Pausa di 1 secondo tra batch per evitare rate limiting di Axiom
4. **Tempo stimato**: 
   - ~1000 record/secondo
   - 100.000 record = ~2 minuti
   - 1.000.000 record = ~20 minuti

## 🔍 Verifica Migrazione

Dopo la migrazione, verifica su Axiom:

1. Vai su https://app.axiom.co/demos-institute-jrim/datasets
2. Seleziona il dataset (`centralized_logs` o `real-time`)
3. Clicca su "Query" e esegui:
   ```apl
   ['centralized_logs'] | count
   ```
4. Confronta con il numero di record su Neon

## 🐛 Troubleshooting

### Errore: "Axiom non configurato"
- Verifica che `AXIOM_ENABLED=true` su Render
- Verifica che `AXIOM_API_TOKEN` e `AXIOM_ORG_ID` siano configurati

### Errore: "DATABASE_URL non configurato"
- Verifica che `DATABASE_URL` sia configurato su Render
- Il valore non deve essere un placeholder

### Migrazione lenta
- Normale per grandi volumi di dati
- Monitora i log per vedere il progresso
- La migrazione può richiedere ore per milioni di record

### Dati non visibili su Axiom
- Attendi qualche minuto (Axiom ha un leggero delay)
- Verifica che il dataset sia corretto
- Controlla i log per errori di ingest

## 📞 Supporto

Se hai problemi:
1. Controlla i log su Render
2. Verifica la configurazione Axiom
3. Esegui `node scripts/test-axiom-connection.js` per testare la connessione

