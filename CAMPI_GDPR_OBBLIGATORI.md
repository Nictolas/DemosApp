# 🔒 Campi GDPR Obbligatori - Centralized Logs

## ✅ Modifiche Completate

Il logger ora invia **SOLO** i campi obbligatori per GDPR su Axiom.

## 📋 Campi Inviati ad Axiom (GDPR Obbligatori)

### 1. **`_time`** ✅
- **Tipo**: ISO 8601 timestamp
- **GDPR**: Quando è successo (audit trail)
- **Esempio**: `"2025-12-13T18:00:00.000Z"`

### 2. **`message`** ✅
- **Tipo**: String
- **GDPR**: Cosa è successo (descrizione azione)
- **Esempio**: `"GET /api/users/profile - 200"`

### 3. **`user_id`** ✅
- **Tipo**: UUID o null
- **GDPR**: Chi ha fatto l'azione
- **Anonimizzazione**: Opzionale (se `AXIOM_ANONYMIZE_USER_ID=true`)
- **Esempio**: `"5e51ec52-c656-4f4b-a940-425acb873b0b"` o `null`

### 4. **`ip_address`** ✅
- **Tipo**: String o null
- **GDPR**: Da dove è arrivata la richiesta
- **Anonimizzazione**: Obbligatoria (solo rete, non host specifico)
- **Esempio**: `"192.168.1.0"` (anonimizzato) o `null`

### 5. **`endpoint`** ✅
- **Tipo**: String o null
- **GDPR**: Quale risorsa è stata acceduta
- **Esempio**: `"/api/users/profile"` o `null`

### 6. **`session_id`** ✅
- **Tipo**: String o null
- **GDPR**: Identifica la sessione utente
- **Esempio**: `"sess_abc123"` o `null`

## ❌ Campi Rimossi (Non Obbligatori per GDPR)

### Campi Tecnici Rimossi:
- ❌ **`level`** - Non obbligatorio (utile per debugging ma non GDPR-required)
- ❌ **`log_type`** - Non obbligatorio (categorizzazione non GDPR-required)
- ❌ **`user_agent`** - Non obbligatorio (utile per sicurezza ma non GDPR-required)
- ❌ **`request_id`** - Non obbligatorio (tracciamento tecnico non GDPR-required)
- ❌ **`pid`** - Non obbligatorio (Process ID tecnico)
- ❌ **`hostname`** - Non obbligatorio (hostname tecnico)

### Campi HTTP Rimossi:
- ❌ **`method`** - Già incluso nel `message`
- ❌ **`statusCode`** - Già incluso nel `message`
- ❌ **`responseTime`** - Non obbligatorio per GDPR
- ❌ **`url`** - Già coperto da `endpoint`

## 📊 Struttura Record Axiom

```json
{
  "_time": "2025-12-13T18:00:00.000Z",
  "message": "GET /api/users/profile - 200",
  "user_id": "5e51ec52-c656-4f4b-a940-425acb873b0b",
  "ip_address": "192.168.1.0",
  "endpoint": "/api/users/profile",
  "session_id": "sess_abc123"
}
```

## 🔒 Anonimizzazione

### IP Address
- **Automatica** se `AXIOM_ANONYMIZE=true`
- **Formato**: `192.168.1.0` (ultimo ottetto sempre `.0`)
- **GDPR**: Rispetta minimizzazione dati (solo rete, non host specifico)

### User ID
- **Opzionale** se `AXIOM_ANONYMIZE_USER_ID=true`
- **Formato**: Hash SHA256 (primi 16 caratteri)
- **GDPR**: Permette tracciamento senza identificazione diretta

## ✅ Conformità GDPR

Con questa configurazione:
- ✅ **Minimizzazione dati**: Solo campi obbligatori
- ✅ **Limitazione finalità**: Solo per audit trail GDPR
- ✅ **Anonimizzazione**: IP e opzionalmente user_id
- ✅ **Conservazione**: Solo dati necessari per conformità

## 🎯 Prossimi Passi

1. ✅ Codice modificato (solo campi GDPR obbligatori)
2. ⏳ Deploy su Render
3. ⏳ Attivare `GDPR_LOGGING_FILTER=true`
4. ⏳ Verificare che i nuovi log contengano solo questi 6 campi

