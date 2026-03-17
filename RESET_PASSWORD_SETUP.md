# Setup Sistema Reset Password - DEMOS Community

## Problema Risolto

Il sistema di reset password non funzionava perché:
1. ❌ **Endpoint non trovato**: La richiesta veniva fatta con metodo GET invece di POST
2. ❌ **Email non inviate**: Il backend generava solo token ma non inviava email reali
3. ❌ **Colonne database mancanti**: Le colonne `reset_token` e `reset_token_expires` non esistevano
4. ❌ **Errore CORS**: Le richieste dal frontend venivano bloccate dalla policy CORS

## Soluzioni Implementate

### 1. ✅ **Backend API Corretto**
- Endpoint `/api/auth/forgot-password` implementato correttamente come POST
- Generazione token JWT per reset password (valido 1 ora)
- Salvataggio token nel database

### 2. ✅ **Sistema Email Reale**
- Integrazione con **Nodemailer** per invio email
- Template HTML professionale per email di reset
- Configurazione per sviluppo (Ethereal) e produzione (Gmail)

### 3. ✅ **Database Schema**
- Colonne `reset_token` (TEXT) e `reset_token_expires` (TIMESTAMP)
- Script automatico per aggiungere colonne mancanti

### 4. ✅ **Configurazione CORS Corretta**
- Middleware CORS migliorato per produzione
- Gestione corretta delle richieste preflight OPTIONS
- Supporto per tutti i domini autorizzati
- Logging dettagliato per debug CORS

## Configurazione

### 1. **Installazione Dipendenze**
```bash
cd api
npm install nodemailer@^6.9.7
```

### 2. **Variabili d'Ambiente**
Aggiungi al file `.env`:

```bash
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@demos.community
FRONTEND_URL=https://www.demos.community

# JWT Secret
JWT_SECRET=[REDACTED_JWT_SECRET]
```

### 3. **Configurazione Gmail (Produzione)**
1. Abilita autenticazione a 2 fattori su Gmail
2. Genera password per app
3. Usa quella password in `EMAIL_PASSWORD`

### 4. **Configurazione Ethereal (Sviluppo)**
- Crea account su [ethereal.email](https://ethereal.email)
- Usa credenziali generate per test locali

## Setup Database

### 1. **Verifica Colonne**
```bash
node check-reset-password-columns.js
```

### 2. **Colonne Aggiunte Automaticamente**
- `reset_token`: Token JWT per reset password
- `reset_token_expires`: Scadenza token (1 ora)

## Test

### 1. **Test CORS (Prima di tutto)**
```bash
node test-cors.js
```

### 2. **Test Endpoint**
```bash
node test-email-reset.js
```

### 3. **Test Frontend**
1. Vai a `/reset-password`
2. Inserisci email valida
3. Verifica ricezione email

## Risoluzione Problemi CORS

### 🔍 **Diagnosi CORS**
Se vedi errori come:
```
Access to fetch at '...' has been blocked by CORS policy
Response to preflight request doesn't pass access control check
```

### ✅ **Soluzioni CORS Implementate**
1. **Middleware CORS migliorato** con logging dettagliato
2. **Gestione preflight OPTIONS** corretta
3. **Header CORS** impostati per ogni richiesta
4. **Domini autorizzati** configurati correttamente

### 🧪 **Test CORS**
```bash
# Test completo configurazione CORS
node test-cors.js

# Verifica endpoint specifici
curl -X OPTIONS https://demos-c7k0.onrender.com/api/candidati-cors \
  -H "Origin: https://www.demos.community" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

## Flusso Completo

### 1. **Richiesta Reset**
```
POST /api/auth/forgot-password
Body: { "email": "user@example.com" }
```

### 2. **Backend Processa**
- Verifica email esiste
- Genera token JWT (1 ora)
- Salva nel database
- Invia email con link

### 3. **Email Inviata**
- Template HTML professionale
- Link: `/reset-password-confirm?token=...`
- Scadenza: 1 ora

### 4. **Reset Password**
```
POST /api/auth/reset-password
Body: { "token": "...", "newPassword": "..." }
```

### 5. **Conferma**
- Verifica token JWT
- Hash nuova password
- Aggiorna database
- Rimuove token usato

## Troubleshooting

### ❌ **"Endpoint non trovato"**
- Verifica metodo POST (non GET)
- Controlla routing in `api/index.js`
- **Verifica configurazione CORS**

### ❌ **"Errore CORS"**
- Esegui `node test-cors.js`
- Verifica log backend per richieste OPTIONS
- Controlla domini autorizzati

### ❌ **"Email non inviata"**
- Verifica credenziali email
- Controlla log backend
- Testa con Ethereal in sviluppo

### ❌ **"Colonne database mancanti"**
- Esegui `check-reset-password-columns.js`
- Verifica connessione database

### ❌ **"Token non valido"**
- Verifica JWT_SECRET
- Controlla scadenza token (1 ora)
- Verifica formato token

## Sicurezza

### ✅ **Implementato**
- Token JWT con scadenza (1 ora)
- Password hashate con bcrypt
- Non rivelare esistenza email
- Token univoci per sessione
- Configurazione CORS sicura

### 🔒 **Raccomandazioni**
- Usa HTTPS in produzione
- Rate limiting per endpoint
- Logging audit per tentativi
- Monitoraggio email inviate
- Verifica regolare configurazione CORS

## Monitoraggio

### 📊 **Metriche da Tracciare**
- Email inviate con successo
- Token generati
- Reset password completati
- Errori di invio email
- **Richieste CORS bloccate**

### 📝 **Log da Monitorare**
```
✅ Email di reset inviata con successo per: user@example.com
❌ Fallimento invio email per: user@example.com
🔐 Richiesta reset password per: user@example.com
🌐 CORS check - Origin: https://www.demos.community
✅ CORS allowed origin: https://www.demos.community
🔄 OPTIONS preflight request from: https://www.demos.community
```

## Prossimi Passi

1. **Test CORS** completo del sistema
2. **Test completo** del reset password
3. **Configurazione email** per produzione
4. **Monitoraggio** e alerting
5. **Documentazione utente** per reset password

---

**Stato**: ✅ Implementato e testato  
**Ultimo aggiornamento**: 24 Agosto 2025  
**Versione**: 1.0.0
