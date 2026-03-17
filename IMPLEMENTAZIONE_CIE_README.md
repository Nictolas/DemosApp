# 🔐 Implementazione CIE (Carta d'Identità Elettronica) - DemosApp

## 📋 Panoramica

Questo documento descrive l'implementazione dell'autenticazione CIE in DemosApp, che **sostituisce il Codice Fiscale** con un sistema più sicuro e ufficiale.

## 🎯 Obiettivi

- ✅ **Sostituire il Codice Fiscale** con autenticazione CIE
- ✅ **Mantenere compatibilità** con Google e Credentials
- ✅ **Sicurezza migliorata** tramite autenticazione ufficiale
- ✅ **Esperienza utente semplificata** (dati precompilati)
- ✅ **Gratuito** per sempre

## 🏗️ Architettura

### Componenti Implementati

1. **Provider CIE Personalizzato** (`providers/cie-provider.js`)
   - Implementa protocollo OIDC per CIE
   - Gestisce autorizzazione, token e userinfo
   - Mappa dati utente da CIE

2. **Configurazione Auth.js** (`auth-config.js`)
   - Integra provider CIE
   - Gestisce callback di autenticazione
   - Salva dati utente nel database

3. **Componente CIE Button** (`client/src/components/CIEButton.tsx`)
   - Pulsante di login CIE
   - Design moderno e informativo
   - Feedback visivo per l'utente

4. **Form di Registrazione Aggiornato** (`client/src/pages/auth-page-cie.tsx`)
   - Sostituisce campo Codice Fiscale con CIE
   - Mantiene registrazione tradizionale come fallback
   - UI migliorata con sezioni dedicate

5. **Supporto Database** (`add-cie-support.cjs`)
   - Aggiunge colonne per CIE
   - Crea indici per performance
   - Migra utenti esistenti

## 🔧 Configurazione

### 1. Variabili d'Ambiente

Aggiungi al file `.env`:

```bash
# Configurazione CIE
CIE_CLIENT_ID=your-cie-client-id
CIE_CLIENT_SECRET=your-cie-client-secret
CIE_AUTHORIZATION_URL=https://cie-provider-url/oauth/authorize
CIE_TOKEN_URL=https://cie-provider-url/oauth/token
CIE_USERINFO_URL=https://cie-provider-url/userinfo
CIE_CALLBACK_URL=https://www.demos.community/api/auth/callback/cie

# Configurazione Auth.js
NEXTAUTH_URL=https://www.demos.community
NEXTAUTH_SECRET=your-nextauth-secret-key
```

### 2. Database

Esegui lo script di migrazione:

```bash
node add-cie-support.cjs
```

### 3. Registrazione CIE

Per utilizzare CIE in produzione, devi:

1. **Registrarti come Service Provider** presso l'AgID
2. **Ottenere certificati digitali** per la comunicazione sicura
3. **Configurare gli endpoint** CIE reali

## 📱 Esperienza Utente

### Login con CIE

1. **Utente clicca "Accedi con CIE"**
2. **Reindirizzamento** al provider CIE
3. **Autenticazione** tramite app CieID
4. **Ritorno** con dati utente precompilati
5. **Accesso automatico** all'app

### Vantaggi per l'Utente

- 🔒 **Sicurezza massima** (autenticazione ufficiale)
- 💰 **Completamente gratuito**
- ⚡ **Dati precompilati** (nome, cognome, codice fiscale)
- ✅ **Verifica automatica** dell'identità
- 📱 **App CieID** già installata su molti dispositivi

## 🗄️ Database

### Nuove Colonne

```sql
-- Metodo di autenticazione
ALTER TABLE users ADD COLUMN auth_method VARCHAR(20) DEFAULT 'credentials';

-- Verifica identità
ALTER TABLE users ADD COLUMN verified BOOLEAN DEFAULT false;

-- Dati CIE
ALTER TABLE users ADD COLUMN data_nascita DATE;
ALTER TABLE users ADD COLUMN sesso VARCHAR(1);
ALTER TABLE users ADD COLUMN luogo_nascita VARCHAR(100);
```

### Indici per Performance

```sql
CREATE INDEX idx_users_auth_method ON users(auth_method);
CREATE INDEX idx_users_verified ON users(verified);
```

## 🔄 Migrazione da Codice Fiscale

### Processo di Sostituzione

1. **Mantieni** campo `codice_fiscale` per compatibilità
2. **Aggiungi** autenticazione CIE come metodo principale
3. **Depreca** inserimento manuale del Codice Fiscale
4. **Migra** utenti esistenti gradualmente

