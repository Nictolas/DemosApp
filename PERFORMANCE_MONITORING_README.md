# 📊 Sistema di Monitoraggio Performance e Salute - DemosApp

## 📋 Panoramica

Il **Sistema di Monitoraggio Performance e Salute** fornisce monitoraggio completo in tempo reale delle performance del sistema, controlli di salute automatici, rilevamento proattivo di problemi e dashboard amministrative per garantire stabilità e performance ottimali dell'applicazione DemosApp.

## 🔧 Componenti Implementati

### 1. Servizio di Monitoraggio Performance (`api/services/performanceMonitor.js`)

#### **Metriche Monitorate**
```javascript
// Metriche Sistema
- CPU Usage (percentuale e dettagli user/system)
- Memory Usage (heap, RSS, sistema)
- Event Loop Delay (latenza eventi)
- Uptime (tempo di funzionamento)
- Load Average (carico sistema)

// Metriche Database
- Connessioni attive/idle
- Dimensione database
- Query lente
- Performance connessioni

// Metriche Applicazione
- Active Handles/Requests
- Memory Heap (used/total)
- Process PID e hostname
- Platform e architettura

// Metriche Rete
- Interfacce di rete attive
- Connessioni di rete
- Statistiche interfacce

// Metriche Errori
- Errori ultima ora
- Warning ultima ora
- Tasso errori totale
```

#### **Soglie di Allerta Configurabili**
```javascript
const thresholds = {
  cpu: 80,           // CPU usage %
  memory: 85,        // Memory usage %
  responseTime: 2000, // Response time ms
  errorRate: 5,      // Error rate %
  dbConnections: 80, // DB connections %
  diskSpace: 90      // Disk space %
};
```

#### **Funzionalità Avanzate**
- ✅ **Monitoraggio Automatico**: Intervalli configurabili (default 30s)
- ✅ **Alert Intelligenti**: Cooldown per evitare spam
- ✅ **Storage Storico**: Metriche salvate per analisi trend
- ✅ **Cleanup Automatico**: Rimozione dati vecchi configurabile
- ✅ **Health Status**: Calcolo automatico stato salute sistema

### 2. Servizio di Health Check (`api/services/healthCheckService.js`)

#### **Controlli di Salute Implementati**
```javascript
// Controllo Database
- Test connessione
- Test query semplice e complessa
- Tempo risposta
- Conteggio utenti e statistiche

// Controllo Memoria
- Utilizzo heap applicazione
- Memoria sistema (total/free/used)
- Percentuale utilizzo
- Soglie di warning/error

// Controllo Spazio Disco
- Spazio libero disponibile
- Percentuale utilizzo
- Soglie configurabili

// Controllo Rete
- Interfacce di rete attive
- Connessioni IPv4
- Stato interfacce

// Controllo Servizi
- Performance Monitor
- Database
- Logging
- Security

// Controllo Sicurezza
- Eventi sicurezza recenti
- Tentativi di attacco
- Violazioni rilevate
```

#### **Stati di Salute**
- ✅ **HEALTHY**: Tutti i controlli OK
- ⚠️ **DEGRADED**: Alcuni warning, sistema funzionante
- ❌ **UNHEALTHY**: Errori critici, intervento richiesto
- 🚨 **CRITICAL**: Sistema compromesso, azione immediata

### 3. Database e Storage

#### **Tabella `performance_metrics`**
```sql
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  cpu_usage DECIMAL(5,2),
  memory_usage BIGINT,
  memory_total BIGINT,
  memory_free BIGINT,
  db_connections INTEGER,
  db_size_bytes BIGINT,
  error_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  event_loop_delay DECIMAL(10,2),
  uptime DECIMAL(10,2),
  load_average JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### **Tabella `health_checks`**
```sql
CREATE TABLE health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL,
  checks JSONB NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4. API Routes (`api/routes/admin/monitoring.js`)

