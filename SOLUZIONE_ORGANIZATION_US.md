# 🔧 Soluzione: Organization in US - Come Procedere

## 📋 Situazione Attuale

Hai creato l'organization ma è finita in **US** invece che **EU**, e Axiom non ti permette di modificarla.

**Organization Details:**
- **ID**: `demos-istitute-2np7`
- **Region**: US ❌
- **Created**: 45 secondi fa

---

## ✅ Soluzione 1: Usa AXIOM_REGION=eu nel Codice (FUNZIONA SUBITO)

**Buone notizie**: Anche se l'organization è in US, puoi specificare la regione EU nel codice e i log verranno inviati agli endpoint EU!

### **Come Funziona:**

L'SDK Axiom rispetta il parametro `region` quando invii i log. Anche se l'organization è in US, se specifichi `region: 'eu'` nel codice, i log andranno agli endpoint EU.

### **Configurazione:**

1. **Nel file `.env`**, assicurati di avere:

```env
# Axiom Configuration
AXIOM_ENABLED=true
AXIOM_API_TOKEN=il-tuo-token
AXIOM_ORG_ID=demos-istitute-2np7
AXIOM_DATASET=demosapp-logs

# ⚠️ IMPORTANTE: Specifica EU qui
AXIOM_REGION=eu

# GDPR
AXIOM_ANONYMIZE=true
AXIOM_ANONYMIZE_USER_ID=true
EXPORT_HASH_SALT=your-secure-random-salt
```

2. **Il codice è già configurato correttamente!**

Verifica in `api/services/centralizedLogger.js` (riga 15):
```javascript
region: process.env.AXIOM_REGION || 'eu'  // ✅ Userà 'eu' dal .env
```

E in `api/services/auditService.js` (riga 12):
```javascript
region: process.env.AXIOM_REGION || 'eu'  // ✅ Userà 'eu' dal .env
```

### **Cosa Significa:**

- ✅ I log verranno inviati agli **endpoint EU** di Axiom
- ✅ I dati saranno processati in **Europa**
- ✅ Conformità GDPR per l'invio dei dati
- ⚠️ L'organization rimane in US (solo per billing/settings)

### **Verifica:**

Dopo aver configurato, testa:

```bash
node scripts/axiom-logger.js check
node scripts/axiom-logger.js test
```

Poi controlla su Axiom che i log arrivino correttamente.

---

## ✅ Soluzione 2: Contatta il Supporto Axiom (Per Spostare Organization)

Se vuoi che anche l'organization sia in EU (per billing/settings), contatta il supporto:

### **Email al Supporto:**

**A**: support@axiom.co  
**Oggetto**: `Request to change organization region from US to EU`

**Messaggio**:

```
Hi Axiom Support,

I just created an organization but it was set to US region instead of EU. 
I need the EU region for GDPR compliance.

Organization Details:
- ID: demos-istitute-2np7
- Name: [il nome della tua organization]
- Current Region: US
- Desired Region: EU
- Account Email: [tua email]

Could you please help me change the organization region to EU?

Thank you!

Best regards,
[Il tuo nome]
```

### **Cosa Può Fare il Supporto:**

- Cambiare la regione dell'organization da US a EU
- Oppure creare una nuova organization in EU e migrare i dati

---

## ✅ Soluzione 3: Crea Nuova Organization in EU (Se Supporto Non Può Aiutare)

Se il supporto non può cambiare la regione, puoi creare una nuova organization:

### **Passo 1: Contatta il Supporto**

Chiedi al supporto di:
1. Creare una nuova organization in EU
2. Migrare i dati dalla vecchia organization (se necessario)
3. Eliminare la vecchia organization US

### **Passo 2: Oppure Crea Manualmente**

1. Vai su **"Settings"** → **"Organizations"**
2. Clicca **"Create Organization"** (se disponibile)
3. Nome: `DemosApp EU`
4. **Regione**: Seleziona **"EU"** ⚠️ IMPORTANTE
5. Crea

### **Passo 3: Migra i Dati**

1. Crea il dataset `demosapp-logs` nella nuova organization
2. Crea un nuovo API Token
3. Aggiorna il `.env` con:
   - Nuovo Organization ID
   - Nuovo API Token
4. Sincronizza i log (se ne hai già inviati):
   ```bash
   node scripts/axiom-logger.js sync 30
   ```