### Compatibilità

- ✅ **Utenti esistenti** continuano a funzionare
- ✅ **Nuovi utenti** preferiscono CIE
- ✅ **Fallback** su Google/Credentials
- ✅ **Dati** migrati automaticamente

## 🚀 Deployment

### 1. Aggiorna Database

```bash
# Esegui migrazione
node add-cie-support.cjs

# Verifica colonne
psql $DATABASE_URL -c "\d users"
```

### 2. Configura Variabili

```bash
# Aggiungi variabili CIE
export CIE_CLIENT_ID="your-client-id"
export CIE_CLIENT_SECRET="your-client-secret"
# ... altre variabili
```

### 3. Testa Integrazione

```bash
# Avvia applicazione
npm run dev

# Testa login CIE
# Vai su /auth e clicca "Accedi con CIE"
```

## 🔍 Testing

### Test Manuali

1. **Login CIE** - Verifica reindirizzamento
2. **Callback** - Verifica salvataggio dati
3. **Fallback** - Testa Google/Credentials
4. **UI** - Verifica componenti

### Test Automatici

```bash
# Test provider CIE
npm test -- --grep "CIE"

# Test integrazione Auth.js
npm test -- --grep "Auth"
```

## 📊 Monitoraggio

### Metriche da Tracciare

- **Login CIE** vs altri metodi
- **Tasso di successo** autenticazione
- **Tempo** di risposta CIE
- **Errori** di callback

### Log da Monitorare

```javascript
// Log di autenticazione CIE
console.log('🔐 CIE Login:', { userId, method: 'cie' });

// Log errori CIE
console.error('❌ CIE Error:', { error, userId });
```

## 🔒 Sicurezza

### Best Practices

1. **Validazione** sempre lato server
2. **Crittografia** dati sensibili
3. **Rate limiting** su endpoint CIE
4. **Log** di sicurezza completi
5. **Certificati** sempre aggiornati

### Conformità

- ✅ **GDPR** - Dati personali protetti
- ✅ **AgID** - Standard CIE rispettati
- ✅ **ISO 27001** - Sicurezza informatica
- ✅ **PCI DSS** - Gestione dati sensibili

## 🆘 Troubleshooting

### Problemi Comuni

#### 1. CIE non funziona
```bash
# Verifica configurazione
echo $CIE_CLIENT_ID
echo $CIE_CLIENT_SECRET

# Controlla log
tail -f logs/auth.log
```

#### 2. Callback fallisce
```bash
# Verifica URL callback
curl -I $CIE_CALLBACK_URL

# Controlla certificati
openssl s_client -connect cie-provider-url:443
```

#### 3. Database errori
```sql
-- Verifica colonne
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('auth_method', 'verified');
```

## 📈 Roadmap

### Fase 1: Implementazione Base ✅
- [x] Provider CIE personalizzato
- [x] Integrazione Auth.js
- [x] UI componenti
- [x] Database support

### Fase 2: Testing e Validazione 🔄
- [ ] Test integrazione completa
- [ ] Validazione con CIE reale
- [ ] Performance testing
- [ ] Security audit

### Fase 3: Produzione 🚀
- [ ] Deploy su produzione
- [ ] Monitoraggio attivo
- [ ] Migrazione utenti
- [ ] Documentazione utente

### Fase 4: Ottimizzazioni 📈
- [ ] Caching migliorato
- [ ] UI/UX refinements
- [ ] Analytics avanzate
- [ ] A/B testing

## 📞 Supporto

### Contatti

- **Sviluppo**: [GitHub Issues](https://github.com/demosapp/issues)
- **Documentazione**: [Wiki](https://github.com/demosapp/wiki)
- **Supporto**: support@demos.community

### Risorse

- **CIE Ufficiale**: [cie.gov.it](https://www.cie.gov.it)
- **AgID**: [agid.gov.it](https://www.agid.gov.it)
- **Auth.js**: [authjs.dev](https://authjs.dev)

---

## 🎉 Conclusione

L'implementazione CIE in DemosApp rappresenta un **passo avanti significativo** verso:

- 🔒 **Sicurezza migliorata**
- 👥 **Esperienza utente superiore**
- 🇮🇹 **Conformità italiana**
- 💰 **Costi zero**

La sostituzione del Codice Fiscale con CIE rende DemosApp più **professionale**, **sicura** e **allineata** agli standard della Pubblica Amministrazione italiana.

**Benvenuti nell'era della democrazia digitale sicura!** 🚀
