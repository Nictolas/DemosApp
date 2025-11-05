# 🚀 Guida Setup Axiom per Analisi Log

## 📋 Cos'è Axiom?

**Axiom** è un servizio cloud specifico per log con:
- ✅ **Ricerca avanzata** su milioni di log
- ✅ **Dashboard** per visualizzazione
- ✅ **Alert** automatici
- ✅ **Query language** potente
- ✅ **API** per integrazione

---

## 💰 Tier Gratuito Axiom

### **Specifiche Tier Gratuito:**
- ✅ **500GB/mese** di log
- ✅ **30 giorni** retention
- ✅ **Query illimitate**
- ✅ **Dashboard** illimitate
- ✅ **Alert** illimitati
- ✅ **API** accesso completo
- ✅ **Regioni EU** disponibili (GDPR compliant)

### **Con la Tua Crescita Attuale:**
- Crescita: ~90MB/mese
- Tier gratuito: 500GB/mese
- **Copertura**: ~5.555 mesi = **~462 anni** gratis! ✅

---

## 🎯 Perché Axiom per il Tuo Caso?

### **✅ Vantaggi:**
1. ✅ **Analisi in tempo reale**: Dashboard per vedere subito problemi
2. ✅ **Ricerca avanzata**: Query complesse sui log
3. ✅ **Alert automatici**: Notifiche su errori critici
4. ✅ **30 giorni retention**: Perfetto per analisi recenti
5. ✅ **Gratis per sempre**: Con la tua crescita attuale

### **⚠️ Limitazioni:**
- ⚠️ **Retention 30 giorni**: Solo per analisi recenti
- ⚠️ **Limite mensile**: 500GB/mese (ma sufficiente per anni)

---

## 🚀 Setup Axiom

### **Fase 1: Registrazione**

1. **Crea account**: https://axiom.co/
2. **Scegli regione**: EU (per GDPR)
3. **Verifica email**: Non richiede carta di credito

### **Fase 2: Crea Dataset**

1. **Dashboard** → **Datasets** → **New Dataset**
2. **Nome**: `demosapp-logs`
3. **Regione**: EU

### **Fase 3: Ottieni API Token**

1. **Settings** → **API Tokens** → **Create Token**
2. **Nome**: `demosapp-backup`
3. **Permessi**: `Ingest` e `Query`
4. **Copia token**: Salva in `.env`

---

## 🔧 Integrazione nel Progetto

### **Installazione Dipendenze**

```bash
npm install @axiomhq/axiom-node
```

### **Configurazione `.env`**

```env
# Axiom Configuration
AXIOM_API_TOKEN=your-axiom-api-token
AXIOM_DATASET=demosapp-logs
AXIOM_ORG_ID=your-org-id
AXIOM_REGION=eu
```

### **Script di Invio Log**

Crea `scripts/axiom-logger.js`:

```javascript
const { Axiom } = require('@axiomhq/axiom-node');
require('dotenv').config();

const axiom = new Axiom({
  token: process.env.AXIOM_API_TOKEN,
  orgId: process.env.AXIOM_ORG_ID,
  region: process.env.AXIOM_REGION || 'eu'
});

/**
 * Invia log a Axiom
 */
async function sendLogsToAxiom(logs) {
  try {
    const dataset = process.env.AXIOM_DATASET || 'demosapp-logs';
    
    // Invia log in batch
    await axiom.datasets.ingest(dataset, logs);
    
    console.log(`✅ ${logs.length} log inviati a Axiom`);
    return true;
  } catch (error) {
    console.error('❌ Errore invio log Axiom:', error);
    return false;
  }
}

/**
 * Invia log dal database a Axiom
 */
async function syncLogsToAxiom(days = 1) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Recupera log degli ultimi N giorni
    const query = `
      SELECT 
        id,
        timestamp,
        level,
        message,
        user_id,
        ip_address,
        endpoint,
        meta_data
      FROM centralized_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('✅ Nessun log da inviare');
      return;
    }
    
    // Converti in formato Axiom
    const logs = result.rows.map(row => ({
      _time: new Date(row.timestamp).toISOString(),
      level: row.level,
      message: row.message,
      user_id: row.user_id,
      ip_address: row.ip_address,
      endpoint: row.endpoint,
      ...(row.meta_data && typeof row.meta_data === 'object' ? row.meta_data : {})
    }));
    
    // Invia in batch da 1000
    const batchSize = 1000;
    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize);
      await sendLogsToAxiom(batch);
    }
    
    console.log(`✅ ${logs.length} log sincronizzati con Axiom`);
    
  } catch (error) {
    console.error('❌ Errore sincronizzazione Axiom:', error);
  } finally {
    await pool.end();
  }
}

module.exports = {
  sendLogsToAxiom,
  syncLogsToAxiom
};

// Esegui se chiamato direttamente
if (require.main === module) {
  const days = parseInt(process.argv[2]) || 1;
  syncLogsToAxiom(days).catch(console.error);
}
```

### **Integrazione Automatica**

Modifica `api/services/centralizedLogger.js` per inviare anche ad Axiom:

```javascript
// Aggiungi all'inizio
const { sendLogsToAxiom } = require('../../scripts/axiom-logger');

