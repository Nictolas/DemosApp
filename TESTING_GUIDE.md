# 🧪 Guida Completa per il Testing del Deploy

Questa guida ti aiuterà a testare tutte le funzionalità implementate nel sistema di audit logging e data retention.

## 📋 **PREPARAZIONE**

### 1. Installazione Dipendenze di Test
```bash
npm install axios
```

### 2. Configurazione
- Assicurati che il server sia in esecuzione
- Configura le variabili d'ambiente necessarie
- Verifica che il database sia accessibile

## 🚀 **TEST LOCALI**

### 1. Test Backend Completo
```bash
node test-deploy.js
```

**Cosa testa:**
- ✅ Health check dell'API
- ✅ Endpoint di audit logging
- ✅ Endpoint di data retention
- ✅ Gestione job automatici
- ✅ Pulizia dati
- ✅ Notifiche

### 2. Test Frontend
Apri `test-frontend.html` nel browser e segui le istruzioni.

**Cosa testa:**
- ✅ Connessione API
- ✅ Pagine legali
- ✅ GDPR Rights
- ✅ Data Retention
- ✅ Design responsive
- ✅ Performance

### 3. Test Manuale delle Pagine

#### Pagine Legali
- [ ] `http://localhost:3001/privacy-policy`
- [ ] `http://localhost:3001/terms-of-service`
- [ ] `http://localhost:3001/cookie-policy`
- [ ] `http://localhost:3001/security-measures`

#### Pagine GDPR
- [ ] `http://localhost:3001/gdpr-rights`
- [ ] `http://localhost:3001/data-retention`

#### Verifica:
- [ ] Le pagine si caricano senza errori
- [ ] Il design è responsive
- [ ] I link funzionano correttamente
- [ ] Non ci sono errori nella console

## 🌐 **TEST SU RENDER**

### 1. Test Automatico
```bash
node test-render-deploy.js
```

**Prima di eseguire:**
1. Sostituisci `RENDER_URL` con il tuo URL Render
2. Assicurati che il deploy sia completato
3. Verifica che il server sia in esecuzione

### 2. Test Manuale su Render

#### URL da Testare
- [ ] `https://your-app.onrender.com/privacy-policy`
- [ ] `https://your-app.onrender.com/terms-of-service`
- [ ] `https://your-app.onrender.com/cookie-policy`
- [ ] `https://your-app.onrender.com/security-measures`
- [ ] `https://your-app.onrender.com/gdpr-rights`
- [ ] `https://your-app.onrender.com/data-retention`

#### Verifica:
- [ ] Le pagine si caricano correttamente
- [ ] Il CSS è applicato correttamente
- [ ] Le immagini sono visibili
- [ ] I link interni funzionano
- [ ] Non ci sono errori 404 o 500

## 🔧 **TEST API ENDPOINTS**

### 1. Test con Postman/Insomnia

#### Health Check
```
GET /api/test/health
```

#### Audit Dashboard
```
GET /api/admin/audit-dashboard/stats
GET /api/admin/audit-dashboard/logs
GET /api/admin/audit-dashboard/suspicious
```

#### Data Retention
```
GET /api/admin/data-retention/policies
GET /api/admin/data-retention/stats
GET /api/admin/data-retention/job/status
```

#### GDPR Rights
```
GET /api/user/rights-requests
POST /api/user/data-export
DELETE /api/user/account
```

### 2. Test con cURL

```bash
# Health Check
curl -X GET http://localhost:3001/api/test/health

# Audit Stats
curl -X GET http://localhost:3001/api/admin/audit-dashboard/stats

# Data Retention Policies
curl -X GET http://localhost:3001/api/admin/data-retention/policies
```

## 📊 **TEST DI PERFORMANCE**

### 1. Test di Caricamento
- [ ] Tempo di caricamento < 3 secondi
- [ ] Nessun timeout
- [ ] Risposta fluida

### 2. Test di Memoria
- [ ] Nessun memory leak
- [ ] Uso memoria stabile
- [ ] Garbage collection funzionante

### 3. Test di Concorrenza
- [ ] Gestione di più richieste simultanee
- [ ] Nessun deadlock
- [ ] Risposta consistente

## 🔒 **TEST DI SICUREZZA**

### 1. Test di Autenticazione
- [ ] Endpoint protetti richiedono autenticazione
- [ ] Token JWT validi
- [ ] Sessioni scadute gestite correttamente

### 2. Test di Autorizzazione
- [ ] Solo admin possono accedere agli endpoint admin
- [ ] Utenti possono accedere solo ai propri dati
- [ ] Nessun accesso non autorizzato

### 3. Test di Input Validation
- [ ] Input malformati vengono rifiutati
- [ ] SQL injection prevenuta
- [ ] XSS prevenuto

## 📱 **TEST RESPONSIVE**

### 1. Breakpoints da Testare
- [ ] Mobile: 375px
- [ ] Tablet: 768px
- [ ] Desktop: 1200px
- [ ] Large Desktop: 1920px

### 2. Elementi da Verificare
- [ ] Layout si adatta correttamente
- [ ] Testo rimane leggibile
- [ ] Pulsanti sono cliccabili
- [ ] Menu funziona su mobile

## 🐛 **TROUBLESHOOTING**

### Errori Comuni

#### 1. "Cannot find module"
```bash
# Soluzione: Reinstalla le dipendenze
npm install
```

#### 2. "Port already in use"
```bash
# Soluzione: Termina il processo
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

#### 3. "Connection refused"
- Verifica che il server sia in esecuzione
- Controlla la porta
- Verifica le variabili d'ambiente

#### 4. "CORS error"
- Verifica la configurazione CORS
- Controlla gli header
- Testa con diversi browser

### Log da Controllare

#### Backend
- Console del server
- Log di Render
- Log del database

#### Frontend
- Console del browser
- Network tab
- Performance tab

## ✅ **CHECKLIST FINALE**

### Prima del Deploy
- [ ] Tutti i test locali passano
- [ ] Nessun errore nella console
- [ ] Performance accettabile
- [ ] Design responsive
- [ ] Sicurezza verificata

### Dopo il Deploy
- [ ] Test su Render passano
- [ ] Pagine accessibili pubblicamente
- [ ] API funzionanti
- [ ] Database connesso
- [ ] Log puliti

### Post-Deploy
- [ ] Monitoraggio attivo
- [ ] Backup configurato
- [ ] Alerting funzionante
- [ ] Documentazione aggiornata

## 🎯 **OBIETTIVI DI TEST**

- **Funzionalità**: 100% degli endpoint funzionanti
- **Performance**: < 3s tempo di caricamento
- **Sicurezza**: Nessuna vulnerabilità critica
- **Usabilità**: Design responsive e intuitivo
- **Affidabilità**: 99% uptime

## 📞 **SUPPORTO**

Se incontri problemi durante il testing:

1. Controlla i log per errori specifici
2. Verifica la configurazione
3. Testa con strumenti diversi
4. Consulta la documentazione
5. Contatta il team di sviluppo

---

**Buon testing! 🚀**
