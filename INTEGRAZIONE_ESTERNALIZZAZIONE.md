# 🔧 Integrazione Esternalizzazione Log con GDPR

Questa guida spiega come integrare le funzionalità GDPR nello script di export esistente.

## 📋 File Creati

1. **`scripts/gdpr-utils.js`** - Utilità per anonimizzazione e crittografia GDPR
2. **`scripts/cloud-backup-export.js`** - Script per backup su cloud storage
3. **`export-cloud-config.example.env`** - Configurazione cloud storage
4. **`ESTERNALIZZAZIONE_LOG_GDPR.md`** - Documentazione completa

## 🚀 Passi di Integrazione

### **Fase 1: Aggiorna lo Script di Export**

Modifica `scripts/hard-disk-export.js` per integrare l'anonimizzazione GDPR:

```javascript
// Aggiungi all'inizio del file
const { anonymizeRecords, encryptBuffer } = require('./gdpr-utils');

// Modifica la funzione exportTableToCSV
async function exportTableToCSV(tableName, config, outputPath) {
  console.log(`📊 Esportazione ${tableName}...`);
  
  // ... codice esistente ...
  
  // Dopo aver recuperato i dati dal database:
  const result = await pool.query(query);
  
  // ANONIMIZZA I DATI (NUOVO)
  const anonymizedRows = anonymizeRecords(result.rows, tableName);
  
  // Converte in CSV (usa anonymizedRows invece di result.rows)
  const csvContent = await convertToCSV(anonymizedRows);
  
  // ... resto del codice ...
  
  // CRITTOGRAFA SE ABILITATO (NUOVO)
  if (process.env.EXPORT_ENCRYPTION_ENABLED === 'true' && process.env.EXPORT_ENCRYPTION_KEY) {
    const encrypted = encryptBuffer(Buffer.from(finalContent), process.env.EXPORT_ENCRYPTION_KEY);
    await fs.writeFile(path.join(outputPath, finalFilename + '.encrypted'), encrypted);
    console.log(`   🔒 File crittografato: ${finalFilename}.encrypted`);
  }
}
```

### **Fase 2: Configurazione Ambiente**

1. **Genera chiavi di crittografia:**

```bash
# Genera chiave crittografia
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Genera salt per hash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

2. **Aggiungi al `.env`:**

```env
# GDPR Configuration
EXPORT_ENCRYPTION_KEY=generated-key-here
EXPORT_HASH_SALT=generated-salt-here
EXPORT_ANONYMIZE_ENABLED=true
EXPORT_ENCRYPTION_ENABLED=true
```

### **Fase 3: Test Export con GDPR**

```bash
# Test dry-run
node scripts/hard-disk-export.js dry-run

# Export con anonimizzazione
node scripts/hard-disk-export.js export

# Verifica file esportati
ls -lh /mnt/external-drive/archivio/2024/
```

### **Fase 4: Configura Backup Cloud (Opzionale)**

1. **Scegli provider** (es. AWS S3 per tier gratuito)

2. **Configura credenziali:**

```bash
# Per AWS S3
aws configure
# Inserisci: Access Key ID, Secret Access Key, Region (eu-west-1)

# Aggiungi al .env
CLOUD_STORAGE_PROVIDER=s3
AWS_S3_BUCKET=demosapp-log-archive
AWS_S3_REGION=eu-west-1
```

3. **Test backup:**

```bash
# Backup completo
node scripts/cloud-backup-export.js full

# Backup solo file nuovi
node scripts/cloud-backup-export.js new 7
```

### **Fase 5: Automazione Completa**

Crea script di automazione `scripts/automated-export.js`:

```javascript
const { exportToHardDisk } = require('./hard-disk-export');
const { backupNewFiles } = require('./cloud-backup-export');

async function automatedExport() {
  console.log('🚀 Avvio export automatico...\n');
  
  // 1. Export su hard disk
  const result = await exportToHardDisk({
    deleteAfterExport: true,
    tables: ['audit_logs', 'centralized_logs']
  });
  
  console.log(`\n✅ Export completato: ${result.totalExported} record`);
  
  // 2. Backup su cloud (opzionale)
  if (process.env.CLOUD_BACKUP_ENABLED === 'true') {
    console.log('\n☁️ Avvio backup cloud...');
    await backupNewFiles(process.env.EXPORT_DIR, 7);
  }
  
  console.log('\n🎉 Processo completato!');
}

automatedExport().catch(console.error);
```

## 📊 Schema di Funzionamento

```
┌─────────────────┐
│  Database Neon  │
│  (30 giorni)    │
└────────┬────────┘
         │
         │ Export automatico
         ▼
┌─────────────────┐
│  Anonimizzazione│ ← GDPR Utils
│  + Crittografia │
└────────┬────────┘
         │
         ├─────────────┬─────────────┐
         ▼             ▼             ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐
    │ Hard    │  │ Cloud   │  │ Backup  │
    │ Disk    │  │ Storage │  │ Locale  │
    │ Esterno │  │ (S3/B2) │  │         │
    └─────────┘  └─────────┘  └─────────┘
```

## 🔒 Sicurezza GDPR

### **Dati Anonimizzati:**

- ✅ **IP Address**: Solo rete (192.168.1.0)
- ✅ **User ID**: Hash SHA-256
- ✅ **Session ID**: Hash SHA-256
- ✅ **Email**: Rimossa dai messaggi
- ✅ **Telefoni**: Rimossi dai messaggi

### **File Crittografati:**

- ✅ **Algoritmo**: AES-256-GCM
- ✅ **Key Derivation**: PBKDF2 (100,000 iterazioni)
- ✅ **Salt**: Random per ogni file

### **Audit Trail:**

Tutti gli export vengono registrati in `index.json` con:
- Data/ora export
- Record esportati
- File creati
- Hash dei file (per integrità)

## 🧪 Test Completo

```bash
# 1. Test export senza modifiche
node scripts/hard-disk-export.js dry-run

# 2. Test export con anonimizzazione
EXPORT_ANONYMIZE_ENABLED=true node scripts/hard-disk-export.js export

# 3. Verifica file esportati
ls -lh /mnt/external-drive/archivio/2024/01-gennaio/

# 4. Test decrittografia (se abilitata)
node -e "
  const { decryptBuffer } = require('./scripts/gdpr-utils');
  const fs = require('fs');
  const encrypted = fs.readFileSync('file.encrypted');
  const decrypted = decryptBuffer(encrypted, process.env.EXPORT_ENCRYPTION_KEY);
  console.log(decrypted.toString());
"

# 5. Test backup cloud
node scripts/cloud-backup-export.js new 1
```

## ⚠️ Note Importanti

1. **Chiavi di Crittografia:**
   - Conserva in luogo sicuro (password manager)
   - Non committare nel repository
   - Backup separato delle chiavi

2. **Hard Disk:**
   - Backup periodico del disco
   - Considera RAID per ridondanza
   - Verifica integrità periodica

3. **Cloud Storage:**
   - Usa regioni UE per GDPR
   - Abilita versioning per backup
   - Configura lifecycle policies

4. **Retention:**
   - Database: 30 giorni (dati recenti)
   - Archivio: 1-2 anni (audit)
   - Eliminazione automatica dopo scadenza

## 📞 Supporto

Per problemi:
1. Verifica configurazione: `cat .env | grep EXPORT`
2. Controlla log: `tail -f logs/export.log`
3. Testa componenti singolarmente
4. Verifica permessi directory

---

**🎉 Sistema completo per esternalizzazione log con conformità GDPR!**

