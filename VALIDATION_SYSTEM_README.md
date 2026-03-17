# 🛡️ Sistema di Validazione e Sanitizzazione Input - DemosApp

## 📋 Panoramica

Il sistema di Validazione e Sanitizzazione Input protegge l'applicazione DemosApp da attacchi di input malformati, SQL injection, XSS, path traversal e altri attacchi comuni, garantendo la sicurezza e l'integrità dei dati.

## 🔧 Componenti Implementati

### 1. Middleware di Validazione (`api/middleware/inputValidation.js`)

#### **Schemi di Validazione Joi**
```javascript
// Validazione Email
email: Joi.string().email().max(255).required()

// Validazione Password
password: Joi.string().min(8).max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)

// Validazione Nome/Cognome
nome: Joi.string().min(2).max(50)
  .pattern(/^[a-zA-ZÀ-ÿ\s'-]+$/)

// Validazione Codice Fiscale
codiceFiscale: Joi.string().length(16)
  .pattern(/^[A-Z0-9]{16}$/)

// Validazione Data di Nascita
dataNascita: Joi.string().pattern(/^\d{2}\/\d{2}\/\d{4}$/)
```

#### **Funzioni di Sanitizzazione**
```javascript
// Sanitizzazione HTML
html: (input) => sanitizeHtml(input, { allowedTags: [...] })

// Sanitizzazione Testo
text: (input) => xss(input, { whiteList: {}, stripIgnoreTag: true })

// Sanitizzazione Email
email: (input) => validator.normalizeEmail(input)

// Sanitizzazione URL
url: (input) => validator.escape(input)
```

### 2. Middleware di Sicurezza (`api/middleware/security.js`)

#### **Headers di Sicurezza**
```javascript
// Content Security Policy
Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'...

// X-Frame-Options
X-Frame-Options: DENY

// X-Content-Type-Options
X-Content-Type-Options: nosniff

// X-XSS-Protection
X-XSS-Protection: 1; mode=block

// Strict-Transport-Security
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

#### **Protezioni Attive**
- ✅ **SQL Injection Detection**: Rilevamento pattern SQL maliciosi
- ✅ **XSS Detection**: Rilevamento script e tag HTML pericolosi
- ✅ **Path Traversal Protection**: Prevenzione accessi directory
- ✅ **User-Agent Filtering**: Blocco tool di attacco
- ✅ **Request Size Limiting**: Limite 10MB per richiesta

### 3. Servizio di Validazione (`api/services/validationService.js`)

#### **Validazioni Avanzate**
```javascript
// Validazione Email Unica
static async validateUniqueEmail(email, excludeUserId = null)

// Validazione Codice Fiscale Unico
static async validateUniqueCodiceFiscale(codiceFiscale, excludeUserId = null)

// Validazione Formato Codice Fiscale
static validateCodiceFiscaleFormat(codiceFiscale)

// Validazione Data di Nascita
static validateDataNascita(dataNascita)

// Validazione Forza Password
static validatePasswordStrength(password)
```

#### **Sanitizzazione Completa**
```javascript
// Sanitizzazione Input Completo
static sanitizeInput(input)

// Validazione e Sanitizzazione Combinata
static async validateAndSanitizeInput(input, validationRules)
```

### 4. Database e Monitoraggio

#### **Tabella `validation_failures`**
```sql
CREATE TABLE validation_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  endpoint VARCHAR(255) NOT NULL,
  errors JSONB NOT NULL,
  input_data JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### **Indici per Performance**
```sql
CREATE INDEX idx_validation_failures_ip ON validation_failures(ip_address);
CREATE INDEX idx_validation_failures_timestamp ON validation_failures(timestamp);
CREATE INDEX idx_validation_failures_endpoint ON validation_failures(endpoint);
CREATE INDEX idx_validation_failures_errors ON validation_failures USING GIN(errors);
```

## 🚀 Utilizzo

### Backend

#### **Validazione Route**
```javascript
const { validators, sanitizeInput } = require('./middleware/inputValidation');
const ValidationService = require('./services/validationService');

// Route con validazione
router.post('/register', 
  validateInput(validators.registration), 
  sanitizeInput(['nome', 'cognome']),
  async (req, res) => {
    // Validazione avanzata
    const validation = await ValidationService.validateAndSanitizeInput(req.body, validationRules);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors });
    }
    // ...
  }
);
```

#### **Middleware di Sicurezza**
```javascript
const { securityHeaders, securityMiddleware } = require('./middleware/security');

app.use(securityHeaders);
app.use(securityMiddleware);
```

### Frontend

#### **Dashboard Admin**
```typescript
// Route: /validation-dashboard
import ValidationDashboard from './pages/ValidationDashboard';
```

## 📊 Monitoraggio

### Dashboard Admin

- **Statistiche Generali**: Fallimenti totali, IP unici, endpoint
- **Fallimenti per Tipo**: Distribuzione errori per categoria
- **Fallimenti per Endpoint**: Endpoint con più errori
- **Fallimenti Recenti**: Ultimi tentativi di validazione falliti
- **Dettagli Fallimento**: Visualizzazione completa errori e input

