# 🚀 Setup Axiom - Guida Passo-Passo Dettagliata

## 📋 Indice
1. [Creazione Account Axiom](#1-creazione-account-axiom)
2. [Selezione/Cambio Regione EU](#2-selezione-cambio-regione-eu)
3. [Creazione Dataset](#3-creazione-dataset)
4. [Creazione API Token](#4-creazione-api-token)
5. [Configurazione Progetto](#5-configurazione-progetto)

---

## 1. Creazione Account Axiom

### **Passo 1.1: Vai al Sito Axiom**

1. Apri il browser
2. Vai su: **https://axiom.co/**
3. Clicca sul pulsante **"Sign Up"** o **"Get Started"** (in alto a destra)

### **Passo 1.2: Scegli Metodo di Registrazione**

Axiom ti permette di registrarti con:
- **Email** (consigliato)
- **GitHub**
- **Google**

**Scegli il metodo che preferisci** e completa la registrazione.

### **Passo 1.3: Completa la Registrazione**

1. Se hai scelto **Email**:
   - Inserisci la tua email
   - Inserisci una password sicura
   - Clicca su **"Sign Up"** o **"Create Account"**
   - Verifica la tua email (controlla la casella di posta)

2. Se hai scelto **GitHub/Google**:
   - Autorizza Axiom ad accedere al tuo account
   - Completa eventuali passaggi aggiuntivi

### **Passo 1.4: Login**

1. Dopo la verifica, fai login su Axiom
2. Potresti vedere una schermata di benvenuto o essere portato direttamente alla dashboard

---

## 2. Selezione/Cambio Regione EU

### **⚠️ IMPORTANTE: La Regione si Configura DOPO la Registrazione**

Axiom **NON** ti permette di selezionare la regione durante la registrazione. Devi configurarla dopo.

### **Passo 2.1: Accedi alle Impostazioni**

1. Dopo il login, guarda in **alto a destra** della schermata
2. Clicca sul tuo **avatar/profilo** (icona circolare con iniziali o foto)
3. Nel menu a tendina, clicca su **"Settings"** o **"Organization Settings"**

**OPPURE**

1. Guarda il menu laterale **sinistro**
2. Cerca l'icona **⚙️ Settings** o **"Settings"**
3. Clicca su **"Settings"**

### **Passo 2.2: Vai a Organization Settings**

1. Nella pagina Settings, cerca il menu laterale o le tab
2. Clicca su **"Organization"** o **"Organization Settings"**

### **Passo 2.3: Verifica/Cambia Regione**

1. Nella sezione **"Organization"**, cerca:
   - **"Region"**
   - **"Data Region"**
   - **"Organization Region"**

2. **Se vedi la regione:**
   - Se è **"US"** o **"United States"**, devi cambiarla
   - Se è **"EU"** o **"Europe"**, sei già a posto! ✅

3. **Se NON vedi l'opzione per cambiare regione:**
   - La regione potrebbe essere bloccata dopo la creazione
   - **Soluzione**: Devi creare una nuova organization nella regione EU

### **Passo 2.4: Creare Nuova Organization in EU (se necessario)**

Se non puoi cambiare la regione, crea una nuova organization:

1. Vai su **"Settings"** → **"Organizations"** (se disponibile)
2. Clicca su **"Create Organization"** o **"New Organization"**
3. Nome: `DemosApp EU` (o un nome a tua scelta)
4. **Regione**: Seleziona **"EU"** o **"Europe"**
5. Clicca **"Create"**

**OPPURE**

1. Contatta il supporto Axiom:
   - Email: support@axiom.co
   - Oppure usa il chat support nella dashboard
   - Chiedi: "I need to change my organization region to EU" o "I need to create an organization in EU region"

### **Passo 2.5: Verifica Regione**

1. Dopo aver configurato la regione EU, verifica:
   - Vai su **"Settings"** → **"Organization"**
   - Controlla che la regione sia **"EU"** o **"Europe"**
   - **Copia l'Organization ID** (ti servirà dopo)

---

## 3. Creazione Dataset

### **Passo 3.1: Vai alla Sezione Datasets**

1. Nel menu laterale **sinistro**, cerca **"Datasets"**
2. Clicca su **"Datasets"**

### **Passo 3.2: Crea Nuovo Dataset**

1. Clicca sul pulsante **"Create Dataset"** o **"New Dataset"** (in alto a destra)
2. Si aprirà un form o una finestra modale

### **Passo 3.3: Configura Dataset**

1. **Nome Dataset**: Inserisci `demosapp-logs`
   - ⚠️ **IMPORTANTE**: Usa questo nome esatto (o ricorda quello che scegli)
   
2. **Descrizione** (opzionale): 
   - Es: "Log centralizzati e audit logs per DemosApp"

3. **Retention** (opzionale):
   - Default: 95 giorni (già ottimale)
   - Puoi lasciare il default

4. Clicca su **"Create"** o **"Create Dataset"**

### **Passo 3.4: Verifica Dataset Creato**

1. Dovresti vedere il dataset `demosapp-logs` nella lista
2. Clicca sul dataset per aprirlo
3. Dovresti vedere una schermata vuota (è normale, non ci sono ancora log)

---

## 4. Creazione API Token

### **Passo 4.1: Vai a API Tokens**

1. Vai su **"Settings"** (icona ⚙️ o menu in alto a destra)
2. Nel menu laterale, cerca **"API Tokens"** o **"Tokens"**
3. Clicca su **"API Tokens"**

### **Passo 4.2: Crea Nuovo Token**

1. Clicca sul pulsante **"Create Token"** o **"New Token"** (in alto a destra)
2. Si aprirà un form

### **Passo 4.3: Configura Token**

1. **Nome Token**: 
   - Es: `demosapp-production` o `demosapp-logs-token`
   - Scegli un nome descrittivo

2. **Descrizione** (opzionale):
   - Es: "Token per invio log da DemosApp"

3. **Permessi (Permissions)**:
   - ✅ **Seleziona "Ingest"** (per inviare log)
   - ✅ **Seleziona "Query"** (per leggere log)
   - ⚠️ **IMPORTANTE**: Seleziona entrambi!

4. **Scadenza (Expiration)** (opzionale):
   - Puoi lasciare vuoto (token permanente)
   - Oppure imposta una data futura

5. Clicca su **"Create"** o **"Create Token"**

### **Passo 4.4: Copia il Token**

1. **⚠️ ATTENZIONE**: Il token viene mostrato **SOLO UNA VOLTA**
2. **COPIA IL TOKEN** immediatamente
3. Incollalo in un file di testo temporaneo o password manager
4. **NON CONDIVIDERE** il token con nessuno
5. Clicca su **"Done"** o **"Close"**

**Esempio token**: `<REDACTED_API_KEY>`

---

## 5. Configurazione Progetto

### **Passo 5.1: Ottieni Organization ID**

1. Vai su **"Settings"** → **"Organization"**
2. Cerca **"Organization ID"** o **"Org ID"**
3. **COPIA L'Organization ID**
   - Es: `abc123def456` o `org-abc123def456`

### **Passo 5.2: Installa SDK Axiom**

Apri il terminale nella root del progetto e esegui:

```bash
npm install @axiomhq/axiom-node
```

**Output atteso:**
```
+ @axiomhq/axiom-node@x.x.x
added 1 package in 2s
```

### **Passo 5.3: Configura File .env**

1. Apri il file `.env` nella root del progetto
2. Se non esiste, crealo
3. Aggiungi queste righe:

```env
# ============================================
# AXIOM CONFIGURATION - REGIONE EU
# ============================================

# Abilita/disabilita invio log ad Axiom
AXIOM_ENABLED=true

# API Token Axiom (sostituisci con il token copiato)
AXIOM_API_TOKEN=<REDACTED_API_KEY>

# Organization ID Axiom (sostituisci con l'ID copiato)
AXIOM_ORG_ID=abc123def456

# Dataset Axiom
AXIOM_DATASET=demosapp-logs

# ⚠️ REGIONE: 'eu' per Europa (GDPR compliant)
AXIOM_REGION=eu

# ============================================
# GDPR - Anonimizzazione Dati
# ============================================

# Anonimizza IP address (solo rete, es. 192.168.1.0)
AXIOM_ANONYMIZE=true

# Hash user_id con SHA-256 (pseudonimizzazione)
AXIOM_ANONYMIZE_USER_ID=true

# Salt per hash (genera un valore casuale sicuro)
EXPORT_HASH_SALT=your-secure-random-salt-here
```

4. **Sostituisci**:
   - `xaat-abc123...` con il tuo **API Token** reale
   - `abc123def456` con il tuo **Organization ID** reale
   - `your-secure-random-salt-here` con un valore casuale (es: `openssl rand -hex 32`)

### **Passo 5.4: Verifica Configurazione**

Esegui nel terminale:

```bash
node scripts/axiom-logger.js check
```

**Output atteso:**
```
🔍 Verifica configurazione Axiom...

Configurazione:
  Dataset: demosapp-logs
  Region: eu
  Enabled: true
  Token: ✅ Configurato
  Org ID: ✅ Configurato

🧪 Test connessione Axiom...
✅ Configurazione Axiom corretta
```

### **Passo 5.5: Test Invio Log**

Esegui:

```bash
node scripts/axiom-logger.js test
```

**Output atteso:**
```
✅ 1 log inviati a Axiom
```

### **Passo 5.6: Verifica su Axiom**

1. Vai su Axiom dashboard
2. Clicca su **"Datasets"** → **"demosapp-logs"**
3. Dovresti vedere il log di test che hai appena inviato
4. Se lo vedi, **tutto funziona!** ✅

---

## 🆘 Risoluzione Problemi

### **Problema: Non vedo l'opzione per cambiare regione**

**Soluzione 1**: Contatta il supporto Axiom
- Email: support@axiom.co
- Chat: Cerca "Support" o "Help" nella dashboard
- Chiedi: "I need to change my organization region to EU for GDPR compliance"

**Soluzione 2**: Crea una nuova organization
- Vai su Settings → Organizations
- Crea nuova organization con regione EU
- Usa questa organization per il progetto

### **Problema: Errore "Invalid token"**

**Verifica**:
1. Il token è stato copiato correttamente (senza spazi)
2. Il token ha i permessi "Ingest" e "Query"
3. Il token non è scaduto

**Soluzione**: Crea un nuovo token e aggiorna il `.env`

### **Problema: Errore "Region mismatch"**

**Verifica**:
1. L'Organization ID è corretto
2. L'organization è nella regione EU
3. Nel `.env` hai `AXIOM_REGION=eu`

**Soluzione**: 
- Verifica la regione dell'organization su Axiom
- Se è US, contatta il supporto per cambiarla

### **Problema: "Axiom SDK non installato"**

**Soluzione**:
```bash
npm install @axiomhq/axiom-node
```

### **Problema: Log non appaiono su Axiom**

**Verifica**:
1. `AXIOM_ENABLED=true` nel `.env`
2. Token e Organization ID sono corretti
3. Il dataset esiste e si chiama correttamente

**Test**:
```bash
node scripts/axiom-logger.js check
node scripts/axiom-logger.js test
```

---

## 📋 Checklist Finale

- [ ] Account Axiom creato
- [ ] Organization configurata in regione **EU**
- [ ] Organization ID copiato
- [ ] Dataset `demosapp-logs` creato
- [ ] API Token creato con permessi "Ingest" e "Query"
- [ ] API Token copiato (salvato in modo sicuro)
- [ ] SDK installato: `npm install @axiomhq/axiom-node`
- [ ] File `.env` configurato con tutte le variabili
- [ ] Test configurazione: `node scripts/axiom-logger.js check` ✅
- [ ] Test invio: `node scripts/axiom-logger.js test` ✅
- [ ] Log visibile su Axiom dashboard ✅

---

## 📞 Supporto Axiom

Se hai problemi con la configurazione della regione:

- **Email**: support@axiom.co
- **Documentazione**: https://axiom.co/docs
- **Community**: https://github.com/axiomhq

**Messaggio da inviare al supporto**:
```
Hi,

I need to configure my Axiom organization to use the EU region for GDPR compliance. 
Could you please help me either:
1. Change my current organization region to EU, or
2. Create a new organization in the EU region?

Organization name: [il tuo nome organization]
Current region: [se lo conosci]

Thank you!
```

---

**🎉 Una volta completati tutti i passi, i log verranno inviati automaticamente ad Axiom con regione EU!**

