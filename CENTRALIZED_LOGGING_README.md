# 📊 Sistema di Logging Centralizzato - DemosApp

## 📋 Panoramica

Il **Sistema di Logging Centralizzato** unifica tutti i log dell'applicazione DemosApp in un sistema unificato, fornendo monitoraggio completo, ricerca avanzata, esportazione dati e gestione automatica dei log per garantire performance ottimali e conformità.

## 🔧 Componenti Implementati

### 1. Servizio di Logging Centralizzato (`api/services/centralizedLogger.js`)

#### **Livelli di Log Supportati**
```javascript
ERROR  (0) - Errori critici che richiedono attenzione immediata
WARN   (1) - Warning che potrebbero indicare problemi
INFO   (2) - Informazioni generali sul funzionamento
DEBUG  (3) - Informazioni dettagliate per debugging
TRACE  (4) - Informazioni molto dettagliate per tracciamento
```

#### **Canali di Output**
- ✅ **Console**: Log immediati per debugging
- ✅ **File**: Rotazione automatica, compressione, pulizia
- ✅ **Database**: Storage persistente con indici ottimizzati
- ✅ **Configurabile**: Attiva/disattiva canali via environment

#### **Funzionalità Avanzate**
```javascript
// Logging automatico richieste HTTP
logger.logRequest(req, res, responseTime)

// Logging errori con stack trace
logger.logError(error, req, meta)

// Logging eventi di sicurezza
logger.logSecurity(event, details)

// Logging performance operazioni
logger.logPerformance(operation, duration, details)

// Logging audit per conformità
logger.logAudit(action, resource, userId, details)
```

### 2. Middleware di Logging (`api/middleware/loggingMiddleware.js`)

#### **Middleware Implementati**
```javascript
// Logging automatico richieste HTTP
requestLoggingMiddleware

// Logging errori con gestione centralizzata
errorLoggingMiddleware

// Logging performance per operazioni specifiche
performanceLoggingMiddleware(operationName)

// Logging sicurezza per rilevamento attacchi
securityLoggingMiddleware

// Logging audit per azioni utente
auditLoggingMiddleware(action, resource)

// Logging database per operazioni CRUD
databaseLoggingMiddleware(operation, table)

// Logging business logic per eventi applicazione
businessLogicLoggingMiddleware(eventName)
```

#### **Utility di Logging**
```javascript
// Log operazioni utente
logUtils.logUserAction(userId, action, details)

// Log operazioni admin
logUtils.logAdminAction(adminId, action, resource, details)

// Log eventi sistema
logUtils.logSystemEvent(event, details)

// Log eventi sicurezza
logUtils.logSecurityEvent(event, details)

// Log performance operazioni
logUtils.logOperationPerformance(operation, duration, details)
```

### 3. Database e Storage (`create-centralized-logs-table.cjs`)

#### **Tabella `centralized_logs`**
```sql
CREATE TABLE centralized_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  level VARCHAR(10) NOT NULL,
  pid INTEGER NOT NULL,
  hostname VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  user_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  endpoint VARCHAR(500),
  request_id VARCHAR(255),
  session_id VARCHAR(255),
  meta_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### **Indici per Performance**
```sql
-- Indice per timestamp (query temporali)
CREATE INDEX idx_centralized_logs_timestamp ON centralized_logs (timestamp);

-- Indice per livello (filtri per tipo)
CREATE INDEX idx_centralized_logs_level ON centralized_logs (level);

-- Indice per user_id (query per utente)
CREATE INDEX idx_centralized_logs_user_id ON centralized_logs (user_id);

-- Indice per endpoint (query per API)
CREATE INDEX idx_centralized_logs_endpoint ON centralized_logs (endpoint);

-- Indice per IP (analisi sicurezza)
CREATE INDEX idx_centralized_logs_ip_address ON centralized_logs (ip_address);

-- Indice composito (query comuni)
CREATE INDEX idx_centralized_logs_level_timestamp ON centralized_logs (level, timestamp);
```

### 4. API Routes (`api/routes/admin/logging.js`)

#### **Endpoints Implementati**
```bash
# Statistiche log
GET /api/admin/logging/stats?days=7