// Modifica metodo writeToDatabase
async writeToDatabase(level, message, meta = {}) {
  // ... codice esistente ...
  
  // Invia anche ad Axiom (opzionale, solo per ERROR/WARN)
  if (process.env.AXIOM_ENABLED === 'true' && (level === 'ERROR' || level === 'WARN')) {
    sendLogsToAxiom([{
      _time: new Date().toISOString(),
      level,
      message,
      ...meta
    }]).catch(err => console.error('Axiom error:', err));
  }
}
```

---

## 📊 Query Axiom

### **Query Esempi**

```javascript
// Query errori ultime 24 ore
const errors = await axiom.query(`['demosapp-logs'] 
  | where level == 'ERROR' 
  | where _time > ago(24h)
  | summarize count() by bin(_time, 1h)
`);

// Query errori per utente
const userErrors = await axiom.query(`['demosapp-logs']
  | where level == 'ERROR'
  | where user_id != null
  | summarize count() by user_id
  | order by count_ desc
  | take 10
`);

// Query errori per endpoint
const endpointErrors = await axiom.query(`['demosapp-logs']
  | where level == 'ERROR'
  | where endpoint != null
  | summarize count() by endpoint
  | order by count_ desc
`);
```

---

## 🔄 Workflow Completo

### **Flusso Log:**

```
┌─────────────────┐
│  Database Neon  │
│  (30 giorni)    │
└────────┬────────┘
         │
         ├─────────────┬─────────────┬─────────────┐
         ▼             ▼             ▼             ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
    │  Axiom  │  │ Backblaze│  │ Hard    │  │ Backup  │
    │ (30d)   │  │ B2 (7y) │  │ Disk    │  │ Locale  │
    │ Analisi │  │ Backup  │  │ Archive │  │         │
    └─────────┘  └─────────┘  └─────────┘  └─────────┘
```

### **Sincronizzazione Automatica**

Crea cron job per sincronizzare giornalmente:

**Windows - Task Scheduler:**
```powershell
schtasks /create /tn "Sync Logs Axiom" /tr "node C:\path\to\scripts\axiom-logger.js 1" /sc daily /st 03:00
```

**Linux/Mac - Cron:**
```bash
# Aggiungi a crontab
0 3 * * * cd /path/to/demosapp && node scripts/axiom-logger.js 1
```

---

## 📈 Dashboard Axiom

### **Dashboard Consigliate:**

1. **Error Dashboard**
   - Errori per ora/giorno
   - Errori per endpoint
   - Errori per utente

2. **Security Dashboard**
   - Tentativi di accesso falliti
   - IP sospetti
   - Attività anomale

3. **Performance Dashboard**
   - Tempo di risposta endpoint
   - Query lente
   - Utilizzo risorse

---

## 🔔 Alert Axiom

### **Alert Consigliati:**

1. **Error Spike**
   - Alert se > 10 errori in 5 minuti
   - Email/Slack notification

2. **Security Alert**
   - Alert su tentativi di accesso multipli
   - Alert su IP sospetti

3. **Performance Alert**
   - Alert su endpoint lenti (> 2s)
   - Alert su errori database

---

## 💰 Costi

### **Tier Gratuito:**
- ✅ **500GB/mese**: Gratis
- ✅ **30 giorni retention**: Gratis
- ✅ **Query illimitate**: Gratis
- ✅ **Dashboard illimitate**: Gratis

### **Con la Tua Crescita:**
- Crescita: ~90MB/mese
- Tier gratuito: 500GB/mese
- **Costo**: **$0/mese per sempre** ✅

### **Dopo Tier Gratuito (se superi 500GB/mese):**
- $0.10/GB/mese oltre limite
- Con 600GB/mese = $10/mese

---

## ⚖️ GDPR Compliance

### **✅ Conformità:**
- ✅ **Regione EU**: Axiom ha regioni EU
- ✅ **Crittografia**: Dati crittografati in transito e a riposo
- ✅ **Anonimizzazione**: Puoi anonimizzare prima dell'invio
- ✅ **Diritto alla cancellazione**: API per eliminare dati

### **Configurazione GDPR:**

```javascript
// Anonimizza prima dell'invio
const { anonymizeRecord } = require('./gdpr-utils');

const logs = result.rows.map(row => {
  const anonymized = anonymizeRecord(row, 'centralized_logs');
  return {
    _time: new Date(anonymized.timestamp).toISOString(),
    level: anonymized.level,
    message: anonymized.message,
    // IP già anonimizzato (solo rete)
    ip_address: anonymized.ip_address,
    // User ID già hashato
    user_id: anonymized.user_id
  };
});
```

---

## 🚀 Prossimi Passi

1. ✅ **Crea account Axiom**: https://axiom.co/
2. ✅ **Installa dipendenze**: `npm install @axiomhq/axiom-node`
3. ✅ **Configura `.env`**: Aggiungi token e dataset
4. ✅ **Test invio**: `node scripts/axiom-logger.js 1`
5. ✅ **Crea dashboard**: Configura dashboard in Axiom
6. ✅ **Configura alert**: Imposta alert automatici
7. ✅ **Automatizza sync**: Configura cron job

---

## 📞 Supporto

- **Documentazione**: https://axiom.co/docs
- **API Reference**: https://axiom.co/docs/api
- **Community**: https://github.com/axiomhq

---

**🎉 Axiom ti permette di analizzare i log in tempo reale con dashboard e query avanzate, tutto gratis!**

