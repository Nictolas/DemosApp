# 🛡️ Sistema di Validazione Nativa - DemosApp

## 📋 Panoramica

Il sistema di Validazione e Sanitizzazione Input **nativo** protegge l'applicazione DemosApp da attacchi di input malformati, SQL injection, XSS, path traversal e altri attacchi comuni, **senza dipendenze esterne** per garantire la massima compatibilità e stabilità.

## 🔧 Componenti Implementati

### 1. Validatori Nativi (`api/middleware/inputValidation.js`)

#### **Validatori Implementati**
```javascript
// Validazione Email
validators.email(value) // Formato, lunghezza, normalizzazione

// Validazione Password
validators.password(value) // Complessità, sicurezza, pattern

// Validazione Nome/Cognome
validators.name(value, fieldName) // Solo lettere, spazi, apostrofi

// Validazione Codice Fiscale
validators.codiceFiscale(value) // Formato italiano, 16 caratteri

// Validazione Data di Nascita
validators.dataNascita(value) // Formato DD/MM/YYYY, età minima

// Validazione Genere
validators.genere(value) // M, F, Altro

// Validazione Telefono
validators.telefono(value) // Formato internazionale

// Validazione URL
validators.url(value) // Formato, protocollo

// Validazione Testo
validators.text(value, maxLength) // Lunghezza, sanitizzazione

// Validazione ID
validators.id(value) // Formato alfanumerico

// Validazione Numeri
validators.integer(value, min, max) // Range, tipo

// Validazione Booleani
validators.boolean(value) // true/false
```

#### **Sanitizzatori Nativi**
```javascript
// Sanitizzazione HTML
sanitizers.html(input) // Rimozione tag pericolosi

// Sanitizzazione Testo
sanitizers.text(input) // Escape caratteri speciali

// Sanitizzazione Email
sanitizers.email(input) // Normalizzazione

// Sanitizzazione URL
sanitizers.url(input) // Pulizia caratteri pericolosi

// Sanitizzazione Numeri
sanitizers.number(input) // Conversione sicura

// Sanitizzazione Booleani
sanitizers.boolean(input) // Conversione sicura
```

### 2. Middleware di Sicurezza (`api/middleware/security.js`)

#### **Headers di Sicurezza Nativi**
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

// Referrer-Policy
Referrer-Policy: strict-origin-when-cross-origin

// Permissions-Policy
Permissions-Policy: geolocation=(), microphone=(), camera=()
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

## 🚀 Utilizzo

### Backend

#### **Validazione Route**
```javascript
const { validationRules, sanitizeInput } = require('./middleware/inputValidation');
const ValidationService = require('./services/validationService');

// Route con validazione
router.post('/register', 
  validateInput(validationRules.registration), 
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

### Vantaggi del Sistema Nativo

- ✅ **Zero Dipendenze**: Nessuna dipendenza esterna
- ✅ **Compatibilità Totale**: Funziona su qualsiasi ambiente
- ✅ **Performance**: Ottimizzato per l'applicazione
- ✅ **Manutenzione**: Controllo completo del codice
- ✅ **Sicurezza**: Nessun rischio da dipendenze vulnerabili
- ✅ **Deploy**: Nessun problema di compatibilità

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
// Aggiungi nuovo validatore
const customValidator = (value) => {
  // Logica di validazione personalizzata
  return { isValid: true, value: sanitizedValue };
};

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

- **Validazione Nativa**: Algoritmi ottimizzati per l'applicazione
- **Indici Database**: Ottimizzati per query frequenti
- **Sanitizzazione Efficiente**: Algoritmi nativi veloci
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

**Errore**: `Cannot find module 'joi'`
**Soluzione**: Sistema nativo, nessuna dipendenza esterna

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

Per problemi o domande sul sistema di Validazione Nativa:
1. Controlla i log dell'applicazione
2. Verifica la dashboard admin
3. Controlla la configurazione database
4. Consulta questo README

---

**Sistema implementato**: Settembre 2025  
**Versione**: 1.0.0  
**Compatibilità**: Node.js 18+, PostgreSQL 12+  
**Dipendenze**: Zero (sistema completamente nativo)
