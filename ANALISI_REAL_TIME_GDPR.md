# 📊 Analisi Dataset Real-Time per GDPR Compliance

## 🎯 Tipi di Log nel Dataset Real-Time

Il dataset `real-time` contiene **3 tipi di log**:

### 1. **Audit Logs** (`log_type: 'audit'`)
- **Cosa sono**: Tracciano accesso/modifica/cancellazione dati personali
- **GDPR**: ✅ **NECESSARI** (Articolo 30 GDPR - Registro attività trattamento)
- **Fonte**: `api/services/auditService.js`

### 2. **Security Events** (`log_type: 'security'`)
- **Cosa sono**: Tracciano tentativi di accesso non autorizzati, attacchi
- **GDPR**: ✅ **NECESSARI** (Articolo 32 GDPR - Sicurezza del trattamento)
- **Fonte**: `api/middleware/securityMonitoring.js`

### 3. **Performance Metrics** (`log_type: 'performance'`)
- **Cosa sono**: Metriche tecniche (CPU, memoria, database)
- **GDPR**: ❌ **NON NECESSARI** (solo tecnico, non riguarda dati personali)
- **Fonte**: `api/services/performanceMonitor.js`

---

## 📋 Campi Attualmente Inviati

### Audit Logs (da `auditService.js`):
```javascript
{
  _time: timestamp,
  log_type: 'audit',
  type: 'audit',
  user_id: ...,
  action: ...,           // GDPR: Cosa è stato fatto
  resource: ...,         // GDPR: Su quale risorsa
  resource_id: ...,      // GDPR: ID specifico risorsa
  success: ...,          // GDPR: Se l'azione è riuscita
  ip_address: ...,       // GDPR: Da dove
  user_agent: ...,       // ❌ Non obbligatorio
  error_message: ...,    // GDPR: Dettagli errore (utile)
  // + tutti i campi da details (Object.assign)
}
```

### Security Events (da `securityMonitoring.js`):
```javascript
{
  _time: timestamp,
  log_type: 'security',
  type: ...,             // GDPR: Tipo evento sicurezza
  ip_address: ...,      // GDPR: Da dove
  user_id: ...,         // GDPR: Chi (se disponibile)
  user_email: ...,      // ❌ Non obbligatorio (abbiamo user_id)
  user_agent: ...,      // ❌ Non obbligatorio
  severity: ...,        // GDPR: Gravità evento
  details: ...          // GDPR: Dettagli evento
}
```

### Performance Metrics (da `performanceMonitor.js`):
```javascript
{
  _time: timestamp,
  log_type: 'performance',
  cpu_usage: ...,       // ❌ NON GDPR
  memory_usage: ...,    // ❌ NON GDPR
  memory_total: ...,    // ❌ NON GDPR
  memory_free: ...,     // ❌ NON GDPR
  db_connections: ..., // ❌ NON GDPR
  db_size_bytes: ...,  // ❌ NON GDPR
  error_count: ...,    // ❌ NON GDPR
  warning_count: ...,  // ❌ NON GDPR
  event_loop_delay: ..., // ❌ NON GDPR
  uptime: ...,          // ❌ NON GDPR
  load_average: ...     // ❌ NON GDPR
}
```

---

## ✅ Campi GDPR Obbligatori per Real-Time

### Per Audit Logs:
1. **`_time`** - Quando è successo
2. **`user_id`** - Chi ha fatto l'azione
3. **`ip_address`** - Da dove (anonimizzato)
4. **`action`** - Cosa è stato fatto (DATA_ACCESS, DATA_MODIFY, etc.)
5. **`resource`** - Su quale risorsa (users, votes, etc.)
6. **`resource_id`** - ID specifico della risorsa
7. **`success`** - Se l'azione è riuscita
8. **`error_message`** - Dettagli errore (se presente)

### Per Security Events:
1. **`_time`** - Quando è successo
2. **`user_id`** - Chi (se disponibile)
3. **`ip_address`** - Da dove (anonimizzato)
4. **`type`** - Tipo evento sicurezza
5. **`severity`** - Gravità evento
6. **`details`** - Dettagli evento (solo essenziali)

---

## ❌ Campi da Rimuovere

### Audit Logs:
- ❌ `log_type` - Categorizzazione non obbligatoria
- ❌ `type` - Duplicato di `log_type`
- ❌ `user_agent` - Non obbligatorio per GDPR
- ❌ `details.*` nested fields non necessari (es. `details.method`, `details.path`, `details.endpoint` se già in `action`/`resource`)

### Security Events:
- ❌ `log_type` - Categorizzazione non obbligatoria
- ❌ `user_email` - Non obbligatorio (abbiamo `user_id`)
- ❌ `user_agent` - Non obbligatorio per GDPR

### Performance Metrics:
- ❌ **TUTTI** - Non necessari per GDPR (solo tecnico)

---

## 🎯 Raccomandazioni

1. **Rimuovere Performance Metrics**: Non inviarli più ad Axiom (non GDPR)
2. **Pulire Audit Logs**: Inviare solo campi GDPR obbligatori
3. **Pulire Security Events**: Inviare solo campi GDPR obbligatori
4. **Filtro GDPR**: Aggiungere filtro simile a `centralized_logs` per inviare solo log GDPR-required
5. **Ricreare Dataset**: Cancellare e ricreare `real-time` con schema pulito