### API Endpoints

```bash
# Statistiche validazione
GET /api/admin/validation/stats?days=7

# Dettagli fallimento specifico
GET /api/admin/validation/failure/:id

# Fallimenti per IP
GET /api/admin/validation/ip/:ip?days=7

# Fallimenti per endpoint
GET /api/admin/validation/endpoint/:endpoint?days=7

# Pulizia fallimenti vecchi
POST /api/admin/validation/cleanup
{
  "retentionDays": 30
}
```

## 🔒 Sicurezza

### Protezioni Implementate

- ✅ **SQL Injection**: Rilevamento e blocco pattern SQL maliciosi
- ✅ **XSS Attacks**: Sanitizzazione e rilevamento script pericolosi
- ✅ **Path Traversal**: Prevenzione accessi directory non autorizzati
- ✅ **Input Validation**: Validazione robusta tutti i campi
- ✅ **Data Sanitization**: Pulizia e normalizzazione input
- ✅ **Security Headers**: Headers HTTP per sicurezza
- ✅ **Request Filtering**: Blocco richieste sospette
- ✅ **Format Validation**: Controllo formati specifici
- ✅ **Uniqueness Check**: Controllo unicità dati sensibili
- ✅ **Strength Check**: Validazione forza password

### Logging e Monitoraggio

- ✅ **Logging Automatico**: Tutti i fallimenti di validazione
- ✅ **Dashboard Real-time**: Statistiche e monitoraggio
- ✅ **Alerting**: Notifiche per tentativi sospetti
- ✅ **Analytics**: Pattern e trend di attacchi
- ✅ **Cleanup**: Pulizia automatica dati vecchi

## ⚙️ Configurazione

### Variabili d'Ambiente

```bash
# Validazione (opzionale - usa default se non specificato)
VALIDATION_ENABLED=true
VALIDATION_LOG_FAILURES=true
VALIDATION_CLEANUP_DAYS=30
```

### Personalizzazione Validazione

Per modificare le regole di validazione, edita `api/middleware/inputValidation.js`:

```javascript
// Aggiungi nuovo schema
const customSchema = Joi.object({
  campo: Joi.string().min(5).max(100).required()
});

// Aggiungi nuovo sanitizzatore
const customSanitizer = (input) => {
  // Logica di sanitizzazione personalizzata
  return sanitizedInput;
};
```

## 🚨 Gestione Errori

### Risposte Standard

```json
{
  "success": false,
  "error": "Dati di input non validi",
  "details": [
    {
      "field": "email",
      "message": "Email non valida"
    }
  ]
}
```

### Logging Fallimenti

```javascript
// Log automatico fallimenti
await ValidationService.logValidationFailure(
  req.ip,
  req.get('User-Agent'),
  '/api/endpoint',
  validation.errors,
  req.body
);
```

## 📈 Performance

### Ottimizzazioni

- **Indici Database**: Ottimizzati per query frequenti
- **Validazione Lazy**: Solo quando necessario
- **Sanitizzazione Efficiente**: Algoritmi ottimizzati
- **Caching**: Headers HTTP per cache browser
- **Cleanup Automatico**: Rimozione dati vecchi

### Monitoraggio Performance

- **Dashboard Real-time**: Statistiche aggiornate
- **Query Optimization**: Indici per performance
- **Memory Management**: Cleanup automatico
- **Error Tracking**: Monitoraggio errori

## 🔧 Manutenzione

### Pulizia Dati

```bash
# Pulizia manuale via API
curl -X POST /api/admin/validation/cleanup \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"retentionDays": 30}'
```

### Monitoraggio Salute

```bash
# Verifica stato sistema
curl /api/admin/validation/stats \
  -H "Authorization: Bearer <admin-token>"
```

## 📚 Best Practices

1. **Validazione Completa**: Valida tutti gli input utente
2. **Sanitizzazione Sistematica**: Pulisci tutti i dati
3. **Logging Dettagliato**: Registra tutti i fallimenti
4. **Monitoraggio Continuo**: Controlla dashboard regolarmente
5. **Aggiornamento Regole**: Mantieni regole aggiornate
6. **Test Periodici**: Verifica funzionamento sistema
7. **Cleanup Automatico**: Esegui pulizia regolare

## 🆘 Troubleshooting

### Problemi Comuni

**Errore**: `Cannot find module 'helmet'`
**Soluzione**: Helmet rimosso, usa `securityHeaders` nativo

**Errore**: `Validation failed`
**Soluzione**: Controlla formato input e regole validazione

**Errore**: `Database connection failed`
**Soluzione**: Verifica connessione database e tabella `validation_failures`

### Log di Debug

```bash
# Attiva logging dettagliato
DEBUG=validation* npm start
```

## 📞 Supporto

Per problemi o domande sul sistema di Validazione:
1. Controlla i log dell'applicazione
2. Verifica la dashboard admin
3. Controlla la configurazione database
4. Consulta questo README

---

**Sistema implementato**: Settembre 2025  
**Versione**: 1.0.0  
**Compatibilità**: Node.js 18+, PostgreSQL 12+
