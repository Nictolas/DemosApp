# Spiegazione Struttura centralized_logs

## Cosa è `meta_data`?

`meta_data` è un campo JSONB (JSON Binary) che contiene **tutti i dati extra** passati al logger quando viene chiamato:

```javascript
logger.log('INFO', 'Messaggio', {
  userId: '123',
  ipAddress: '192.168.1.1',
  endpoint: '/api/users',
  // ... qualsiasi altro campo
});
```

Tutti questi campi extra vengono salvati in `meta_data` come JSON. Il problema è che durante la migrazione, **tutti questi campi vengono aggiunti al logEntry** con `Object.assign(logEntry, meta)`, quindi vengono inviati ad Axiom anche campi non necessari.

## Colonne della tabella centralized_logs (su Neon)

### 1. **id** (UUID)
- **Cosa contiene**: Identificatore univoco del record
- **Necessario per GDPR?**: NO (solo identificativo interno)
- **Visualizzato su Axiom?**: NO

### 2. **timestamp** (BIGINT)
- **Cosa contiene**: Timestamp Unix in millisecondi
- **Necessario per GDPR?**: SÌ (per audit trail)
- **Visualizzato su Axiom?**: SÌ (come `_time`)

### 3. **level** (CHAR(1))
- **Cosa contiene**: Livello del log (I=INFO, E=ERROR, W=WARNING, D=DEBUG)
- **Necessario per GDPR?**: SÌ (per analisi)
- **Visualizzato su Axiom?**: SÌ

### 4. **pid** (INTEGER)
- **Cosa contiene**: Process ID del processo che ha generato il log
- **Necessario per GDPR?**: NO (solo tecnico)
- **Visualizzato su Axiom?**: SÌ

### 5. **hostname** (VARCHAR(20))
- **Cosa contiene**: Nome dell'host/server che ha generato il log
- **Necessario per GDPR?**: NO (solo tecnico)
- **Visualizzato su Axiom?**: SÌ

### 6. **message** (VARCHAR(50))
- **Cosa contiene**: Messaggio del log (troncato a 50 caratteri su Neon)
- **Necessario per GDPR?**: SÌ (contenuto principale)
- **Visualizzato su Axiom?**: SÌ

### 7. **user_id** (VARCHAR(255))
- **Cosa contiene**: ID dell'utente che ha generato l'azione
- **Necessario per GDPR?**: SÌ (ma può essere anonimizzato)
- **Visualizzato su Axiom?**: SÌ

### 8. **ip_address** (INTEGER)
- **Cosa contiene**: Indirizzo IP compresso (solo su Neon, come integer)
- **Necessario per GDPR?**: SÌ (ma deve essere anonimizzato - solo rete)
- **Visualizzato su Axiom?**: SÌ (come stringa, può essere anonimizzato)

### 9. **user_agent** (VARCHAR(20))
- **Cosa contiene**: User Agent del browser (troncato a 20 caratteri su Neon)
- **Necessario per GDPR?**: NO (solo tecnico)
- **Visualizzato su Axiom?**: SÌ

### 10. **endpoint** (VARCHAR(20))
- **Cosa contiene**: Endpoint API chiamato (troncato a 20 caratteri su Neon)
- **Necessario per GDPR?**: SÌ (per audit trail)
- **Visualizzato su Axiom?**: SÌ

### 11. **request_id** (VARCHAR(100))
- **Cosa contiene**: ID univoco della richiesta HTTP
- **Necessario per GDPR?**: NO (solo tecnico per tracciamento)
- **Visualizzato su Axiom?**: SÌ

### 12. **session_id** (VARCHAR(100))
- **Cosa contiene**: ID della sessione utente
- **Necessario per GDPR?**: SÌ (per audit trail, ma può essere anonimizzato)
- **Visualizzato su Axiom?**: SÌ

### 13. **meta_data** (JSONB)
- **Cosa contiene**: **TUTTI i campi extra** passati al logger
- **Esempi di campi che possono essere in meta_data**:
  - `freed`, `afterGC`, `beforeGC` (metriche memoria)
  - `alertType`, `errors` (errori tecnici)
  - `method`, `statusCode`, `responseTime` (dettagli HTTP)
  - `url`, `headers` (dettagli richiesta)
  - Qualsiasi altro campo passato al logger
- **Necessario per GDPR?**: DIPENDE (alcuni campi sì, altri no)
- **Visualizzato su Axiom?**: SÌ (tutti i campi vengono aggiunti al logEntry)

### 14. **created_at** (BIGINT)
- **Cosa contiene**: Timestamp di creazione del record
- **Necessario per GDPR?**: SÌ (per audit trail)
- **Visualizzato su Axiom?**: NO (usato solo `_time`)

## Cosa viene visualizzato su Axiom (centralized_logs)?

Su Axiom vengono visualizzati **TUTTI i campi** della tabella centralized_logs **PIÙ tutti i campi da meta_data**.

### Campi base (sempre presenti):
- `_time`: Timestamp del log
- `level`: Livello del log
- `message`: Messaggio del log
- `log_type`: Tipo di log (application, performance, security)
- `pid`: Process ID
- `hostname`: Nome host
- `user_id`: ID utente
- `ip_address`: Indirizzo IP
- `user_agent`: User Agent
- `endpoint`: Endpoint API
- `request_id`: ID richiesta
- `session_id`: ID sessione

### Campi da meta_data (possono variare):
- `freed`, `afterGC`, `beforeGC`: Metriche memoria
- `method`, `statusCode`, `responseTime`: Dettagli HTTP
- `url`, `headers`: Dettagli richiesta
- Qualsiasi altro campo passato al logger

## Campi NON necessari per GDPR (possono essere rimossi):

1. **Campi tecnici**:
   - `pid` (Process ID)
   - `hostname` (Nome host)
   - `request_id` (ID richiesta - solo per tracciamento tecnico)

2. **Campi da meta_data non necessari**:
   - `freed`, `afterGC`, `beforeGC` (metriche memoria - solo tecnico)
   - `alertType`, `errors` (errori tecnici dettagliati)
   - `method`, `statusCode`, `responseTime` (dettagli HTTP - già in endpoint)
   - `url`, `headers` (dettagli richiesta - già in endpoint)

## Campi NECESSARI per GDPR (devono rimanere):

1. **Campi obbligatori**:
   - `_time` / `timestamp`: Quando è successo
   - `level`: Tipo di evento
   - `message`: Cosa è successo
   - `user_id`: Chi ha fatto l'azione (può essere anonimizzato)
   - `ip_address`: Da dove (può essere anonimizzato - solo rete)
   - `endpoint`: Quale risorsa
   - `session_id`: Sessione utente (può essere anonimizzato)

2. **Campi opzionali utili**:
   - `user_agent`: Browser utilizzato (per sicurezza)
   - `log_type`: Tipo di log (per categorizzazione)

