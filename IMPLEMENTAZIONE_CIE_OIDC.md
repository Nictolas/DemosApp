# 🔐 Implementazione Autenticazione CIE tramite OIDC

## 📋 Riepilogo

È stato implementato un sistema completo di autenticazione tramite CIE (Carta d'Identità Elettronica) usando il protocollo standard OpenID Connect (OIDC).

### ✅ Componenti Implementati

1. **Mock Server OIDC** (`api/routes/auth/mock-cie.js`)
   - Simula un Identity Provider OIDC standard per lo sviluppo
   - Attivo solo se `NODE_ENV === 'development'` o `USE_MOCK_CIE === 'true'`
   - Endpoints: `/authorize`, `/token`, `/userinfo`, `/.well-known/openid-configuration`

2. **Controller CIE Reale** (`api/routes/auth/cie.js`)
   - Implementa il flusso OIDC Authorization Code Flow
   - Gestisce la callback dall'Identity Provider
   - Crea/aggiorna utenti nel database basandosi su `fiscal_number`

3. **Logica Database**
   - Script per aggiungere colonna `fiscal_number` (`add-fiscal-number-column.cjs`)
   - Gestione automatica utenti esistenti/nuovi basata su `fiscal_number`
   - Generazione token JWT per sessioni

## 🚀 Setup

### 1. Database

Esegui lo script per aggiungere la colonna `fiscal_number`:

```bash
node add-fiscal-number-column.cjs
```

Questo script:
- Aggiunge la colonna `fiscal_number VARCHAR(20) UNIQUE` alla tabella `users`
- Crea un indice per migliorare le performance delle query

### 2. Variabili d'Ambiente

Aggiungi queste variabili al tuo file `.env`:

#### Per Sviluppo (con Mock Server)

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

#### Per Produzione (con Provider CIE Reale)

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

## 📡 Endpoints Disponibili

### Mock Server (solo in development)

- `GET /api/auth/mock-cie/authorize` - Pagina di autorizzazione mock
- `POST /api/auth/mock-cie/authorize` - Conferma autorizzazione
- `POST /api/auth/mock-cie/token` - Genera access token
- `GET /api/auth/mock-cie/userinfo` - Dati utente mock
- `GET /api/auth/mock-cie/.well-known/openid-configuration` - Discovery OIDC

### Controller CIE Reale

- `GET /api/auth/cie/login` - Inizia il flusso OIDC (redirect a Identity Provider)
- `GET /api/auth/cie/callback` - Gestisce la callback dall'Identity Provider
- `GET /api/auth/cie/status` - Verifica stato configurazione CIE

## 🔄 Flusso di Autenticazione

### 1. Utente clicca "Accedi con CIE"

Il frontend fa una richiesta a:
```
GET /api/auth/cie/login
```

### 2. Redirect all'Identity Provider

Il backend reindirizza l'utente all'Identity Provider (mock o reale) con:
- `response_type=code`
- `client_id`
- `redirect_uri`
- `state` (per CSRF protection)
- `code_challenge` (PKCE)

### 3. Autenticazione Utente

L'utente si autentica tramite:
- **Mock**: Clicca "Entra come Nicolas" nella pagina HTML
- **Reale**: Usa l'app CieID o il lettore di smart card

### 4. Callback con Authorization Code

L'Identity Provider reindirizza a:
```
GET /api/auth/cie/callback?code=AUTHORIZATION_CODE&state=STATE
```

### 5. Scambio Token

Il backend:
1. Verifica lo `state` (CSRF protection)
2. Scambia l'authorization code con un access token
3. Recupera i dati utente tramite `/userinfo`
4. Cerca o crea l'utente nel database basandosi su `fiscal_number`
5. Genera token JWT per la sessione
6. Reindirizza al frontend con i token

### 6. Redirect al Frontend

Il backend reindirizza a:
```
FRONTEND_URL/auth/cie/callback?accessToken=TOKEN&refreshToken=REFRESH_TOKEN&success=true
```

## 🗄️ Gestione Database

### Creazione/Login Utente

Quando il backend riceve i dati dall'Identity Provider:

1. **Estrae `fiscal_number`** dai dati utente
2. **Cerca utente esistente** nella tabella `users` per `fiscal_number`
3. **Se esiste:**
   - Aggiorna `updated_at`
   - Genera token JWT
   - Logga l'utente
4. **Se non esiste:**
   - Crea nuovo utente con:
     - `fiscal_number` (normalizzato, senza prefisso `TINIT-`)
     - `nome` e `cognome` da `given_name` e `family_name`
     - `email` (da `userInfo.email` o generata come `fiscal_number@cie.local`)
     - `status = 'a'` (attivo)
     - `auth_method = 'cie'`
     - `verified = true`
   - Genera token JWT
   - Logga l'utente

### Dati Utente Mock

Il Mock Server restituisce sempre questi dati fissi:

```json
{
  "sub": "123456",
  "given_name": "Nicolas",
  "family_name": "Micheletti",
  "fiscal_number": "TINIT-MCHNLS90L11G702W"
}
```

## 🔒 Sicurezza

- **CSRF Protection**: Uso di `state` parameter
- **PKCE**: Code challenge/verifier per prevenire attacchi
- **One-time Authorization Codes**: I codici vengono invalidati dopo l'uso
- **Token Scadenza**: Access token scadono dopo 1 ora
- **HTTPS in Produzione**: Obbligatorio per il provider CIE reale

## 🧪 Testing

### Test Mock Server

1. Avvia il server in modalità development:
   ```bash
   NODE_ENV=development npm start
   ```

2. Visita:
   ```
   http://localhost:3001/api/auth/mock-cie/authorize?client_id=test&redirect_uri=http://localhost:3000/callback&response_type=code&state=test123
   ```

3. Clicca "Entra come Nicolas"

4. Verifica il redirect con `code` e `state`

### Test Flusso Completo

1. Configura le variabili d'ambiente per il mock
2. Visita: `http://localhost:3001/api/auth/cie/login`
3. Completa il flusso di autenticazione
4. Verifica che l'utente sia creato nel database con `fiscal_number = 'MCHNLS90L11G702W'`

## 📝 Note Importanti

1. **NON sostituisce** l'attuale sistema di autenticazione email/password
2. Il Mock Server è **solo per sviluppo** - non usarlo in produzione
3. Per produzione, è necessario l'**accreditamento ufficiale** con il Ministero dell'Interno
4. La colonna `fiscal_number` deve essere **unica** nel database
5. Il sistema gestisce automaticamente la normalizzazione del `fiscal_number` (rimuove prefisso `TINIT-`)

## 🔗 Riferimenti

- [OpenID Connect Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [CIE - Carta d'Identità Elettronica](https://www.cartaidentita.interno.gov.it/)
- [AgID - Servizi CIE](https://www.agid.gov.it/it/piattaforme/carta-identita-elettronica)