#### **Endpoints Implementati**
```bash
# Stato salute sistema
GET /api/admin/monitoring/health

# Metriche performance correnti
GET /api/admin/monitoring/performance

# Metriche storiche
GET /api/admin/monitoring/metrics/historical?hours=24

# Storico controlli salute
GET /api/admin/monitoring/health/history?hours=24

# Alert recenti
GET /api/admin/monitoring/alerts?hours=24

# Riepilogo sistema completo
GET /api/admin/monitoring/summary

# Controlli monitoraggio
POST /api/admin/monitoring/start
POST /api/admin/monitoring/stop
GET /api/admin/monitoring/status

# Pulizia dati vecchi
POST /api/admin/monitoring/cleanup
{
  "retentionDays": 30
}

# Metriche database dettagliate
GET /api/admin/monitoring/database
```

### 5. Frontend Dashboard (`client/src/pages/MonitoringDashboard.tsx`)

#### **Sezioni Dashboard**
- **📊 Panoramica**: Status generale, metriche aggregate, trend
- **❤️ Salute Sistema**: Controlli dettagliati per ogni componente
- **⚡ Performance**: Metriche CPU, memoria, database, applicazione
- **🚨 Alert e Log**: Alert recenti e log di sistema

#### **Funzionalità Frontend**
- ✅ **Controlli Real-time**: Avvia/ferma monitoraggio
- ✅ **Aggiornamento Automatico**: Refresh dati periodico
- ✅ **Visualizzazione Trend**: Grafici trend performance
- ✅ **Status Colorati**: Indicatori visivi stato salute
- ✅ **Metriche Dettagliate**: Informazioni complete sistema
- ✅ **Alert Management**: Gestione notifiche e warning

## 🚀 Utilizzo

### Backend

#### **Avvio Monitoraggio**
```javascript
const performanceMonitor = require('./services/performanceMonitor');

// Avvia monitoraggio (30 secondi intervallo)
performanceMonitor.start(30000);

// Ottieni metriche correnti
const metrics = performanceMonitor.getCurrentMetrics();

// Ottieni stato salute
const health = performanceMonitor.getSystemHealth();
```

#### **Health Check Manuale**
```javascript
const healthCheckService = require('./services/healthCheckService');

// Esegui tutti i controlli
const healthStatus = await healthCheckService.runAllChecks();

// Salva stato per storico
await healthCheckService.saveHealthStatus(healthStatus);
```

### Frontend

#### **Dashboard Admin**
```typescript
// Route: /monitoring-dashboard
import MonitoringDashboard from './pages/MonitoringDashboard';
```

## 📊 Monitoraggio

### Dashboard Admin

- **Status Generale**: Indicatore salute sistema con dettagli
- **Metriche Performance**: CPU, memoria, database, applicazione
- **Controlli Salute**: Verifica dettagliata ogni componente
- **Trend Analysis**: Analisi trend performance nel tempo
- **Alert Management**: Gestione notifiche e warning

### API Endpoints

```bash
# Health check completo
curl /api/admin/monitoring/health

# Metriche performance
curl /api/admin/monitoring/performance

# Riepilogo sistema
curl /api/admin/monitoring/summary

# Avvia monitoraggio
curl -X POST /api/admin/monitoring/start

# Ferma monitoraggio
curl -X POST /api/admin/monitoring/stop
```

## 🔒 Sicurezza

### Protezioni Implementate

- ✅ **Accesso Controllato**: Solo admin possono accedere
- ✅ **Rate Limiting**: Protezione API monitoraggio
- ✅ **Data Sanitization**: Pulizia dati sensibili
- ✅ **Alert Cooldown**: Prevenzione spam notifiche
- ✅ **Retention Policy**: Pulizia automatica dati vecchi
- ✅ **Error Handling**: Gestione sicura errori
- ✅ **Logging Audit**: Tracciamento accessi monitoraggio

### Conformità GDPR

- ✅ **Data Minimization**: Solo metriche necessarie
- ✅ **Retention Policy**: Configurabile per conformità
- ✅ **Right to Erasure**: Pulizia automatica dati
- ✅ **Data Portability**: Esportazione metriche
- ✅ **Privacy by Design**: Nessun dato personale nei log

## ⚙️ Configurazione

### Variabili d'Ambiente

```bash
# Monitoraggio Performance
PERFORMANCE_MONITORING_ENABLED=true
PERFORMANCE_MONITORING_INTERVAL=30000
PERFORMANCE_METRICS_RETENTION_DAYS=30

# Health Check
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL=60000
HEALTH_CHECK_RETENTION_DAYS=30

# Soglie Alert
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
ERROR_RATE_THRESHOLD=5
DB_CONNECTIONS_THRESHOLD=80
DISK_SPACE_THRESHOLD=90
```

