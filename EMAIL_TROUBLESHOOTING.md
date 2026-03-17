# Troubleshooting Email Reset Password - DEMOS Community

## Problemi Identificati

### 1. Email non arrivano per `chiara.nardone0@gmail.com`
**Sintomi:**
- L'utente `nicolasmicheletti90@gmail.com` riceve le email correttamente
- L'utente `chiara.nardone0@gmail.com` non riceve email (nemmeno in spam)

**Possibili Cause:**
1. **Problemi di deliverability** - L'email potrebbe essere bloccata dal provider
2. **Configurazione Resend** - Problemi con l'API key o configurazione
3. **Rate limiting** - Troppe richieste per lo stesso indirizzo
4. **Problemi di autenticazione** - L'utente potrebbe non esistere nel database

### 2. Cambio di mittente e estetica
**Sintomi:**
- **Prima**: Mittente "Demos Community" con estetica carina
- **Ora**: Mittente "onboarding@resend.dev" con estetica semplice

**Cause:**
1. **Configurazione Resend** - Il mittente è impostato su `onboarding@resend.dev` di default
2. **Template email** - Il template attuale è molto semplice

## Soluzioni Implementate

### 1. Logging Dettagliato
- Aggiunto logging completo per il processo di reset password
- Tracciamento di ogni step: verifica utente, generazione token, invio email
- Log dettagliati degli errori per facilitare il debug

### 2. Estetica Email Migliorata
- **Header con gradiente** - Design moderno e accattivante
- **Pulsante principale** - Call-to-action prominente con ombreggiatura
- **Sezioni informative** - Box colorati per avvisi di sicurezza
- **Footer professionale** - Branding DEMOS Community
- **Responsive design** - Ottimizzato per mobile e desktop

### 3. Configurazione Mittente Corretta
- **Mittente**: `Demos Community <onboarding@resend.dev>`
- **Oggetto**: `Reset Password - Demos Community`
- **Branding**: Consistente con l'identità visiva dell'app

### 4. Endpoint di Test
- **`/api/candidati-resend`** - Verifica configurazione Resend
- **`/api/candidati-resend-email`** - Test invio email specifiche

## Procedure di Debug

### Step 1: Verificare Configurazione
```bash
# Test configurazione Resend
curl -X GET https://your-api-domain/api/candidati-resend
```

### Step 2: Test Invio Email
```bash
# Test invio email specifica
curl -X POST https://your-api-domain/api/candidati-resend-email \
  -H "Content-Type: application/json" \
  -d '{"email": "chiara.nardone0@gmail.com"}'
```

### Step 3: Verificare Log
Controllare i log dell'API per:
- Verifica esistenza utente nel database
- Generazione token
- Errori di invio email
- Dettagli completi degli errori

### Step 4: Verificare Database
```sql
-- Verificare se l'utente esiste
SELECT id, nome, cognome, email FROM users WHERE email = 'chiara.nardone0@gmail.com';

-- Verificare colonne reset password
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('reset_token', 'reset_token_expires');
```

## Configurazione Variabili d'Ambiente

### File `.env` Richiesto
```env
# Configurazione Email (Resend)
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=Demos Community <onboarding@resend.dev>

# Configurazione Frontend
FRONTEND_URL=https://www.demos.community

# Configurazione Database
DATABASE_URL=postgresql://username:password@host:port/database

# Configurazione JWT
JWT_SECRET=[REDACTED_JWT_SECRET]
```

## Checklist di Verifica

### ✅ Configurazione Base
- [ ] `RESEND_API_KEY` configurata correttamente
- [ ] `EMAIL_FROM` impostato su `Demos Community <onboarding@resend.dev>`
- [ ] `DATABASE_URL` funzionante
- [ ] `JWT_SECRET` configurato

### ✅ Database
- [ ] Tabella `users` esiste
- [ ] Colonne `reset_token` e `reset_token_expires` presenti
- [ ] Utente `chiara.nardone0@gmail.com` esiste nel database

### ✅ API
- [ ] Endpoint `/api/auth/forgot-password` funzionante
- [ ] Endpoint `/api/candidati-resend` funzionante
- [ ] Endpoint `/api/candidati-resend-email` funzionante

### ✅ Email
- [ ] Template HTML renderizzato correttamente
- [ ] Mittente visualizzato come "Demos Community"
- [ ] Estetica moderna e professionale
- [ ] Link di reset funzionante

## Risoluzione Problemi Comuni

### Problema: "Resend non è disponibile"
**Soluzione:**
1. Verificare che `RESEND_API_KEY` sia configurata
2. Verificare che il pacchetto `resend` sia installato
3. Riavviare l'applicazione

### Problema: "Token non valido o scaduto"
**Soluzione:**
1. Verificare che `JWT_SECRET` sia configurato correttamente
2. Verificare che l'orario del server sia sincronizzato
3. Controllare che il token non sia scaduto (1 ora)

### Problema: "Errore nell'invio dell'email"
**Soluzione:**
1. Verificare la validità della `RESEND_API_KEY`
2. Controllare i log per errori specifici
3. Verificare che l'email di destinazione sia valida
4. Controllare eventuali rate limiting di Resend

## Monitoraggio e Manutenzione

### Log da Monitorare
- Richieste di reset password
- Errori di invio email
- Problemi di database
- Rate limiting

### Metriche da Tracciare
- Numero di richieste reset password
- Tasso di successo invio email
- Tempo di risposta API
- Errori per utente/email

### Manutenzione Periodica
- Verifica validità `RESEND_API_KEY`
- Controllo log per pattern di errore
- Aggiornamento template email
- Verifica configurazione database

## Contatti e Supporto

Per problemi persistenti:
1. Controllare i log dell'API
2. Verificare la configurazione Resend
3. Testare con endpoint di debug
4. Controllare la documentazione Resend per best practices