# Log recenti
GET /api/admin/logging/recent?hours=24&limit=50

# Ricerca avanzata
GET /api/admin/logging/search?level=ERROR&message=error&userId=123

# Esporta log
GET /api/admin/logging/export?startDate=2025-01-01&endDate=2025-01-31&format=json

# Pulizia log vecchi
POST /api/admin/logging/cleanup
{
  "retentionDays": 30
}

# Livelli disponibili
GET /api/admin/logging/levels

# Salute sistema
GET /api/admin/logging/health

# Solo errori
GET /api/admin/logging/errors?hours=24&limit=100

# Log performance
GET /api/admin/logging/performance?hours=24&limit=100
```

### 5. Frontend Dashboard (`client/src/pages/LoggingDashboard.tsx`)

#### **Sezioni Dashboard**
- **📊 Panoramica**: Statistiche aggregate, distribuzione livelli
- **📝 Log Recenti**: Visualizzazione real-time ultimi log
- **🔍 Ricerca**: Filtri avanzati per ricerca specifica
- **⚙️ Gestione**: Esportazione, pulizia, configurazione

#### **Funzionalità Frontend**
- ✅ **Filtri Avanzati**: Livello, messaggio, utente, IP, endpoint, periodo
- ✅ **Esportazione**: JSON e CSV con download automatico
- ✅ **Visualizzazione Real-time**: Aggiornamento automatico log
- ✅ **Ricerca Testuale**: Cerca in messaggi e metadati
- ✅ **Gestione Pulizia**: Rimozione log vecchi configurabile
- ✅ **Statistiche Grafiche**: Distribuzione per livello e periodo

## 🚀 Utilizzo

### Backend

#### **Logging Automatico**
```javascript
const logger = require('./services/centralizedLogger');

// Log semplice
await logger.info('Operazione completata', { userId: '123' });

// Log errore
await logger.error('Errore critico', { 
  error: error.message, 
  stack: error.stack 
});

// Log sicurezza
await logger.logSecurity('Tentativo di accesso sospetto', {
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});
```

#### **Middleware per Route**
```javascript
const { performanceLoggingMiddleware } = require('./middleware/loggingMiddleware');

// Applica logging performance a una route
router.get('/api/data', 
  performanceLoggingMiddleware('GET_DATA'),
  async (req, res) => {
    // Logica route
  }
);
```

### Frontend

#### **Dashboard Admin**
```typescript
// Route: /logging-dashboard
import LoggingDashboard from './pages/LoggingDashboard';
```

## 📊 Monitoraggio

### Dashboard Admin

- **Statistiche Generali**: Totale log, distribuzione livelli, trend temporali
- **Log Recenti**: Ultimi log con filtri per livello e periodo
- **Ricerca Avanzata**: Filtri multipli per analisi specifiche
- **Esportazione Dati**: Download JSON/CSV per analisi esterne
- **Gestione Storage**: Pulizia automatica e configurazione ritenzione

### API Endpoints

```bash
# Statistiche periodo
curl /api/admin/logging/stats?days=30

# Ricerca errori recenti
curl /api/admin/logging/errors?hours=24

# Esporta log periodo
curl /api/admin/logging/export?startDate=2025-01-01&endDate=2025-01-31

# Pulizia log vecchi
curl -X POST /api/admin/logging/cleanup -d '{"retentionDays": 30}'
```

## 🔒 Sicurezza

### Protezioni Implementate

- ✅ **Logging Sicuro**: Nessun logging di password o dati sensibili
- ✅ **Sanitizzazione**: Pulizia input prima del logging
- ✅ **Accesso Controllato**: Solo admin possono accedere ai log
- ✅ **Rotazione File**: Prevenzione crescita eccessiva file
- ✅ **Cleanup Automatico**: Rimozione log vecchi per privacy
- ✅ **Indicizzazione**: Query ottimizzate per performance
- ✅ **Rate Limiting**: Protezione API di logging

### Conformità GDPR

- ✅ **Retention Policy**: Configurabile per conformità
- ✅ **Data Minimization**: Solo dati necessari nei log
- ✅ **Right to Erasure**: Pulizia automatica dati utente
- ✅ **Audit Trail**: Tracciamento accessi ai log
- ✅ **Data Portability**: Esportazione dati utente

## ⚙️ Configurazione

### Variabili d'Ambiente

```bash
# Livello di log (ERROR, WARN, INFO, DEBUG, TRACE)
LOG_LEVEL=INFO

