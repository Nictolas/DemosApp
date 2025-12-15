# 🔄 Ricreare Dataset Centralized Logs per GDPR

## 🎯 Obiettivo

Ricreare il dataset `centralized_logs` su Axiom per garantire che tutti i 6 campi GDPR obbligatori siano riconosciuti correttamente.

## ⚠️ Problema Attuale

Il dataset attuale su Axiom mostra solo 5 campi:
- `_sysTime` (sistema Axiom)
- `_time`
- `endpoint`
- `ip_address`
- `message`

**Mancano:**
- `user_id` ❌
- `session_id` ❌

Questo perché i log precedenti sono stati inviati prima delle modifiche GDPR.

## ✅ Soluzione

### Step 1: Testare l'Invio dei Campi

Prima di ricreare il dataset, testa che i nuovi log vengano inviati correttamente:

```bash
node scripts/test-axiom-gdpr-fields.js
```

Questo script invierà 2 log di test:
1. Un log con tutti i campi con valori
2. Un log con tutti i campi con valori `null`

**Verifica su Axiom:**
- Vai su Axiom Dashboard → Stream → `centralized_logs`
- Cerca i log con `message` contenente "TEST: Verifica campi GDPR"
- Verifica che entrambi abbiano tutti e 6 i campi

### Step 2: Ricreare il Dataset

1. **Vai su Axiom Dashboard**
   - URL: https://app.axiom.co/demos-institute-jrim/datasets

2. **Cancella il dataset `centralized_logs`**
   - Clicca sul dataset `centralized_logs`
   - Vai su Settings (o menu a tre puntini)
   - Seleziona "Delete Dataset"
   - Conferma la cancellazione

3. **Ricrea il dataset `centralized_logs`**
   - Clicca su "Create Dataset"
   - Nome: `centralized_logs`
   - Descrizione: "Log GDPR-compliant con 6 campi obbligatori"
   - Clicca "Create"

### Step 3: Verificare il Deploy

Assicurati che il codice modificato sia deployato su Render:

1. **Verifica che le modifiche siano su Render:**
   - Controlla che `api/services/centralizedLogger.js` sia aggiornato
   - Verifica che il deploy sia completato

2. **Verifica le variabili d'ambiente su Render:**
   - `GDPR_LOGGING_FILTER=true` (opzionale, per filtrare)
   - `AXIOM_ENABLED=true`
   - `AXIOM_API_TOKEN=...`
   - `AXIOM_ORG_ID=...`
   - `AXIOM_DATASET=centralized_logs`

### Step 4: Verificare i Nuovi Log

Dopo il deploy e la ricreazione del dataset:

1. **Fai alcune richieste all'applicazione:**
   - Login
   - Accedi a `/api/users/profile`
   - Fai altre richieste che accedono a dati personali

2. **Verifica su Axiom:**
   - Vai su Axiom Dashboard → Stream → `centralized_logs`
   - Apri alcuni record recenti
   - Verifica che abbiano tutti e 6 i campi:
     - ✅ `_time`
     - ✅ `message`
     - ✅ `user_id` (anche se null)
     - ✅ `ip_address` (anche se null)
     - ✅ `endpoint` (anche se null)
     - ✅ `session_id` (anche se null)

3. **Verifica la lista Fields:**
   - Vai su Axiom Dashboard → Datasets → `centralized_logs`
   - Nella sezione "Fields" dovresti vedere tutti e 6 i campi:
     - `_time`
     - `message`
     - `user_id`
     - `ip_address`
     - `endpoint`
     - `session_id`

## 📋 Campi GDPR Obbligatori

Dopo la ricreazione, il dataset dovrebbe avere questi 6 campi:

| Campo | Tipo | GDPR | Esempio |
|-------|------|------|---------|
| `_time` | datetime | ✅ Obbligatorio | `"2025-12-15T22:30:00.000Z"` |
| `message` | string | ✅ Obbligatorio | `"GET /api/users/profile - 200"` |
| `user_id` | string/null | ✅ Obbligatorio | `"5e51ec52-..."` o `null` |
| `ip_address` | string/null | ✅ Obbligatorio | `"192.168.1.0"` o `null` |
| `endpoint` | string/null | ✅ Obbligatorio | `"/api/users/profile"` o `null` |
| `session_id` | string/null | ✅ Obbligatorio | `"sess_abc123"` o `null` |

## ⚠️ Nota Importante

- **I log vecchi verranno persi** quando cancelli il dataset
- Ma sono solo log di test/oggi, non dati storici importanti
- I nuovi log saranno GDPR-compliant fin dall'inizio

## 🔍 Troubleshooting

Se dopo la ricreazione i campi non compaiono:

1. **Verifica che il codice sia deployato:**
   ```bash
   # Controlla che centralizedLogger.js invii tutti i 6 campi
   ```

2. **Esegui lo script di test:**
   ```bash
   node scripts/test-axiom-gdpr-fields.js
   ```

3. **Verifica le variabili d'ambiente su Render**

4. **Controlla i log del server** per errori di invio ad Axiom

