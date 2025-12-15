# 🔒 Campi GDPR Obbligatori - Real-Time Dataset

## ✅ Modifiche Completate

I servizi ora inviano **SOLO** i campi obbligatori per GDPR su Axiom nel dataset `real-time`.

## 📋 Tipi di Log nel Dataset Real-Time

### 1. **Audit Logs** (`log_type: 'audit'`) ✅ GDPR-Required
- **Cosa sono**: Tracciano accesso/modifica/cancellazione dati personali
- **GDPR**: ✅ **NECESSARI** (Articolo 30 GDPR - Registro attività trattamento)

### 2. **Security Events** (`log_type: 'security'`) ✅ GDPR-Required
- **Cosa sono**: Tracciano tentativi di accesso non autorizzati, attacchi
- **GDPR**: ✅ **NECESSARI** (Articolo 32 GDPR - Sicurezza del trattamento)

### 3. **Performance Metrics** (`log_type: 'performance'`) ❌ NON GDPR
- **Cosa sono**: Metriche tecniche (CPU, memoria, database)
- **GDPR**: ❌ **NON NECESSARI** (solo tecnico, non riguarda dati personali)
- **Stato**: ✅ **DISABILITATO** - Non vengono più inviati ad Axiom

---

## 📋 Campi Inviati ad Axiom (GDPR Obbligatori)

### Audit Logs (8 campi):
1. **`_time`** ✅ - Quando è successo (ISO 8601 timestamp)
2. **`user_id`** ✅ - Chi ha fatto l'azione (UUID o null)
3. **`ip_address`** ✅ - Da dove (anonimizzato se `AXIOM_ANONYMIZE=true`)
4. **`action`** ✅ - Cosa è stato fatto (DATA_ACCESS, DATA_MODIFY, etc.)
5. **`resource`** ✅ - Su quale risorsa (users, votes, etc.)
6. **`resource_id`** ✅ - ID specifico della risorsa
7. **`success`** ✅ - Se l'azione è riuscita (boolean)
8. **`error_message`** ✅ - Dettagli errore (se presente)
9. **`session_id`** ✅ - Identifica la sessione utente (generato se non disponibile)

### Security Events (7 campi):
1. **`_time`** ✅ - Quando è successo (ISO 8601 timestamp)
2. **`user_id`** ✅ - Chi (se disponibile, UUID o null)
3. **`ip_address`** ✅ - Da dove (anonimizzato se `AXIOM_ANONYMIZE=true`)
4. **`type`** ✅ - Tipo evento sicurezza
5. **`severity`** ✅ - Gravità evento
6. **`details`** ✅ - Dettagli evento (solo essenziali)
7. **`session_id`** ✅ - Identifica la sessione utente (generato se non disponibile)

---

## ❌ Campi Rimossi (Non Obbligatori per GDPR)

### Audit Logs:
- ❌ **`log_type`** - Categorizzazione non obbligatoria
- ❌ **`type`** - Duplicato di `log_type`
- ❌ **`user_agent`** - Non obbligatorio per GDPR
- ❌ **`details.*`** nested fields - Campi non necessari (es. `method`, `path`, `endpoint` già coperti da `action`/`resource`)

### Security Events:
- ❌ **`log_type`** - Categorizzazione non obbligatoria
- ❌ **`user_email`** - Non obbligatorio (abbiamo `user_id`)
- ❌ **`user_agent`** - Non obbligatorio per GDPR

### Performance Metrics:
- ❌ **TUTTI** - Non necessari per GDPR (solo tecnico)
  - `cpu_usage`, `memory_usage`, `memory_total`, `memory_free`
  - `db_connections`, `db_size_bytes`
  - `error_count`, `warning_count`
  - `event_loop_delay`, `uptime`, `load_average`

---

## 🔧 File Modificati

1. **`api/services/auditService.js`**
   - Rimossi campi non GDPR (`log_type`, `type`, `user_agent`, `details.*`)
   - Aggiunto `session_id` per coerenza con `centralized_logs`
   - Pulito `sendAuditLogToAxiomHTTP` e `sendAuditLogToAxiom`

2. **`api/middleware/securityMonitoring.js`**
   - Rimossi campi non GDPR (`log_type`, `user_email`, `user_agent`)
   - Aggiunto `session_id` per coerenza con `centralized_logs`

3. **`api/services/performanceMonitor.js`**
   - **DISABILITATO** invio ad Axiom (non GDPR-required)

---

## 📊 Confronto Prima/Dopo

### Prima:
- Audit logs: ~15+ campi (inclusi `details.*` nested)
- Security events: ~8 campi
- Performance metrics: ~12 campi
- **Totale**: ~35+ campi nel dataset

### Dopo:
- Audit logs: 9 campi GDPR-obbligatori
- Security events: 7 campi GDPR-obbligatori
- Performance metrics: 0 campi (disabilitato)
- **Totale**: ~16 campi nel dataset (riduzione ~54%)

---

## 🎯 Prossimi Passi

1. ✅ Codice modificato per inviare solo campi GDPR
2. ⏳ Cancellare e ricreare il dataset `real-time` su Axiom
3. ⏳ Verificare che i nuovi log contengano solo campi GDPR-obbligatori