# Canali di output
LOG_TO_CONSOLE=true
LOG_TO_FILE=true
LOG_TO_DATABASE=true

# Configurazione file
LOG_DIR=./logs
LOG_MAX_FILE_SIZE=10485760  # 10MB
LOG_MAX_FILES=5

# Configurazione database
DATABASE_URL=postgresql://...
```

### Personalizzazione Logging

Per aggiungere nuovi tipi di log, estendi `CentralizedLogger`:

```javascript
// Logging personalizzato
class CustomLogger extends CentralizedLogger {
  async logBusinessEvent(event, details = {}) {
    await this.log('INFO', `Business Event: ${event}`, {
      ...details,
      businessEvent: true
    });
  }
}
```

## 🚨 Gestione Errori

### Risposte Standard

```json
{
  "success": false,
  "error": "Errore logging",
  "requestId": "uuid",
  "timestamp": "2025-01-11T20:30:00.000Z"
}
```

### Logging Errori

```javascript
// Logging automatico errori
try {
  // Operazione rischiosa
} catch (error) {
  await logger.logError(error, req, {
    operation: 'user_registration',
    userId: req.user?.id
  });
  throw error;
}
```

## 📈 Performance

### Ottimizzazioni

- **Indici Database**: Ottimizzati per query frequenti
- **Rotazione File**: Prevenzione crescita eccessiva
- **Cleanup Automatico**: Rimozione log vecchi
- **Scrittura Asincrona**: Non blocca operazioni principali
- **Batch Processing**: Raggruppamento operazioni database
- **Caching**: Cache per query frequenti

### Monitoraggio Performance

- **Dashboard Real-time**: Statistiche aggiornate
- **Query Optimization**: Indici per performance
- **Memory Management**: Cleanup automatico
- **Error Tracking**: Monitoraggio errori logging

## 🔧 Manutenzione

### Pulizia Dati

```bash
# Pulizia manuale via API
curl -X POST /api/admin/logging/cleanup \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"retentionDays": 30}'
```

### Monitoraggio Salute

```bash
# Verifica stato sistema
curl /api/admin/logging/health \
  -H "Authorization: Bearer <admin-token>"
```

### Backup Log

```bash
# Esporta tutti i log periodo
curl /api/admin/logging/export?startDate=2025-01-01&endDate=2025-01-31 \
  -H "Authorization: Bearer <admin-token>"
```

## 📚 Best Practices

1. **Logging Appropriato**: Usa il livello giusto per ogni situazione
2. **Metadati Utili**: Includi contesto rilevante nei log
3. **Performance**: Evita logging eccessivo in produzione
4. **Sicurezza**: Non loggare dati sensibili
5. **Cleanup**: Configura retention policy appropriata
6. **Monitoraggio**: Controlla dashboard regolarmente
7. **Backup**: Esporta log importanti periodicamente

## 🆘 Troubleshooting

### Problemi Comuni

**Errore**: `Cannot write to log file`
**Soluzione**: Verifica permessi directory e spazio disco

**Errore**: `Database connection failed`
**Soluzione**: Verifica connessione database e tabella `centralized_logs`

**Errore**: `Log level not working`
**Soluzione**: Verifica variabile `LOG_LEVEL` e riavvia applicazione

### Log di Debug

```bash
# Attiva logging dettagliato
LOG_LEVEL=DEBUG npm start
```

## 📞 Supporto

Per problemi o domande sul sistema di Logging Centralizzato:
1. Controlla i log dell'applicazione
2. Verifica la dashboard admin
3. Controlla la configurazione database
4. Consulta questo README

---

**Sistema implementato**: Settembre 2025  
**Versione**: 1.0.0  
**Compatibilità**: Node.js 18+, PostgreSQL 12+  
**Dipendenze**: Zero (sistema completamente nativo)
