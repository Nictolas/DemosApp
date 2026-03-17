# ✅ Checklist Setup Autenticazione CIE

## 📋 SQL da Eseguire

### Opzione 1: SQL Diretto (Consigliato)

Esegui questo SQL direttamente sul tuo database Neon:

```sql
-- Aggiungi colonna fiscal_number (se non esiste già)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS fiscal_number VARCHAR(20);

-- Aggiungi constraint UNIQUE per fiscal_number
-- IMPORTANTE: Rimuovi il commento se vuoi che fiscal_number sia univoco
-- Se hai già dati nella tabella, assicurati che non ci siano duplicati prima!
ALTER TABLE users ADD CONSTRAINT unique_fiscal_number UNIQUE (fiscal_number);

-- Crea indice per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_users_fiscal_number 
ON users(fiscal_number);
```

**Nota sul UNIQUE:** 
- Se la tabella `users` è già popolata, verifica prima che non ci siano duplicati
- Se preferisci permettere valori NULL duplicati, non aggiungere il constraint UNIQUE
- Lo script Node.js (`add-fiscal-number-column.cjs`) aggiunge UNIQUE automaticamente

### Opzione 2: Script Node.js

Esegui lo script automatico:

```bash
node add-fiscal-number-column.cjs
```

Questo script:
- Verifica se la colonna esiste già
- Aggiunge la colonna con constraint UNIQUE
- Crea l'indice
- Gestisce gli errori automaticamente

## 🔧 Configurazione Variabili d'Ambiente

Aggiungi queste variabili al tuo file `.env`:

### Per Sviluppo (con Mock Server)

```env
# Ambiente
NODE_ENV=development
USE_MOCK_CIE=true

# Mock Server (usa il server interno)
CIE_ISSUER_URL=http://localhost:3001/api/auth/mock-cie
CIE_CLIENT_ID=mock-client-id
CIE_CLIENT_SECRET=mock-client-secret
CIE_REDIRECT_URI=http://localhost:3001/api/auth/cie/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Per Produzione (con Provider CIE Reale)

```env
# Ambiente
NODE_ENV=production

# Provider CIE Reale (URL fornito dal Ministero dell'Interno)
CIE_ISSUER_URL=https://cie-provider-url
CIE_CLIENT_ID=your-real-cie-client-id
CIE_CLIENT_SECRET=your-real-cie-client-secret
CIE_REDIRECT_URI=https://www.demos.community/api/auth/cie/callback

# Frontend URL
FRONTEND_URL=https://www.demos.community
```

**Nota:** Puoi anche usare `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI` invece delle variabili `CIE_*` (hanno priorità se presenti).

## ✅ Checklist Completa

### 1. Database ✅
- [ ] Eseguito SQL per aggiungere colonna `fiscal_number`
- [ ] Verificato che la colonna esista: `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'fiscal_number';`
- [ ] Verificato che l'indice sia stato creato

### 2. Variabili d'Ambiente ✅
- [ ] Aggiunto `CIE_ISSUER_URL` (o `OIDC_ISSUER_URL`)
- [ ] Aggiunto `CIE_CLIENT_ID` (o `OIDC_CLIENT_ID`)
- [ ] Aggiunto `CIE_CLIENT_SECRET` (o `OIDC_CLIENT_SECRET`)
- [ ] Aggiunto `CIE_REDIRECT_URI` (o `OIDC_REDIRECT_URI`)
- [ ] Aggiunto `FRONTEND_URL`
- [ ] Se in sviluppo: aggiunto `USE_MOCK_CIE=true`

### 3. Test Backend ✅
- [ ] Riavviato il server backend
- [ ] Verificato che il Mock Server sia attivo (solo in development):
  ```
  GET http://localhost:3001/api/auth/mock-cie/.well-known/openid-configuration
  ```
- [ ] Verificato endpoint status CIE:
  ```
  GET http://localhost:3001/api/auth/cie/status
  ```

### 4. Test Flusso Completo ✅
- [ ] Visitato `http://localhost:3001/api/auth/cie/login` in development
- [ ] Completato il flusso di autenticazione mock
- [ ] Verificato che l'utente sia stato creato nel database:
  ```sql
  SELECT id, email, nome, cognome, fiscal_number, auth_method, verified 
  FROM users 
  WHERE fiscal_number = 'MCHNLS90L11G702W';
  ```