---

## 🎯 Raccomandazione: Usa Soluzione 1 (Immediata)

**Per iniziare subito:**

1. ✅ **Usa `AXIOM_REGION=eu` nel `.env`** (funziona già!)
2. ✅ I log andranno agli endpoint EU
3. ✅ Conformità GDPR per l'invio dati
4. ✅ Nessuna modifica al codice necessaria

**Poi, se vuoi:**

5. Contatta il supporto per spostare anche l'organization in EU (opzionale)

---

## 📋 Configurazione Completa .env

Ecco la configurazione completa per il tuo caso:

```env
# ============================================
# AXIOM CONFIGURATION
# ============================================

# Abilita invio log ad Axiom
AXIOM_ENABLED=true

# API Token (crealo in Settings → API Tokens)
AXIOM_API_TOKEN=il-tuo-token-qui

# Organization ID (quello che hai: demos-istitute-2np7)
AXIOM_ORG_ID=demos-istitute-2np7

# Dataset
AXIOM_DATASET=demosapp-logs

# ⚠️ REGIONE EU - Anche se organization è in US, questo fa inviare i log agli endpoint EU
AXIOM_REGION=eu

# ============================================
# GDPR - Anonimizzazione
# ============================================

AXIOM_ANONYMIZE=true
AXIOM_ANONYMIZE_USER_ID=true
EXPORT_HASH_SALT=your-secure-random-salt-here
```

---

## ✅ Prossimi Passi

### **1. Crea Dataset**

1. Vai su Axiom dashboard
2. Clicca su **"Datasets"**
3. Clicca **"Create Dataset"**
4. Nome: `demosapp-logs`
5. Clicca **"Create"**

### **2. Crea API Token**

1. Vai su **"Settings"** → **"API Tokens"**
2. Clicca **"Create Token"**
3. Nome: `demosapp-production`
4. Permessi: ✅ **"Ingest"** e ✅ **"Query"**
5. Clicca **"Create"**
6. **COPIA IL TOKEN** (lo vedrai solo una volta!)

### **3. Configura .env**

Aggiungi al file `.env`:
```env
AXIOM_ENABLED=true
AXIOM_API_TOKEN=il-token-che-hai-copiato
AXIOM_ORG_ID=demos-istitute-2np7
AXIOM_DATASET=demosapp-logs
AXIOM_REGION=eu
```

### **4. Installa SDK (se non l'hai fatto)**

```bash
npm install @axiomhq/axiom-node
```

### **5. Verifica**

```bash
node scripts/axiom-logger.js check
```

**Output atteso:**
```
🔍 Verifica configurazione Axiom...

Configurazione:
  Dataset: demosapp-logs
  Region: eu  ✅
  Enabled: true
  Token: ✅ Configurato
  Org ID: ✅ Configurato

🧪 Test connessione Axiom...
✅ Configurazione Axiom corretta
```

### **6. Test Invio**

```bash
node scripts/axiom-logger.js test
```

### **7. Verifica su Axiom**

1. Vai su Axiom dashboard
2. Clicca su **"Datasets"** → **"demosapp-logs"**
3. Dovresti vedere il log di test

---

## 🆘 FAQ

### **Q: I log andranno veramente in EU anche se l'organization è in US?**
A: **SÌ**, se specifichi `AXIOM_REGION=eu` nel codice, l'SDK invierà i log agli endpoint EU. L'organization in US riguarda solo billing/settings, non dove vengono inviati i log.

### **Q: È GDPR compliant?**
A: **SÌ**, i log vengono inviati e processati in EU. L'organization in US è solo per gestione account.

### **Q: Devo cambiare l'organization in EU?**
A: **Non è necessario** per la conformità GDPR dei log. Ma se vuoi, puoi contattare il supporto.

### **Q: Cosa succede se contatto il supporto?**
A: Potrebbero cambiare la regione dell'organization da US a EU, oppure creare una nuova organization in EU.

---

## 🎯 Conclusione

**Per iniziare subito:**
1. ✅ Usa `AXIOM_REGION=eu` nel `.env`
2. ✅ Crea dataset e token
3. ✅ Configura e testa

**I log andranno in EU anche se l'organization è in US!** 🚀

Poi, se vuoi, puoi contattare il supporto per spostare anche l'organization in EU (opzionale).