### Personalizzazione Soglie

Per modificare le soglie di allerta, edita `api/services/performanceMonitor.js`:

```javascript
this.thresholds = {
  cpu: 80,           // CPU usage %
  memory: 85,        // Memory usage %
  responseTime: 2000, // Response time ms
  errorRate: 5,      // Error rate %
  dbConnections: 80, // DB connections %
  diskSpace: 90      // Disk space %
};
```

## 🚨 Gestione Alert

### Tipi di Alert

```javascript
// Alert Performance
CPU_HIGH          - CPU usage > soglia
MEMORY_HIGH       - Memory usage > soglia
EVENT_LOOP_DELAY  - Event loop delay > 100ms
DB_CONNECTIONS_HIGH - Connessioni DB > soglia

// Alert Salute
DATABASE_ERROR    - Database non raggiungibile
MEMORY_ERROR      - Memoria insufficiente
DISK_ERROR        - Spazio disco insufficiente
NETWORK_ERROR     - Problemi rete
SERVICES_ERROR    - Servizi non operativi
SECURITY_ALERT    - Eventi sicurezza
```

### Gestione Alert

- **Cooldown**: Prevenzione spam (1 ora per tipo)
- **Logging**: Tutti gli alert loggati
- **Dashboard**: Visualizzazione real-time
- **Escalation**: Alert critici evidenziati

## 📈 Performance

### Ottimizzazioni

- **Indici Database**: Ottimizzati per query frequenti
- **Cleanup Automatico**: Rimozione dati vecchi
- **Batch Processing**: Raggruppamento operazioni
- **Caching**: Cache per query frequenti
- **Async Operations**: Operazioni non bloccanti
- **Memory Management**: Gestione memoria ottimizzata

### Monitoraggio Performance

- **Real-time Metrics**: Metriche aggiornate ogni 30s
- **Historical Data**: Dati storici per analisi trend
- **Trend Analysis**: Analisi trend automatica
- **Alert Thresholds**: Soglie configurabili
- **Dashboard Real-time**: Aggiornamento automatico

## 🔧 Manutenzione

### Pulizia Dati

```bash
# Pulizia manuale via API
curl -X POST /api/admin/monitoring/cleanup \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"retentionDays": 30}'
```

### Monitoraggio Salute

```bash
# Verifica stato sistema
curl /api/admin/monitoring/health \
  -H "Authorization: Bearer <admin-token>"
```

### Backup Metriche

```bash
# Esporta metriche storiche
curl /api/admin/monitoring/metrics/historical?hours=168 \
  -H "Authorization: Bearer <admin-token>"
```

## 📚 Best Practices

1. **Monitoraggio Continuo**: Mantieni monitoraggio sempre attivo
2. **Soglie Appropriate**: Configura soglie realistiche
3. **Alert Management**: Gestisci alert prontamente
4. **Data Retention**: Configura retention policy appropriata
5. **Dashboard Review**: Controlla dashboard regolarmente
6. **Trend Analysis**: Analizza trend performance
7. **Capacity Planning**: Usa dati per pianificazione capacità

## 🆘 Troubleshooting

### Problemi Comuni

**Errore**: `Performance monitoring non avviato`
**Soluzione**: Verifica `PERFORMANCE_MONITORING_ENABLED=true`

**Errore**: `Health check fallito`
**Soluzione**: Controlla connessione database e servizi

**Errore**: `Metriche non aggiornate`
**Soluzione**: Verifica intervallo monitoraggio e database

### Log di Debug

```bash
# Attiva logging dettagliato
DEBUG=performance* npm start
```

## 📞 Supporto

Per problemi o domande sul sistema di Monitoraggio Performance:
1. Controlla i log dell'applicazione
2. Verifica la dashboard admin
3. Controlla la configurazione database
4. Consulta questo README

---

**Sistema implementato**: Settembre 2025  
**Versione**: 1.0.0  
**Compatibilità**: Node.js 18+, PostgreSQL 12+  
**Dipendenze**: Zero (sistema completamente nativo)