### 5. Frontend (da implementare) ⚠️
- [ ] Creare pagina/bottone "Accedi con CIE" nel frontend
- [ ] Implementare redirect a `/api/auth/cie/login`
- [ ] Gestire callback da `/api/auth/cie/callback` con token
- [ ] Salvare token nel localStorage/sessionStorage
- [ ] Aggiornare stato autenticazione

## 🧪 Test Rapido

### Test Mock Server

1. Visita nel browser:
   ```
   http://localhost:3001/api/auth/mock-cie/authorize?client_id=test&redirect_uri=http://localhost:3000/callback&response_type=code&state=test123
   ```

2. Dovresti vedere una pagina con bottone "Entra come Nicolas"

3. Clicca il bottone

4. Dovresti essere reindirizzato a `http://localhost:3000/callback?code=...&state=test123`

### Test Flusso Completo

1. Visita: `http://localhost:3001/api/auth/cie/login`

2. Dovresti essere reindirizzato alla pagina mock di autorizzazione

3. Clicca "Entra come Nicolas"

4. Dovresti essere reindirizzato al frontend con token:
   ```
   FRONTEND_URL/auth/cie/callback?accessToken=...&refreshToken=...&success=true
   ```

## 🔍 Verifica Database

Dopo il primo login di test, verifica che l'utente sia stato creato:

```sql
-- Verifica utente creato
SELECT 
  id, 
  email, 
  nome, 
  cognome, 
  fiscal_number, 
  auth_method, 
  verified,
  status,
  created_at
FROM users 
WHERE fiscal_number = 'MCHNLS90L11G702W';
```

Dovresti vedere:
- `fiscal_number = 'MCHNLS90L11G702W'` (senza prefisso TINIT-)
- `auth_method = 'cie'`
- `verified = true`
- `status = 'a'` (attivo)

## 🚨 Troubleshooting

### Errore: "Colonna fiscal_number già esiste"
- ✅ Normale se hai già eseguito lo script
- La colonna è già presente, puoi procedere

### Errore: "Constraint unique_fiscal_number già esiste"
- ✅ Normale se hai già eseguito lo script
- Il constraint è già presente, puoi procedere

### Mock Server non disponibile
- Verifica che `NODE_ENV=development` o `USE_MOCK_CIE=true`
- Riavvia il server backend

### Errore: "Configurazione OIDC incompleta"
- Verifica che tutte le variabili d'ambiente siano presenti
- Controlla che non ci siano spazi o caratteri speciali

### Errore: "Token di accesso non valido"
- Verifica che l'`access_token` sia stato ricevuto correttamente
- Controlla i log del backend per dettagli

## 📝 Note Finali

1. **Il sistema NON sostituisce** l'autenticazione email/password esistente
2. **Il Mock Server è solo per sviluppo** - non usarlo in produzione
3. **Per produzione** serve l'accreditamento ufficiale con il Ministero dell'Interno
4. La colonna `fiscal_number` è **unica** (se hai aggiunto il constraint)
5. Il sistema normalizza automaticamente il `fiscal_number` (rimuove prefisso `TINIT-`)

## 🎯 Prossimi Passi

1. ✅ Esegui il SQL per aggiungere la colonna
2. ✅ Configura le variabili d'ambiente
3. ✅ Testa il backend
4. ⚠️ Implementa il frontend per il login CIE
5. ⚠️ Quando pronto per produzione: ottieni accreditamento CIE e aggiorna le variabili d'ambiente

