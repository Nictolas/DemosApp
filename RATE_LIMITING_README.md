# 🛡️ Sistema di Rate Limiting - DemosApp

## 📋 Panoramica

Il sistema di Rate Limiting protegge l'API DemosApp da attacchi DDoS, brute force, spam e abusi, garantendo la stabilità e la sicurezza del servizio.

## 🔧 Configurazione

### Middleware Implementati

| Middleware | Limite | Finestra | Scopo |
|------------|--------|----------|-------|
| `generalLimiter` | 100 req | 15 min | Protezione generale API |
| `authLimiter` | 5 req | 15 min | Protezione login |
| `registrationLimiter` | 3 req | 1 ora | Protezione registrazione |
| `passwordResetLimiter` | 3 req | 1 ora | Protezione reset password |
| `adminLimiter` | 200 req | 15 min | Limiti per admin |
| `userLimiter` | 50 req | 15 min | Limiti per utenti autenticati |
| `publicLimiter` | 30 req | 15 min | API pubbliche |
| `uploadLimiter` | 10 req | 1 ora | Upload file |
| `speedLimiter` | 50 req | 15 min | Rilevamento richieste sospette |

### Database

**Tabella**: `rate_limit_violations`
```sql
CREATE TABLE rate_limit_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address VARCHAR(45) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  limit_type VARCHAR(50) NOT NULL,
  user_agent TEXT,
  user_id VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Utilizzo

### Backend

```javascript
// Import middleware
const { generalLimiter, authLimiter } = require('./middleware/rateLimiting');

// Applica a route specifiche
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userLimiter, userRoutes);
```

### Frontend

```typescript
// Dashboard admin
import RateLimitingDashboard from './pages/RateLimitingDashboard';

// Route: /rate-limiting-dashboard
```

## 📊 Monitoraggio

### Dashboard Admin

- **Statistiche Generali**: Violazioni totali, IP unici, utenti unici
- **IP Sospetti**: Indirizzi con più di 3 violazioni
- **Statistiche Endpoint**: Violazioni per endpoint
- **Violazioni per Tipo**: Dettaglio per tipo di limite

### API Endpoints

```bash
# Dashboard completa
GET /api/admin/rate-limiting/dashboard

# Statistiche
GET /api/admin/rate-limiting/stats?days=7

# IP sospetti
GET /api/admin/rate-limiting/suspicious-ips?days=7&minViolations=5

# Statistiche endpoint
GET /api/admin/rate-limiting/endpoint-stats?days=7

# Verifica IP bloccato
GET /api/admin/rate-limiting/check-ip/:ip?hours=24

# Pulizia violazioni
POST /api/admin/rate-limiting/cleanup
{
  "retentionDays": 30
}
```

## 🔒 Sicurezza

### Protezioni Attive

- ✅ **DDoS Protection**: Limite generale 100 req/15min
- ✅ **Brute Force**: 5 tentativi login/15min
- ✅ **Spam Registration**: 3 registrazioni/ora
- ✅ **Password Spam**: 3 reset/ora
- ✅ **API Abuse**: Limiti specifici per tipo
- ✅ **Admin Protection**: Limiti elevati per admin
- ✅ **Upload Protection**: 10 upload/ora

### Logging Automatico

Tutte le violazioni vengono automaticamente loggate con:
- IP address
- Endpoint violato
- Tipo di limite
- User agent
- User ID (se autenticato)
- Timestamp

## ⚙️ Configurazione Avanzata

### Variabili d'Ambiente

```bash
# Rate limiting (opzionale - usa default se non specificato)
RATE_LIMIT_WINDOW_MS=900000        # 15 minuti
RATE_LIMIT_MAX_REQUESTS=100        # 100 richieste
AUTH_LIMIT_MAX_REQUESTS=5          # 5 tentativi login
REGISTRATION_LIMIT_MAX_REQUESTS=3  # 3 registrazioni
```

### Personalizzazione Limiti

Per modificare i limiti, edita `api/middleware/rateLimiting.js`:

```javascript
const customLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 50, // Limite personalizzato
  message: {
    success: false,
    error: 'Limite superato',
    message: 'Messaggio personalizzato'
  }
});
```

## 🚨 Gestione Errori

### Risposte Standard

```json
{
  "success": false,
  "error": "Troppe richieste",
  "message": "Hai superato il limite di richieste. Riprova tra 15 minuti.",
  "retryAfter": 900
}
```

### Headers HTTP

- `Retry-After`: Secondi prima del prossimo tentativo
- `X-RateLimit-Limit`: Limite massimo
- `X-RateLimit-Remaining`: Richieste rimanenti
- `X-RateLimit-Reset`: Timestamp reset

## 📈 Performance

### Ottimizzazioni

- **Indici Database**: Ottimizzati per query frequenti
- **Cleanup Automatico**: Rimozione violazioni vecchie
- **Caching**: Headers HTTP per cache browser
- **Logging Efficiente**: Solo violazioni, non richieste normali

### Monitoraggio

- **Dashboard Real-time**: Aggiornamento automatico
- **Alerting**: Notifiche per IP sospetti
- **Statistiche**: Trend e pattern di utilizzo
- **Cleanup**: Pulizia automatica dati vecchi

## 🔧 Manutenzione

### Pulizia Dati

```bash
# Pulizia manuale via API
curl -X POST /api/admin/rate-limiting/cleanup \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"retentionDays": 30}'
```

### Monitoraggio Salute

```bash
# Verifica stato sistema
curl /api/admin/rate-limiting/dashboard \
  -H "Authorization: Bearer <admin-token>"
```

## 📚 Best Practices

1. **Monitoraggio Continuo**: Controlla regolarmente la dashboard
2. **Pulizia Periodica**: Esegui cleanup mensile
3. **Analisi Pattern**: Identifica attacchi ricorrenti
4. **Aggiustamento Limiti**: Modifica in base al traffico
5. **Backup Configurazione**: Salva configurazioni personalizzate

## 🆘 Troubleshooting

### Problemi Comuni

**Errore**: `Cannot find module 'express-slow-down'`
**Soluzione**: Il modulo è stato rimosso, usa solo `express-rate-limit`

**Errore**: `Rate limit exceeded`
**Soluzione**: Aspetta il reset della finestra o contatta admin

**Errore**: `Database connection failed`
**Soluzione**: Verifica connessione database e tabella `rate_limit_violations`

### Log di Debug

```bash
# Attiva logging dettagliato
DEBUG=rate-limit* npm start
```

## 📞 Supporto

Per problemi o domande sul sistema di Rate Limiting:
1. Controlla i log dell'applicazione
2. Verifica la dashboard admin
3. Controlla la configurazione database
4. Consulta questo README

---

**Sistema implementato**: Settembre 2025  
**Versione**: 1.0.0  
**Compatibilità**: Node.js 18+, PostgreSQL 12+
