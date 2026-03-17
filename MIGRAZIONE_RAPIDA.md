# 🚀 Guida Rapida Migrazione Axiom

## ✅ Pronto per la Migrazione

Tutto è configurato e pronto. Ecco come procedere:

## 📊 Opzione 1: Via Script Locale (Consigliato)

### 1. Configura il token admin nel `.env`:

```env
ADMIN_TOKEN=tuo-token-jwt-admin
RENDER_BACKEND_URL=https://demos-backend.onrender.com
```

### 2. Verifica statistiche:

```bash
node scripts/start-axiom-migration.js --dry-run
```

### 3. Avvia migrazione:

```bash
node scripts/start-axiom-migration.js --confirm
```

## 📊 Opzione 2: Via API Diretta (cURL)

### 1. Verifica statistiche:

```bash
curl -X GET https://demos-backend.onrender.com/api/admin/axiom-migration/status \
  -H "Authorization: Bearer TUO_TOKEN_ADMIN" \
  -H "Content-Type: application/json"
```

### 2. Avvia migrazione:

```bash
curl -X POST https://demos-backend.onrender.com/api/admin/axiom-migration/migrate \
  -H "Authorization: Bearer TUO_TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "tables": ["centralized_logs", "audit_logs"],
    "dryRun": false
  }'
```

## 📊 Opzione 3: Via Render Shell

1. Vai su Render Dashboard → demos-backend → Shell
2. Esegui:

```bash
# Verifica statistiche
node scripts/migrate-neon-to-axiom.js dry-run

# Avvia migrazione
node scripts/migrate-neon-to-axiom.js migrate
```

## 📋 Cosa Succede

1. **Legge dati da Neon** in batch da 1000 record
2. **Converte** nel formato Axiom
3. **Invia ad Axiom**:
   - `centralized_logs` → dataset `centralized_logs`
   - `audit_logs` → dataset `real-time` (con tag `log_type: "audit"`)
4. **Mostra progresso** nei log su Render

## ⏱️ Tempo Stimato

- ~1000 record/secondo
- 100.000 record = ~2 minuti
- 1.000.000 record = ~20 minuti

## 🔍 Monitoraggio

1. Vai su Render Dashboard → demos-backend → Logs
2. Cerca messaggi:
   - `✅ Batch X: 1000 record inviati`
   - `✅ Migrazione completata`

## ✅ Verifica su Axiom

Dopo la migrazione, verifica su Axiom:
1. Vai su https://app.axiom.co/demos-institute-jrim/datasets
2. Seleziona `centralized_logs` o `real-time`
3. Clicca su "Query" e esegui: `['centralized_logs'] | count`

## 🆘 Problemi?

- **Errore autenticazione**: Verifica che il token admin sia corretto
- **Errore connessione**: Verifica che `RENDER_BACKEND_URL` sia corretto
- **Nessun dato su Axiom**: Attendi qualche minuto (Axiom ha un leggero delay)

