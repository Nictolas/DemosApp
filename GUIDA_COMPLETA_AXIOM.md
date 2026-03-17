# 🚀 Guida Completa: Configurazione Axiom con Regione EU

## 📋 Indice

1. [Creazione Account e Configurazione](#1-creazione-account-e-configurazione)
2. [Spazio Disponibile (Tier Gratuito)](#2-spazio-disponibile-tier-gratuito)
3. [Configurazione Regione EU](#3-configurazione-regione-eu)
4. [Installazione e Setup](#4-installazione-e-setup)
5. [Caricamento Log](#5-caricamento-log)
6. [Integrazione Audit Logs](#6-integrazione-audit-logs)
7. [Verifica e Monitoraggio](#7-verifica-e-monitoraggio)

---

## 1. Creazione Account e Configurazione

### **Passo 1.1: Crea Account Axiom**

1. Vai su: **https://axiom.co/**
2. Clicca su **"Sign Up"** o **"Get Started"**
3. Registrati con email o GitHub/Google
4. **IMPORTANTE**: Durante la registrazione, seleziona la regione **EU (Europe)**

### **Passo 1.2: Crea Dataset**

1. Dopo il login, vai su **"Datasets"** nel menu laterale
2. Clicca su **"Create Dataset"**
3. Nome dataset: `demosapp-logs` (o un nome a tua scelta)
4. Clicca **"Create"**

### **Passo 1.3: Ottieni Credenziali**

1. Vai su **"Settings"** → **"API Tokens"**
2. Clicca su **"Create Token"**
3. Nome token: `demosapp-production` (o un nome descrittivo)
4. Permessi: Seleziona **"Ingest"** e **"Query"**
5. Clicca **"Create"**
6. **COPIA IL TOKEN** (lo vedrai solo una volta!)

7. Vai su **"Settings"** → **"Organization"**
8. **COPIA L'Organization ID** (es. `abc123def456`)

---

## 2. Spazio Disponibile (Tier Gratuito)

### **Tier Gratuito Axiom:**

✅ **Ingestione**: 
- **500 MB/mese** di log (gratis per sempre)
- Dopo i 500 MB: $0.15 per GB aggiuntivo

✅ **Retention**:
- **95 giorni** di retention standard (molto generoso!)
- I log più vecchi vengono automaticamente eliminati

✅ **Query**:
- Query illimitate incluse
- Nessun limite su numero di query

✅ **Dashboard e Alert**:
- Dashboard illimitate
- Alert configurabili

### **Calcolo Spazio per il Vostro Caso:**

**Esempio:**
- `centralized_logs`: ~50.000 record/mese
- `audit_logs`: ~10.000 record/mese
- Dimensione media log: ~500 bytes
- **Totale**: ~30 MB/mese

**Conclusione**: Il tier gratuito (500 MB/mese) è **più che sufficiente** per il vostro caso! 🎉

### **Monitoraggio Utilizzo:**

1. Vai su **"Settings"** → **"Usage"**
2. Vedi utilizzo mensile in tempo reale
3. Ricevi notifiche quando superi l'80% del limite

---

## 3. Configurazione Regione EU

### **⚠️ IMPORTANTE: Verifica Regione Account**

1. Vai su **"Settings"** → **"Organization"**
2. Controlla la **"Region"** (deve essere **EU**)
3. Se è **US**, contatta il supporto Axiom per cambiarla

### **Configurazione nel Codice:**

Il codice è già configurato per usare EU come default, ma verifichiamo:

#### **File: `.env`** (nella root del progetto)

```env
# ============================================
# AXIOM CONFIGURATION - REGIONE EU
# ============================================

# Abilita/disabilita invio log ad Axiom
AXIOM_ENABLED=true

# API Token Axiom (ottieni da: Settings -> API Tokens)
AXIOM_API_TOKEN=your-axiom-api-token-here

# Organization ID Axiom (ottieni da: Settings -> Organization)
AXIOM_ORG_ID=your-org-id-here

# Dataset Axiom (nome del dataset dove inviare i log)
AXIOM_DATASET=demosapp-logs

# ⚠️ REGIONE: 'eu' per Europa (GDPR compliant)
# Opzioni: 'eu' (Europa), 'us' (USA), 'us-fips' (USA FIPS)
AXIOM_REGION=eu

# ============================================
# GDPR - Anonimizzazione Dati
# ============================================

# Anonimizza IP address (solo rete, es. 192.168.1.0)
AXIOM_ANONYMIZE=true

# Hash user_id con SHA-256 (pseudonimizzazione)
AXIOM_ANONYMIZE_USER_ID=true

# Salt per hash (usa un valore casuale sicuro)
EXPORT_HASH_SALT=your-secure-random-salt-here
```

### **Verifica Regione nel Codice:**

Il codice è già configurato correttamente:

**File: `api/services/centralizedLogger.js`** (riga 15):
```javascript
region: process.env.AXIOM_REGION || 'eu'  // ✅ Default EU
```

**File: `scripts/axiom-logger.js`** (riga 27):
```javascript
region: process.env.AXIOM_REGION || 'eu',  // ✅ Default EU
```

**Conclusione**: Basta impostare `AXIOM_REGION=eu` nel `.env` e il codice userà automaticamente la regione EU! ✅

---

## 4. Installazione e Setup

### **Passo 4.1: Installa SDK Axiom**

```bash
# Dalla root del progetto
npm install @axiomhq/axiom-node
```

### **Passo 4.2: Configura File .env**

1. Crea/modifica il file `.env` nella root del progetto
2. Aggiungi le variabili come mostrato sopra
3. Sostituisci i valori placeholder con le tue credenziali reali

### **Passo 4.3: Verifica Configurazione**

```bash
# Verifica che tutto sia configurato correttamente
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

---

## 5. Caricamento Log

### **Metodo 1: Caricamento Automatico (Tempo Reale)**

I log vengono inviati automaticamente ad Axiom quando vengono creati.

**Come funziona:**

1. Quando viene chiamato `logger.error()`, `logger.warn()`, ecc., il log viene automaticamente inviato ad Axiom
2. Il codice è già presente in `centralizedLogger.js` (riga 120-168)
3. L'invio è **asincrono** e **non blocca** l'applicazione

**Verifica che funzioni:**

```bash
# Avvia l'applicazione
npm start

# In un'altra finestra, genera un log di test
# (es. fai una richiesta che genera un errore)
```

**Controlla su Axiom:**

1. Vai su **"Datasets"** → **"demosapp-logs"**
2. Dovresti vedere i log in tempo reale

### **Metodo 2: Sincronizzazione Log Storici**

Per caricare i log già presenti nel database:

#### **5.2.1: Sincronizza Ultimi N Giorni**

```bash
# Sincronizza ultimi 7 giorni
node scripts/axiom-logger.js sync 7

# Sincronizza ultimi 30 giorni
node scripts/axiom-logger.js sync 30

# Sincronizza ultimi 90 giorni (max retention Axiom)
node scripts/axiom-logger.js sync 90
```

**Output esempio:**
```
🔄 Sincronizzazione log a Axiom (ultimi 30 giorni)...

📊 Trovati 15.234 log da sincronizzare
✅ 1000 log inviati a Axiom
✅ 1000 log inviati a Axiom
...
✅ 15.234/15.234 log sincronizzati con Axiom
```

#### **5.2.2: Sincronizza Solo Log Nuovi**

```bash
# Sincronizza solo log delle ultime 24 ore
node scripts/axiom-logger.js sync-new
```

### **Metodo 3: Test Invio**

```bash
# Invia un log di test
node scripts/axiom-logger.js test
```

**Output atteso:**
```
✅ 1 log inviati a Axiom
```

### **Caricamento in Batch**

Il codice carica automaticamente i log in batch da 1000 per ottimizzare le performance:

- **Batch size**: 1000 log per richiesta
- **Pausa tra batch**: 100ms (per non sovraccaricare API)
- **Gestione errori**: Se un batch fallisce, continua con il successivo

---

## 6. Integrazione Audit Logs

Attualmente solo `centralized_logs` vengono inviati ad Axiom. Aggiungiamo anche `audit_logs`.

### **Passo 6.1: Modifica AuditService**

Aggiungiamo l'invio ad Axiom anche per gli audit logs.

**File: `api/services/auditService.js`**

Aggiungi all'inizio del file (dopo le import):

```javascript
// Axiom integration per audit logs
let Axiom;
let axiomAudit;
try {
  Axiom = require('@axiomhq/axiom-node');
  if (process.env.AXIOM_ENABLED === 'true' && process.env.AXIOM_API_TOKEN && process.env.AXIOM_ORG_ID) {
    axiomAudit = new Axiom({
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
      region: process.env.AXIOM_REGION || 'eu'
    });
  }
} catch (error) {
  axiomAudit = null;
}
```

Aggiungi un metodo per inviare audit logs ad Axiom:

```javascript
/**
 * Invia audit log ad Axiom
 */
static async sendAuditLogToAxiom(auditLog) {
  if (!axiomAudit || process.env.AXIOM_ENABLED !== 'true') return;

  try {
    const logEntry = {
      _time: new Date(auditLog.timestamp || Date.now()).toISOString(),
      type: 'audit',
      user_id: auditLog.user_id,
      action: auditLog.action,
      resource: auditLog.resource,
      resource_id: auditLog.resource_id,
      success: auditLog.success,
      ip_address: auditLog.ip_address,
      user_agent: auditLog.user_agent,
      error_message: auditLog.error_message
    };

    // Aggiungi details se presente
    if (auditLog.details) {
      if (typeof auditLog.details === 'string') {
        try {
          Object.assign(logEntry, JSON.parse(auditLog.details));
        } catch (e) {
          logEntry.details = auditLog.details;
        }
      } else {
        Object.assign(logEntry, auditLog.details);
      }
    }

    // Anonimizza se richiesto (GDPR)
    if (process.env.AXIOM_ANONYMIZE === 'true') {
      // Anonimizza IP (solo rete)
      if (logEntry.ip_address) {
        const parts = logEntry.ip_address.split('.');
        if (parts.length === 4) {
          logEntry.ip_address = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
        }
      }
      
      // Hash user_id se richiesto
      if (logEntry.user_id && process.env.AXIOM_ANONYMIZE_USER_ID === 'true') {
        const crypto = require('crypto');
        logEntry.user_id = crypto
          .createHash('sha256')
          .update(logEntry.user_id + (process.env.EXPORT_HASH_SALT || 'axiom-salt'))
          .digest('hex')
          .substring(0, 16);
      }
    }

    // Invia ad Axiom (non blocca se fallisce)
    const dataset = process.env.AXIOM_AUDIT_DATASET || process.env.AXIOM_DATASET || 'demosapp-logs';
    axiomAudit.datasets.ingest(dataset, [logEntry])
      .catch(err => {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Errore invio audit log Axiom:', err.message);
        }
      });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Errore preparazione audit log Axiom:', error);
    }
  }
}
```

Modifica il metodo `logAction` per inviare anche ad Axiom:

```javascript
static async logAction({
  userId,
  action,
  resource,
  resourceId = null,
  details = {},
  ipAddress = null,
  userAgent = null,
  success = true,
  errorMessage = null
}) {
  try {
    // ... codice esistente per INSERT nel database ...
    
    const result = await pool.query(query, values);
    
    console.log(`📝 Audit log creato: ${action} su ${resource} per utente ${userId}`);
    
    // ✅ NUOVO: Invia anche ad Axiom
    const auditLog = {
      user_id: userId,
      action: action,
      resource: resource,
      resource_id: resourceId,
      details: details,
      ip_address: ipAddress,
      user_agent: userAgent,
      success: success,
      error_message: errorMessage,
      timestamp: new Date(now)
    };
    
    // Invia ad Axiom in modo asincrono (non blocca)
    this.sendAuditLogToAxiom(auditLog).catch(() => {});
    
    return { id: result.rows[0].id, timestamp: new Date(now) };
  } catch (error) {
    console.error('❌ Errore nel logging audit:', error);
    return null;
  }
}
```

### **Passo 6.2: Sincronizza Audit Logs Storici**

Aggiungi una funzione nello script `axiom-logger.js` per sincronizzare audit logs:

```javascript
/**
 * Sincronizza audit logs dal database a Axiom
 */
async function syncAuditLogsToAxiom(days = 1) {
  if (!axiom) {
    console.error('❌ Axiom non configurato');
    return;
  }
  
  console.log(`🔄 Sincronizzazione audit logs a Axiom (ultimi ${days} giorni)...\n`);
  
  try {
    // Recupera audit logs degli ultimi N giorni
    const query = `
      SELECT 
        id,
        user_id,
        action,
        resource,
        resource_id,
        details,
        ip_address,
        user_agent,
        timestamp,
        success,
        error_message,
        created_at
      FROM audit_logs_decompressed
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
      ORDER BY timestamp DESC
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('✅ Nessun audit log da inviare');
      return;
    }
    
    console.log(`📊 Trovati ${result.rows.length} audit logs da sincronizzare`);
    
    // Converti in formato Axiom
    const logs = result.rows.map(row => {
      const log = {
        _time: new Date(row.timestamp || row.created_at).toISOString(),
        type: 'audit',
        user_id: row.user_id,
        action: row.action,
        resource: row.resource,
        resource_id: row.resource_id,
        success: row.success,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        error_message: row.error_message
      };
      
      // Aggiungi details se presente
      if (row.details) {
        if (typeof row.details === 'string') {
          try {
            Object.assign(log, JSON.parse(row.details));
          } catch (e) {
            log.details = row.details;
          }
        } else {
          Object.assign(log, row.details);
        }
      }
      
      return log;
    });
    
    // Invia in batch da 1000
    const batchSize = 1000;
    let sent = 0;
    
    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize);
      const success = await sendLogsToAxiom(batch);
      
      if (success) {
        sent += batch.length;
      }
      
      if (i + batchSize < logs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n✅ ${sent}/${logs.length} audit logs sincronizzati con Axiom`);
    
  } catch (error) {
    console.error('❌ Errore sincronizzazione audit logs:', error);
    throw error;
  }
}
```

Aggiungi il comando nel main:

```javascript
case 'sync-audit':
  const auditDays = parseInt(process.argv[3]) || 1;
  await syncAuditLogsToAxiom(auditDays);
  break;
```

**Uso:**
```bash
# Sincronizza audit logs ultimi 30 giorni
node scripts/axiom-logger.js sync-audit 30
```

---

## 7. Verifica e Monitoraggio

### **7.1: Verifica Log su Axiom**

1. Vai su **"Datasets"** → **"demosapp-logs"**
2. Dovresti vedere i log in tempo reale
3. Usa la barra di ricerca per filtrare:
   - `level == "ERROR"` - Solo errori
   - `type == "audit"` - Solo audit logs
   - `user_id == "abc123"` - Log per utente specifico

### **7.2: Query Esempi**

**Errori ultime 24 ore:**
```
['demosapp-logs'] 
| where level == "ERROR" 
| where _time > ago(24h)
| summarize count() by bin(_time, 1h)
```

**Audit logs per utente:**
```
['demosapp-logs']
| where type == "audit"
| where user_id == "user123"
| order by _time desc
```

**Errori per endpoint:**
```
['demosapp-logs']
| where level == "ERROR"
| summarize count() by endpoint
| order by count_ desc
```

### **7.3: Dashboard**

1. Vai su **"Dashboards"** → **"Create Dashboard"**
2. Aggiungi pannelli con query
3. Salva e condividi con il team

### **7.4: Alert**

1. Vai su **"Alerts"** → **"Create Alert"**
2. Configura query (es. errori > 10 in 5 minuti)
3. Aggiungi notifiche (email, Slack, ecc.)

---

## 📋 Checklist Finale

- [ ] Account Axiom creato con regione **EU**
- [ ] Dataset `demosapp-logs` creato
- [ ] API Token creato e copiato
- [ ] Organization ID copiato
- [ ] SDK installato: `npm install @axiomhq/axiom-node`
- [ ] File `.env` configurato con `AXIOM_REGION=eu`
- [ ] Test configurazione: `node scripts/axiom-logger.js check`
- [ ] Test invio: `node scripts/axiom-logger.js test`
- [ ] Sincronizzazione log storici: `node scripts/axiom-logger.js sync 30`
- [ ] Sincronizzazione audit logs: `node scripts/axiom-logger.js sync-audit 30`
- [ ] Verifica log su Axiom dashboard
- [ ] Configurazione alert (opzionale)

---

## 🆘 Risoluzione Problemi

### **Errore: "Axiom SDK non installato"**
```bash
npm install @axiomhq/axiom-node
```

### **Errore: "Invalid token"**
- Verifica che il token sia corretto nel `.env`
- Controlla che il token abbia permessi "Ingest" e "Query"

### **Errore: "Region mismatch"**
- Verifica che `AXIOM_REGION=eu` nel `.env`
- Controlla che l'account Axiom sia nella regione EU

### **Log non appaiono su Axiom**
- Verifica che `AXIOM_ENABLED=true` nel `.env`
- Controlla i log del server per errori
- Esegui `node scripts/axiom-logger.js check` per verificare configurazione

---

## 📞 Supporto

- **Documentazione Axiom**: https://axiom.co/docs
- **API Reference**: https://axiom.co/docs/api
- **Community**: https://github.com/axiomhq

---

**🎉 Configurazione completata! I log vengono ora inviati ad Axiom con regione EU!**



