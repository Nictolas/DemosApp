# 🧹 Istruzioni per Ricreazione Dataset Real-Time

## ⚠️ Problema Identificato

Il token Axiom non ha i permessi per cancellare/creare dataset (403 Forbidden).

## 📝 Procedura Manuale

### Opzione 1: Ricreazione Manuale (Consigliato)

1. **Cancella il dataset su Axiom Dashboard:**
   - Vai su https://app.axiom.co
   - Seleziona il dataset `real-time`
   - Clicca "Delete Dataset" o "Settings" → "Delete"
   - Conferma la cancellazione

2. **Ricrea il dataset:**
   - Clicca "Create Dataset"
   - Nome: `real-time`
   - Descrizione: "Real-time logs GDPR-compliant (audit + security only)"

3. **Esegui lo script per pulire e re-ingestare i record:**
   ```bash
   node scripts/recreate-realtime-gdpr.js
   ```
   
   Lo script:
   - Estrae tutti i record esistenti
   - Li pulisce rimuovendo campi non GDPR-obbligatori
   - Li re-ingesta nel nuovo dataset

### Opzione 2: Aggiorna Permessi Token

Se vuoi che lo script faccia tutto automaticamente:

1. Vai su Axiom Dashboard → Settings → API Tokens
2. Modifica il token usato dall'applicazione
3. Abilita i permessi:
   - ✅ **Datasets** → WRITE (per creare/cancellare dataset)
   - ✅ **Data** → WRITE (per ingest)
   - ✅ **Query** → READ (per leggere record)

4. Aggiorna il token nelle variabili d'ambiente su Render

5. Esegui di nuovo lo script:
   ```bash
   node scripts/recreate-realtime-gdpr.js
   ```

---

## ✅ Verifica Post-Ricreazione

Dopo la ricreazione, verifica:

1. **Campi nel dataset:**
   - Vai su Axiom Dashboard → Dataset `real-time` → Fields
   - Dovresti vedere solo:
     - Audit logs: `_time`, `user_id`, `ip_address`, `action`, `resource`, `resource_id`, `success`, `error_message`, `session_id`
     - Security events: `_time`, `user_id`, `ip_address`, `type`, `severity`, `details` (solo `message`), `session_id`

2. **Nessun campo non GDPR:**
   - ❌ `details.endpoint` - NON dovrebbe essere presente
   - ❌ `details.url` - NON dovrebbe essere presente
   - ❌ `details.method` - NON dovrebbe essere presente
   - ❌ `log_type` - NON dovrebbe essere presente
   - ❌ `user_agent` - NON dovrebbe essere presente
   - ❌ `user_email` - NON dovrebbe essere presente

3. **Verifica con script:**
   ```bash
   node scripts/check-realtime-fields.js
   ```

---

## 📊 Record Puliti Attesi

### Audit Log (esempio):
```json
{
  "_time": "2025-12-15T22:05:58.158Z",
  "user_id": "test-user-15ab3c52",
  "ip_address": "192.168.1.100",
  "action": "DATA_ACCESS",
  "resource": "users",
  "resource_id": "user-123",
  "success": true,
  "error_message": null,
  "session_id": "audit_cb1112095875539a"
}
```

### Security Event (esempio):
```json
{
  "_time": "2025-12-15T23:05:58.480Z",
  "user_id": "test-user-cea0040b",
  "ip_address": "192.168.1.200",
  "type": "UNAUTHORIZED_ACCESS",
  "severity": "high",
  "details": {
    "message": "Tentativo di accesso non autorizzato"
  },
  "session_id": "security_180b6d51b42265fa"
}
```

**NOTA**: `details.endpoint` NON dovrebbe essere presente!

---

## 🚀 Dopo la Ricreazione

Una volta ricreato il dataset, i nuovi log inviati dall'applicazione conterranno automaticamente solo campi GDPR-obbligatori grazie alle modifiche al codice già implementate.

